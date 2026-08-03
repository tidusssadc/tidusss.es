import type { ContentEntity, ContentGraph, ContentRelation } from './types';

/**
 * Invariantes del Content Graph (Fase A, `docs/content-graph.md` §10.2).
 * Funciones puras: reciben datos, devuelven violaciones — nunca lanzan,
 * nunca acceden a `contentGraph` directamente, para poder probarlas con
 * grafos sintéticos además de con el registro real.
 */

const KNOWN_ENTITY_KEYS = new Set<string>([
  'id',
  'kind',
  'title',
  'description',
  'href',
  'external',
  'source',
  'status',
]);

const KNOWN_RELATION_KEYS = new Set<string>([
  'from',
  'to',
  'kind',
  'label',
  'context',
  'priority',
  'source',
]);

/** IDs de entidad duplicados en el registro. */
export const findDuplicateEntityIds = (
  entities: readonly ContentEntity[],
): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const entity of entities) {
    if (seen.has(entity.id)) duplicates.add(entity.id);
    seen.add(entity.id);
  }
  return [...duplicates];
};

/** Relaciones repetidas: mismo origen, destino y tipo — señal de registro accidental por duplicado. */
export const findDuplicateRelations = (
  relations: readonly ContentRelation[],
): ContentRelation[] => {
  const seen = new Set<string>();
  const duplicates: ContentRelation[] = [];
  for (const relation of relations) {
    const key = `${relation.from}|${relation.to}|${relation.kind}`;
    if (seen.has(key)) duplicates.push(relation);
    seen.add(key);
  }
  return duplicates;
};

/** Ninguna relación puede apuntar a una entidad que no existe en el mismo grafo. */
export const findDanglingRelations = (
  graph: ContentGraph,
): ContentRelation[] => {
  const ids = new Set(graph.entities.map((entity) => entity.id));
  return graph.relations.filter(
    (relation) => !ids.has(relation.from) || !ids.has(relation.to),
  );
};

/** El id de toda entidad debe empezar por `${kind}:` (contrato de `ContentEntityId`). */
export const findMismatchedIdPrefixEntities = (
  entities: readonly ContentEntity[],
): ContentEntity[] =>
  entities.filter((entity) => !entity.id.startsWith(`${entity.kind}:`));

/** Una entidad `planned` nunca debe ser navegable: no debe llevar `href`. */
export const findNavigablePlannedEntities = (
  entities: readonly ContentEntity[],
): ContentEntity[] =>
  entities.filter(
    (entity) => entity.status === 'planned' && Boolean(entity.href),
  );

/**
 * Las relaciones no se autoinvierten (regla de dirección, §6.1). Si dos
 * relaciones son exactamente inversas (A→B y B→A, mismo `kind`) y además
 * comparten la misma etiqueta literal, es la huella de una función que
 * generó la inversa automáticamente en vez de que alguien escribiera su
 * propio texto editorial para cada sentido — exactamente lo que la regla
 * de dirección prohíbe.
 */
export const findSuspiciousInverseRelations = (
  relations: readonly ContentRelation[],
): ContentRelation[] => {
  const suspicious: ContentRelation[] = [];
  for (const relation of relations) {
    const hasAutoLookingInverse = relations.some(
      (candidate) =>
        candidate.from === relation.to &&
        candidate.to === relation.from &&
        candidate.kind === relation.kind &&
        candidate.label === relation.label,
    );
    if (hasAutoLookingInverse) suspicious.push(relation);
  }
  return suspicious;
};

/** Ninguna entidad debe exponer campos fuera del contrato público `ContentEntity`. */
export const findEntitiesWithUnknownFields = (
  entities: readonly ContentEntity[],
): ContentEntity[] =>
  entities.filter((entity) =>
    Object.keys(entity).some((key) => !KNOWN_ENTITY_KEYS.has(key)),
  );

/** Ninguna relación debe exponer campos fuera del contrato público `ContentRelation`. */
export const findRelationsWithUnknownFields = (
  relations: readonly ContentRelation[],
): ContentRelation[] =>
  relations.filter((relation) =>
    Object.keys(relation).some((key) => !KNOWN_RELATION_KEYS.has(key)),
  );

/**
 * Agrega todas las invariantes en una lista de violaciones legible.
 * Lista vacía = grafo válido. Pensada para usarse desde pruebas contra el
 * registro real (`contentGraph`) y contra grafos sintéticos en pruebas
 * unitarias de esta misma función.
 */
export const validateContentGraph = (graph: ContentGraph): string[] => {
  const violations: string[] = [];

  for (const id of findDuplicateEntityIds(graph.entities)) {
    violations.push(`Entidad duplicada: ${id}`);
  }
  for (const relation of findDuplicateRelations(graph.relations)) {
    violations.push(
      `Relación duplicada: ${relation.from} → ${relation.to} (${relation.kind})`,
    );
  }
  for (const relation of findDanglingRelations(graph)) {
    violations.push(
      `Relación colgante: ${relation.from} → ${relation.to} (${relation.kind}) no resuelve a una entidad existente`,
    );
  }
  for (const entity of findMismatchedIdPrefixEntities(graph.entities)) {
    violations.push(
      `Id sin el prefijo de su kind: ${entity.id} (kind: ${entity.kind})`,
    );
  }
  for (const entity of findNavigablePlannedEntities(graph.entities)) {
    violations.push(`Entidad "planned" navegable: ${entity.id}`);
  }
  for (const relation of findSuspiciousInverseRelations(graph.relations)) {
    violations.push(
      `Relación inversa sospechosa (misma etiqueta en ambos sentidos): ${relation.from} ↔ ${relation.to} (${relation.kind})`,
    );
  }
  for (const entity of findEntitiesWithUnknownFields(graph.entities)) {
    violations.push(`Entidad con campos fuera de contrato: ${entity.id}`);
  }
  for (const relation of findRelationsWithUnknownFields(graph.relations)) {
    violations.push(
      `Relación con campos fuera de contrato: ${relation.from} → ${relation.to} (${relation.kind})`,
    );
  }

  return violations;
};
