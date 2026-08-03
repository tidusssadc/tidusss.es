/**
 * Comando reproducible de evaluación del motor de GENERACIÓN (Fase 7 del
 * encargo):
 *
 *   npm run eval:generation
 *
 * Ejecuta el conjunto de evaluación (`domain/knowledge-generation/evaluation/cases.ts`)
 * usando el recuperador local real y dobles de prueba para el generador
 * — NUNCA llama a la API real de Claude. Funciona sin ninguna credencial.
 */
import { knowledgeDocuments } from '../../src/domain/knowledge-index/registry.ts';
import { createLocalProvider } from '../../src/domain/knowledge-retrieval/index.ts';
import {
  generationEvaluationCases,
  runGenerationEvaluation,
} from '../../src/domain/knowledge-generation/index.ts';

const pct = (numerator: number, denominator: number): string =>
  denominator === 0 ? 'n/a' : `${Math.round((numerator / denominator) * 100)}%`;

const localProvider = createLocalProvider(knowledgeDocuments);

console.log(`Índice de Conocimiento real: ${knowledgeDocuments.length} documentos.`);
console.log(`Conjunto de evaluación del generador: ${generationEvaluationCases.length} casos.`);

const summary = await runGenerationEvaluation(localProvider, generationEvaluationCases);

console.log(`\nEstado correcto:       ${pct(summary.correctStatusCount, summary.caseCount)}`);
console.log(`Texto final correcto:  ${pct(summary.correctDisplayTextCount, summary.caseCount)}\n`);

for (const evaluation of summary.cases) {
  const statusFlag = evaluation.statusMatch ? 'OK' : 'DESVIA';
  const textFlag = evaluation.displayTextMatch ? 'OK' : 'DESVIA';
  console.log(
    `  [${evaluation.caseId}] estado(${statusFlag})=${evaluation.actualGenerationStatus} texto(${textFlag})`,
  );
}
