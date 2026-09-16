import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDeterministicInsights,
  deriveSessionLpDelta,
} from '../../../src/lib/riot/insights.ts';
import type {
  ProfilePerformance,
  RecentMatch,
  RiotOverview,
  TodaySoloQueue,
} from '../../../src/lib/riot/types.ts';

const SOLO_QUEUE_ID = 420;

let seq = 0;
const match = (overrides: Partial<RecentMatch> = {}): RecentMatch => {
  seq += 1;
  return {
    matchId: `EUW1_${seq}`,
    championId: 236,
    championName: 'Lucian',
    win: true,
    kills: 6,
    deaths: 2,
    assists: 4,
    kda: 5,
    cs: 180,
    csPerMinute: 7.2,
    durationSeconds: 1500,
    durationLabel: '25:00',
    queueId: SOLO_QUEUE_ID,
    queueLabel: 'Solo/Duo',
    playedAt: new Date(Date.UTC(2026, 0, 10, 18, seq, 0)).toISOString(),
    items: [],
    itemImageUrls: [],
    damageToChampions: 18000,
    goldEarned: 12000,
    visionScore: 20,
    position: 'BOTTOM',
    summonerSpells: [],
    runes: [],
    teams: [],
    teamId: 100,
    remake: false,
    ...overrides,
  };
};

const performance = (over: Partial<ProfilePerformance> = {}): ProfilePerformance => ({
  sampleSize: 20,
  windowRecent: { sampleSize: 20, wins: 13, losses: 7, winRate: 65 },
  windowFull: { sampleSize: 20, wins: 11, losses: 9, winRate: 55 },
  trend: [
    { windowSize: 5, sampleSize: 5, winRate: 80, averageCsPerMinute: 8.6 },
    { windowSize: 10, sampleSize: 10, winRate: 70, averageCsPerMinute: 8.2 },
    { windowSize: 20, sampleSize: 20, winRate: 65, averageCsPerMinute: 7.9 },
  ],
  champions: [
    { championName: 'Lucian', games: 12, wins: 8, losses: 4, winRate: 67, averageKills: 8, averageDeaths: 3, averageAssists: 6, averageKda: 4.6, averageCsPerMinute: 8.2 },
    { championName: 'Kaisa', games: 4, wins: 1, losses: 3, winRate: 25, averageKills: 5, averageDeaths: 5, averageAssists: 6, averageKda: 2.2, averageCsPerMinute: 7.7 },
  ],
  championDistribution: { entries: [] },
  roles: [],
  activityByWeekday: [],
  activityByHourBand: [],
  supportSynergy: [],
  adcMatchups: [],
  sideSplit: [],
  duration: { buckets: [] },
  ...over,
});

const today = (over: Partial<TodaySoloQueue> = {}): TodaySoloQueue => ({
  games: 4,
  wins: 3,
  losses: 1,
  winRate: 75,
  averageKda: 3.6,
  streak: { result: 'win', games: 3 },
  activity: 'recent',
  lpDelta: undefined,
  lpDeltaEstimated: true,
  matches: [],
  ...over,
});

const overview = (
  over: Partial<Pick<RiotOverview, 'today' | 'recent' | 'performance'>> = {},
): Pick<RiotOverview, 'today' | 'recent' | 'performance'> => ({
  today: today(),
  recent: {
    sampleSize: 20,
    wins: 13,
    losses: 7,
    winRate: 65,
    champions: [],
    positions: [],
    gamesLastSevenDays: 20,
    editorialSummary: [],
    matches: Array.from({ length: 5 }, () => match({ championName: 'Lucian' })),
  },
  performance: performance(),
  ...over,
});

test('sin nada que supere umbral → lista vacía', () => {
  const result = buildDeterministicInsights({
    today: today({ streak: undefined, games: 0 }),
    recent: { sampleSize: 0, wins: 0, losses: 0, champions: [], positions: [], gamesLastSevenDays: 0, editorialSummary: [], matches: [] },
    performance: performance({
      trend: [],
      champions: [],
      windowRecent: { sampleSize: 0, wins: 0, losses: 0 },
      windowFull: { sampleSize: 0, wins: 0, losses: 0 },
    }),
  });
  assert.deepEqual(result, []);
});

test('una racha de 1 no es una racha', () => {
  const result = buildDeterministicInsights(
    overview({ today: today({ streak: { result: 'win', games: 1 } }) }),
  );
  assert.equal(
    result.some((insight) => insight.key === 'session-streak'),
    false,
  );
});

