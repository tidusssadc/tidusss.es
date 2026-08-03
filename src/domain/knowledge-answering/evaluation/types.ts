import type { EditorialConfidence } from '../../league-laboratory';
import type { RetrievalCoverage } from '../../knowledge-retrieval';
import type { AnswerStatus } from '../types';

/**
 * Un caso del conjunto de evaluación de RESPUESTAS (Fase 6 del encargo) —
 * a diferencia de `knowledge-retrieval/evaluation`, que solo comprueba qué
 * documentos se recuperan, este conjunto comprueba el `AnswerResult`
 * completo: estado, fuentes mínimas, documentos prohibidos, cobertura y
 * confianza.
 */
export interface AnswerEvaluationCase {
  readonly id: string;
  readonly question: string;
  readonly expectedStatus: AnswerStatus;
  /** IDs de documento que deben aparecer entre `sources` cuando el estado es `sufficient`/`partial`. Vacío para estados de rechazo. */
  readonly minimumSourceIds: readonly string[];
  /** IDs de documento que nunca deberían aparecer entre `sources`. */
  readonly forbiddenSourceIds: readonly string[];
  readonly expectedCoverage: RetrievalCoverage;
  /** Solo cuando la confianza editorial es predecible de forma determinista con los datos reales de hoy. */
  readonly expectedEditorialConfidence?: EditorialConfidence;
  readonly note: string;
}

export interface AnswerCaseEvaluation {
  readonly caseId: string;
  readonly question: string;
  readonly statusMatch: boolean;
  readonly coverageMatch: boolean;
  readonly editorialConfidenceMatch: boolean;
  readonly missingRequiredSources: readonly string[];
  readonly forbiddenSourceHits: readonly string[];
  readonly hasUnsupportedText: boolean;
  readonly actualStatus: AnswerStatus;
}

export interface AnswerEvaluationSummary {
  readonly providerName: string;
  readonly caseCount: number;
  readonly correctStatusCount: number;
  readonly correctSufficientCount: number;
  readonly sufficientCaseCount: number;
  readonly correctPartialCount: number;
  readonly partialCaseCount: number;
  readonly correctRejectionCount: number;
  readonly rejectionCaseCount: number;
  readonly validCitationCount: number;
  readonly totalCitationChecks: number;
  readonly forbiddenSourceHitCount: number;
  readonly patchMixingViolationCount: number;
  readonly unsupportedTextCount: number;
  readonly cases: readonly AnswerCaseEvaluation[];
}
