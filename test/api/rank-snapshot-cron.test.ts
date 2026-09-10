import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../../functions/api/riot/rank-snapshot-cron.ts';
import { clearRiotMemoryCache } from '../../src/lib/riot/cache.ts';
import type {
  D1Database,
  D1PreparedStatement,
  D1Result,
} from '../../src/lib/rank-history/d1-types.ts';

/**
 * `rank-snapshot-cron` usa el CAMINO LIGERO (`getRiotRankObservation`):
 * ACCOUNT-V1 + LEAGUE-V4 y NADA MÁS (encargo cierre §18/§19). Estos tests
 * lo prueban con un router de red sintético y, sobre todo, incluyen el
 * test de aislamiento del §20: si una regresión futura vuelve a arrastrar
 * MATCH-V5 / Timeline / Data Dragon, DEBE fallar aquí.
 */

const SECRET = 'test-cron-secret-do-not-leak';
const SELF_PUUID = 'puuid-cron-test-not-in-response';

const ENV_BASE = {
  RIOT_API_KEY: 'RGAPI-test-key-do-not-leak-1234567890',
  RIOT_GAME_NAME: 'Tidusss',
  RIOT_TAG_LINE: 'FFX',
  RIOT_PLATFORM_ROUTE: 'euw1',
  RIOT_REGIONAL_ROUTE: 'europe',
  RANK_SNAPSHOT_CRON_SECRET: SECRET,
};

const jsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const SOLO_ENTRY = {
  queueType: 'RANKED_SOLO_5x5',
  tier: 'MASTER',
  rank: 'I',
  leaguePoints: 245,
  wins: 120,
  losses: 98,
};

interface FetchMock {
  restore: () => void;
  urls: string[];
}

const installFetchMock = (
  leagueBody: unknown = [SOLO_ENTRY],
): FetchMock => {
  const original = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input: unknown) => {
    const url = String(input);
    urls.push(url);
    if (url.includes('/riot/account/v1/accounts/by-riot-id/'))
      return jsonResponse(200, { puuid: SELF_PUUID, gameName: 'Tidusss', tagLine: 'FFX' });
    if (url.includes('/lol/league/v4/entries/by-puuid/'))
      return jsonResponse(200, leagueBody);
    // Cualquier otra URL (MATCH-V5, Timeline, Data Dragon, SUMMONER-V4...)
    // NO debería llegar nunca — 500 para que una regresión rompa el test.
    return jsonResponse(500, { message: `unexpected riot call in cron: ${url}` });
  }) as unknown as typeof fetch;
  return {
    urls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
};

class FakeD1 implements D1Database {
  rows: Record<string, unknown>[] = [];
  prepare(query: string): D1PreparedStatement {
    let bound: unknown[] = [];
    const rows = this.rows;
    const statement: D1PreparedStatement = {
      bind: (...values: unknown[]) => {
        bound = values;
        return statement;
      },
      first: async <T>() => {
        // getLatest: ORDER BY observed_at DESC LIMIT 1
        if (query.includes('ORDER BY observed_at DESC LIMIT 1')) {
          const sorted = [...rows].sort((a, b) =>
            String(b.observed_at).localeCompare(String(a.observed_at)),
          );
          return (sorted[0] ?? null) as T | null;
        }
        return (rows[0] ?? null) as T | null;
      },
      run: async <T>(): Promise<D1Result<T>> => {
        if (query.startsWith('INSERT')) {
          const [puuid, queue_type, tier, rank, league_points, wins, losses, observed_at, source] =
            bound as unknown[];
          const collision = rows.some(
            (r) =>
              r.puuid === puuid &&
              r.queue_type === queue_type &&
              r.observed_at === observed_at,
          );
          if (collision) return { success: true, meta: { changes: 0, last_row_id: rows.length } };
          rows.push({ puuid, queue_type, tier, rank, league_points, wins, losses, observed_at, source });
          return { success: true, meta: { changes: 1, last_row_id: rows.length } };
        }
        return { success: true, meta: { changes: 0, last_row_id: 0 } };
      },
      all: async <T>(): Promise<D1Result<T>> => ({ success: true, results: rows as unknown as T[] }),
    };
    return statement;
  }
}

let mock: FetchMock | undefined;

beforeEach(() => {
  clearRiotMemoryCache();
  mock?.restore();
  mock = undefined;
});

const post = (headers: Record<string, string> = {}, body?: string) =>
  new Request('https://tidusss.es/api/riot/rank-snapshot-cron', { method: 'POST', headers, body });

test('rechaza cualquier método distinto de POST', async () => {
  const response = await onRequest({
    request: new Request('https://tidusss.es/api/riot/rank-snapshot-cron', { method: 'GET' }),
    env: { ...ENV_BASE, DB: new FakeD1() },
  });
  assert.equal(response.status, 405);
});

test('sin Authorization: 401 y NO toca Riot ni D1', async () => {
  mock = installFetchMock();
  const db = new FakeD1();
  const response = await onRequest({ request: post(), env: { ...ENV_BASE, DB: db } });
  assert.equal(response.status, 401);
  assert.equal(mock.urls.length, 0);
  assert.equal(db.rows.length, 0);
});

test('secreto incorrecto: 401', async () => {
  const response = await onRequest({
    request: post({ Authorization: 'Bearer nope' }),
    env: { ...ENV_BASE, DB: new FakeD1() },
  });
  assert.equal(response.status, 401);
});

