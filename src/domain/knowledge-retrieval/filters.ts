import type { KnowledgeDocument } from '../knowledge-index';
import { findMentionedChampionId, findMentionedPatchId } from './corpus-index';
import type { RetrievalFilters, RetrievalQuery } from './types';

/**
 * Resolución y aplicación de filtros — compartida por todos los
 * proveedores de recuperación (local por términos, espacio vectorial, y
 * cualquier proveedor futuro de embeddings reales) para que el guardrail
 * "nunca mezclar campeones" (Fase 6 del encargo) se comporte exactamente
 * igual sea cual sea el motor de puntuación usado por debajo.
 */

export const resolveFilters = (
  query: RetrievalQuery,
  normalizedQueryText: string,
): RetrievalFilters => {
  const championId = query.filters?.championId ?? findMentionedChampionId(normalizedQueryText);
  const patchId = query.filters?.patchId ?? findMentionedPatchId(normalizedQueryText);
  return {
    ...(championId ? { championId } : {}),
    ...(patchId ? { patchId } : {}),
    ...(query.filters?.type ? { type: query.filters.type } : {}),
  };
};

/**
 * Nunca devuelve contenido de un campeón distinto del mencionado, nunca
 * mezcla parches cuando la pregunta nombra uno explícito (los documentos
 * sin `patchId` propio — conceptos, identidad, entendimiento — no se
 * excluyen: no pertenecen a ningún parche en particular).
 */
export const applyFilters = (
  corpus: readonly KnowledgeDocument[],
  filters: RetrievalFilters,
): readonly KnowledgeDocument[] => {
  let candidates = corpus;
  if (filters.championId) {
    const championId = filters.championId;
    candidates = candidates.filter((document) => document.relatedEntityIds.includes(championId));
  }
  if (filters.patchId) {
    const patchId = filters.patchId;
    candidates = candidates.filter((document) => !document.patchId || document.patchId === patchId);
  }
  if (filters.type) {
    const type = filters.type;
    candidates = candidates.filter((document) => document.type === type);
  }
  return candidates;
};
