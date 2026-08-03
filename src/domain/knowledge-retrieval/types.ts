import type {
  KnowledgeDocument,
  KnowledgeDocumentType,
} from '../knowledge-index';
import type { LabChampionId, PatchId } from '../league-laboratory';

/**
 * El Índice de Conocimiento (`domain/knowledge-index`) describe qué existe.
 * Este dominio describe cómo se recupera, dada una pregunta real de un
 * usuario. Es deliberadamente un consumidor de `KnowledgeDocument` — a
 * diferencia de la separación Content Graph / Índice de Conocimiento (que
 * son dos responsabilidades paralelas que no se importan entre sí), aquí sí
 * hay una dependencia real y esperada: no existe "recuperación" sin
 * documentos que recuperar. Lo que este dominio NO hace es reinterpretar ni
 * modificar `KnowledgeDocument` — solo lee, puntúa y filtra.
 *
 * Ver `docs/knowledge-retrieval.md` para la arquitectura completa.
 */

/** Filtros explícitos que una pregunta puede declarar (o que el propio recuperador infiere de su texto). */
export interface RetrievalFilters {
  readonly championId?: LabChampionId;
  readonly patchId?: PatchId;
  readonly type?: KnowledgeDocumentType;
}

export interface RetrievalQuery {
  readonly text: string;
  readonly filters?: RetrievalFilters;
  readonly limit?: number;
}

export type MatchReason =
  | 'title-match'
  | 'content-term-match'
  | 'type-keyword-match'
  | 'champion-match'
  | 'patch-match'
  | 'related-entity-match'
  | 'vector-similarity';

/**
 * `score` es una medida de recuperación (cuánto se parece la pregunta a
 * este documento), nunca una medida de certeza editorial. Un documento con
 * `confidence: 'high'` (en `KnowledgeDocument`, un juicio de Tidusss) puede
 * perfectamente tener un `score` de recuperación bajo si la pregunta no se
 * parece a su contenido — y viceversa. Los dos números nunca se combinan.
 */
export interface RetrievedDocument {
  readonly document: KnowledgeDocument;
  readonly score: number;
  readonly reasons: readonly MatchReason[];
}

export type RetrievalCoverage = 'full' | 'partial' | 'none';

export interface RetrievalResult {
  readonly query: string;
  readonly documents: readonly RetrievedDocument[];
  readonly coverage: RetrievalCoverage;
  /**
   * Confianza EN LA RECUPERACIÓN (¿qué tan seguro está el sistema de que
   * encontró lo que se preguntó?) — nunca la `confidence` editorial de
   * ningún documento. Ver `docs/knowledge-retrieval.md` §4.
   */
  readonly retrievalConfidence: number;
  readonly insufficientInformation: boolean;
  readonly filtersApplied: RetrievalFilters;
}

/**
 * Interfaz desacoplada de proveedor de recuperación (Fase 5 del encargo):
 * cualquier motor de recuperación —el local determinista por términos, el
 * experimento local de espacio vectorial, o un futuro proveedor real de
 * embeddings con Cloudflare Vectorize/Workers AI— implementa exactamente
 * este contrato. El conjunto de evaluación y el runner de métricas no saben
 * ni necesitan saber cuál de los tres están evaluando.
 */
export interface RetrievalProvider {
  readonly name: string;
  retrieve(query: RetrievalQuery): RetrievalResult;
}