test('sin RANK_SNAPSHOT_CRON_SECRET en el servidor: 401 incluso con header', async () => {
  const response = await onRequest({
    request: post({ Authorization: `Bearer ${SECRET}` }),
    env: { ...ENV_BASE, RANK_SNAPSHOT_CRON_SECRET: undefined, DB: new FakeD1() },
  });
  assert.equal(response.status, 401);
});

test('sin binding DB: 503 STORAGE_NOT_CONFIGURED', async () => {
  mock = installFetchMock();
  const response = await onRequest({
    request: post({ Authorization: `Bearer ${SECRET}` }),
    env: ENV_BASE,
  });
  assert.equal(response.status, 503);
  const payload = (await response.json()) as { error: { code: string } };
  assert.equal(payload.error.code, 'STORAGE_NOT_CONFIGURED');
  // Ni siquiera se resolvió la cuenta.
  assert.equal(mock.urls.length, 0);
});

test('camino feliz: registra el primer snapshot y devuelve diagnóstico mínimo', async () => {
  mock = installFetchMock();
  const db = new FakeD1();
  const response = await onRequest({
    request: post({ Authorization: `Bearer ${SECRET}` }),
    env: { ...ENV_BASE, DB: db },
  });
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    ok: boolean;
    data: {
      observed: { available: boolean; tier: string; leaguePoints: number };
      recorded: boolean;
      reason: string;
      observedAt: string;
    };
  };
  assert.equal(payload.ok, true);
  assert.equal(payload.data.recorded, true);
  assert.equal(payload.data.reason, 'first-snapshot');
  assert.equal(payload.data.observed.available, true);
  assert.equal(payload.data.observed.tier, 'MASTER');
  assert.equal(payload.data.observed.leaguePoints, 245);
  assert.ok(Date.parse(payload.data.observedAt) > 0);
  assert.equal(db.rows.length, 1);
});

test('AISLAMIENTO (§20): SOLO llama ACCOUNT-V1 y LEAGUE-V4 — nunca MATCH-V5, Timeline ni Data Dragon', async () => {
  mock = installFetchMock();
  await onRequest({
    request: post({ Authorization: `Bearer ${SECRET}` }),
    env: { ...ENV_BASE, DB: new FakeD1() },
  });
  assert.ok(mock.urls.length > 0, 'debería haber llamado a Riot al menos una vez');
  for (const url of mock.urls) {
    const isAccount = url.includes('/riot/account/v1/accounts/by-riot-id/');
    const isLeague = url.includes('/lol/league/v4/entries/by-puuid/');
    assert.ok(isAccount || isLeague, `llamada Riot no permitida en el cron: ${url}`);
    assert.ok(!url.includes('/lol/match/v5/'), `el cron NO puede llamar a MATCH-V5: ${url}`);
    assert.ok(!url.includes('/timeline'), `el cron NO puede llamar a Timeline: ${url}`);
    assert.ok(!url.includes('/lol/summoner/v4/'), `el cron NO necesita SUMMONER-V4: ${url}`);
    assert.ok(
      !url.includes('ddragon') && !url.includes('versions.json') && !url.includes('/cdn/'),
      `el cron NO puede llamar a Data Dragon: ${url}`,
    );
  }
});

test('sin rango Solo/Duo real: recorded:false, reason "no-rank-data", nada escrito', async () => {
  mock = installFetchMock([{ queueType: 'RANKED_FLEX_SR', tier: 'GOLD', rank: 'I', leaguePoints: 1, wins: 1, losses: 1 }]);
  const db = new FakeD1();
  const response = await onRequest({
    request: post({ Authorization: `Bearer ${SECRET}` }),
    env: { ...ENV_BASE, DB: db },
  });
  const payload = (await response.json()) as { data: { recorded: boolean; reason: string } };
  assert.equal(payload.data.recorded, false);
  assert.equal(payload.data.reason, 'no-rank-data');
  assert.equal(db.rows.length, 0);
});

test('dos invocaciones seguidas sin cambio real: la segunda NO escribe (dedupe vía endpoint)', async () => {
  mock = installFetchMock();
  const db = new FakeD1();
  const ctx = { request: post({ Authorization: `Bearer ${SECRET}` }), env: { ...ENV_BASE, DB: db } };
  const first = (await (await onRequest(ctx)).json()) as { data: { recorded: boolean } };
  const second = (await (await onRequest({
    request: post({ Authorization: `Bearer ${SECRET}` }),
    env: { ...ENV_BASE, DB: db },
  })).json()) as { data: { recorded: boolean; reason: string } };
  assert.equal(first.data.recorded, true);
  assert.equal(second.data.recorded, false);
  assert.equal(second.data.reason, 'unchanged');
  assert.equal(db.rows.length, 1);
});

test('el body no puede inyectar PUUID/cola — siempre la cuenta del servidor; la respuesta nunca filtra PUUID ni secreto', async () => {
  mock = installFetchMock();
  const db = new FakeD1();
  const response = await onRequest({
    request: new Request('https://tidusss.es/api/riot/rank-snapshot-cron', {
      method: 'POST',
      headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ puuid: 'atacante', queueType: 'RANKED_FLEX_SR' }),
    }),
    env: { ...ENV_BASE, DB: db },
  });
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.ok(!text.includes(SELF_PUUID), 'la respuesta nunca expone el PUUID');
  assert.ok(!text.includes(SECRET), 'la respuesta nunca expone el secreto');
  assert.equal(db.rows.length, 1);
  assert.equal(db.rows[0]!.queue_type, 'RANKED_SOLO_5x5');
});
