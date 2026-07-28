import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  leagueLaboratoryBuilds,
  lucianPersonalBuild26_14,
  lucianSolidBuild26_14,
} from '../../src/data/league-laboratory/builds.ts';
import { patch2614 } from '../../src/data/league-laboratory/patches.ts';
import { championCatalog } from '../../src/data/league-laboratory/catalog/champions.generated.ts';

test('hay exactamente 2 builds de Lucian: una principal y una alternativa', () => {
  assert.equal(leagueLaboratoryBuilds.length, 2);
  const primary = leagueLaboratoryBuilds.filter((b) => b.variant === 'primary');
  const situational = leagueLaboratoryBuilds.filter(
    (b) => b.variant === 'situational',
  );
  assert.equal(primary.length, 1);
  assert.equal(situational.length, 1);
});

test('ambas builds pertenecen al parche 26.14', () => {
  for (const build of leagueLaboratoryBuilds) {
    assert.equal(build.patchId, patch2614.id);
  }
});

test('ninguna elección de objeto tiene un razonamiento vacío', () => {
  for (const build of leagueLaboratoryBuilds) {
    const allChoices = [
      ...build.startingItems,
      ...(build.boots ?? []),
      ...build.coreItems,
      ...build.situationalItems,
    ];
    for (const choice of allChoices) {
      assert.ok(choice.name.length > 0, `nombre vacío en ${build.id}`);
      assert.ok(
        choice.reasoning.length > 0,
        `razonamiento vacío para "${choice.name}" en ${build.id}`,
      );
    }
  }
});

test('la build principal usa Segador de Esencia primero y Filo Infinito segundo', () => {
  const names = lucianSolidBuild26_14.coreItems.map((item) => item.name);
  assert.deepEqual(names, ['Segador de Esencia', 'Filo Infinito']);
});

test('la build personal usa Segador de Esencia primero y Navori segundo, con el riesgo documentado', () => {
  const names = lucianPersonalBuild26_14.coreItems.map((item) => item.name);
  assert.deepEqual(names, ['Segador de Esencia', 'Navori']);
  const navori = lucianPersonalBuild26_14.coreItems.find(
    (item) => item.name === 'Navori',
  );
  assert.ok(navori?.cons && navori.cons.length > 0);
  assert.match(navori!.cons![0], /Filo Infinito/);
});

test('las botas no se declaran una superior a otra: ambas tienen su propio razonamiento de cuándo usarlas', () => {
  for (const build of leagueLaboratoryBuilds) {
    assert.equal(build.boots?.length, 2);
    for (const boot of build.boots ?? []) {
      assert.ok(boot.reasoning.length > 0);
    }
  }
});

test('las dos builds comparten el mismo tercer objeto situacional (Lord Dominik / Recordatorio Letal)', () => {
  const situationalNames = (build: (typeof leagueLaboratoryBuilds)[number]) =>
    build.situationalItems.map((item) => item.name).sort();
  assert.deepEqual(
    situationalNames(lucianSolidBuild26_14),
    situationalNames(lucianPersonalBuild26_14),
  );
  assert.deepEqual(situationalNames(lucianSolidBuild26_14), [
    'Recordatorio Letal',
    'Últimas Palabras de Lord Dominik',
  ]);
});

test('el orden de habilidades es parcial (Q, E) y no afirma un orden completo con W', () => {
  for (const build of leagueLaboratoryBuilds) {
    assert.deepEqual(build.skillOrder, ['Q', 'E']);
    assert.match(build.skillOrderReasoning ?? '', /todavía no está confirmado/);
  }
});

test('championId de ambas builds corresponde a un campeón real del catálogo (Lucian)', () => {
  const lucianEntry = championCatalog.find(
    (entry) => entry.id === 'champion:lucian',
  );
  assert.ok(lucianEntry);
  for (const build of leagueLaboratoryBuilds) {
    assert.equal(build.championId, lucianEntry!.id);
  }
});
