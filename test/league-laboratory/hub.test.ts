import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getCatalogCoverage,
  isChampionInAnyTierList,
  resolveRiotDifficultyBucket,
} from '../../src/domain/league-laboratory/hub.ts';
import { buildLabRegistry } from '../../src/domain/league-laboratory/registry.ts';
import { championCatalog } from '../../src/data/league-laboratory/catalog/champions.generated.ts';
import {
  adcLabChampions,
  lucian,
} from '../../src/data/league-laboratory/champions.ts';
import { officialAdcTierList } from '../../src/data/league-laboratory/official-adc-tier-list.ts';

test('getCatalogCoverage: los totales reales suman el tamaño del catálogo', () => {
  const registry = buildLabRegistry({
    catalog: championCatalog,
    champions: adcLabChampions,
  });
  const coverage = getCatalogCoverage(registry);
  assert.equal(coverage.total, championCatalog.length);
  assert.equal(
    coverage.reviewed + coverage.draft + coverage.pending,
    coverage.total,
  );
  assert.equal(coverage.reviewed, 1); // Solo Lucian tiene profile
  assert.equal(coverage.draft, 3); // Kai'Sa, Jinx, Ezreal
  assert.equal(coverage.pending, championCatalog.length - 4);
});

test('getCatalogCoverage con un registro vacío no falla', () => {
  const registry = buildLabRegistry({});
  const coverage = getCatalogCoverage(registry);
  assert.deepEqual(coverage, { total: 0, reviewed: 0, draft: 0, pending: 0 });
});

test('resolveRiotDifficultyBucket agrupa correctamente los tres tramos', () => {
  assert.equal(resolveRiotDifficultyBucket(0), 'low');
  assert.equal(resolveRiotDifficultyBucket(3), 'low');
  assert.equal(resolveRiotDifficultyBucket(4), 'medium');
  assert.equal(resolveRiotDifficultyBucket(7), 'medium');
  assert.equal(resolveRiotDifficultyBucket(8), 'high');
  assert.equal(resolveRiotDifficultyBucket(10), 'high');
});

test('isChampionInAnyTierList: Lucian está en la Tier List oficial', () => {
  const registry = buildLabRegistry({ tierLists: [officialAdcTierList] });
  assert.equal(isChampionInAnyTierList(registry, lucian.id), true);
});

test('isChampionInAnyTierList: un campeón sin ninguna Tier List devuelve false', () => {
  const registry = buildLabRegistry({ tierLists: [officialAdcTierList] });
  assert.equal(isChampionInAnyTierList(registry, 'champion:aatrox'), false);
});
