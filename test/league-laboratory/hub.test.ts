import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAdcRoster,
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
  assert.equal(coverage.draft, 4); // Kai'Sa, Jinx, Ezreal, Jhin (build/runas de referencia, sin profile)
  assert.equal(coverage.pending, championCatalog.length - 5);
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

// --- getAdcRoster: fuente única del roster público de /campeones (fase
// "ecosistema ADC") — siempre derivado de officialAdcTierList, nunca una
// segunda lista mantenida a mano. ---

const ADC_ROSTER_REGISTRY = buildLabRegistry({
  catalog: championCatalog,
  champions: adcLabChampions,
  tierLists: [officialAdcTierList],
});

const EXPECTED_ADC_ROSTER_IDS = [
  'champion:zeri',
  'champion:jinx',
  'champion:tristana',
  'champion:ashe',
  'champion:caitlyn',
  'champion:kaisa',
  'champion:lucian',
  'champion:sivir',
  'champion:corki',
  'champion:xayah',
  'champion:nilah',
  'champion:yunara',
  'champion:kalista',
  'champion:varus',
  'champion:jhin',
  'champion:twitch',
  'champion:draven',
  'champion:kog-maw',
  'champion:samira',
  'champion:aphelios',
  'champion:miss-fortune',
  'champion:vayne',
  'champion:ezreal',
  'champion:smolder',
  'champion:senna',
].sort();

test('getAdcRoster devuelve exactamente los 25 ADC actuales de la Tier List — ni uno más, ni uno menos', () => {
  const roster = getAdcRoster(ADC_ROSTER_REGISTRY);
  assert.equal(roster.length, 25);
  assert.deepEqual(
    roster.map((entry) => entry.catalogEntry.id).sort(),
    EXPECTED_ADC_ROSTER_IDS,
  );
});

test('getAdcRoster: ningún campeón fuera de la Tier List ADC aparece en el roster visible', () => {
  const roster = getAdcRoster(ADC_ROSTER_REGISTRY);
  const rosterIds = new Set(roster.map((entry) => entry.catalogEntry.id));
  // Aatrox, Seraphine y Vel'Koz son casos reales de campeones NO incluidos
  // en `officialAdcTierListEntries` — Seraphine/Vel'Koz aparecen en la nota
  // "¿Y los magos en bot?" de la propia Tier List, pero deliberadamente
  // fuera de sus `entries`, así que no deben contar como roster ADC.
  assert.equal(rosterIds.has('champion:aatrox'), false);
  assert.equal(rosterIds.has('champion:seraphine'), false);
  assert.equal(rosterIds.has('champion:velkoz'), false);
});

test('getAdcRoster: Lucian aparece en el roster con su tier real (A) y su curación editorial', () => {
  const roster = getAdcRoster(ADC_ROSTER_REGISTRY);
  const lucianEntry = roster.find((entry) => entry.catalogEntry.id === lucian.id);
  assert.ok(lucianEntry, 'Lucian debería estar en el roster ADC');
  assert.equal(lucianEntry?.tier, 'A');
  assert.equal(lucianEntry?.labChampion?.id, lucian.id);
});

test('officialAdcTierList mantiene exactamente 25 entradas revisadas (reviewStatus === reviewed)', () => {
  const reviewed = officialAdcTierList.entries.filter(
    (entry) => entry.reviewStatus === 'reviewed',
  );
  assert.equal(reviewed.length, 25);
});
