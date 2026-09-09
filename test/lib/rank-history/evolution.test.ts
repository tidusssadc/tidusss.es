import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRankEvolution,
  unavailableRankEvolution,
} from '../../../src/lib/rank-history/evolution.ts';
import type { RankSnapshot } from '../../../src/lib/rank-history/types.ts';

const snap = (overrides: Partial<RankSnapshot>): RankSnapshot => ({
  id: 1,
  puuid: 'puuid-tidusss',
  queueType: 'RANKED_SOLO_5x5',
  tier: 'GOLD',
  rank: 'II',
  leaguePoints: 40,
  wins: 10,
  losses: 8,
  observedAt: '2026-09-01T10:00:00.000Z',
  source: 'overview',
  ...overrides,
});

test('buildRankEvolution: 0 snapshots reales — available:true, sampleCount:0, nunca un gráfico inventado', () => {
  const summary = buildRankEvolution([], undefined);
  assert.equal(summary.available, true);
  assert.equal(summary.sampleCount, 0);
  assert.deepEqual(summary.points, []);
  assert.equal(summary.peak, undefined);
  assert.equal(summary.latest, undefined);
});

test('buildRankEvolution: 1 snapshot — sampleCount 1, sin tendencia inventada, peak = ese mismo punto', () => {
  const only = snap({ id: 1, observedAt: '2026-09-01T10:00:00.000Z' });
  const summary = buildRankEvolution([only], only.observedAt);
  assert.equal(summary.sampleCount, 1);
  assert.equal(summary.points.length, 1);
  assert.deepEqual(summary.peak, { observedAt: only.observedAt, tier: 'GOLD', rank: 'II', leaguePoints: 40 });
  assert.equal(summary.transitions.length, 0);
});

test('buildRankEvolution: varios snapshots — latest es el más reciente real, firstObservedAt es el más antiguo', () => {
  const recentDescending = [
    snap({ id: 3, observedAt: '2026-09-03T10:00:00.000Z', leaguePoints: 60 }),
    snap({ id: 2, observedAt: '2026-09-02T10:00:00.000Z', leaguePoints: 50 }),
    snap({ id: 1, observedAt: '2026-09-01T10:00:00.000Z', leaguePoints: 40 }),
  ];
  const summary = buildRankEvolution(recentDescending, '2026-09-01T10:00:00.000Z');
  assert.equal(summary.sampleCount, 3);
  assert.equal(summary.latest!.leaguePoints, 60);
  assert.equal(summary.firstObservedAt, '2026-09-01T10:00:00.000Z');
  // cronológico: más antiguo primero
  assert.deepEqual(summary.points.map((p) => p.leaguePoints), [40, 50, 60]);
});

test('buildRankEvolution: peak observado es el máximo real por tier/division/LP, no el más reciente ni el de mayor LP en bruto', () => {
  const recentDescending = [
    snap({ id: 3, observedAt: '2026-09-03T10:00:00.000Z', tier: 'GOLD', rank: 'I', leaguePoints: 10 }),
    snap({ id: 2, observedAt: '2026-09-02T10:00:00.000Z', tier: 'PLATINUM', rank: 'IV', leaguePoints: 0 }),
    snap({ id: 1, observedAt: '2026-09-01T10:00:00.000Z', tier: 'GOLD', rank: 'II', leaguePoints: 90 }),
  ];
  const summary = buildRankEvolution(recentDescending, '2026-09-01T10:00:00.000Z');
  // Platinum IV > Gold I aunque tenga menos LP en bruto y no sea el más reciente.
  assert.equal(summary.peak!.tier, 'PLATINUM');
});

test('buildRankEvolution: firstObservedAt real (más allá de la ventana visible) nunca se sustituye por el primero de la ventana', () => {
  const recentDescending = [snap({ id: 5, observedAt: '2026-09-05T10:00:00.000Z' })];
  const summary = buildRankEvolution(recentDescending, '2026-08-01T00:00:00.000Z');
  assert.equal(summary.firstObservedAt, '2026-08-01T00:00:00.000Z');
});

test('buildRankEvolution: transiciones reales aparecen en la vista pública', () => {
  const recentDescending = [
    snap({ id: 2, observedAt: '2026-09-02T10:00:00.000Z', tier: 'PLATINUM', rank: 'IV', leaguePoints: 0 }),
    snap({ id: 1, observedAt: '2026-09-01T10:00:00.000Z', tier: 'GOLD', rank: 'I', leaguePoints: 95 }),
  ];
  const summary = buildRankEvolution(recentDescending, '2026-09-01T10:00:00.000Z');
  assert.equal(summary.transitions.length, 1);
  assert.equal(summary.transitions[0]!.direction, 'up');
  assert.equal(summary.transitions[0]!.toTier, 'PLATINUM');
});

test('unavailableRankEvolution: available:false — nunca se confunde con "0 snapshots reales"', () => {
  const summary = unavailableRankEvolution();
  assert.equal(summary.available, false);
  assert.equal(summary.sampleCount, 0);
});
