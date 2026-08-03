import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findDanglingRelations,
  findDuplicateEntityIds,
  findDuplicateRelations,
  findEntitiesWithUnknownFields,
  findMismatchedIdPrefixEntities,
  findNavigablePlannedEntities,
  findRelationsWithUnknownFields,
  findSuspiciousInverseRelations,
  validateContentGraph,
} from '../../src/domain/content-graph/invariants.ts';
import type {
  ContentEntity,
  ContentRelation,
} from '../../src/domain/content-graph/types.ts';

const entity = (overrides: Partial<ContentEntity> = {}): ContentEntity => ({
  id: 'champion:test',
  kind: 'champion',
  title: 'Test',
  source: 'editorial',
  status: 'available',
  ...overrides,
});

const relation = (overrides: Partial<ContentRelation> = {}): ContentRelation => ({
  from: 'champion:test',
  to: 'build:test',
  kind: 'documents',
  label: 'Ver',
  priority: 50,
  source: 'editorial',
  ...overrides,
});

// --- findDuplicateEntityIds ---

test('findDuplicateEntityIds detecta un id repetido', () => {
  const entities = [
    entity({ id: 'champion:a' }),
    entity({ id: 'champion:a' }),
    entity({ id: 'champion:b' }),
  ];
  assert.deepEqual(findDuplicateEntityIds(entities), ['champion:a']);
});

test('findDuplicateEntityIds no reporta nada sobre ids únicos', () => {
  const entities = [entity({ id: 'champion:a' }), entity({ id: 'champion:b' })];
  assert.deepEqual(findDuplicateEntityIds(entities), []);
});

// --- findDuplicateRelations ---

test('findDuplicateRelations detecta la misma arista (from, to, kind) repetida', () => {
  const relations = [
    relation(),
    relation(),
    relation({ kind: 'related-to' }),
  ];
  const duplicates = findDuplicateRelations(relations);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0]?.kind, 'documents');
});

test('findDuplicateRelations no confunde relaciones distintas con el mismo origen', () => {
  const relations = [relation({ to: 'build:a' }), relation({ to: 'build:b' })];
  assert.deepEqual(findDuplicateRelations(relations), []);
});

// --- findDanglingRelations ---

test('findDanglingRelations detecta una relación cuyo destino no existe', () => {
  const graph = {
    entities: [entity({ id: 'champion:a' })],
    relations: [relation({ from: 'champion:a', to: 'build:inexistente' })],
  };
  const dangling = findDanglingRelations(graph);
  assert.equal(dangling.length, 1);
  assert.equal(dangling[0]?.to, 'build:inexistente');
});

test('findDanglingRelations detecta también un origen inexistente', () => {
  const graph = {
    entities: [entity({ id: 'build:a', kind: 'build' })],
    relations: [relation({ from: 'champion:inexistente', to: 'build:a' })],
  };
  assert.equal(findDanglingRelations(graph).length, 1);
});

test('findDanglingRelations no reporta nada cuando ambos extremos existen', () => {
  const graph = {
    entities: [entity({ id: 'champion:a' }), entity({ id: 'build:a', kind: 'build' })],
    relations: [relation({ from: 'champion:a', to: 'build:a' })],
  };
  assert.deepEqual(findDanglingRelations(graph), []);
});

// --- findMismatchedIdPrefixEntities ---

test('findMismatchedIdPrefixEntities detecta un id que no empieza por su kind', () => {
  const entities = [entity({ id: 'video:algo', kind: 'champion' })];
  assert.equal(findMismatchedIdPrefixEntities(entities).length, 1);
});

test('findMismatchedIdPrefixEntities no reporta nada cuando el prefijo es correcto', () => {
  assert.deepEqual(findMismatchedIdPrefixEntities([entity()]), []);
});

// --- findNavigablePlannedEntities ---

test('findNavigablePlannedEntities detecta una entidad planned con href', () => {
  const entities = [entity({ status: 'planned', href: '/algo' })];
  assert.equal(findNavigablePlannedEntities(entities).length, 1);
});

test('findNavigablePlannedEntities no reporta una entidad planned sin href', () => {
  const entities = [entity({ status: 'planned' })];
  assert.deepEqual(findNavigablePlannedEntities(entities), []);
});

test('findNavigablePlannedEntities no reporta una entidad available con href', () => {
  const entities = [entity({ status: 'available', href: '/algo' })];
  assert.deepEqual(findNavigablePlannedEntities(entities), []);
});

// --- findSuspiciousInverseRelations ---

/**
 * Regla de dirección (`docs/content-graph.md` §6.1): dos relaciones
 * genuinamente inversas siempre llevan su propia etiqueta editorial, nunca
 * el mismo texto en ambos sentidos. Compartir la misma etiqueta literal es
 * la huella de una inversión generada automáticamente.
 */
test('findSuspiciousInverseRelations detecta una inversa con la misma etiqueta literal', () => {
  const relations = [
    relation({ from: 'champion:a', to: 'champion:b', label: 'Ver' }),
    relation({ from: 'champion:b', to: 'champion:a', label: 'Ver' }),
  ];
  assert.equal(findSuspiciousInverseRelations(relations).length, 2);
});

test('findSuspiciousInverseRelations no reporta nada cuando cada sentido tiene su propia etiqueta editorial', () => {
  const relations = [
    relation({
      from: 'tier-list:x',
      to: 'champion:a',
      kind: 'features',
      label: 'Ver el perfil completo del campeón',
    }),
    relation({
      from: 'champion:a',
      to: 'tier-list:x',
      kind: 'tracks',
      label: 'Ver en la Tier List oficial',
    }),
  ];
  assert.deepEqual(findSuspiciousInverseRelations(relations), []);
});

// --- findEntitiesWithUnknownFields / findRelationsWithUnknownFields ---

test('findEntitiesWithUnknownFields detecta un campo fuera del contrato público', () => {
  const leaked = Object.assign({}, entity(), {
    profile: { summary: 'fuga interna de league-laboratory' },
  });
  assert.equal(findEntitiesWithUnknownFields([leaked]).length, 1);
});

test('findEntitiesWithUnknownFields no reporta nada sobre una entidad limpia', () => {
  assert.deepEqual(findEntitiesWithUnknownFields([entity()]), []);
});

test('findRelationsWithUnknownFields detecta un campo fuera del contrato público', () => {
  const leaked = Object.assign({}, relation(), {
    editorialTake: { verdict: 'fuga interna de league-laboratory' },
  });
  assert.equal(findRelationsWithUnknownFields([leaked]).length, 1);
});

test('findRelationsWithUnknownFields no reporta nada sobre una relación limpia', () => {
  assert.deepEqual(findRelationsWithUnknownFields([relation()]), []);
});

// --- validateContentGraph ---

test('validateContentGraph agrega todas las violaciones de un grafo sintético roto', () => {
  const graph = {
    entities: [entity({ id: 'champion:a' }), entity({ id: 'champion:a' })],
    relations: [relation({ from: 'champion:a', to: 'build:inexistente' })],
  };
  const violations = validateContentGraph(graph);
  assert.ok(violations.some((message) => message.includes('Entidad duplicada')));
  assert.ok(violations.some((message) => message.includes('Relación colgante')));
});

test('validateContentGraph no reporta violaciones sobre un grafo sintético válido', () => {
  const graph = {
    entities: [entity({ id: 'champion:a' }), entity({ id: 'build:a', kind: 'build' })],
    relations: [relation({ from: 'champion:a', to: 'build:a' })],
  };
  assert.deepEqual(validateContentGraph(graph), []);
});
