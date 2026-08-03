import type { KnowledgeDocumentType } from '../knowledge-index';
import type { EditorialConfidence } from '../league-laboratory';
import type { RetrievalCoverage } from '../knowledge-retrieval';

/**
 * El motor de respuesta transforma un `RetrievalResult` (qué documentos se
 * recuperaron) en una respuesta estructurada y citable — sin IA
 * generativa, sin redacción libre. Cada campo de `AnswerResult` responde a
 * un requisito explícito del encargo; ninguno se rellena si no hay un dato
 * real detrás (nunca `''`/`0` como relleno — `undefined` cuando el dato no
 * existe).
 *
 * Ver `docs/knowledge-answering.md` para la arquitectura completa y
 * `docs/pregunta-a-tidusss.md` §5/§10 para el diseño de producto del que
 * este contrato es la primera versión real, determinista, sin LLM.
 */

/**
 * Seis estados obligatorios (encargo, "ESTADOS OBLIGATORIOS"):
 * - `sufficient`               cobertura completa, respuesta lista para mostrarse tal cual.
 * - `partial`                  cobertura parcial — información real, pero no completa/específica.
 * - `insufficient-information` se reconoce de qué trata la pregunta (un campeón real, un parche
 *                              real), pero no existe contenido editorial real que responderla.
 * - `out-of-scope`             ningún término de la pregunta pertenece al vocabulario del corpus.
 * - `empty-question`           la pregunta está vacía — se rechaza antes de intentar nada.
 * - `internal-error`           el motor no pudo completar el proceso (ver `assemble.ts`).
 *
 * `insufficient-information` y `out-of-scope` sonarían igual de "no sé" de
 * cara al usuario, pero son estados distintos y no intercambiables: el
 * primero significa "entiendo la pregunta, no tengo contenido"; el segundo,
 * "esto no pertenece al corpus de Tidusss en absoluto". Ver
 * `docs/knowledge-answering.md` §3 para el criterio exacto de cuándo es cada uno.
 */
export type AnswerStatus =
  | 'sufficient'
  | 'partial'
  | 'insufficient-information'
  | 'out-of-scope'
  | 'empty-question'
  | 'internal-error';

/**
 * Una fuente realmente citada en la respuesta — nunca una fuente que no
 * estuviera entre los documentos recuperados (invariante verificado en
 * `test/knowledge-answering/`).
 */
export interface AnswerSource {
  readonly documentId: string;
  readonly title: string;
  readonly url: string;
  readonly type: KnowledgeDocumentType;
  readonly patchId?: string;
  readonly editorialDate?: string;
  /** El texto real y verbatim del documento — nunca resumido ni parafraseado. */
  readonly excerpt: string;
}

/** Un enlace relacionado real, resuelto contra el Content Graph — nunca una recomendación inventada. */
export interface RelatedLink {
  readonly id: string;
  readonly title: string;
  readonly href: string;
  readonly kind: string;
}

export interface AnswerResult {
  readonly query: string;
  readonly status: AnswerStatus;
  /** Presente únicamente si `status` es `'sufficient'` o `'partial'`. */
  readonly answer?: string;
  /**
   * Confianza EDITORIAL (heredada de `EditorialTake.confidence`, nunca
   * inventada) — mínimo entre las fuentes realmente combinadas en la
   * respuesta. Ausente si ninguna fuente combinada declara confianza (p.
   * ej. un `Concept`, que es una definición objetiva, no un veredicto).
   */
  readonly editorialConfidence?: EditorialConfidence;
  /** Confianza DE RECUPERACIÓN — viene directamente de `RetrievalResult.retrievalConfidence`, nunca se mezcla con la editorial. */
  readonly retrievalConfidence: number;
  readonly coverage: RetrievalCoverage;
  /** Vacío salvo cuando `status` es `'sufficient'` o `'partial'`. */
  readonly sources: readonly AnswerSource[];
  /** La fecha editorial más reciente entre las fuentes citadas, si alguna la declara. */
  readonly editorialDate?: string;
  /** El parche de la respuesta, si las fuentes citadas comparten uno. */
  readonly patchId?: string;
  readonly relatedLinks: readonly RelatedLink[];
  readonly insufficientInformation: boolean;
  /** Vacío cuando `status` es `'sufficient'` o `'partial'`. */
  readonly rejectionReasons: readonly string[];
}
