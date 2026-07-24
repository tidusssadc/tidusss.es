import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLabRegistry,
  getCatalogEntry,
  getChampionKnowledge,
} from '../../src/domain/league-laboratory/registry.ts';
import { championCatalog } from '../../src/data/league-laboratory/catalog/champions.generated.ts';
import {
  adcLabChampions,
  lucian,
} from '../../src/data/league-laboratory/champions.ts';
import { officialAdcTierList } from '../../src/data/league-laboratory/official-adc-tier-list.ts';
import { patch1514 } from '../../src/data/league-laboratory/patches.ts';

test('buildLabRegistry sin seed produce colecciones vacías, nunca undefined', () => {
  const registry = buildLabRegistry({});
  assert.deepEqual(registry.catalog, []);
  assert.deepEqual(registry.champions, []);
  assert.deepEqual(registry.tierLists, []);
  assert.equal(getCatalogEntry(registry, 'champion:lucian'), undefined);
  assert.equal(getChampionKnowledge(registry, 'champion:lucian'), undefined);
});

test('getChampionKnowledge para un campeón que no existe en el catálogo devuelve undefined', () => {
  const registry = buildLabRegistry({ catalog: championCatalog });
  assert.equal(getChampionKnowledge(registry, 'champion:no-existe'), undefined);
});

test('getChampionKnowledge para Lucian (curado, con perfil) incluye catalogEntry y labChampion', () => {
  const registry = buildLabRegistry({
    catalog: championCatalog,
    champions: adcLabChampions,
    patches: [patch1514],
    tierLists: [officialAdcTierList],
  });
  const knowledge = getChampionKnowledge(registry, lucian.id);
  assert.ok(knowledge);
  assert.equal(knowledge?.catalogEntry.id, 'champion:lucian');
  assert.equal(knowledge?.labChampion?.id, 'champion:lucian');
  assert.equal(knowledge?.labChampion?.profile?.difficulty, 'medium');
  assert.equal(knowledge?.tierListAppearances.length, 1);
  assert.equal(knowledge?.tierListAppearances[0]?.entry.championId, lucian.id);
});

/**
 * La inmensa mayoría del catálogo (~169 de 173) no tiene curación editorial.
 * getChampionKnowledge debe seguir funcionando para ellos: catalogEntry
 * siempre presente, labChampion ausente, listas vacías — nunca undefined
 * para el conjunto completo.
 */
test('getChampionKnowledge para un campeón sin curación editorial no falla', () => {
  const uncurated = championCatalog.find(
    (entry) => !adcLabChampions.some((champion) => champion.id === entry.id),
  );
  assert.ok(
    uncurated,
    'debe existir al menos un campeón sin curación en el catálogo real',
  );
  const registry = buildLabRegistry({
    catalog: championCatalog,
    champions: adcLabChampions,
  });
  const knowledge = getChampionKnowledge(registry, uncurated!.id);
  assert.ok(knowledge);
  assert.equal(knowledge?.catalogEntry.id, uncurated!.id);
  assert.equal(knowledge?.labChampion, undefined);
  assert.deepEqual(knowledge?.builds, []);
  assert.deepEqual(knowledge?.tierListAppearances, []);
});
