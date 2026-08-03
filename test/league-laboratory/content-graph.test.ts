import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  leagueLaboratoryEntities,
  leagueLaboratoryRelations,
} from '../../src/domain/content-graph/league-laboratory-extension.ts';
import { adcLabChampions } from '../../src/data/league-laboratory/champions.ts';
import { championCatalog } from '../../src/data/league-laboratory/catalog/champions.generated.ts';
import { leagueLaboratorySynergies } from '../../src/data/league-laboratory/synergies.ts';

/**
 * ADR (League Laboratory, Fase 3): el Content Graph solo registra los
 * campeones con una relación real que ofrecer. Registrar los ~173 del
 * catálogo saturaría el grafo con nodos sin ninguna relación que ofrecer.
 *
 * Actualizado en la Fase C (`docs/content-graph.md`): la curación editorial
 * completa (`adcLabChampions`) ya no es la única fuente de esa relación
 * real — un socio de sinergia (Milio, Nami...) también la tiene desde que
 * `synergizes-with` conecta a Lucian con él, aunque no tenga `LabChampion`
 * propio. El conjunto esperado se deriva aquí de la misma fuente real
 * (`leagueLaboratorySynergies`) que usa `league-laboratory-extension.ts`,
 * no de un número fijo — si mañana se añade o quita una sinergia real, este
 * test sigue siendo exacto sin tocarlo. Lo que este test sigue blindando,
 * sin relajarse, es que el grafo **nunca** se acerca al tamaño del catálogo
 * completo (~173) solo por existir en Data Dragon.
 */
const realSynergyPartnerIds = new Set<string>(
  leagueLaboratorySynergies.flatMap((synergy) => synergy.championIds.slice(1)),
);
const expectedChampionEntityIds = new Set<string>([
  ...adcLabChampions.map((champion) => champion.id),
  ...realSynergyPartnerIds,
]);

test('el Content Graph registra únicamente campeones con una relación real (curados o socios de sinergia), no los ~173 del catálogo', () => {
  const championEntities = leagueLaboratoryEntities.filter(
    (entity) => entity.kind === 'champion',
  );
  assert.equal(championEntities.length, expectedChampionEntityIds.size);
  assert.ok(
    championEntities.length < championCatalog.length / 2,
    'el grafo no debe acercarse al tamaño del catálogo factual completo',
  );
});

test('cada entidad de campeón en el grafo corresponde a un campeón curado real o a un socio de sinergia real', () => {
  const championEntities = leagueLaboratoryEntities.filter(
    (entity) => entity.kind === 'champion',
  );
  for (const entity of championEntities) {
    assert.ok(
      expectedChampionEntityIds.has(entity.id),
      `${entity.id} no está en adcLabChampions ni es un socio de sinergia real referenciado por leagueLaboratorySynergies`,
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
