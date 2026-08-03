import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  leagueLaboratoryEntities,
  leagueLaboratoryRelations,
} from '../../src/domain/content-graph/league-laboratory-extension.ts';
import {
  contentGraph,
  getContentConnections,
  getContentEntitiesByKind,
} from '../../src/domain/content-graph/registry.ts';
import {
  findDuplicateEntityIds,
  validateContentGraph,
} from '../../src/domain/content-graph/invariants.ts';
import {
  adcLabChampions,
  kaisa,
  lucian,
} from '../../src/data/league-laboratory/champions.ts';
import { leagueLaboratoryBuilds } from '../../src/data/league-laboratory/builds.ts';
import { leagueLaboratoryMatchups } from '../../src/data/league-laboratory/matchups.ts';
import { leagueLaboratoryRunePages } from '../../src/data/league-laboratory/rune-pages.ts';
import { leagueLaboratorySynergies } from '../../src/data/league-laboratory/synergies.ts';
import { leagueLaboratoryConcepts } from '../../src/data/league-laboratory/concepts.ts';

/**
 * Fase B: activación de `build`/`matchup` en el Content Graph con el
 * contenido editorial real ya existente de Lucian. `guide` no se prueba
 * aquí porque no existe todavía ninguna fuente real de `KnowledgeArticle`
 * en `src/data/league-laboratory` — nada que activar sin inventarla.
 */

// --- Las entidades build reales se registran ---

test('las dos builds reales de Lucian se registran como entidades del grafo', () => {
  const buildEntities = leagueLaboratoryEntities.filter(
    (entity) => entity.kind === 'build',
  );
  assert.equal(buildEntities.length, leagueLaboratoryBuilds.length);
  assert.equal(buildEntities.length, 2);
});

test('los ids de las entidades build son estables, únicos y coinciden con el dominio de origen', () => {
  const buildEntities = leagueLaboratoryEntities.filter(
    (entity) => entity.kind === 'build',
  );
  assert.deepEqual(findDuplicateEntityIds(buildEntities), []);
  const ids = buildEntities.map((entity) => entity.id).sort();
  const sourceIds = leagueLaboratoryBuilds
    .map((build) => build.id)
    .sort();
  assert.deepEqual(ids, sourceIds);
});

test('build no tiene concepto de borrador/placeholder: todas sus entidades están disponibles', () => {
  const buildEntities = leagueLaboratoryEntities.filter(
    (entity) => entity.kind === 'build',
  );
  for (const entity of buildEntities) {
    assert.equal(entity.status, 'available');
  }
});

test('las entidades build apuntan a la sección real de la guía del campeón, nunca a una ruta inventada', () => {
  const buildEntities = leagueLaboratoryEntities.filter(
    (entity) => entity.kind === 'build',
  );
  for (const entity of buildEntities) {
    assert.equal(entity.href, '/campeones/lucian#build-heading');
  }
});

// --- matchup: activado, pero sin contenido real todavía ---

test('no se registra ninguna entidad matchup porque todavía no existe contenido real analizado', () => {
  assert.deepEqual(leagueLaboratoryMatchups, []);
  const matchupEntities = leagueLaboratoryEntities.filter(
    (entity) => entity.kind === 'matchup',
  );
  assert.deepEqual(matchupEntities, []);
});

// --- guide: sin fuente de datos real, nada que activar ---

test('no existe ninguna entidad guide en el grafo real: no hay todavía fuente de datos de guías', () => {
  assert.deepEqual(getContentEntitiesByKind('guide'), []);
});

// --- Todas las relaciones de build resuelven a entidades existentes ---

test('todas las relaciones que salen de una entidad build resuelven a una entidad existente en el grafo', () => {
  const buildEntityIds = new Set(
    leagueLaboratoryEntities
      .filter((entity) => entity.kind === 'build')
      .map((entity) => entity.id),
  );
  const entityIds = new Set(contentGraph.entities.map((entity) => entity.id));
  const buildRelations = leagueLaboratoryRelations.filter((relation) =>
    buildEntityIds.has(relation.from),
  );
  assert.ok(buildRelations.length > 0, 'debe existir al menos una relación de build para que esta prueba sea significativa');
  for (const relation of buildRelations) {
    assert.ok(entityIds.has(relation.to), `${relation.to} no existe como entidad del grafo`);
  }
});

