import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HEARTBEAT_MS,
  decideSnapshot,
  hasRankChanged,
} from '../../../src/lib/rank-history/dedupe.ts';
import type { NewRankSnapshot, RankSnapshot } from '../../../src/lib/rank-history/types.ts';

const base: RankSnapshot = {
  id: 1,
  puuid: 'puuid-tidusss',
  queueType: 'RANKED_SOLO_5x5',
  tier: 'MASTER',
  rank: undefined,
  leaguePoints: 200,
  wins: 100,
  losses: 90,
  observedAt: '2026-09-09T10:00:00.000Z',
  source: 'overview',
};
const candidateFrom = (overrides: Partial<NewRankSnapshot>): NewRankSnapshot => ({
  puuid: base.puuid,
  queueType: base.queueType,
  tier: base.tier,
  rank: base.rank,
  leaguePoints: base.leaguePoints,
  wins: base.wins,
  losses: base.losses,
  observedAt: '2026-09-09T10:05:00.000Z',
  source: 'overview',
  ...overrides,
});

// --- hasRankChanged ---

test('hasRankChanged: false cuando tier/rank/LP/wins/losses son idénticos', () => {
  assert.equal(hasRankChanged(base, candidateFrom({})), false);
});
test('hasRankChanged: true si cambia el LP', () => {
  assert.equal(hasRankChanged(base, candidateFrom({ leaguePoints: 201 })), true);
});
test('hasRankChanged: true si cambian wins/losses (una partida jugada)', () => {
  assert.equal(hasRankChanged(base, candidateFrom({ wins: 101 })), true);
  assert.equal(hasRankChanged(base, candidateFrom({ losses: 91 })), true);
});
test('hasRankChanged: true si cambia el tier', () => {
  assert.equal(hasRankChanged(base, candidateFrom({ tier: 'GRANDMASTER' })), true);
});
test('hasRankChanged: true si cambia la division', () => {
  const withDivision: RankSnapshot = { ...base, tier: 'GOLD', rank: 'II' };
  assert.equal(hasRankChanged(withDivision, candidateFrom({ tier: 'GOLD', rank: 'I' })), true);
});

// --- decideSnapshot ---

test('decideSnapshot: primer snapshot real siempre se guarda', () => {
  const decision = decideSnapshot(undefined, candidateFrom({}));
  assert.deepEqual(decision, { shouldInsert: true, reason: 'first-snapshot' });
});
test('decideSnapshot: sin cambios y dentro del heartbeat, no se guarda', () => {
  const now = Date.parse(base.observedAt) + 1000; // 1s después, muy por debajo del heartbeat
  const decision = decideSnapshot(base, candidateFrom({}), now);
  assert.deepEqual(decision, { shouldInsert: false, reason: 'unchanged' });
});
test('decideSnapshot: con cambio real de LP, se guarda aunque el heartbeat no haya pasado', () => {
  const now = Date.parse(base.observedAt) + 1000;
  const decision = decideSnapshot(base, candidateFrom({ leaguePoints: 215 }), now);
  assert.deepEqual(decision, { shouldInsert: true, reason: 'changed' });
});
test('decideSnapshot: sin cambios pero pasado el heartbeat, se guarda como prueba de seguimiento activo', () => {
  const now = Date.parse(base.observedAt) + HEARTBEAT_MS + 1;
  const decision = decideSnapshot(base, candidateFrom({}), now);
  assert.deepEqual(decision, { shouldInsert: true, reason: 'heartbeat-elapsed' });
});
test('decideSnapshot: exactamente en el límite del heartbeat, se guarda (inclusive)', () => {
  const now = Date.parse(base.observedAt) + HEARTBEAT_MS;
  const decision = decideSnapshot(base, candidateFrom({}), now);
  assert.equal(decision.shouldInsert, true);
});
test('decideSnapshot: nunca genera miles de filas idénticas — llamadas repetidas sin cambios ni heartbeat solo devuelven "unchanged"', () => {
  const now = Date.parse(base.observedAt) + 5000;
  for (let i = 0; i < 20; i += 1) {
    const decision = decideSnapshot(base, candidateFrom({}), now + i);
    assert.equal(decision.shouldInsert, false);
  }
});
