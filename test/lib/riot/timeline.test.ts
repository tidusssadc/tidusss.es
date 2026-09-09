import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getMatchTimeline,
  getRiotOverview,
  MATCH_ID_PATTERN,
} from '../../../src/lib/riot/index.ts';
import { getRiotLiveGame } from '../../../src/lib/riot/live.ts';
import { RiotApiError } from '../../../src/lib/riot/errors.ts';
import { cached, clearRiotMemoryCache } from '../../../src/lib/riot/cache.ts';
import type { RiotEnvironment } from '../../../src/config/riot.ts';
import type { RiotMatchDto } from '../../../src/lib/riot/types.ts';

/**
 * `getMatchTimeline` orquesta red real (Riot + Data Dragon) — mismo patrón
 * que `test/lib/riot/live.test.ts`: `globalThis.fetch` sustituido por un
 * router sintético, nunca contra Riot real (encargo §37).
 */

const ENV: RiotEnvironment = {
  RIOT_API_KEY: 'RGAPI-test-key-do-not-leak-1234567890',
  RIOT_GAME_NAME: 'Tidusss',
  RIOT_TAG_LINE: 'FFX',
  RIOT_PLATFORM_ROUTE: 'euw1',
  RIOT_REGIONAL_ROUTE: 'europe',
};

const SELF_PUUID = 'puuid-tidusss-timeline';
const RIVAL_PUUID = 'puuid-rival-adc-timeline';
const MATCH_ID = 'EUW1_7000000001';

interface MockRoute {
  match: (url: string) => boolean;
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

const jsonResponse = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: {
    get: (name: string) => headers[name] ?? headers[name.toLowerCase()] ?? null,
  },
  json: async () => body,
});

const installFetchMock = (routes: MockRoute[]) => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: unknown) => {
    const url = String(input);
    calls.push(url);
    const route = routes.find((candidate) => candidate.match(url));
    if (!route) return jsonResponse(500, { message: 'unmocked url in test' });
    return jsonResponse(route.status, route.body, route.headers);
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
};

const accountRoute: MockRoute = {
  match: (url) => url.includes('/accounts/by-riot-id/'),
  status: 200,
  body: { puuid: SELF_PUUID, gameName: 'Tidusss', tagLine: 'FFX' },
};
const matchIdsRoute: MockRoute = {
  match: (url) => url.includes('/matches/by-puuid/') && url.includes('/ids'),
  status: 200,
  body: [MATCH_ID, 'EUW1_7000000000'],
};
const ddragonVersionRoute: MockRoute = {
  match: (url) => url.includes('api/versions.json'),
  status: 200,
  body: ['15.14.1'],
};
const ddragonItemsRoute: MockRoute = {
  match: (url) => url.includes('/data/es_ES/item.json'),
  status: 200,
  body: {
    data: {
      '3031': { name: 'Filo Infinito', gold: { total: 3400, purchasable: true }, tags: ['Damage'] },
    },
  },
};
const matchDetailFixture = (): RiotMatchDto => ({
  metadata: { matchId: MATCH_ID },
  info: {
    gameCreation: Date.now(),
    gameDuration: 1500,
    queueId: 420,
    participants: [
      { puuid: SELF_PUUID, championName: 'Jinx', teamId: 100, teamPosition: 'BOTTOM', win: true, kills: 8, deaths: 2, assists: 5 },
      { puuid: RIVAL_PUUID, championName: 'Draven', teamId: 200, teamPosition: 'BOTTOM', win: false, kills: 2, deaths: 8, assists: 1 },
    ],
    teams: [{ teamId: 100, win: true }, { teamId: 200, win: false }],
  },
});
const matchDetailRoute: MockRoute = {
  match: (url) => /\/matches\/[^/]+$/.test(url) && !url.includes('/ids'),
  status: 200,
  body: matchDetailFixture(),
};
const timelineFixture = () => ({
  metadata: { matchId: MATCH_ID },
  info: {
    frameInterval: 60_000,
    participants: [
      { participantId: 1, puuid: SELF_PUUID },
      { participantId: 6, puuid: RIVAL_PUUID },
    ],
    frames: [
      { timestamp: 0, participantFrames: { '1': { minionsKilled: 0, totalGold: 500, xp: 0 }, '6': { minionsKilled: 0, totalGold: 500, xp: 0 } } },
      { timestamp: 600_000, participantFrames: { '1': { minionsKilled: 86, totalGold: 4120, xp: 5200 }, '6': { minionsKilled: 77, totalGold: 3690, xp: 4900 } } },
    ],
  },
});
const timelineRoute: MockRoute = {
  match: (url) => url.includes('/timeline'),
  status: 200,
  body: timelineFixture(),
};
const notFoundTimelineRoute: MockRoute = {
  match: (url) => url.includes('/timeline'),
  status: 404,
  body: { status: { status_code: 404, message: 'Data not found' } },
};
const rateLimitedTimelineRoute: MockRoute = {
  match: (url) => url.includes('/timeline'),
  status: 429,
  headers: { 'Retry-After': '2' },
  body: { status: { status_code: 429, message: 'Rate limit exceeded' } },
};

