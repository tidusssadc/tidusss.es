import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  contentGraph,
  getContentConnections,
  getContentEntitiesByKind,
  getContentEntity,
  getPrimaryConnection,
  resolveConnections,
} from '../../src/domain/content-graph/registry.ts';
import {
  findNavigablePlannedEntities,
  validateContentGraph,
} from '../../src/domain/content-graph/invariants.ts';
import type {
  ContentEntity,
  ContentRelation,
} from '../../src/domain/content-graph/types.ts';

// --- Resolución por id ---

test('getContentEntity resuelve una entidad real por su id exacto', () => {
  const entity = getContentEntity('champion:lucian');
  assert.ok(entity);
  assert.equal(entity?.kind, 'champion');
});

test('getContentEntity devuelve undefined para un id que no existe en el registro', () => {
  assert.equal(getContentEntity('champion:no-existe'), undefined);
});

// --- Resolución por kind ---

test('getContentEntitiesByKind resuelve todas las entidades de un kind real', () => {
  const channels = getContentEntitiesByKind('channel');
  assert.equal(channels.length, 2);
  assert.ok(channels.every((entity) => entity.kind === 'channel'));
  assert.ok(channels.some((entity) => entity.id === 'channel:youtube'));
  assert.ok(channels.some((entity) => entity.id === 'channel:twitch'));
});

test('getContentEntitiesByKind devuelve una lista vacía para un kind sin ningún productor real hoy', () => {
  // `game` está reservado en el vocabulario de tipos pero, a día de hoy,
  // ningún dominio registra entidades de este kind (docs/content-graph.md §3.1).
  assert.deepEqual(getContentEntitiesByKind('game'), []);
});

// --- resolveConnections: núcleo puro, estabilidad de orden ---

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

test('resolveConnections ordena por prioridad descendente con independencia del orden de registro', () => {
  const entities = [
    entity({ id: 'champion:origen' }),
    entity({ id: 'build:baja', kind: 'build', href: '/baja' }),
    entity({ id: 'build:alta', kind: 'build', href: '/alta' }),
  ];
  const relationsInOrderA = [
    relation({ from: 'champion:origen', to: 'build:baja', priority: 10 }),
    relation({ from: 'champion:origen', to: 'build:alta', priority: 90 }),
  ];
  const relationsInOrderB = [...relationsInOrderA].reverse();

  const resultA = resolveConnections(entities, relationsInOrderA, 'champion:origen');
  const resultB = resolveConnections(entities, relationsInOrderB, 'champion:origen');

  assert.deepEqual(resultA, resultB);
  assert.equal(resultA[0]?.target.id, 'build:alta');
  assert.equal(resultA[1]?.target.id, 'build:baja');
});

test('resolveConnections descarta destinos planned, sin href o repetidos', () => {
  const entities = [
    entity({ id: 'champion:origen' }),
    entity({ id: 'build:planeada', kind: 'build', status: 'planned', href: '/no-deberia-verse' }),
    entity({ id: 'build:sin-href', kind: 'build' }),
    entity({ id: 'build:valida', kind: 'build', href: '/valida' }),
  ];
  const relations = [
    relation({ from: 'champion:origen', to: 'build:planeada', priority: 100 }),
    relation({ from: 'champion:origen', to: 'build:sin-href', priority: 90 }),
    relation({ from: 'champion:origen', to: 'build:valida', priority: 10 }),
    relation({ from: 'champion:origen', to: 'build:valida', priority: 5, kind: 'related-to' }),
  ];
  const connections = resolveConnections(entities, relations, 'champion:origen');
  assert.equal(connections.length, 1);
  assert.equal(connections[0]?.target.id, 'build:valida');
});

// --- getContentConnections / getPrimaryConnection: determinismo sobre el grafo real ---

test('getContentConnections es determinista: misma entrada, misma salida', () => {
  const first = getContentConnections('creator-project:live');
  const second = getContentConnections('creator-project:live');
  assert.deepEqual(first, second);
});

test('getPrimaryConnection devuelve la conexión de mayor prioridad de un nodo real con varias salidas', () => {
  const primary = getPrimaryConnection('creator-project:live');
  const all = getContentConnections('creator-project:live');
  assert.ok(primary);
  assert.deepEqual(primary, all[0]);
});

// --- Regresión: entidades `planned` nunca navegables ---

/**
 * `findNavigablePlannedEntities` es la invariante pura que garantiza que
 * ninguna entidad `planned` lleve `href` — se prueba aquí con un fixture
 * sintético en vez de depender de que el grafo real tenga hoy alguna
 * entidad `planned` (los objetivos ya no viven en el Content Graph desde
 * Fase VI: `domain/goals` los resuelve en vivo, no en build time).
 */
test('findNavigablePlannedEntities detecta una entidad planned con href', () => {
  const entities: ContentEntity[] = [
    {
      id: 'guide:futura',
      kind: 'guide',
      title: 'Guía futura',
      href: '/guias/futura',
      source: 'editorial',
      status: 'planned',
    },
  ];
  const violations = findNavigablePlannedEntities(entities);
  assert.equal(violations.length, 1);
  assert.equal(violations[0]?.id, 'guide:futura');
});

test('ninguna entidad planned del grafo real es navegable', () => {
  const planned = contentGraph.entities.filter((entity) => entity.status === 'planned');
  for (const entity of planned) {
    assert.equal(entity.href, undefined, `${entity.id} es planned pero tiene href`);
  }
});

// --- El registro real completo no viola ninguna invariante de grafo ---

test('el grafo real (contentGraph) no viola ninguna invariante de la Fase A', () => {
  assert.deepEqual(validateContentGraph(contentGraph), []);
});
