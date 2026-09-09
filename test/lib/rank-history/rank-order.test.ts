import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compareRank,
  detectRankTransitions,
  highestRank,
  rankOrdinal,
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

// --- rankOrdinal (solo posición de gráfico, nunca un dato mostrado) ---

test('rankOrdinal: nunca lanza y es coherente con compareRank en todo el rango real de tiers', () => {
  const samples: Array<{ tier?: string; rank?: string; leaguePoints?: number }> = [
    {},
    { tier: 'IRON', rank: 'IV', leaguePoints: 0 },
    { tier: 'IRON', rank: 'I', leaguePoints: 99 },
    { tier: 'BRONZE', rank: 'IV', leaguePoints: 0 },
    { tier: 'GOLD', rank: 'III', leaguePoints: 40 },
    { tier: 'DIAMOND', rank: 'I', leaguePoints: 95 },
    { tier: 'MASTER', leaguePoints: 0 },
    { tier: 'MASTER', leaguePoints: 245 },
    { tier: 'GRANDMASTER', leaguePoints: 100 },
    { tier: 'CHALLENGER', leaguePoints: 1200 },
  ];
  for (let i = 1; i < samples.length; i += 1) {
    const prev = samples[i - 1]!;
    const curr = samples[i]!;
    assert.ok(
      rankOrdinal(curr) > rankOrdinal(prev),
      `rankOrdinal(${JSON.stringify(curr)}) debería ser mayor que rankOrdinal(${JSON.stringify(prev)})`,
    );
    assert.ok(compareRank(curr, prev) >= 0);
  }
});

test('rankOrdinal: Platinum IV 0 LP siempre por encima de Gold I 95 LP, igual que compareRank', () => {
  const gold = { tier: 'GOLD', rank: 'I', leaguePoints: 95 };
  const platinum = { tier: 'PLATINUM', rank: 'IV', leaguePoints: 0 };
  assert.ok(rankOrdinal(platinum) > rankOrdinal(gold));
});

test('rankOrdinal: Diamond I 80 LP queda por debajo de Master 0 LP (el problema real de un eje de LP crudo)', () => {
  const diamond = { tier: 'DIAMOND', rank: 'I', leaguePoints: 80 };
  const master = { tier: 'MASTER', leaguePoints: 0 };
  assert.ok(rankOrdinal(master) > rankOrdinal(diamond));
});

test('rankOrdinal: sin clasificar es siempre el punto más bajo, por debajo incluso de Iron IV 0 LP', () => {
  assert.ok(rankOrdinal({ tier: 'IRON', rank: 'IV', leaguePoints: 0 }) > rankOrdinal({}));
});

test('rankOrdinal: un LP fuera de rango (ruido de Riot) nunca rompe el orden entre divisiones', () => {
  // LP > 99 puede aparecer brevemente antes de una promoción — se recorta,
  // pero Gold III con LP "inflado" nunca debe superar a Gold II real.
  const goldIIIInflated = { tier: 'GOLD', rank: 'III', leaguePoints: 500 };
  const goldII = { tier: 'GOLD', rank: 'II', leaguePoints: 0 };
  assert.ok(rankOrdinal(goldII) > rankOrdinal(goldIIIInflated));
});
