import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  leagueLaboratoryEntities,
  leagueLaboratoryRelations,
} from '../../src/domain/content-graph/league-laboratory-extension.ts';
import { adcLabChampions } from '../../src/data/league-laboratory/champions.ts';
import { championCatalog } from '../../src/data/league-laboratory/catalog/champions.generated.ts';

/**
 * ADR (League Laboratory, Fase 3): el Content Graph solo registra los
 * campeones con curación editorial real. Registrar los ~173 del catálogo
 * saturaría el grafo con nodos sin ninguna relación que ofrecer. Este test
 * blinda esa política: si alguien reintrodujera un bucle sobre
 * `championCatalog` completo, fallaría aquí antes de llegar a producción.
 */
test('el Content Graph registra únicamente los campeones curados, no los ~173 del catálogo', () => {
  const championEntities = leagueLaboratoryEntities.filter(
    (entity) => entity.kind === 'champion',
  );
  assert.equal(championEntities.length, adcLabChampions.length);
  assert.ok(
    championEntities.length < championCatalog.length,
    'el grafo no debe crecer al mismo ritmo que el catálogo factual',
  );
});

test('cada entidad de campeón en el grafo corresponde a un campeón curado real', () => {
  const curatedIds = new Set<string>(
    adcLabChampions.map((champion) => champion.id),
  );
  const championEntities = leagueLaboratoryEntities.filter(
    (entity) => entity.kind === 'champion',
  );
  for (const entity of championEntities) {
    assert.ok(
      curatedIds.has(entity.id),
      `${entity.id} no está en adcLabChampions`,
    );
  }
});

test('Lucian tiene relaciones reales hacia y desde la Tier List oficial', () => {
  const lucianRelations = leagueLaboratoryRelations.filter(
    (relation) =>
      relation.from === 'champion:lucian' || relation.to === 'champion:lucian',
  );
  assert.ok(
    lucianRelations.length > 0,
    'Lucian debe tener al menos una relación en el grafo',
  );
  assert.ok(
    lucianRelations.some(
      (relation) =>
        relation.to === 'tier-list:official-adc' && relation.kind === 'tracks',
    ),
    'Lucian debe poder navegar hacia la Tier List oficial',
  );
  assert.ok(
    lucianRelations.some(
      (relation) =>
        relation.from === 'tier-list:official-adc' &&
        relation.kind === 'features',
    ),
    'La Tier List oficial debe destacar a Lucian',
  );
});

test('las entidades de campeón del grafo tienen href a su página real en /campeones/<slug>', () => {
  const championEntities = leagueLaboratoryEntities.filter(
    (entity) => entity.kind === 'champion',
  );
  for (const entity of championEntities) {
    assert.match(entity.href ?? '', /^\/campeones\/[a-z0-9-]+$/);
  }
});
