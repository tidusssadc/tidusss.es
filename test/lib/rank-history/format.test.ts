import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRankLabel } from '../../../src/lib/rank-history/format.ts';

test('formatRankLabel: sin tier es "Sin clasificar"', () => {
  assert.equal(formatRankLabel(undefined, undefined), 'Sin clasificar');
});

test('formatRankLabel: tier con division real combina ambos con formato título', () => {
  assert.equal(formatRankLabel('DIAMOND', 'I'), 'Diamond I');
  assert.equal(formatRankLabel('gold', 'iv'), 'Gold IV');
});

test('formatRankLabel: tiers apex (Master/GM/Challenger) nunca muestran division, aunque venga una', () => {
  assert.equal(formatRankLabel('MASTER', undefined), 'Master');
  assert.equal(formatRankLabel('GRANDMASTER', 'I'), 'Grandmaster');
  assert.equal(formatRankLabel('CHALLENGER', undefined), 'Challenger');
});

test('formatRankLabel: tier sin rank fuera de apex (dato parcial real) muestra solo el tier', () => {
  assert.equal(formatRankLabel('GOLD', undefined), 'Gold');
});
