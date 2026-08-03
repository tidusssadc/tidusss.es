import type { RetrievalCoverage } from '../types';

/**
 * Un caso del conjunto de evaluación (Fase 1 del encargo): una pregunta
 * real, con el resultado que se espera de CUALQUIER proveedor de
 * recuperación — nunca una respuesta generada, solo qué documentos
 * deberían (o no deberían) recuperarse. `run.ts` puntúa cualquier
 * `RetrievalProvider` contra este mismo conjunto, sea el local por
 * términos, el experimento de espacio vectorial, o un futuro proveedor de
 * embeddings reales.
 */
export interface EvaluationCase {
  readonly id: string;
  readonly question: string;
  /** El documento (o documentos) que sería la respuesta ideal — se usa para `recall`. */
  readonly expectedDocumentIds: readonly string[];
  /** Documentos que no son el ideal pero tampoco serían un error si se recuperan — cuentan como acierto en `precision@k`. */
  readonly acceptableDocumentIds: readonly string[];
  /** Documentos que NUNCA deberían aparecer entre los resultados (p. ej. contenido de otro campeón). */
  readonly forbiddenDocumentIds: readonly string[];
  readonly expectedCoverage: RetrievalCoverage;
  readonly expectInsufficientInformation: boolean;
  /** Marca las preguntas deliberadamente fuera del alcance del corpus (Mundial, vacía, ambigua sin señal real) — métrica aparte en el informe. */
  readonly isOutOfScope: boolean;
  /** Por qué se espera este resultado — para que el informe de evaluación sea legible sin releer el corpus. */
  readonly note: string;
}

export interface CaseEvaluation {
  readonly caseId: string;
  readonly question: string;
  readonly topDocumentIds: readonly string[];
  /** `null` para casos de rechazo puro (sin documentos esperados ni aceptables) — no hay nada sobre lo que medir precisión. */
  readonly precisionAt1: number | null;
  readonly precisionAt3: number | null;
  /** `null` cuando `expectedDocumentIds` está vacío. */
  readonly recall: number | null;
  readonly forbiddenHits: readonly string[];
  readonly coverageMatch: boolean;
  readonly insufficientInformationMatch: boolean;
  readonly actualCoverage: RetrievalCoverage;
  readonly actualInsufficientInformation: boolean;
}

export interface EvaluationSummary {
  readonly providerName: string;
  readonly caseCount: number;
  readonly meanPrecisionAt1: number;
  readonly meanPrecisionAt3: number;
  readonly meanRecall: number;
  readonly correctlyRejectedCount: number;
  readonly rejectableCaseCount: number;
  readonly outOfScopeDetectedCount: number;
  readonly outOfScopeCaseCount: number;
  readonly totalForbiddenHits: number;
  readonly cases: readonly CaseEvaluation[];
}
