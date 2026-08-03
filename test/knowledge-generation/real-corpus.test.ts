import { test } from 'node:test';
import assert from 'node:assert/strict';
import { knowledgeDocuments } from '../../src/domain/knowledge-index/registry.ts';
import { createLocalProvider } from '../../src/domain/knowledge-retrieval/local-provider.ts';
import { assembleAnswer } from '../../src/domain/knowledge-answering/assemble.ts';
import { validateAnswers } from '../../src/domain/knowledge-answering/invariants.ts';
import { createLocalDeterministicGenerator } from '../../src/domain/knowledge-generation/local-generator.ts';
import { generateAnswer, resolveDisplayText } from '../../src/domain/knowledge-generation/orchestrate.ts';
import { validateGenerationResult } from '../../src/domain/knowledge-generation/validate.ts';
import {
  createConfidenceInflationFakeGenerator,
  createDropsAllSourcesFakeGenerator,
} from '../../src/domain/knowledge-generation/evaluation/fakes.ts';
import {
  generationEvaluationCases,
  runGenerationEvaluation,
} from '../../src/domain/knowledge-generation/evaluation/index.ts';

const local = createLocalProvider(knowledgeDocuments);

test('extremo a extremo: recuperación real -> motor de respuesta real -> generación (determinista) sin tocar el estado ni las fuentes', async () => {
  const answer = assembleAnswer(local.retrieve({ text: '¿Cuándo me hago Navori?', limit: 10 }));
  const generation = await generateAnswer(answer, createLocalDeterministicGenerator());
  assert.equal(generation.status, 'generated');
  assert.equal(generation.text, answer.answer);
  assert.deepEqual(generation.usedSourceIds, answer.sources.map((s) => s.documentId));
});

test('Draven: nunca se invoca ningún generador y la respuesta final sigue siendo información insuficiente', async () => {
  const answer = assembleAnswer(local.retrieve({ text: '¿Cómo juego Lucian contra Draven?' }));
  const generation = await generateAnswer(answer, createLocalDeterministicGenerator());
  assert.equal(answer.status, 'insufficient-information');
  assert.equal(generation.status, 'not-applicable');
  assert.equal(resolveDisplayText(answer, generation), undefined);
});

test('un intento real de "quitar las fuentes" sobre una pregunta real en alcance cae al determinista', async () => {
  const answer = assembleAnswer(local.retrieve({ text: '¿Qué runa usa Tidusss con Lucian?', limit: 10 }));
  const generation = await generateAnswer(answer, createDropsAllSourcesFakeGenerator());
  assert.equal(generation.status, 'fallback');
  assert.equal(resolveDisplayText(answer, generation), answer.answer);
});

test('un intento real de inflar la confianza sobre una pregunta real en alcance cae al determinista', async () => {
  const answer = assembleAnswer(local.retrieve({ text: '¿Cuándo me hago Navori?', limit: 10 }));
  assert.notEqual(answer.editorialConfidence, 'high');
  const generation = await generateAnswer(answer, createConfidenceInflationFakeGenerator());
  assert.equal(generation.status, 'fallback');
});

test('la validación de salida real nunca marca como inválido al generador determinista sobre ninguna pregunta del corpus', async () => {
  for (const text of ['¿Cuándo me hago Navori?', '¿Qué runa usa Tidusss con Lucian?', '¿Por qué Lucian sufre en late?']) {
    const answer = assembleAnswer(local.retrieve({ text, limit: 10 }));
    if (answer.status !== 'sufficient' && answer.status !== 'partial') continue;
    const generator = createLocalDeterministicGenerator();
    const input = {
      query: answer.query,
      deterministicAnswer: answer.answer!,
      status: answer.status,
      editorialConfidence: answer.editorialConfidence,
      retrievalConfidence: answer.retrievalConfidence,
      coverage: answer.coverage,
      allowedDocumentIds: answer.sources.map((s) => s.documentId),
      sources: answer.sources,
      patchId: answer.patchId,
      editorialDate: answer.editorialDate,
      toneInstructions: 'tono',
    };
    const result = await generator.generate(input);
    const validation = validateGenerationResult(result, input);
    assert.equal(validation.valid, true, `debería ser válido para: ${text}`);
  }
});

test('el conjunto de evaluación de respuestas real sigue siendo válido después de pasar por el generador determinista', async () => {
  const answers = ['¿Cuándo me hago Navori?', '¿Qué runa usa Tidusss con Lucian?'].map((text) =>
    assembleAnswer(local.retrieve({ text, limit: 10 })),
  );
  assert.deepEqual(validateAnswers(answers), []);
});

test('el runner de evaluación del generador se ejecuta sin lanzar excepciones y acierta el 100% sobre el conjunto real', async () => {
  const summary = await runGenerationEvaluation(local, generationEvaluationCases);
  assert.equal(summary.caseCount, generationEvaluationCases.length);
  assert.equal(summary.correctStatusCount, summary.caseCount);
  assert.equal(summary.correctDisplayTextCount, summary.caseCount);
});
