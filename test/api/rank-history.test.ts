import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../../functions/api/riot/rank-history.ts';
import { clearRiotMemoryCache } from '../../src/lib/riot/cache.ts';
import type { RankHistoryPublicResponse } from '../../functions/api/riot/rank-history.ts';
import type { D1Database, D1PreparedStatement, D1Result } from '../../src/lib/rank-history/d1-types.ts';

const ENV_BASE = {
  RIOT_API_KEY: 'RGAPI-test-key-do-not-leak-1234567890',
  RIOT_GAME_NAME: 'Tidusss',
  RIOT_TAG_LINE: 'FFX',
  RIOT_PLATFORM_ROUTE: 'euw1',
  RIOT_REGIONAL_ROUTE: 'europe',
};
const SELF_PUUID = 'puuid-rank-history-test';

const jsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

class FakeD1 implements D1Database {
  rows: Record<string, unknown>[] = [];
  prepare(query: string): D1PreparedStatement {
    let bound: unknown[] = [];
    const statement: D1PreparedStatement = {
      bind: (...values: unknown[]) => {
        bound = values;
        return statement;
      },
      first: async <T>() => {
        const result = await statement.all<T>();
        return result.results?.[0] ?? null;
      },
      run: async <T>(): Promise<D1Result<T>> => {
        return { success: true, meta: { last_row_id: 1 } };
      },
      all: async <T>(): Promise<D1Result<T>> => {
        if (query.includes('LIMIT ?')) {
          return { success: true, results: this.rows.slice(0, bound[2] as number) as unknown as T[] };
        }
        return { success: true, results: this.rows as unknown as T[] };
      },
    };
    return statement;
  }
}

const get = () => new Request('https://tidusss.es/api/riot/rank-history', { method: 'GET' });

beforeEach(() => {
  clearRiotMemoryCache();
});

test('rechaza cualquier método distinto de GET', async () => {
  const response = await onRequest({
    request: new Request('https://tidusss.es/api/riot/rank-history', { method: 'POST' }),
    env: ENV_BASE,
  });
  assert.equal(response.status, 405);
});

test('sin binding DB, responde ok:true con available:false — nunca un 500', async () => {
  const response = await onRequest({ request: get(), env: ENV_BASE });
  assert.equal(response.status, 200);
  const payload = (await response.json()) as RankHistoryPublicResponse;
  assert.equal(payload.ok, true);
  if (payload.ok) assert.equal(payload.data.available, false);
});

test('con DB configurada pero 0 snapshots reales, available:true y sampleCount:0', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: unknown) => {
    const url = String(input);
    if (url.includes('/accounts/by-riot-id/'))
      return jsonResponse(200, { puuid: SELF_PUUID, gameName: 'Tidusss', tagLine: 'FFX' });
    return jsonResponse(500, {});
  }) as unknown as typeof fetch;
  try {
    const response = await onRequest({ request: get(), env: { ...ENV_BASE, DB: new FakeD1() } });
    const payload = (await response.json()) as RankHistoryPublicResponse;
    assert.equal(payload.ok, true);
    if (payload.ok) {
      assert.equal(payload.data.available, true);
      assert.equal(payload.data.sampleCount, 0);
    }
  } finally {
    globalThis.fetch = original;
  }
});

test('la respuesta pública nunca expone el PUUID', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: unknown) => {
    const url = String(input);
    if (url.includes('/accounts/by-riot-id/'))
      return jsonResponse(200, { puuid: SELF_PUUID, gameName: 'Tidusss', tagLine: 'FFX' });
    return jsonResponse(500, {});
  }) as unknown as typeof fetch;
  try {
    const response = await onRequest({ request: get(), env: { ...ENV_BASE, DB: new FakeD1() } });
    const text = await response.text();
    assert.ok(!text.includes(SELF_PUUID));
  } finally {
    globalThis.fetch = original;
  }
});

test('AISLAMIENTO Riot: el endpoint de LECTURA solo puede tocar ACCOUNT-V1 — nunca League/Match/Summoner/Timeline/Data Dragon', async () => {
  // Guardrail de coste (encargo PROJECT AGENT SYSTEM §16): `rank-history` lee
  // D1, no Riot. La única resolución permitida es la cuenta (caché 24h,
  // compartida). Si una regresión futura arrastra otra familia Riot aquí,
  // este test debe fallar.
  const original = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input: unknown) => {
    const url = String(input);
    urls.push(url);
    if (url.includes('/riot/account/v1/accounts/by-riot-id/'))
      return jsonResponse(200, { puuid: SELF_PUUID, gameName: 'Tidusss', tagLine: 'FFX' });
    return jsonResponse(500, { message: `unexpected riot call in rank-history: ${url}` });
  }) as unknown as typeof fetch;
  try {
    await onRequest({ request: get(), env: { ...ENV_BASE, DB: new FakeD1() } });
    for (const url of urls) {
      assert.ok(url.includes('/riot/account/v1/'), `llamada Riot no permitida en rank-history: ${url}`);
      assert.ok(!url.includes('/lol/league/v4/'), `rank-history NO puede llamar a LEAGUE-V4: ${url}`);
      assert.ok(!url.includes('/lol/match/v5/'), `rank-history NO puede llamar a MATCH-V5: ${url}`);
      assert.ok(!url.includes('/lol/summoner/v4/'), `rank-history NO puede llamar a SUMMONER-V4: ${url}`);
      assert.ok(!url.includes('/timeline'), `rank-history NO puede llamar a Timeline: ${url}`);
      assert.ok(
        !url.includes('ddragon') && !url.includes('versions.json') && !url.includes('/cdn/'),
        `rank-history NO puede llamar a Data Dragon: ${url}`,
      );
    }
  } finally {
    globalThis.fetch = original;
  }
});
