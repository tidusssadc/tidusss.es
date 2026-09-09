import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../../functions/api/riot/matches/[matchId]/timeline.ts';
import { clearRiotMemoryCache } from '../../src/lib/riot/cache.ts';
import type { MatchTimelinePublicResponse } from '../../src/lib/riot/timeline-types.ts';
import type { RiotMatchDto } from '../../src/lib/riot/types.ts';

/**
 * Pruebas del endpoint público `GET /api/riot/matches/{matchId}/timeline`
 * — ejecutan el handler real (`onRequest`) con `globalThis.fetch`
 * sustituido por un router sintético, nunca contra Riot real.
 */

const ENV = {
  RIOT_API_KEY: 'RGAPI-test-key-do-not-leak-1234567890',
  RIOT_GAME_NAME: 'Tidusss',
  RIOT_TAG_LINE: 'FFX',
  RIOT_PLATFORM_ROUTE: 'euw1',
  RIOT_REGIONAL_ROUTE: 'europe',
};

const SELF_PUUID = 'puuid-tidusss-endpoint';
const MATCH_ID = 'EUW1_8000000001';

interface MockRoute {
  match: (url: string) => boolean;
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name: string) => headers[name] ?? headers[name.toLowerCase()] ?? null },
  json: async () => body,
});

const installFetchMock = (routes: MockRoute[]) => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: unknown) => {
    const url = String(input);
    const route = routes.find((candidate) => candidate.match(url));
    if (!route) return jsonResponse(500, { message: 'unmocked url in test' });
    return jsonResponse(route.status, route.body, route.headers);
  }) as typeof fetch;
  return {
    restore: () => {
      globalThis.fetch = original;
    },
  };
};

const matchDetailFixture = (): RiotMatchDto => ({
  metadata: { matchId: MATCH_ID },
  info: {
    gameCreation: Date.now(),
    gameDuration: 1500,
    queueId: 420,
    participants: [
      { puuid: SELF_PUUID, championName: 'Jinx', teamId: 100, teamPosition: 'BOTTOM' },
      { puuid: 'puuid-rival', championName: 'Draven', teamId: 200, teamPosition: 'BOTTOM' },
    ],
    teams: [{ teamId: 100, win: true }, { teamId: 200, win: false }],
  },
});

const HAPPY_ROUTES: MockRoute[] = [
  { match: (url) => url.includes('/accounts/by-riot-id/'), status: 200, body: { puuid: SELF_PUUID, gameName: 'Tidusss', tagLine: 'FFX' } },
  { match: (url) => url.includes('/matches/by-puuid/') && url.includes('/ids'), status: 200, body: [MATCH_ID] },
  { match: (url) => /\/matches\/[^/]+$/.test(url) && !url.includes('/ids'), status: 200, body: matchDetailFixture() },
  {
    match: (url) => url.includes('/timeline'),
    status: 200,
    body: {
      metadata: { matchId: MATCH_ID },
      info: {
        frameInterval: 60_000,
        participants: [{ participantId: 1, puuid: SELF_PUUID }, { participantId: 6, puuid: 'puuid-rival' }],
        frames: [{ timestamp: 0, participantFrames: { '1': { minionsKilled: 0, totalGold: 500, xp: 0 } } }],
      },
    },
  },
  { match: (url) => url.includes('api/versions.json'), status: 200, body: ['15.14.1'] },
  { match: (url) => url.includes('/data/es_ES/item.json'), status: 200, body: { data: {} } },
];

const get = (path: string) => new Request(`https://tidusss.es${path}`, { method: 'GET' });

beforeEach(() => {
  clearRiotMemoryCache();
});

test('rechaza cualquier método distinto de GET', async () => {
  const response = await onRequest({
    request: new Request('https://tidusss.es/api/riot/matches/EUW1_1/timeline', { method: 'POST' }),
    env: ENV,
    params: { matchId: 'EUW1_1' },
  });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'GET');
});

test('un GET válido con un matchId real devuelve ok:true con el timeline normalizado', async () => {
  const mock = installFetchMock(HAPPY_ROUTES);
  try {
    const response = await onRequest({ request: get(`/api/riot/matches/${MATCH_ID}/timeline`), env: ENV, params: { matchId: MATCH_ID } });
    assert.equal(response.status, 200);
    const payload = (await response.json()) as MatchTimelinePublicResponse;
    assert.equal(payload.ok, true);
    if (payload.ok) {
      assert.equal(payload.data.matchId, MATCH_ID);
      assert.equal(payload.data.tidussChampionName, 'Jinx');
    }
  } finally {
    mock.restore();
  }
});

test('el Cache-Control de una respuesta correcta usa un s-maxage muy largo (partida terminada = inmutable)', async () => {
  const mock = installFetchMock(HAPPY_ROUTES);
  try {
    const response = await onRequest({ request: get(`/api/riot/matches/${MATCH_ID}/timeline`), env: ENV, params: { matchId: MATCH_ID } });
    const cacheControl = response.headers.get('Cache-Control') ?? '';
    assert.match(cacheControl, /s-maxage=2592000/);
  } finally {
    mock.restore();
  }
});

test('un matchId con forma inválida se rechaza con 400, sin tocar red', async () => {
  const mock = installFetchMock(HAPPY_ROUTES);
  try {
    const response = await onRequest({
      request: get('/api/riot/matches/not-a-real-id/timeline'),
      env: ENV,
      params: { matchId: 'not-a-real-id' },
    });
    assert.equal(response.status, 400);
    const payload = (await response.json()) as MatchTimelinePublicResponse;
    assert.equal(payload.ok, false);
  } finally {
    mock.restore();
  }
});

test('un matchId ausente en la ruta se rechaza con 400', async () => {
  const response = await onRequest({ request: get('/api/riot/matches//timeline'), env: ENV, params: {} });
  assert.equal(response.status, 400);
});

test('un matchId fuera del historial reciente conocido se rechaza con 404', async () => {
  const mock = installFetchMock([
    HAPPY_ROUTES[0]!,
    HAPPY_ROUTES[1]!, // solo devuelve MATCH_ID en la lista reciente
  ]);
  try {
    const response = await onRequest({
      request: get('/api/riot/matches/EUW1_9999999999/timeline'),
      env: ENV,
      params: { matchId: 'EUW1_9999999999' },
    });
    assert.equal(response.status, 404);
  } finally {
    mock.restore();
  }
});

test('nunca se devuelve un mensaje de error técnico (stack, nombre de excepción) al cliente', async () => {
  const response = await onRequest({
    request: get('/api/riot/matches/x/timeline'),
    env: { ...ENV, RIOT_API_KEY: '' },
    params: { matchId: 'EUW1_1' },
  });
  const text = await response.text();
  assert.ok(!text.toLowerCase().includes('riotapierror'));
  assert.ok(!text.toLowerCase().includes('at '));
});

test('la respuesta pública nunca expone el DTO crudo de Riot (metadata/info sin normalizar)', async () => {
  const mock = installFetchMock(HAPPY_ROUTES);
  try {
    const response = await onRequest({ request: get(`/api/riot/matches/${MATCH_ID}/timeline`), env: ENV, params: { matchId: MATCH_ID } });
    const serialized = await response.text();
    // Claves que solo existen en el DTO crudo de Riot — nunca deberían
    // sobrevivir a la normalización (`frameIntervalMs`, en cambio, es un
    // campo propio y real de `MatchTimeline`, no una fuga del DTO).
    assert.ok(!serialized.includes('participantFrames'));
    assert.ok(!serialized.includes('"metadata"'));
  } finally {
    mock.restore();
  }
});
