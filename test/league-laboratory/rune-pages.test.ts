import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  jhinRunesA26_17,
  jhinRunesB26_17,
  jinxRunes26_17,
  leagueLaboratoryRunePages,
  lucianRunes26_14,
} from '../../src/data/league-laboratory/rune-pages.ts';
import { patch2614, patch2617 } from '../../src/data/league-laboratory/patches.ts';

test('hay exactamente 4 páginas de runas registradas: la de Lucian (26.14), las 2 de Jhin y la de Jinx (26.17)', () => {
  assert.equal(leagueLaboratoryRunePages.length, 4);
  assert.equal(lucianRunes26_14.patchId, patch2614.id);
});

test('la runa principal confirmada es Ataque Intensificado, con razonamiento real', () => {
  assert.equal(lucianRunes26_14.primaryRunes.length, 1);
  assert.equal(lucianRunes26_14.primaryRunes[0]?.name, 'Ataque Intensificado');
  assert.ok((lucianRunes26_14.primaryRunes[0]?.reasoning ?? '').length > 0);
});

test('el árbol secundario y los fragmentos de estadística quedan vacíos (pendientes), no inventados', () => {
  assert.deepEqual(lucianRunes26_14.secondaryRunes, []);
  assert.deepEqual(lucianRunes26_14.statShards, []);
});

test('ningún árbol (primaryTreeId/secondaryTreeId) se ha inventado: ambos ausentes', () => {
  assert.equal(lucianRunes26_14.primaryTreeId, undefined);
  assert.equal(lucianRunes26_14.secondaryTreeId, undefined);
});

// --- Jhin — dos configuraciones de runas alternativas, parche 26.17 ---

test('existen exactamente dos configuraciones de runas de Jhin para el parche 26.17', () => {
  const jhinRunePages = leagueLaboratoryRunePages.filter(
    (page) => page.championId === 'champion:jhin',
  );
  assert.equal(jhinRunePages.length, 2);
  for (const page of jhinRunePages) {
    assert.equal(page.patchId, patch2617.id);
  }
});

test('la configuración A de Jhin usa Pies Veloces como runa principal', () => {
  assert.equal(jhinRunesA26_17.primaryRunes.length, 1);
  assert.equal(jhinRunesA26_17.primaryRunes[0]?.name, 'Pies Veloces');
});

test('la configuración B de Jhin usa Toque de Muerte Ígnea como runa principal', () => {
  assert.equal(jhinRunesB26_17.primaryRunes.length, 1);
  assert.equal(jhinRunesB26_17.primaryRunes[0]?.name, 'Toque de Muerte Ígnea');
});

test('ninguna de las dos configuraciones de Jhin sustituye la keystone por Lluvia de Cuchillas', () => {
  for (const page of [jhinRunesA26_17, jhinRunesB26_17]) {
    const keystoneNames = page.primaryRunes.map((rune) => rune.name);
    assert.equal(keystoneNames.includes('Lluvia de Cuchillas'), false);
  }
});

test('las runas menores de Jhin no se han rellenado por suposición: rama secundaria y fragmentos vacíos en ambas configuraciones', () => {
  for (const page of [jhinRunesA26_17, jhinRunesB26_17]) {
    assert.deepEqual(page.secondaryRunes, []);
    assert.deepEqual(page.statShards, []);
  }
});

test('el editorialTake de cada configuración de Jhin declara que son alternativas, sin inventar un criterio de selección entre ambas', () => {
  for (const page of [jhinRunesA26_17, jhinRunesB26_17]) {
    assert.equal(page.editorialTake.confidence, 'low');
    assert.match(page.editorialTake.reasoning, /alternativa/);
    assert.match(page.editorialTake.reasoning, /sin un criterio de selección publicado/);
  }
});

// --- Jinx — una única configuración de runas de referencia, parche 26.17 ---

test('existe exactamente una configuración de runas de Jinx, para el parche 26.17', () => {
  const jinxRunePages = leagueLaboratoryRunePages.filter(
    (page) => page.championId === 'champion:jinx',
  );
  assert.equal(jinxRunePages.length, 1);
  assert.equal(jinxRunePages[0]?.patchId, patch2617.id);
  assert.equal(jinxRunePages[0]?.id, jinxRunes26_17.id);
});

test('la runa principal de Jinx es Tempo Letal', () => {
  assert.equal(jinxRunes26_17.primaryRunes.length, 1);
  assert.equal(jinxRunes26_17.primaryRunes[0]?.name, 'Tempo Letal');
});

test('las runas menores de Jinx no se han rellenado por suposición: rama secundaria, fragmentos y árboles ausentes', () => {
  assert.deepEqual(jinxRunes26_17.secondaryRunes, []);
  assert.deepEqual(jinxRunes26_17.statShards, []);
  assert.equal(jinxRunes26_17.primaryTreeId, undefined);
  assert.equal(jinxRunes26_17.secondaryTreeId, undefined);
});

test('el editorialTake de la runa de Jinx tiene confianza baja y documenta qué queda pendiente', () => {
  assert.equal(jinxRunes26_17.editorialTake.confidence, 'low');
  assert.match(jinxRunes26_17.editorialTake.reasoning, /pendientes de análisis/);
});
