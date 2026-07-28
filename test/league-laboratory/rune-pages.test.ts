import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  leagueLaboratoryRunePages,
  lucianRunes26_14,
} from '../../src/data/league-laboratory/rune-pages.ts';
import { patch2614 } from '../../src/data/league-laboratory/patches.ts';

test('hay exactamente una página de runas, la de Lucian para el parche 26.14', () => {
  assert.equal(leagueLaboratoryRunePages.length, 1);
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
