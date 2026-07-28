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
import { leagueLaboratoryConcepts } from '../../src/data/league-laboratory/concepts.ts';
import { leagueLaboratoryBuilds } from '../../src/data/league-laboratory/builds.ts';
import { leagueLaboratoryRunePages } from '../../src/data/league-laboratory/rune-pages.ts';
import { leagueLaboratorySynergies } from '../../src/data/league-laboratory/synergies.ts';
import { kaisa } from '../../src/data/league-laboratory/champions.ts';

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

/**
 * Fase 5: `LabChampion.coreConceptIds` (curación editorial directa) debe
 * fusionarse con los conceptos derivados de matchups/guías/sinergias — sin
 * que ninguna de las dos vías se pise. Este test siembra el registro sin
 * sinergias/matchups a propósito, para blindar específicamente que la vía
 * directa (`coreConceptIds`) funciona por sí sola, con independencia de la
 * otra vía (probada aparte en `content-graph.test.ts`/`synergies.test.ts`).
 */
test('getChampionKnowledge resuelve los conceptos curados directamente en LabChampion.coreConceptIds', () => {
  const registry = buildLabRegistry({
    catalog: championCatalog,
    champions: adcLabChampions,
    concepts: leagueLaboratoryConcepts,
  });
  const knowledge = getChampionKnowledge(registry, lucian.id);
  assert.ok(knowledge);
  const conceptIds = knowledge?.concepts.map((concept) => concept.id) ?? [];
  assert.ok(lucian.coreConceptIds && lucian.coreConceptIds.length > 0);
  for (const id of lucian.coreConceptIds ?? []) {
    assert.ok(conceptIds.includes(id), `falta el concepto ${id}`);
  }
});

test('getChampionKnowledge no falla si coreConceptIds referencia un concepto ausente del registro', () => {
  const registry = buildLabRegistry({
    catalog: championCatalog,
    champions: adcLabChampions,
    concepts: [], // deliberadamente sin sembrar ningún concepto
  });
  const knowledge = getChampionKnowledge(registry, lucian.id);
  assert.deepEqual(knowledge?.concepts, []);
});

/**
 * Fase 6: el criterio real de Tidusss para Lucian (build/runas/sinergias del
 * parche 26.14) no debe "filtrarse" a ningún otro campeón, ni siquiera a
 * otro campeón curado (Kai'Sa). Cada colección se filtra por `championId`
 * dentro de `getChampionKnowledge` — este test lo comprueba con el registro
 * real completo, no con datos de prueba aislados.
 */
test('el contenido real de Lucian (builds/runas/sinergias) no aparece en la ficha de otro campeón curado', () => {
  const registry = buildLabRegistry({
    catalog: championCatalog,
    champions: adcLabChampions,
    builds: leagueLaboratoryBuilds,
    runePages: leagueLaboratoryRunePages,
    synergies: leagueLaboratorySynergies,
  });
  const kaisaKnowledge = getChampionKnowledge(registry, kaisa.id);
  assert.deepEqual(kaisaKnowledge?.builds, []);
  assert.deepEqual(kaisaKnowledge?.runePages, []);
  assert.deepEqual(kaisaKnowledge?.synergies, []);

  const lucianKnowledge = getChampionKnowledge(registry, lucian.id);
  assert.equal(lucianKnowledge?.builds.length, 2);
  assert.equal(lucianKnowledge?.runePages.length, 1);
  assert.equal(lucianKnowledge?.synergies.length, 6);
});