// --- No se generan relaciones inversas implícitas ---

test('ninguna relación va de un campeón hacia una de sus builds: solo se activó el sentido build → campeón', () => {
  const reverseRelations = leagueLaboratoryRelations.filter(
    (relation) =>
      relation.from.startsWith('champion:') &&
      (relation.to.startsWith('build:') || relation.to.startsWith('matchup:')),
  );
  assert.deepEqual(reverseRelations, []);
});

// --- Lucian no recibe contenido perteneciente a otro campeón, y viceversa ---

test('ningún campeón curado distinto de Lucian recibe una relación "documents" desde una entidad build', () => {
  const otherCuratedChampions = adcLabChampions.filter(
    (champion) => champion.id !== lucian.id,
  );
  assert.ok(
    otherCuratedChampions.length > 0,
    'debe existir al menos otro campeón curado además de Lucian para que esta prueba sea significativa',
  );
  for (const champion of otherCuratedChampions) {
    const leaked = leagueLaboratoryRelations.some(
      (relation) =>
        relation.from.startsWith('build:') &&
        relation.kind === 'documents' &&
        relation.to === champion.id,
    );
    assert.equal(leaked, false, `${champion.id} recibió contenido de build que no le pertenece`);
  }
});

test('todas las relaciones "documents" de build apuntan exactamente a champion:lucian', () => {
  const buildDocumentsRelations = leagueLaboratoryRelations.filter(
    (relation) => relation.from.startsWith('build:') && relation.kind === 'documents',
  );
  assert.ok(buildDocumentsRelations.length > 0);
  for (const relation of buildDocumentsRelations) {
    assert.equal(relation.to, lucian.id);
  }
});

// --- Conexiones end-to-end sin duplicados ---

test('getContentConnections desde una build real resuelve a su campeón, sin duplicados', () => {
  const [firstBuild] = leagueLaboratoryEntities.filter(
    (entity) => entity.kind === 'build',
  );
  assert.ok(firstBuild);
  const connections = getContentConnections(firstBuild.id);
  const targetIds = connections.map((connection) => connection.target.id);
  assert.deepEqual(targetIds, [...new Set(targetIds)]);
  assert.ok(connections.some((connection) => connection.target.id === lucian.id));
});

test('getContentEntitiesByKind("build") sobre el grafo real devuelve exactamente las builds de Lucian', () => {
  const buildEntities = getContentEntitiesByKind('build');
  assert.equal(buildEntities.length, 2);
  assert.ok(buildEntities.every((entity) => entity.href?.startsWith('/campeones/lucian')));
});

// --- El grafo completo sigue sin violar ninguna invariante tras la Fase B ---

test('el grafo real (contentGraph) sigue sin violar ninguna invariante tras activar build/matchup', () => {
  assert.deepEqual(validateContentGraph(contentGraph), []);
});

/**
 * Fase C: activación de `rune-page`, `synergy`, `concept` y `editorial-log`
 * con sus primeros productores reales — la página de runas de Lucian, sus
 * 6 sinergias reales, los 4 conceptos que enlaza directamente
 * (`coreConceptIds`) y su historial editorial real. Ningún tipo se activa
 * "vacío": cada uno tiene, hoy, al menos un productor real.
 */

// --- rune-page ---

test('la página de runas real de Lucian se registra como entidad del grafo, con id único y estable', () => {
  const runePageEntities = leagueLaboratoryEntities.filter(
    (entity) => entity.kind === 'rune-page',
  );
  assert.equal(runePageEntities.length, leagueLaboratoryRunePages.length);
  assert.equal(runePageEntities.length, 1);
  assert.deepEqual(findDuplicateEntityIds(runePageEntities), []);
  assert.equal(runePageEntities[0]?.id, 'rune-page:lucian-26-14');
});

