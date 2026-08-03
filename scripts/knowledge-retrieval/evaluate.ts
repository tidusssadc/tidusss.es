/**
 * Comando reproducible de evaluación (Fase 4 del encargo):
 *
 *   npm run eval:retrieval
 *
 * Ejecuta el mismo conjunto de evaluación (`domain/knowledge-retrieval/evaluation/cases.ts`)
 * contra el recuperador local por términos (línea base, Fase 2) y el
 * experimento local de espacio vectorial TF-IDF (Fase 5), sobre el índice
 * de conocimiento real (`domain/knowledge-index`), e imprime una
 * comparación legible por humanos. No modifica nada, no escribe a disco,
 * no requiere red ni credenciales.
 */
import { knowledgeDocuments } from '../../src/domain/knowledge-index/registry.ts';
import {
  createLocalProvider,
  createVectorSpaceProvider,
  evaluationCases,
  runEvaluation,
} from '../../src/domain/knowledge-retrieval/index.ts';
import type { EvaluationSummary } from '../../src/domain/knowledge-retrieval/index.ts';

const pct = (value: number): string => `${(value * 100).toFixed(0)}%`;

const printSummary = (summary: EvaluationSummary): void => {
  console.log(`\n=== ${summary.providerName} ===`);
  console.log(`Precisión@1 media:  ${pct(summary.meanPrecisionAt1)}`);
  console.log(`Precisión@3 media:  ${pct(summary.meanPrecisionAt3)}`);
  console.log(`Recall medio:       ${pct(summary.meanRecall)}`);
  console.log(
    `Rechazos correctos: ${summary.correctlyRejectedCount}/${summary.rejectableCaseCount}`,
  );
  console.log(
    `Fuera de alcance detectado: ${summary.outOfScopeDetectedCount}/${summary.outOfScopeCaseCount}`,
  );
  console.log(`Documentos prohibidos recuperados: ${summary.totalForbiddenHits}`);
  console.log('');
  for (const evaluation of summary.cases) {
    const p1 = evaluation.precisionAt1 === null ? '—' : pct(evaluation.precisionAt1);
    const p3 = evaluation.precisionAt3 === null ? '—' : pct(evaluation.precisionAt3);
    const recall = evaluation.recall === null ? '—' : pct(evaluation.recall);
    const coverageFlag = evaluation.coverageMatch ? 'OK' : 'DESVIA';
    const insufficientFlag = evaluation.insufficientInformationMatch ? 'OK' : 'DESVIA';
    console.log(
      `  [${evaluation.caseId}] p@1=${p1} p@3=${p3} recall=${recall} cobertura(${coverageFlag})=${evaluation.actualCoverage} info-insuficiente(${insufficientFlag})=${evaluation.actualInsufficientInformation}`,
    );
    if (evaluation.forbiddenHits.length > 0) {
      console.log(`    ¡PROHIBIDOS RECUPERADOS!: ${evaluation.forbiddenHits.join(', ')}`);
    }
  }
};

const localProvider = createLocalProvider(knowledgeDocuments);
const vectorProvider = createVectorSpaceProvider(knowledgeDocuments);

console.log(`Índice de Conocimiento real: ${knowledgeDocuments.length} documentos.`);
console.log(`Conjunto de evaluación: ${evaluationCases.length} preguntas.`);

const localSummary = runEvaluation(localProvider, evaluationCases);
const vectorSummary = runEvaluation(vectorProvider, evaluationCases);

printSummary(localSummary);
printSummary(vectorSummary);

console.log('\n=== Comparación ===');
console.log(
  `Precisión@1: local=${pct(localSummary.meanPrecisionAt1)} vs vector=${pct(vectorSummary.meanPrecisionAt1)}`,
);
console.log(
  `Precisión@3: local=${pct(localSummary.meanPrecisionAt3)} vs vector=${pct(vectorSummary.meanPrecisionAt3)}`,
);
console.log(
  `Recall:      local=${pct(localSummary.meanRecall)} vs vector=${pct(vectorSummary.meanRecall)}`,
);
