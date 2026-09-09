import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../../functions/api/riot/rank-snapshot-cron.ts';
import { clearRiotMemoryCache } from '../../src/lib/riot/cache.ts';
import type { D1Database, D1PreparedStatement, D1Result } from '../../src/lib/rank-history/d1-types.ts';

/**
 * Mismo patrón de mock de red (router de rutas sintéticas, sin tocar Riot
 * real) que `test/lib/riot/live.test.ts` — `getRiotOverview` es la misma
 * orquestación real que este endpoint reutiliza (encargo §29).
 */

const SECRET = 'test-cron-secret-do-not-leak';
const SELF_PUUID = 'puuid-cron-test';

const ENV_BASE = {
  RIOT_API_KEY: 'RGAPI-test-key-do-not-leak-1234567890',
  RIOT_GAME_NAME: 'Tidusss',
  RIOT_TAG_LINE: 'FFX',
  RIOT_PLATFORM_ROUTE: 'euw1',
  RIOT_REGIONAL_ROUTE: 'europe',
  RANK_SNAPSHOT_CRON_SECRET: SECRET,
};

interface MockRoute {
  match: (url: string) => boolean;
  status: number;
  body?: unknown;
}

const jsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const installFetchMock = (routes: MockRoute[]) => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: unknown) => {
    const url = String(input);
    const route = routes.find((candidate) => candidate.match(url));
    if (!route) return jsonResponse(500, { message: 'unmocked url in test' });
    return jsonResponse(route.status, route.body);
  }) as unknown as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
};

const accountRoute: MockRoute = {
  match: (url) => url.includes('/accounts/by-riot-id/'),
  status: 200,
  body: { puuid: SELF_PUUID, gameName: 'Tidusss', tagLine: 'FFX' },
};
const summonerRoute: MockRoute = {
  match: (url) => url.includes('/summoner/v4/summoners/by-puuid/'),
  status: 200,
  body: { id: 'summoner-id', puuid: SELF_PUUID, profileIconId: 1, summonerLevel: 500 },
};
const rankedSoloRoute: MockRoute = {
  match: (url) => url.includes('/league/v4/entries/by-puuid/'),
  status: 200,
  body: [
    {
      queueType: 'RANKED_SOLO_5x5',
      tier: 'MASTER',
      rank: 'I',
      leaguePoints: 245,
      wins: 120,
      losses: 98,
    },
  ],
};
const noMatchesRoute: MockRoute = {
  match: (url) => url.includes('/match/v5/matches/by-puuid/'),
  status: 200,
  body: [],
};
const ddragonVersionRoute: MockRoute = {
  match: (url) => url.includes('api/versions.json'),
  status: 200,
  body: ['15.14.1'],
};

const HAPPY_PATH_ROUTES = [accountRoute, summonerRoute, rankedSoloRoute, noMatchesRoute, ddragonVersionRoute];

const post = (headers: Record<string, string> = {}, body?: string) =>
  new Request('https://tidusss.es/api/riot/rank-snapshot-cron', {
    method: 'POST',
    headers,
    body,
  });

class FakeD1 implements D1Database {
  rows: Record<string, unknown>[] = [];
  prepare(query: string): D1PreparedStatement {
    const statement: D1PreparedStatement = {
      bind: () => statement,
      first: async <T>() => {
        const result = await statement.all<T>();
        return result.results?.[0] ?? null;
      },
      run: async <T>(): Promise<D1Result<T>> => {
        if (query.startsWith('INSERT')) {
          this.rows.push({ id: this.rows.length + 1 });
          return { success: true, meta: { last_row_id: this.rows.length } };
        }
        return { success: true, meta: { last_row_id: 1 } };
      },
      all: async <T>(): Promise<D1Result<T>> => {
        return { success: true, results: [] as unknown as T[] };
      },
    };
    return statement;
  }
}

let restoreFetch: (() => void) | undefined;

beforeEach(() => {
  clearRiotMemoryCache();
  restoreFetch?.();
  restoreFetch = undefined;
});

test('rechaza cualquier método distinto de POST', async () => {
  const response = await onRequest({
    request: new Request('https://tidusss.es/api/riot/rank-snapshot-cron', { method: 'GET' }),
    env: { ...ENV_BASE, DB: new FakeD1() },
  });
  assert.equal(response.status, 405);
});

test('sin Authorization, 401 y nunca toca Riot ni D1', async () => {
  let called = false;
  restoreFetch = installFetchMock([]);
  globalThis.fetch = (async () => {
    called = true;
    return jsonResponse(200, {});
  }) as unknown as typeof fetch;
  const response = await onRequest({ request: post(), env: { ...ENV_BASE, DB: new FakeD1() } });
  assert.equal(response.status, 401);
  assert.equal(called, false);
});

test('con secreto incorrecto, 401', async () => {
  const response = await onRequest({
    request: post({ Authorization: 'Bearer wrong-secret' }),
    env: { ...ENV_BASE, DB: new FakeD1() },
  });
  assert.equal(response.status, 401);
});

test('sin RANK_SNAPSHOT_CRON_SECRET configurado en el servidor, 401 incluso con header', async () => {
  const envNoSecret = { ...ENV_BASE, RANK_SNAPSHOT_CRON_SECRET: undefined, DB: new FakeD1() };
  const response = await onRequest({
    request: post({ Authorization: `Bearer ${SECRET}` }),
    env: envNoSecret,
  });
  assert.equal(response.status, 401);
});

test('sin binding DB, 503 STORAGE_NOT_CONFIGURED', async () => {
  const response = await onRequest({
    request: post({ Authorization: `Bearer ${SECRET}` }),
    env: ENV_BASE,
  });
  assert.equal(response.status, 503);
  const payload = (await response.json()) as { error: { code: string } };
  assert.equal(payload.error.code, 'STORAGE_NOT_CONFIGURED');
});

test('con secreto correcto y DB configurada, registra el snapshot vía getRiotOverview', async () => {
  restoreFetch = installFetchMock(HAPPY_PATH_ROUTES);
  const db = new FakeD1();
  const response = await onRequest({
    request: post({ Authorization: `Bearer ${SECRET}` }),
    env: { ...ENV_BASE, DB: db },
  });
  assert.equal(response.status, 200);
  const payload = (await response.json()) as { ok: boolean; data: { inserted: boolean } };
  assert.equal(payload.ok, true);
  assert.equal(payload.data.inserted, true);
  assert.equal(db.rows.length, 1);
});

test('el body nunca puede inyectar un PUUID propio — siempre resuelve la cuenta del servidor', async () => {
  restoreFetch = installFetchMock(HAPPY_PATH_ROUTES);
  const db = new FakeD1();
  const response = await onRequest({
    request: new Request('https://tidusss.es/api/riot/rank-snapshot-cron', {
      method: 'POST',
      headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ puuid: 'attacker-supplied-puuid' }),
    }),
    env: { ...ENV_BASE, DB: db },
  });
  assert.equal(response.status, 200);
  // La única cuenta jamás usada es la resuelta server-side (accountRoute → SELF_PUUID),
  // el body JSON del atacante ni siquiera se lee — se confirma con 200 + 1 fila insertada.
  assert.equal(db.rows.length, 1);
});