test('la entidad rune-page apunta a la sección real de runas de la guía de Lucian', () => {
  const [runePageEntity] = leagueLaboratoryEntities.filter(
    (entity) => entity.kind === 'rune-page',
  );
  assert.equal(runePageEntity?.href, '/campeones/lucian#runas-heading');
  assert.equal(runePageEntity?.status, 'available');
});

// --- synergy ---

test('las 6 sinergias reales de Lucian se registran como entidades del grafo, con ids únicos', () => {
  const synergyEntities = leagueLaboratoryEntities.filter(
    (entity) => entity.kind === 'synergy',
  );
  assert.equal(synergyEntities.length, leagueLaboratorySynergies.length);
  assert.equal(synergyEntities.length, 6);
  assert.deepEqual(findDuplicateEntityIds(synergyEntities), []);
});

test('las entidades synergy apuntan a la sección real de sinergias de la guía de Lucian', () => {
  const synergyEntities = leagueLaboratoryEntities.filter(
    (entity) => entity.kind === 'synergy',
  );
  for (const entity of synergyEntities) {
    assert.equal(entity.href, '/campeones/lucian#sinergias-heading');
  }
});

test('cada sinergia genera exactamente una relación synergizes-with, explícita y dirigida de Lucian al socio', () => {
  const synergizesWithRelations = leagueLaboratoryRelations.filter(
    (relation) => relation.kind === 'synergizes-with',
  );
  assert.equal(synergizesWithRelations.length, 6);
  for (const relation of synergizesWithRelations) {
    assert.equal(relation.from, lucian.id);
    assert.notEqual(relation.to, lucian.id);
  }
});

test('ninguna relación synergizes-with se autoinvierte: ningún socio de sinergia tiene una relación de vuelta a Lucian', () => {
  const partnerIds = leagueLaboratoryRelations
    .filter((relation) => relation.kind === 'synergizes-with')
    .map((relation) => relation.to);
  const reverseRelations = leagueLaboratoryRelations.filter(
    (relation) =>
      relation.kind === 'synergizes-with' &&
      partnerIds.includes(relation.from) &&
      relation.to === lucian.id,
  );
  assert.deepEqual(reverseRelations, []);
});

test('los socios de sinergia sin curación editorial (Milio, Nami...) se registran como campeones planos, navegables a su propia página real', () => {
  const partnerIds = new Set(
    leagueLaboratoryRelations
      .filter((relation) => relation.kind === 'synergizes-with')
      .map((relation) => relation.to),
  );
  const championEntities = leagueLaboratoryEntities.filter(
    (entity) => entity.kind === 'champion',
  );
  for (const partnerId of partnerIds) {
    const entity = championEntities.find((candidate) => candidate.id === partnerId);
    assert.ok(entity, `${partnerId} debe existir como entidad champion en el grafo`);
    assert.match(entity!.href ?? '', /^\/campeones\/[a-z0-9-]+$/);
  }
});

// --- concept: solo los que tienen un productor real ---

test('solo se registran los 4 conceptos que Lucian enlaza directamente (coreConceptIds), no los 6 de leagueLaboratoryConcepts', () => {
  const conceptEntities = leagueLaboratoryEntities.filter(
    (entity) => entity.kind === 'concept',
  );
  assert.equal(conceptEntities.length, lucian.coreConceptIds?.length ?? 0);
  assert.equal(conceptEntities.length, 4);
  assert.ok(
    conceptEntities.length < leagueLaboratoryConcepts.length,
    'Tempo y Wave Management no tienen hoy ningún productor real y no deben registrarse',
  );
  const registeredIds = new Set(conceptEntities.map((entity) => entity.id));
  assert.ok(!registeredIds.has('concept:tempo'));
  assert.ok(!registeredIds.has('concept:wave-management'));
});

test('los ids de concepto registrados son únicos y coinciden exactamente con LabChampion.coreConceptIds de Lucian', () => {
  const conceptEntities = leagueLaboratoryEntities.filter(
    (entity) => entity.kind === 'concept',
  );
  assert.deepEqual(findDuplicateEntityIds(conceptEntities), []);
  const ids = conceptEntities.map((entity) => entity.id).sort();
  const sourceIds = [...(lucian.coreConceptIds ?? [])].sort();
  assert.deepEqual(ids, sourceIds);
});

