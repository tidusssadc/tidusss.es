/**
 * Comando reproducible de evaluación de RESPUESTAS (Fase 7 del encargo):
 *
 *   npm run eval:answering
 *
 * Ejecuta el conjunto de evaluación de respuestas
 * (`domain/knowledge-answering/evaluation/cases.ts`) contra el motor de
 * respuesta determinista (`assembleAnswer`), usando el recuperador local
 * por términos como proveedor real. No modifica nada, no escribe a disco,
 * no requiere red ni credenciales, no usa ningún LLM.
 */
import { knowledgeDocuments } from '../../src/domain/knowledge-index/registry.ts';
import { createLocalProvider } from '../../src/domain/knowledge-retrieval/index.ts';
import {
  answerEvaluationCases,
  runAnswerEvaluation,
} from '../../src/domain/knowledge-answering/index.ts';
import type { AnswerEvaluationSummary } from '../../src/domain/knowledge-answering/index.ts';

const pct = (numerator: number, denominator: number): string =>
  denominator === 0 ? 'n/a' : `${Math.round((numerator / denominator) * 100)}%`;

const printSummary = (summary: AnswerEvaluationSummary): void => {
  console.log(`\n=== Motor de respuesta — ${summary.providerName} ===`);
  console.log(`Estado correcto (global):      ${pct(summary.correctStatusCount, summary.caseCount)}`);
  console.log(
    `Respuestas suficientes correctas: ${pct(summary.correctSufficientCount, summary.sufficientCaseCount)} (${summary.correctSufficientCount}/${summary.sufficientCaseCount})`,
  );
  console.log(
    `Respuestas parciales correctas:    ${pct(summary.correctPartialCount, summary.partialCaseCount)} (${summary.correctPartialCount}/${summary.partialCaseCount})`,
  );
  console.log(
    `Rechazos correctos (insuf./f.alcance/vacía): ${pct(summary.correctRejectionCount, summary.rejectionCaseCount)} (${summary.correctRejectionCount}/${summary.rejectionCaseCount})`,
  );
  console.log(
    `Citas válidas (mínimas presentes, prohibidas ausentes): ${pct(summary.validCitationCount, summary.totalCitationChecks)}`,
  );
  console.log(`Documentos prohibidos usados: ${summary.forbiddenSourceHitCount}`);
  console.log(`Mezcla incorrecta de parches: ${summary.patchMixingViolationCount}`);
  console.log(`Afirmaciones sin fuente:      ${summary.unsupportedTextCount}`);
  console.log('');
  for (const evaluation of summary.cases) {
    const status = evaluation.statusMatch ? 'OK' : 'DESVIA';
    const coverage = evaluation.coverageMatch ? 'OK' : 'DESVIA';
    const confidence = evaluation.editorialConfidenceMatch ? 'OK' : 'DESVIA';
    console.log(
      `  [${evaluation.caseId}] estado(${status})=${evaluation.actualStatus} cobertura(${coverage}) confianza(${confidence})`,
    );
    if (evaluation.missingRequiredSources.length > 0) {
      console.log(`    Faltan fuentes mínimas: ${evaluation.missingRequiredSources.join(', ')}`);
    }
    if (evaluation.forbiddenSourceHits.length > 0) {
      console.log(`    ¡FUENTES PROHIBIDAS USADAS!: ${evaluation.forbiddenSourceHits.join(', ')}`);
    }
    if (evaluation.hasUnsupportedText) {
      console.log('    ¡TEXTO NO RESPALDADO POR LAS FUENTES!');
    }
  }
};

const localProvider = createLocalProvider(knowledgeDocuments);

console.log(`Índice de Conocimiento real: ${knowledgeDocuments.length} documentos.`);
console.log(`Conjunto de evaluación de respuestas: ${answerEvaluationCases.length} preguntas.`);

const summary = runAnswerEvaluation(localProvider, answerEvaluationCases);
printSummary(summary);