const ALL_ROUTES = [
  accountRoute,
  matchIdsRoute,
  matchDetailRoute,
  timelineRoute,
  ddragonVersionRoute,
  ddragonItemsRoute,
];

beforeEach(() => {
  clearRiotMemoryCache();
});

// --- Formato de matchId ---

test('MATCH_ID_PATTERN acepta formatos reales de Riot y rechaza formas sospechosas', () => {
  assert.equal(MATCH_ID_PATTERN.test('EUW1_1234567890'), true);
  assert.equal(MATCH_ID_PATTERN.test('NA1_9999'), true);
  assert.equal(MATCH_ID_PATTERN.test('KR_555'), true);
  assert.equal(MATCH_ID_PATTERN.test('../../etc/passwd'), false);
  assert.equal(MATCH_ID_PATTERN.test('EUW1_'), false);
  assert.equal(MATCH_ID_PATTERN.test('euw1_123'), false); // minúsculas: no es la forma real de Riot
  assert.equal(MATCH_ID_PATTERN.test('EUW1 1234'), false);
  assert.equal(MATCH_ID_PATTERN.test('<script>1234</script>'), false);
});

test('getMatchTimeline: un matchId con forma inválida se rechaza SIN tocar red — nunca llega a Riot', async () => {
  const mock = installFetchMock(ALL_ROUTES);
  try {
    await assert.rejects(
      () => getMatchTimeline(ENV, "'; DROP TABLE--"),
      (error: unknown) => error instanceof RiotApiError && error.code === 'RIOT_MATCH_ID_INVALID' && error.status === 400,
    );
    assert.deepEqual(mock.calls, []);
  } finally {
    mock.restore();
  }
});

test('getMatchTimeline: un matchId que no pertenece al historial reciente conocido de Tidusss se rechaza como 404 — nunca es un proxy Riot arbitrario', async () => {
  const mock = installFetchMock([accountRoute, matchIdsRoute]);
  try {
    await assert.rejects(
      () => getMatchTimeline(ENV, 'EUW1_9999999999'),
      (error: unknown) => error instanceof RiotApiError && error.code === 'RIOT_MATCH_NOT_FOUND' && error.status === 404,
    );
    // Nunca llegó a pedir el detalle de partida ni el Timeline de un matchId ajeno.
    assert.ok(!mock.calls.some((url) => url.includes('/timeline')));
  } finally {
    mock.restore();
  }
});

test('getMatchTimeline: flujo completo real produce un MatchTimeline normalizado', async () => {
  const mock = installFetchMock(ALL_ROUTES);
  try {
    const timeline = await getMatchTimeline(ENV, MATCH_ID);
    assert.equal(timeline.matchId, MATCH_ID);
    assert.equal(timeline.tidussChampionName, 'Jinx');
    assert.equal(timeline.enemyAdcChampionName, 'Draven');
    assert.ok(timeline.laneCheckpoint10);
    assert.ok(timeline.laneComparison10);
  } finally {
    mock.restore();
  }
});

test('getMatchTimeline: reutiliza la caché de detalle de partida ya calentada por el overview — 0 llamadas nuevas a MATCH-V5 detalle', async () => {
  // Precalienta exactamente la misma clave que usa `getRiotOverview`.
  await cached(`riot:match:${MATCH_ID}`, 24 * 60 * 60_000, 7 * 24 * 60 * 60_000, async () => matchDetailFixture());
  const mock = installFetchMock([accountRoute, matchIdsRoute, timelineRoute, ddragonVersionRoute, ddragonItemsRoute]);
  try {
    const timeline = await getMatchTimeline(ENV, MATCH_ID);
    assert.equal(timeline.tidussChampionName, 'Jinx');
    assert.ok(!mock.calls.some((url) => /\/matches\/[^/]+$/.test(url) && !url.includes('/ids')));
  } finally {
    mock.restore();
  }
});

