import type { AnswerGenerator, GenerationStatus } from '../types';

/**
 * Un caso del conjunto de evaluación del GENERADOR (Fase 7 del encargo).
 * A diferencia de `knowledge-answering/evaluation`, aquí lo que varía no
 * es solo la pregunta sino también el generador bajo prueba — para poder
 * comprobar, con dobles de prueba (`fakes.ts`), que el orquestador
 * detecta y neutraliza cualquier intento de violar las reglas, sin llamar
 * nunca a una API externa real.
 */
export interface GenerationEvaluationCase {
  readonly id: string;
  readonly question: string;
  /** Recibe la lista blanca real de ids (calculada tras la recuperación real) para poder construir un doble de prueba coherente. */
  readonly buildGenerator: (context: { allowedDocumentIds: readonly string[] }) => AnswerGenerator;
  readonly expectedGenerationStatus: GenerationStatus;
  /** Cuando es `true`, el texto final mostrado debe ser exactamente el de la respuesta determinista original (hubo fallback real). */
  readonly expectDisplayTextIsDeterministic: boolean;
  readonly note: string;
}

export interface GenerationCaseEvaluation {
  readonly caseId: string;
  readonly question: string;
  readonly statusMatch: boolean;
  readonly displayTextMatch: boolean;
  readonly actualGenerationStatus: GenerationStatus;
}

export interface GenerationEvaluationSummary {
  readonly caseCount: number;
  readonly correctStatusCount: number;
  readonly correctDisplayTextCount: number;
  readonly cases: readonly GenerationCaseEvaluation[];
}
