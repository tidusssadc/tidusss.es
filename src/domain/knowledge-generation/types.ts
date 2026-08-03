import type { AnswerSource, AnswerStatus } from '../knowledge-answering';
import type { EditorialConfidence } from '../league-laboratory';
import type { RetrievalCoverage } from '../knowledge-retrieval';

/**
 * Claude (o cualquier proveedor de generación) es ÚNICAMENTE un redactor.
 * No busca documentos, no elige fuentes, no decide confianza ni cobertura
 * — esos campos ni siquiera existen en `GenerationResult` (§ más abajo):
 * es una garantía estructural, no solo una regla de validación en runtime.
 * La fuente de verdad sigue siendo Índice de Conocimiento → Recuperación →
 * Motor de Respuesta (`domain/knowledge-answering`); este dominio consume
 * un `AnswerResult` ya ensamblado y, como mucho, reformula su prosa.
 *
 * Ver `docs/knowledge-generation.md` para la arquitectura completa.
 */

/**
 * - `generated`               el proveedor reformuló el texto y pasó la validación de salida.
 * - `not-applicable`          el `AnswerResult` no era `sufficient`/`partial` — nunca se invoca al generador.
 * - `fallback`                el proveedor falló, lanzó una excepción, o su salida no pasó la validación
 *                             (Fase 5) — se usa automáticamente el generador determinista.
 * - `provider-not-configured` faltan credenciales/configuración — estado seguro, nunca un error de aplicación.
 */
export type GenerationStatus = 'generated' | 'not-applicable' | 'fallback' | 'provider-not-configured';

/**
 * Todo lo que un generador puede leer — nunca más. No incluye deliberadamente
 * ningún campo que permita "decidir" cobertura, confianza o fuentes nuevas:
 * `allowedDocumentIds` es una lista blanca cerrada, `sources` ya viene
 * validada por el motor de respuesta.
 */
export interface GenerationInput {
  readonly query: string;
  readonly deterministicAnswer: string;
  readonly status: AnswerStatus;
  readonly editorialConfidence?: EditorialConfidence;
  readonly retrievalConfidence: number;
  readonly coverage: RetrievalCoverage;
  /** Lista blanca cerrada — un generador nunca puede citar un id fuera de esta lista. */
  readonly allowedDocumentIds: readonly string[];
  readonly sources: readonly AnswerSource[];
  readonly patchId?: string;
  readonly editorialDate?: string;
  /** Fijas, decididas por el sistema — nunca controladas por el usuario ni por la pregunta. */
  readonly toneInstructions: string;
}

/**
 * Lo que un generador puede devolver — y NADA MÁS. Adrede no incluye
 * `confidence`, `coverage`, `patchId`, `editorialDate` ni `sources`
 * completas (título/URL/tipo): esos campos siempre vienen del
 * `AnswerResult` original, nunca de aquí. Un generador que "quisiera"
 * cambiar el parche o subir la confianza no tiene ni un campo del
 * contrato donde intentarlo.
 */
export interface GenerationResult {
  readonly text?: string;
  /** Subconjunto de `GenerationInput.allowedDocumentIds` — nunca un id nuevo (validado en `validate.ts`). */
  readonly usedSourceIds: readonly string[];
  readonly warnings: readonly string[];
  readonly provider: string;
  readonly modelVersion?: string;
  readonly status: GenerationStatus;
}

export interface AnswerGenerator {
  readonly name: string;
  generate(input: GenerationInput): Promise<GenerationResult>;
}
