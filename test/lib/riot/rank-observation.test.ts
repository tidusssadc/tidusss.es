import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getRiotRankObservation } from '../../../src/lib/riot/index.ts';
import { clearRiotMemoryCache } from '../../../src/lib/riot/cache.ts';
import type { RiotEnvironment } from '../../../src/config/riot.ts';

/**
 * `getRiotRankObservation` — el camino LIGERO del histórico de rango
 * (encargo cierre §18/§19): ACCOUNT-V1 + LEAGUE-V4, nada más.
 */

const ENV: RiotEnvironment = {
  RIOT_API_KEY: 'RGAPI-test-key-do-not-leak-1234567890',
  RIOT_GAME_NAME: 'Tidusss',
  RIOT_TAG_LINE: 'FFX',
  RIOT_PLATFORM_ROUTE: 'euw1',
  RIOT_REGIONAL_ROUTE: 'europe',
};

const jsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const install = (leagueBody: unknown) => {
  const original = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input: unknown) => {
    const url = String(input);
    urls.push(url);
    if (url.includes('/riot/account/v1/accounts/by-riot-id/'))
      return jsonResponse(200, { puuid: 'puuid-x', gameName: 'Tidusss', tagLine: 'FFX' });
    if (url.includes('/lol/league/v4/entries/by-puuid/'))
      return jsonResponse(200, leagueBody);
    return jsonResponse(500, { message: `unexpected: ${url}` });
  }) as unknown as typeof fetch;
  return { urls, restore: () => { globalThis.fetch = original; } };
};

beforeEach(() => clearRiotMemoryCache());

test('resuelve cuenta + rango Solo/Duo y NADA más', async () => {
  const mock = install([
    { queueType: 'RANKED_SOLO_5x5', tier: 'DIAMOND', rank: 'II', leaguePoints: 40, wins: 100, losses: 90 },
    { queueType: 'RANKED_FLEX_SR', tier: 'PLATINUM', rank: 'I', leaguePoints: 10, wins: 5, losses: 5 },
  ]);
  try {
    const obs = await getRiotRankObservation(ENV);
    assert.equal(obs.puuid, 'puuid-x');
    assert.equal(obs.ranked.available, true);
    assert.equal(obs.ranked.tier, 'DIAMOND');
    assert.equal(obs.ranked.rank, 'II');
    assert.equal(obs.ranked.leaguePoints, 40);
    assert.ok(Date.parse(obs.observedAt) > 0);
    assert.equal(obs.rankedStale, false);
    // Exactamente 2 llamadas: account + league. Ni una más.
    assert.equal(mock.urls.length, 2);
    assert.ok(mock.urls.some((u) => u.includes('/riot/account/v1/')));
    assert.ok(mock.urls.some((u) => u.includes('/lol/league/v4/entries/')));
    assert.ok(!mock.urls.some((u) => u.includes('/lol/match/v5/')));
    assert.ok(!mock.urls.some((u) => u.includes('/lol/summoner/v4/')));
    assert.ok(!mock.urls.some((u) => u.includes('ddragon') || u.includes('versions.json')));
  } finally {
    mock.restore();
  }
});

test('sin entrada Solo/Duo real: ranked.available false, nunca inventa un rango', async () => {
  const mock = install([]);
  try {
    const obs = await getRiotRankObservation(ENV);
    assert.equal(obs.ranked.available, false);
  } finally {
    mock.restore();
  }
});

test('comparte la clave de caché de rango con getRiotOverview (riot:ranked:{puuid})', async () => {
  const mock = install([
    { queueType: 'RANKED_SOLO_5x5', tier: 'MASTER', rank: 'I', leaguePoints: 200, wins: 1, losses: 0 },
  ]);
  try {
    await getRiotRankObservation(ENV);
    const callsAfterFirst = mock.urls.length;
    await getRiotRankObservation(ENV);
    // Segunda vez: account (24h) y league (10min) siguen en caché → 0 llamadas nuevas.
    assert.equal(mock.urls.length, callsAfterFirst);
  } finally {
    mock.restore();
  }
});

test('sin RIOT_API_KEY: lanza RiotApiError de configuración, nunca toca la red', async () => {
  const mock = install([]);
  try {
    await assert.rejects(
      () => getRiotRankObservation({ ...ENV, RIOT_API_KEY: undefined }),
      /RIOT_API_KEY_MISSING/,
    );
    assert.equal(mock.urls.length, 0);
  } finally {
    mock.restore();
  }
});