test('cada concepto registrado genera exactamente una relación "explains" hacia Lucian, nunca la inversa', () => {
  const explainsRelations = leagueLaboratoryRelations.filter(
    (relation) => relation.kind === 'explains',
  );
  assert.equal(explainsRelations.length, 4);
  for (const relation of explainsRelations) {
    assert.equal(relation.to, lucian.id);
    assert.ok(relation.from.startsWith('concept:'));
  }
  const reverseRelations = leagueLaboratoryRelations.filter(
    (relation) => relation.kind === 'explains' && relation.from === lucian.id,
  );
  assert.deepEqual(reverseRelations, []);
});

// --- editorial-log: un único nodo 1:1, nunca uno por entrada ---

test('existe exactamente un nodo editorial-log en todo el grafo, no uno por entrada del historial', () => {
  const editorialLogEntities = getContentEntitiesByKind('editorial-log');
  assert.equal(editorialLogEntities.length, 1);
  assert.ok(
    (lucian.editorialHistory?.length ?? 0) > 1,
    'el historial real de Lucian debe tener más de una entrada para que esta prueba sea significativa',
  );
  assert.equal(editorialLogEntities[0]?.id, 'editorial-log:lucian');
});

test('el nodo editorial-log de Lucian apunta a la sección real de historial editorial de su guía', () => {
  const [editorialLogEntity] = getContentEntitiesByKind('editorial-log');
  assert.equal(editorialLogEntity?.href, '/campeones/lucian#historial-editorial-heading');
});

test('el editorial-log de Lucian genera relaciones changed-in solo hacia parches con evidencia estructurada (patchId)', () => {
  const changedInRelations = leagueLaboratoryRelations.filter(
    (relation) => relation.kind === 'changed-in',
  );
  assert.equal(changedInRelations.length, 2);
  const targets = changedInRelations.map((relation) => relation.to).sort();
  assert.deepEqual(targets, ['patch:15-14', 'patch:26-14']);
  for (const relation of changedInRelations) {
    assert.equal(relation.from, 'editorial-log:lucian');
  }
});

test('los dos parches referenciados por changed-in (patch:15-14 y patch:26-14) están registrados como entidades reales', () => {
  const patchEntityIds = new Set(
    contentGraph.entities
      .filter((entity) => entity.kind === 'patch')
      .map((entity) => entity.id),
  );
  assert.ok(patchEntityIds.has('patch:15-14'));
  assert.ok(patchEntityIds.has('patch:26-14'));
});

// --- El contenido de Lucian no se asigna a otro campeón curado ---

test('Kai\'Sa (otro campeón curado) no recibe ninguna relación de rune-page, synergy, concept o editorial-log de Lucian', () => {
  const leakedKinds = ['documents', 'explains', 'changed-in'] as const;
  const leaked = leagueLaboratoryRelations.some(
    (relation) =>
      leakedKinds.includes(relation.kind as (typeof leakedKinds)[number]) &&
      relation.to === kaisa.id &&
      (relation.from.startsWith('rune-page:') ||
        relation.from.startsWith('synergy:') ||
        relation.from.startsWith('concept:') ||
        relation.from.startsWith('editorial-log:')),
  );
  assert.equal(leaked, false);
});

test('Kai\'Sa no tiene ningún nodo editorial-log propio ni ninguna rune-page real que la documente', () => {
  assert.equal(
    getContentEntitiesByKind('editorial-log').some((entity) => entity.id === 'editorial-log:kaisa'),
    false,
  );
  const runePageDocumentsKaisa = leagueLaboratoryRelations.some(
    (relation) =>
      relation.kind === 'documents' &&
      relation.to === kaisa.id &&
      relation.from.startsWith('rune-page:'),
  );
  assert.equal(runePageDocumentsKaisa, false);
});

// --- El grafo completo sigue sin violar ninguna invariante tras la Fase C ---

test('el grafo real (contentGraph) sigue sin violar ninguna invariante tras activar rune-page/synergy/concept/editorial-log', () => {
  assert.deepEqual(validateContentGraph(contentGraph), []);
});