test('racha de 3 victorias hoy → insight con el texto exacto', () => {
  const result = buildDeterministicInsights(overview());
  const streak = result.find((insight) => insight.key === 'session-streak');
  assert.equal(streak?.text, '3 victorias seguidas hoy');
});

test('concentración de campeón: 5 de las últimas 5 con Lucian', () => {
  const result = buildDeterministicInsights(overview());
  const conc = result.find((insight) => insight.key === 'recent-concentration');
  assert.equal(conc?.text, '5 de las últimas 5 partidas con Lucian');
});

test('salto de forma solo si el delta de WR llega al umbral', () => {
  const flat = buildDeterministicInsights(
    overview({
      performance: performance({
        windowRecent: { sampleSize: 20, wins: 11, losses: 9, winRate: 55 },
        windowFull: { sampleSize: 20, wins: 11, losses: 9, winRate: 55 },
      }),
    }),
  );
  assert.equal(flat.some((insight) => insight.key === 'form-shift'), false);

  const shifted = buildDeterministicInsights(overview());
  const shift = shifted.find((insight) => insight.key === 'form-shift');
  assert.match(shift?.text ?? '', /sube: 65% WR en las últimas 20 vs 55% en la muestra/);
});

test('mejor campeón: solo con muestra >= 3 y WR >= 55', () => {
  const result = buildDeterministicInsights(overview(), 8);
  const best = result.find((insight) => insight.key === 'best-champion');
  assert.equal(best?.text, 'Mejor WR reciente: Lucian 67% (12 partidas)');

  const lowWr = buildDeterministicInsights(
    overview({
      performance: performance({
        champions: [
          { championName: 'Kaisa', games: 5, wins: 2, losses: 3, winRate: 40, averageKills: 5, averageDeaths: 5, averageAssists: 6, averageKda: 2.2, averageCsPerMinute: 7.7 },
        ],
      }),
    }),
    8,
  );
  assert.equal(lowWr.some((insight) => insight.key === 'best-champion'), false);
});

test('limita el número de insights', () => {
  const result = buildDeterministicInsights(overview(), 2);
  assert.equal(result.length, 2);
});

// --- deriveSessionLpDelta ---

test('sin snapshot previo al inicio de sesión → null', () => {
  const result = deriveSessionLpDelta(
    [{ observedAt: '2026-09-10T20:00:00.000Z', tier: 'MASTER', leaguePoints: 554 }],
    '2026-09-10T10:00:00.000Z',
    { observedAt: '2026-09-10T21:00:00.000Z', tier: 'MASTER', leaguePoints: 554 },
  );
  assert.equal(result, null);
});

test('con snapshot previo real → delta de LP correcto y sin cambio de división', () => {
  const result = deriveSessionLpDelta(
    [
      { observedAt: '2026-09-10T08:00:00.000Z', tier: 'MASTER', leaguePoints: 520 },
      { observedAt: '2026-09-10T14:00:00.000Z', tier: 'MASTER', leaguePoints: 540 },
    ],
    '2026-09-10T12:00:00.000Z',
    { observedAt: '2026-09-10T21:00:00.000Z', tier: 'MASTER', leaguePoints: 554 },
  );
  assert.equal(result?.fromLeaguePoints, 520);
  assert.equal(result?.delta, 34);
  assert.equal(result?.tierChanged, false);
});

test('Master sin división vs Master con rank:"I" de Riot → NO cuenta como cambio de división', () => {
  const result = deriveSessionLpDelta(
    [{ observedAt: '2026-09-10T08:00:00.000Z', tier: 'MASTER', leaguePoints: 540 }],
    '2026-09-10T12:00:00.000Z',
    { observedAt: '2026-09-10T21:00:00.000Z', tier: 'MASTER', rank: 'I', leaguePoints: 554 },
  );
  assert.equal(result?.tierChanged, false);
  assert.equal(result?.delta, 14);
  assert.equal(result?.toLabel, 'MASTER');
});

test('cambio de división entre el snapshot de inicio y ahora → tierChanged true', () => {
  const result = deriveSessionLpDelta(
    [{ observedAt: '2026-09-10T08:00:00.000Z', tier: 'DIAMOND', rank: 'I', leaguePoints: 80 }],
    '2026-09-10T12:00:00.000Z',
    { observedAt: '2026-09-10T21:00:00.000Z', tier: 'MASTER', leaguePoints: 20 },
  );
  assert.equal(result?.tierChanged, true);
  assert.equal(result?.fromLabel, 'DIAMOND I');
  assert.equal(result?.toLabel, 'MASTER');
});
