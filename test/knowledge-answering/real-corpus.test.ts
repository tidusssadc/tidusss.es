import { test } from 'node:test';
import assert from 'node:assert/strict';
import { knowledgeDocuments } from '../../src/domain/knowledge-index/registry.ts';
import { createLocalProvider, createVectorSpaceProvider } from '../../src/domain/knowledge-retrieval/index.ts';
import { evaluationCases } from '../../src/domain/knowledge-retrieval/evaluation/cases.ts';
import { assembleAnswer } from '../../src/domain/knowledge-answering/assemble.ts';
import { validateAnswers, findAnswersWithUnsupportedText } from '../../src/domain/knowledge-answering/invariants.ts';
import { answerEvaluationCases, runAnswerEvaluation } from '../../src/domain/knowledge-answering/evaluation/index.ts';

const local = createLocalProvider(knowledgeDocuments);
const vector = createVectorSpaceProvider(knowledgeDocuments);

test('Navori: la respuesta cita el objeto real y hereda su confianza editorial media, sin inflarla', () => {
  const answer = assembleAnswer(local.retrieve({ text: '¿Cuándo me hago Navori?', limit: 10 }));
  assert.equal(answer.status, 'sufficient');
  assert.match(answer.answer ?? '', /Navori/);
  assert.equal(answer.editorialConfidence, 'medium');
  assert.ok(answer.sources.some((s) => s.documentId === 'knowledge:build:lucian-26-14-personal:item:core:1'));
});

test('Filo Infinito vs. Navori: ambos objetos se citan, ninguno se descarta por su confianza editorial', () => {
  const answer = assembleAnswer(local.retrieve({ text: '¿Es mejor Filo Infinito o Navori?', limit: 10 }));
  const ids = answer.sources.map((s) => s.documentId);
  assert.ok(ids.includes('knowledge:build:lucian-26-14-solid:item:core:1'));
  assert.ok(ids.includes('knowledge:build:lucian-26-14-personal:item:core:1'));
});

test('Ataque Intensificado: la respuesta cita la runa real con confianza alta', () => {
  const answer = assembleAnswer(local.retrieve({ text: '¿Qué runa usa Tidusss con Lucian?', limit: 10 }));
  assert.match(answer.answer ?? '', /Ataque Intensificado/);
  assert.equal(answer.editorialConfidence, 'high');
});

test('Draven: información insuficiente, nunca un matchup inventado en la respuesta', () => {
  const answer = assembleAnswer(local.retrieve({ text: '¿Cómo juego Lucian contra Draven?' }));
  assert.equal(answer.status, 'insufficient-information');
  assert.equal(answer.answer, undefined);
  assert.equal(answer.sources.length, 0);
});

test('Jinx: no tiene build propia, pero responde con su entrada real de la Tier List — nunca contenido de Lucian filtrado como si fuera de Jinx', () => {
  const answer = assembleAnswer(local.retrieve({ text: '¿Cuál es la build de Jinx?' }));
  assert.equal(answer.status, 'sufficient');
  assert.equal(answer.sources.length, 1);
  assert.equal(answer.sources[0]?.documentId, 'knowledge:tier-list:official-adc:entry:champion:jinx');
  assert.ok(!answer.sources.some((source) => source.documentId.includes('lucian')));
});

test('Jhin: la build de referencia (parche 26.17) ya existe como documento real — Pregunta puede citarla sin que nadie haya forzado una excepción para él', () => {
  const answer = assembleAnswer(local.retrieve({ text: '¿Cuál es la build de Jhin?', limit: 10 }));
  assert.equal(answer.status, 'sufficient');
  assert.match(answer.answer ?? '', /Filo Infinito/);
  assert.ok(answer.sources.some((source) => source.documentId.includes('jhin-26-17')));
  // Nunca contenido de Lucian filtrado como si fuera de Jhin.
  assert.ok(!answer.sources.some((source) => source.documentId.includes('lucian')));
});

test('el Mundial: fuera de alcance, se rechaza sin intentar responder', () => {
  const answer = assembleAnswer(local.retrieve({ text: '¿Quién ganó el Mundial?' }));
  assert.equal(answer.status, 'out-of-scope');
  assert.equal(answer.answer, undefined);
});

test('pregunta vacía: se rechaza antes de intentar nada', () => {
  const answer = assembleAnswer(local.retrieve({ text: '' }));
  assert.equal(answer.status, 'empty-question');
});

test('pregunta ambigua ("ayuda"): se rechaza como fuera de alcance', () => {
  const answer = assembleAnswer(local.retrieve({ text: 'ayuda' }));
  assert.equal(answer.status, 'out-of-scope');
});

// --- Invariantes contra el conjunto de evaluación de respuestas real ---

test('el conjunto de evaluación de respuestas real no viola ninguna invariante (validateAnswers)', () => {
  const answers = answerEvaluationCases.map((c) => assembleAnswer(local.retrieve({ text: c.question, limit: 10 })));
  assert.deepEqual(validateAnswers(answers), []);
});

test('ninguna respuesta real, sobre TODO el conjunto de evaluación de recuperación, contiene una afirmación no respaldada por sus fuentes', () => {
  const answers = evaluationCases.map((c) => assembleAnswer(local.retrieve({ text: c.question, limit: 10 })));
  assert.deepEqual(findAnswersWithUnsupportedText(answers), []);
});

test('lo mismo se cumple usando el experimento de espacio vectorial como proveedor', () => {
  const answers = evaluationCases.map((c) => assembleAnswer(vector.retrieve({ text: c.question, limit: 10 })));
  assert.deepEqual(validateAnswers(answers), []);
});

// --- Ejecución completa del runner de evaluación de respuestas (Fase 7) ---

test('el runner de evaluación de respuestas se ejecuta sin lanzar excepciones y reporta 0 fuentes prohibidas/mezclas de parche', () => {
  const summary = runAnswerEvaluation(local, answerEvaluationCases);
  assert.equal(summary.caseCount, answerEvaluationCases.length);
  assert.equal(summary.forbiddenSourceHitCount, 0);
  assert.equal(summary.patchMixingViolationCount, 0);
  assert.equal(summary.unsupportedTextCount, 0);
});

test('el runner de evaluación de respuestas acierta el 100% de los estados esperados sobre el conjunto real', () => {
  const summary = runAnswerEvaluation(local, answerEvaluationCases);
  assert.equal(summary.correctStatusCount, summary.caseCount);
});