test('getMatchTimeline: un Timeline ya calentado (misma partida, segunda petición) no vuelve a llamar a Riot', async () => {
  const mock = installFetchMock(ALL_ROUTES);
  try {
    await getMatchTimeline(ENV, MATCH_ID);
    const callsAfterFirst = mock.calls.length;
    await getMatchTimeline(ENV, MATCH_ID);
    assert.equal(mock.calls.length, callsAfterFirst, 'la segunda petición no debería añadir llamadas nuevas');
  } finally {
    mock.restore();
  }
});

test('getMatchTimeline: Riot devuelve 404 en Timeline-V5 → RIOT_MATCH_NOT_FOUND, sin lanzar un error genérico', async () => {
  const mock = installFetchMock([accountRoute, matchIdsRoute, matchDetailRoute, notFoundTimelineRoute, ddragonVersionRoute, ddragonItemsRoute]);
  try {
    await assert.rejects(
      () => getMatchTimeline(ENV, MATCH_ID),
      (error: unknown) => error instanceof RiotApiError && error.status === 404,
    );
  } finally {
    mock.restore();
  }
});

test('getMatchTimeline: Riot devuelve 429 en Timeline-V5 → RIOT_RATE_LIMITED con retryAfterSeconds real', async () => {
  const mock = installFetchMock([accountRoute, matchIdsRoute, matchDetailRoute, rateLimitedTimelineRoute, ddragonVersionRoute, ddragonItemsRoute]);
  try {
    await assert.rejects(
      () => getMatchTimeline(ENV, MATCH_ID),
      (error: unknown) =>
        error instanceof RiotApiError && error.code === 'RIOT_RATE_LIMITED' && error.retryAfterSeconds === 2,
    );
  } finally {
    mock.restore();
  }
});

// --- Aislamiento real: Timeline nunca entra en la ruta crítica de
// overview/live (encargo §29) — prueba en tiempo de ejecución, no solo
// una afirmación en la documentación. ---

test('getRiotOverview: cargar el resumen competitivo nunca dispara ninguna llamada a Timeline-V5', async () => {
  const summonerRoute: MockRoute = {
    match: (url) => url.includes('/summoner/v4/summoners/by-puuid/'),
    status: 200,
    body: { profileIconId: 1, summonerLevel: 300 },
  };
  const rankedRoute: MockRoute = {
    match: (url) => url.includes('/league/v4/entries/by-puuid/'),
    status: 200,
    body: [{ queueType: 'RANKED_SOLO_5x5', tier: 'GOLD', rank: 'II', leaguePoints: 40, wins: 20, losses: 15 }],
  };
  const mock = installFetchMock([
    accountRoute,
    summonerRoute,
    rankedRoute,
    matchIdsRoute,
    matchDetailRoute,
    ddragonVersionRoute,
  ]);
  try {
    const overview = await getRiotOverview(ENV);
    assert.equal(overview.profile.riotId, 'Tidusss#FFX');
    assert.ok(!mock.calls.some((url) => url.includes('/timeline')));
  } finally {
    mock.restore();
  }
});

test('getRiotLiveGame: consultar "partida en curso" nunca dispara ninguna llamada a Timeline-V5', async () => {
  const notInGameRoute: MockRoute = {
    match: (url) => url.includes('/spectator/v5/active-games/'),
    status: 404,
    body: { status: { status_code: 404, message: 'Not Found' } },
  };
  const mock = installFetchMock([accountRoute, notInGameRoute, ddragonVersionRoute]);
  try {
    const live = await getRiotLiveGame(ENV);
    assert.equal(live.status, 'not_in_game');
    assert.ok(!mock.calls.some((url) => url.includes('/timeline')));
  } finally {
    mock.restore();
  }
});

test('getMatchTimeline: sin RIOT_API_KEY configurada, falla antes de tocar red', async () => {
  const mock = installFetchMock(ALL_ROUTES);
  try {
    await assert.rejects(
      () => getMatchTimeline({ ...ENV, RIOT_API_KEY: '' }, MATCH_ID),
      (error: unknown) => error instanceof RiotApiError && error.code === 'RIOT_API_KEY_MISSING',
    );
    assert.deepEqual(mock.calls, []);
  } finally {
    mock.restore();
  }
});
