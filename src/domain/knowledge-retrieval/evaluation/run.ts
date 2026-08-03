import type { RetrievalProvider } from '../types';
import type { CaseEvaluation, EvaluationCase, EvaluationSummary } from './types';

/**
 * Runner de evaluación (Fase 4 del encargo) — puro y determinista: recibe
 * un `RetrievalProvider` y un conjunto de casos, y devuelve métricas. No
 * sabe ni le importa si el proveedor es el local por términos, el
 * experimento de espacio vectorial, o un futuro proveedor de embeddings
 * reales: los tres implementan la misma interfaz (`types.ts`).
 */

/** Cuántos documentos se piden al proveedor por pregunta — separado de `precisionAt1`/`precisionAt3` (que miran solo los primeros puestos) y usado como el "top-N" contra el que se mide `recall`. */
export const EVAL_RETRIEVAL_LIMIT = 10;

const average = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const precisionAtK = (
  topIds: readonly string[],
  k: number,
  positiveIds: ReadonlySet<string>,
): number | null => {
  if (positiveIds.size === 0) return null; // caso de rechazo puro: no hay nada sobre lo que medir precisión.
  const consideredIds = topIds.slice(0, k);
  if (consideredIds.length === 0) return 0; // se esperaba algo y no se devolvió nada.
  const hits = consideredIds.filter((id) => positiveIds.has(id)).length;
  return hits / consideredIds.length;
};

const recallFor = (
  topIds: readonly string[],
  expectedIds: readonly string[],
): number | null => {
  if (expectedIds.length === 0) return null;
  const topIdSet = new Set(topIds);
  const found = expectedIds.filter((id) => topIdSet.has(id)).length;
  return found / expectedIds.length;
};

const evaluateCase = (
  provider: RetrievalProvider,
  evaluationCase: EvaluationCase,
): CaseEvaluation => {
  const result = provider.retrieve({ text: evaluationCase.question, limit: EVAL_RETRIEVAL_LIMIT });
  const topDocumentIds = result.documents.map((retrieved) => retrieved.document.id);
  const positiveIds = new Set([
    ...evaluationCase.expectedDocumentIds,
    ...evaluationCase.acceptableDocumentIds,
  ]);
  const forbiddenIdSet = new Set(evaluationCase.forbiddenDocumentIds);

  return {
    caseId: evaluationCase.id,
    question: evaluationCase.question,
    topDocumentIds,
    precisionAt1: precisionAtK(topDocumentIds, 1, positiveIds),
    precisionAt3: precisionAtK(topDocumentIds, 3, positiveIds),
    recall: recallFor(topDocumentIds, evaluationCase.expectedDocumentIds),
    forbiddenHits: topDocumentIds.filter((id) => forbiddenIdSet.has(id)),
    coverageMatch: result.coverage === evaluationCase.expectedCoverage,
    insufficientInformationMatch:
      result.insufficientInformation === evaluationCase.expectInsufficientInformation,
    actualCoverage: result.coverage,
    actualInsufficientInformation: result.insufficientInformation,
  };
};

export const runEvaluation = (
  provider: RetrievalProvider,
  cases: readonly EvaluationCase[],
): EvaluationSummary => {
  const evaluations = cases.map((evaluationCase) => evaluateCase(provider, evaluationCase));

  const precisionAt1Values = evaluations
    .map((evaluation) => evaluation.precisionAt1)
    .filter((value): value is number => value !== null);
  const precisionAt3Values = evaluations
    .map((evaluation) => evaluation.precisionAt3)
    .filter((value): value is number => value !== null);
  const recallValues = evaluations
    .map((evaluation) => evaluation.recall)
    .filter((value): value is number => value !== null);

  const rejectableCases = cases.filter((evaluationCase) => evaluationCase.expectInsufficientInformation);
  const outOfScopeCases = cases.filter((evaluationCase) => evaluationCase.isOutOfScope);
  const rejectableCaseIds = new Set(rejectableCases.map((evaluationCase) => evaluationCase.id));
  const outOfScopeCaseIds = new Set(outOfScopeCases.map((evaluationCase) => evaluationCase.id));

  const correctlyRejectedCount = evaluations.filter(
    (evaluation) => rejectableCaseIds.has(evaluation.caseId) && evaluation.actualInsufficientInformation,
  ).length;
  const outOfScopeDetectedCount = evaluations.filter(
    (evaluation) => outOfScopeCaseIds.has(evaluation.caseId) && evaluation.actualInsufficientInformation,
  ).length;
  const totalForbiddenHits = evaluations.reduce(
    (sum, evaluation) => sum + evaluation.forbiddenHits.length,
    0,
  );

  return {
    providerName: provider.name,
    caseCount: cases.length,
    meanPrecisionAt1: average(precisionAt1Values),
    meanPrecisionAt3: average(precisionAt3Values),
    meanRecall: average(recallValues),
    correctlyRejectedCount,
    rejectableCaseCount: rejectableCases.length,
    outOfScopeDetectedCount,
    outOfScopeCaseCount: outOfScopeCases.length,
    totalForbiddenHits,
    cases: evaluations,
  };
};
