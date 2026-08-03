import type { KnowledgeDocument } from './types';

const byId = (a: KnowledgeDocument, b: KnowledgeDocument): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/**
 * Ordena por `id` antes de serializar: el resultado es el mismo JSON con
 * independencia del orden en que se hayan generado o concatenado los
 * documentos. No escribe a disco ni a red — quien consuma este JSON
 * (un futuro script de build, fuera de alcance de esta v1) decide dónde
 * persistirlo.
 */
export const serializeKnowledgeIndex = (
  documents: readonly KnowledgeDocument[],
): string => JSON.stringify([...documents].sort(byId), null, 2);
