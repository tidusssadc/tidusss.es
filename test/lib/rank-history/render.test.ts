import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRankEvolutionView } from '../../../src/lib/rank-history/render.ts';
import { unavailableRankEvolution } from '../../../src/lib/rank-history/evolution.ts';
import type { RankEvolutionSummary } from '../../../src/lib/rank-history/evolution.ts';

const NOW = Date.parse('2026-09-09T12:00:00.000Z');

test('buildRankEvolutionView: sin storage configurado (available:false) — estado "hidden", nunca un mensaje de error', () => {
  const view = buildRankEvolutionView(unavailableRankEvolution(), NOW);
  assert.equal(view.state, 'hidden');
  assert.deepEqual(view.points, []);
});

test('buildRankEvolutionView: 0 snapshots reales — estado "empty", distinto de "hidden"', () => {
  const summary: RankEvolutionSummary = {
    available: true,
    sampleCount: 0,
    transitions: [],
    points: [],
  };
  const view = buildRankEvolutionView(summary, NOW);
  assert.equal(view.state, 'empty');
});

test('buildRankEvolutionView: 1 snapshot — estado "single", con "Seguimiento desde" pero sin chart ni peak', () => {
  const summary: RankEvolutionSummary = {
    available: true,
    sampleCount: 1,
    firstObservedAt: '2026-09-01T10:00:00.000Z',
    latest: { tier: 'DIAMOND', rank: 'II', leaguePoints: 40, observedAt: '2026-09-01T10:00:00.000Z' },
    peak: { tier: 'DIAMOND', rank: 'II', leaguePoints: 40, observedAt: '2026-09-01T10:00:00.000Z' },
    transitions: [],
    points: [{ tier: 'DIAMOND', rank: 'II', leaguePoints: 40, observedAt: '2026-09-01T10:00:00.000Z' }],
  };
  const view = buildRankEvolutionView(summary, NOW);
  assert.equal(view.state, 'single');
  assert.equal(view.currentLabel, 'Diamond II');
  assert.equal(view.currentLpLabel, '40 LP');
  assert.ok(view.sinceLabel?.startsWith('Seguimiento desde'));
  assert.equal(view.peakLabel, undefined);
  assert.deepEqual(view.points, []);
});

test('buildRankEvolutionView: 2+ snapshots — estado "chart", con copy exacto "Peak observado" y "Seguimiento desde"', () => {
  const summary: RankEvolutionSummary = {
    available: true,
    sampleCount: 2,
    firstObservedAt: '2026-08-01T10:00:00.000Z',
    latest: { tier: 'MASTER', leaguePoints: 20, observedAt: '2026-09-05T10:00:00.000Z' },
    peak: { tier: 'MASTER', leaguePoints: 20, observedAt: '2026-09-05T10:00:00.000Z' },
    transitions: [
      {
        observedAt: '2026-09-05T10:00:00.000Z',
        direction: 'up',
        fromTier: 'DIAMOND',
        fromRank: 'I',
        toTier: 'MASTER',
        toRank: undefined,
      },
    ],
    points: [
      { tier: 'DIAMOND', rank: 'I', leaguePoints: 80, observedAt: '2026-08-01T10:00:00.000Z' },
      { tier: 'MASTER', leaguePoints: 20, observedAt: '2026-09-05T10:00:00.000Z' },
    ],
  };
  const view = buildRankEvolutionView(summary, NOW);
  assert.equal(view.state, 'chart');
  assert.equal(view.currentLabel, 'Master');
  assert.equal(view.peakLabel, 'Peak observado: Master');
  assert.ok(view.sinceLabel?.startsWith('Seguimiento desde'));
  assert.ok(view.latestTransitionLabel?.startsWith('↑ Diamond I → Master ·'));
  assert.equal(view.points.length, 2);
});

test('buildRankEvolutionView: nunca dice "Peak Season" — el texto exacto es "Peak observado"', () => {
  const summary: RankEvolutionSummary = {
    available: true,
    sampleCount: 2,
    firstObservedAt: '2026-08-01T10:00:00.000Z',
    latest: { tier: 'GOLD', rank: 'II', leaguePoints: 10, observedAt: '2026-09-01T10:00:00.000Z' },
    peak: { tier: 'GOLD', rank: 'I', leaguePoints: 90, observedAt: '2026-08-15T10:00:00.000Z' },
    transitions: [],
    points: [
      { tier: 'GOLD', rank: 'III', leaguePoints: 0, observedAt: '2026-08-01T10:00:00.000Z' },
      { tier: 'GOLD', rank: 'II', leaguePoints: 10, observedAt: '2026-09-01T10:00:00.000Z' },
    ],
  };
  const view = buildRankEvolutionView(summary, NOW);
  assert.ok(view.peakLabel?.includes('Peak observado'));
  assert.ok(!view.peakLabel?.toLowerCase().includes('season'));
  // Sin transición real detectada en esta muestra — nunca se inventa una.
  assert.equal(view.latestTransitionLabel, undefined);
});

test('buildRankEvolutionView: sin transiciones reales, latestTransitionLabel queda undefined (nunca inventado)', () => {
  const summary: RankEvolutionSummary = {
    available: true,
    sampleCount: 3,
    firstObservedAt: '2026-08-01T10:00:00.000Z',
    latest: { tier: 'GOLD', rank: 'II', leaguePoints: 30, observedAt: '2026-09-01T10:00:00.000Z' },
    peak: { tier: 'GOLD', rank: 'II', leaguePoints: 30, observedAt: '2026-09-01T10:00:00.000Z' },
    transitions: [],
    points: [
      { tier: 'GOLD', rank: 'II', leaguePoints: 5, observedAt: '2026-08-01T10:00:00.000Z' },
      { tier: 'GOLD', rank: 'II', leaguePoints: 15, observedAt: '2026-08-15T10:00:00.000Z' },
      { tier: 'GOLD', rank: 'II', leaguePoints: 30, observedAt: '2026-09-01T10:00:00.000Z' },
    ],
  };
  const view = buildRankEvolutionView(summary, NOW);
  assert.equal(view.latestTransitionLabel, undefined);
});
