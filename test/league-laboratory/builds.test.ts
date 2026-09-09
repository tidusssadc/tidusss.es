import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  jhinReferenceBuild26_17,
  leagueLaboratoryBuilds,
  lucianPersonalBuild26_14,
  lucianSolidBuild26_14,
} from '../../src/data/league-laboratory/builds.ts';
import { patch2614, patch2617 } from '../../src/data/league-laboratory/patches.ts';
import { championCatalog } from '../../src/data/league-laboratory/catalog/champions.generated.ts';

// Ámbito explícito de Lucian: desde que Jhin también tiene build real
// (parche 26.17), `leagueLaboratoryBuilds` deja de ser "solo Lucian" —
// estas pruebas se acotan a las builds de Lucian por `championId`, en vez
// de asumir que son las únicas del array.
const lucianBuilds = leagueLaboratoryBuilds.filter(
  (build) => build.championId === 'champion:lucian',
);

test('hay exactamente 2 builds de Lucian: una principal y una alternativa', () => {
  assert.equal(lucianBuilds.length, 2);
  const primary = lucianBuilds.filter((b) => b.variant === 'primary');
  const situational = lucianBuilds.filter(
    (b) => b.variant === 'situational',
  );
  assert.equal(primary.length, 1);
  assert.equal(situational.length, 1);
});

test('ambas builds de Lucian pertenecen al parche 26.14', () => {
  for (const build of lucianBuilds) {
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
  for (const build of lucianBuilds) {
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

test('el orden de habilidades de Lucian es parcial (Q, E) y no afirma un orden completo con W', () => {
  for (const build of lucianBuilds) {
    assert.deepEqual(build.skillOrder, ['Q', 'E']);
    assert.match(build.skillOrderReasoning ?? '', /todavía no está confirmado/);
  }
});

test('championId de ambas builds de Lucian corresponde a un campeón real del catálogo (Lucian)', () => {
  const lucianEntry = championCatalog.find(
    (entry) => entry.id === 'champion:lucian',
  );
  assert.ok(lucianEntry);
  for (const build of lucianBuilds) {
    assert.equal(build.championId, lucianEntry!.id);
  }
});

// --- Jhin — build de referencia, parche 26.17 (contenido parcial real,
// sin perfil editorial completo) ---

test('existe exactamente una build de Jhin, para el parche 26.17', () => {
  const jhinBuilds = leagueLaboratoryBuilds.filter(
    (build) => build.championId === 'champion:jhin',
  );
  assert.equal(jhinBuilds.length, 1);
  assert.equal(jhinBuilds[0]?.patchId, patch2617.id);
  assert.equal(jhinBuilds[0]?.id, jhinReferenceBuild26_17.id);
});

test('la build de Jhin solo declara Filo Infinito como objeto confirmado — nada más se ha rellenado por suposición', () => {
  assert.deepEqual(jhinReferenceBuild26_17.startingItems, []);
  assert.deepEqual(jhinReferenceBuild26_17.situationalItems, []);
  assert.equal(jhinReferenceBuild26_17.coreItems.length, 1);
  assert.equal(jhinReferenceBuild26_17.coreItems[0]?.name, 'Filo Infinito');
  assert.equal(jhinReferenceBuild26_17.coreItems[0]?.itemId, 3031);
});

test('el skill order de Jhin es exactamente Q > W > E, con el detalle completo por nivel en skillOrderReasoning', () => {
  assert.deepEqual(jhinReferenceBuild26_17.skillOrder, ['Q', 'W', 'E']);
  const reasoning = jhinReferenceBuild26_17.skillOrderReasoning ?? '';
  assert.match(reasoning, /Q: 1, 3, 5, 7, 9/);
  assert.match(reasoning, /W: 2, 8, 10, 11, 13/);
  assert.match(reasoning, /E: 4, 14, 15, 16, 18/);
  assert.match(reasoning, /R: 6, 12, 17/);
});

test('la build de Jhin nunca inventa una guía completa: su editorialTake describe el estado del dato, con confianza baja', () => {
  assert.equal(jhinReferenceBuild26_17.editorialTake.confidence, 'low');
  assert.match(
    jhinReferenceBuild26_17.editorialTake.reasoning,
    /pendiente de confirmación/,
  );
});
