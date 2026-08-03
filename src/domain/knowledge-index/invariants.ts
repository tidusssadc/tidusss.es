import type { KnowledgeDocument } from './types';

/**
 * Invariantes del Índice de Conocimiento — funciones puras, reciben datos y
 * devuelven violaciones, nunca lanzan. Mismo patrón que
 * `domain/content-graph/invariants.ts`, deliberadamente: son dos dominios
 * separados, pero comparten disciplina de validación.
 */

/** URL relativa real, con o sin ancla — nunca una URL externa ni una cadena vacía. */
const REAL_RELATIVE_URL = /^\/[a-z0-9-]*(?:\/[a-z0-9-]+)*(?:#[a-z0-9-]+)?$/;

export const findDuplicateDocumentIds = (
  documents: readonly KnowledgeDocument[],
): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const document of documents) {
    if (seen.has(document.id)) duplicates.add(document.id);
    seen.add(document.id);
  }
  return [...duplicates];
};

export const findEmptyContentDocuments = (
  documents: readonly KnowledgeDocument[],
): KnowledgeDocument[] =>
  documents.filter((document) => document.content.trim().length === 0);

export const findEmptyTitleDocuments = (
  documents: readonly KnowledgeDocument[],
): KnowledgeDocument[] =>
  documents.filter((document) => document.title.trim().length === 0);

export const findDocumentsMissingSourceEntityId = (
  documents: readonly KnowledgeDocument[],
): KnowledgeDocument[] =>
  documents.filter((document) => document.sourceEntityId.trim().length === 0);

/** Ninguna URL puede ser externa, absoluta a otro dominio, ni carecer de forma real de ruta. */
export const findDocumentsWithInvalidUrl = (
  documents: readonly KnowledgeDocument[],
): KnowledgeDocument[] =>
  documents.filter((document) => !REAL_RELATIVE_URL.test(document.url));

/** Todo documento debe declarar al menos una entidad relacionada real (nunca una lista vacía). */
export const findDocumentsWithoutRelatedEntities = (
  documents: readonly KnowledgeDocument[],
): KnowledgeDocument[] =>
  documents.filter((document) => document.relatedEntityIds.length === 0);

/** El idioma y la fuente son, hoy, valores únicos y cerrados — cualquier otro valor es un error de datos. */
export const findDocumentsWithInvalidLanguageOrSource = (
  documents: readonly KnowledgeDocument[],
): KnowledgeDocument[] =>
  documents.filter(
    (document) => document.language !== 'es' || document.source !== 'editorial',
  );

export const validateKnowledgeIndex = (
  documents: readonly KnowledgeDocument[],
): string[] => {
  const violations: string[] = [];

  for (const id of findDuplicateDocumentIds(documents)) {
    violations.push(`Documento duplicado: ${id}`);
  }
  for (const document of findEmptyContentDocuments(documents)) {
    violations.push(`Documento sin contenido: ${document.id}`);
  }
  for (const document of findEmptyTitleDocuments(documents)) {
    violations.push(`Documento sin título: ${document.id}`);
  }
  for (const document of findDocumentsMissingSourceEntityId(documents)) {
    violations.push(`Documento sin sourceEntityId: ${document.id}`);
  }
  for (const document of findDocumentsWithInvalidUrl(documents)) {
    violations.push(`URL inválida en ${document.id}: ${document.url}`);
  }
  for (const document of findDocumentsWithoutRelatedEntities(documents)) {
    violations.push(`Documento sin entidades relacionadas: ${document.id}`);
  }
  for (const document of findDocumentsWithInvalidLanguageOrSource(documents)) {
    violations.push(`Idioma o fuente inválidos en ${document.id}`);
  }

  return violations;
};
