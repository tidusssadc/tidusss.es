import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compareRank,
  detectRankTransitions,
  highestRank,
} from '../../../src/lib/rank-history/rank-order.ts';

// --- compareRank ---

test('compareRank: tiers distintos ordenan por tier, ignorando LP', () => {
  assert.equal(
    compareRank({ tier: 'GOLD', rank: 'I', leaguePoints: 99 }, { tier: 'PLATINUM', rank: 'IV', leaguePoints: 0 }),
    -1,
  );
});
test('compareRank: mismo tier, division distinta — I es más alto que IV', () => {
  assert.equal(
    compareRank({ tier: 'GOLD', rank: 'I', leaguePoints: 0 }, { tier: 'GOLD', rank: 'IV', leaguePoints: 99 }),
    1,
  );
});
test('compareRank: mismo tier y division — LP decide', () => {
  assert.equal(
    compareRank({ tier: 'GOLD', rank: 'II', leaguePoints: 40 }, { tier: 'GOLD', rank: 'II', leaguePoints: 10 }),
    1,
  );
});
test('compareRank: Master+ no tiene division real — se compara solo por LP dentro del mismo tier', () => {
  assert.equal(
    compareRank({ tier: 'MASTER', leaguePoints: 245 }, { tier: 'MASTER', leaguePoints: 100 }),
    1,
  );
});
test('compareRank: Challenger siempre por encima de Grandmaster, aunque el LP diga lo contrario', () => {
  assert.equal(
    compareRank({ tier: 'CHALLENGER', leaguePoints: 0 }, { tier: 'GRANDMASTER', leaguePoints: 999 }),
    1,
  );
});
test('compareRank: sin clasificar (tier ausente) es siempre lo más bajo', () => {
  assert.equal(compareRank({}, { tier: 'IRON', rank: 'IV', leaguePoints: 0 }), -1);
});
test('compareRank: dos sin clasificar son iguales', () => {
  assert.equal(compareRank({}, {}), 0);
});
test('compareRank: exactamente iguales devuelve 0', () => {
  assert.equal(
    compareRank({ tier: 'DIAMOND', rank: 'III', leaguePoints: 50 }, { tier: 'DIAMOND', rank: 'III', leaguePoints: 50 }),
    0,
  );
});
test('compareRank: nunca lanza con datos parciales (rank ausente en un tier con divisions)', () => {
  assert.doesNotThrow(() => compareRank({ tier: 'GOLD' }, { tier: 'GOLD', rank: 'II' }));
});

// --- highestRank ---

test('highestRank: encuentra el máximo real entre varios snapshots, no el último de la lista', () => {
  const entries = [
    { tier: 'GOLD', rank: 'II', leaguePoints: 10 },
    { tier: 'DIAMOND', rank: 'IV', leaguePoints: 0 },
    { tier: 'GOLD', rank: 'I', leaguePoints: 90 },
  ];
  assert.deepEqual(highestRank(entries), { tier: 'DIAMOND', rank: 'IV', leaguePoints: 0 });
});
test('highestRank: lista vacía devuelve undefined, nunca un rango inventado', () => {
  assert.equal(highestRank([]), undefined);
});
test('highestRank: un único elemento es su propio máximo', () => {
  const entry = { tier: 'SILVER', rank: 'III', leaguePoints: 20 };
  assert.deepEqual(highestRank([entry]), entry);
});

// --- detectRankTransitions ---

test('detectRankTransitions: una subida real de division se detecta como "up"', () => {
  const chronological = [
    { tier: 'GOLD', rank: 'IV', leaguePoints: 90, observedAt: '2026-01-01' },
    { tier: 'GOLD', rank: 'III', leaguePoints: 0, observedAt: '2026-01-02' },
  ];
  const transitions = detectRankTransitions(chronological);
  assert.equal(transitions.length, 1);
  assert.equal(transitions[0]!.direction, 'up');
});
test('detectRankTransitions: una bajada real de tier se detecta como "down"', () => {
  const chronological = [
    { tier: 'PLATINUM', rank: 'IV', leaguePoints: 0, observedAt: '2026-01-01' },
    { tier: 'GOLD', rank: 'I', leaguePoints: 90, observedAt: '2026-01-02' },
  ];
  const transitions = detectRankTransitions(chronological);
  assert.equal(transitions.length, 1);
  assert.equal(transitions[0]!.direction, 'down');
});
test('detectRankTransitions: un simple cambio de LP dentro de la misma division NUNCA cuenta como transición', () => {
  const chronological = [
    { tier: 'GOLD', rank: 'II', leaguePoints: 10, observedAt: '2026-01-01' },
    { tier: 'GOLD', rank: 'II', leaguePoints: 45, observedAt: '2026-01-02' },
    { tier: 'GOLD', rank: 'II', leaguePoints: 5, observedAt: '2026-01-03' },
  ];
  assert.deepEqual(detectRankTransitions(chronological), []);
});
test('detectRankTransitions: 0 o 1 snapshot nunca produce transiciones', () => {
  assert.deepEqual(detectRankTransitions([]), []);
  assert.deepEqual(detectRankTransitions([{ tier: 'GOLD', rank: 'II', leaguePoints: 10, observedAt: '2026-01-01' }]), []);
});
test('detectRankTransitions: varias transiciones reales seguidas se detectan todas, en orden', () => {
  const chronological = [
    { tier: 'GOLD', rank: 'IV', leaguePoints: 0, observedAt: '2026-01-01' },
    { tier: 'GOLD', rank: 'III', leaguePoints: 0, observedAt: '2026-01-02' },
    { tier: 'GOLD', rank: 'III', leaguePoints: 40, observedAt: '2026-01-03' }, // solo LP, no cuenta
    { tier: 'PLATINUM', rank: 'IV', leaguePoints: 0, observedAt: '2026-01-04' },
  ];
  const transitions = detectRankTransitions(chronological);
  assert.equal(transitions.length, 2);
  assert.equal(transitions[0]!.direction, 'up');
  assert.equal(transitions[1]!.direction, 'up');
});
test('detectRankTransitions: entrar en Master desde Diamond I es una transición real', () => {
  const chronological = [
    { tier: 'DIAMOND', rank: 'I', leaguePoints: 95, observedAt: '2026-01-01' },
    { tier: 'MASTER', leaguePoints: 5, observedAt: '2026-01-02' },
  ];
  const transitions = detectRankTransitions(chronological);
  assert.equal(transitions.length, 1);
  assert.equal(transitions[0]!.direction, 'up');
});
