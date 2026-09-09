import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getRiotLiveGame } from '../../../src/lib/riot/live.ts';
import { clearRiotMemoryCache } from '../../../src/lib/riot/cache.ts';
import type { RiotEnvironment } from '../../../src/config/riot.ts';

/**
 * `getRiotLiveGame` orquesta red real (Riot + Data Dragon) — estos tests
 * sustituyen `globalThis.fetch` por un router sintético, sin tocar la red
 * de verdad (encargo §28: "no hacer tests dependientes de Riot real").
 * `RiotApiError` (src/lib/riot/errors.ts) se reescribió esta misma fase
 * sin "parameter properties" precisamente para que este archivo (y
 * cualquier cosa que importe `live.ts`) se pueda cargar en el modo
 * strip-only del test runner de Node.
 */

const ENV: RiotEnvironment = {
  RIOT_API_KEY: 'RGAPI-test-key-do-not-leak-1234567890',
  RIOT_GAME_NAME: 'Tidusss',
  RIOT_TAG_LINE: 'FFX',
  RIOT_PLATFORM_ROUTE: 'euw1',
  RIOT_REGIONAL_ROUTE: 'europe',
};

const SELF_PUUID = 'self-puuid-tidusss-live';

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
const ddragonVersionRoute: MockRoute = {
  match: (url) => url.includes('api/versions.json'),
  status: 200,
  body: ['15.14.1'],
};
const championJsonRoute: MockRoute = {
  match: (url) => url.includes('/data/en_US/champion.json'),
  status: 200,
  body: { data: { Lucian: { id: 'Lucian', key: '236' } } },
};
const notInGameRoute: MockRoute = {
  match: (url) => url.includes('/spectator/v5/active-games/'),
  status: 404,
  body: { status: { status_code: 404, message: 'Not Found' } },
};

const tenParticipants = () => [
  { puuid: SELF_PUUID, championId: 236, teamId: 100, spell1Id: 4, spell2Id: 7, profileIconId: 1, perks: { perkStyle: 8000, perkSubStyle: 8100 } },
  ...Array.from({ length: 9 }, (_, index) => ({
    puuid: `enemy-puuid-${index}`,
    championId: 236,
    teamId: index < 4 ? 100 : 200,
    spell1Id: 4,
    spell2Id: 12,
    profileIconId: 2,
    perks: { perkStyle: 8100, perkSubStyle: 8200 },
  })),
];

const inGameRoute = (participants = tenParticipants()): MockRoute => ({
  match: (url) => url.includes('/spectator/v5/active-games/'),
  status: 200,
  body: {
    gameId: 555,
    gameType: 'MATCHED_GAME',
    gameStartTime: Date.now(),
    mapId: 11,
    gameLength: 300,
    platformId: 'EUW1',
    gameMode: 'CLASSIC',
    gameQueueConfigId: 420,
    bannedChampions: [],
    participants,
  },
});

const accountByPuuidRoute: MockRoute = {
  match: (url) => url.includes('/accounts/by-puuid/'),
  status: 200,
  body: { puuid: 'x', gameName: 'Enemigo', tagLine: 'EUW' },
};
const rankedRoute: MockRoute = {
  match: (url) => url.includes('/league/v4/entries/by-puuid/'),
  status: 200,
  body: [{ queueType: 'RANKED_SOLO_5x5', tier: 'GOLD', rank: 'II', leaguePoints: 40, wins: 20, losses: 15 }],
};
const unrankedRoute: MockRoute = {
  match: (url) => url.includes('/league/v4/entries/by-puuid/'),
  status: 200,
  body: [],
};

beforeEach(() => {
  clearRiotMemoryCache();
});

// --- A) not_in_game ---

test('not_in_game: spectator-v5 devolviendo 404 se traduce en status "not_in_game", nunca en un error', async () => {
  const mock = installFetchMock([accountRoute, notInGameRoute]);
  try {
    const result = await getRiotLiveGame(ENV);
    assert.equal(result.status, 'not_in_game');
  } finally {
    mock.restore();
  }
});

// --- B) in_game con 10 participantes ---

test('in_game: 10 participantes se normalizan en 2 equipos, con Tidusss marcado', async () => {
  const mock = installFetchMock([
    accountRoute,
    inGameRoute(),
    ddragonVersionRoute,
    championJsonRoute,
    accountByPuuidRoute,
    rankedRoute,
  ]);
  try {
    const result = await getRiotLiveGame(ENV);
    assert.equal(result.status, 'in_game');
    if (result.status !== 'in_game') return;
    assert.equal(result.game.participants.length, 10);
    const self = result.game.participants.filter((p) => p.isSelf);
    assert.equal(self.length, 1);
    assert.equal(self[0]?.puuid, SELF_PUUID);
    // Enriquecimiento real: campeón resuelto, rango resuelto para los enemigos.
    const enemy = result.game.participants.find((p) => !p.isSelf);
    assert.equal(enemy?.championName, 'Lucian');
    assert.equal(enemy?.ranked?.tier, 'GOLD');
  } finally {
    mock.restore();
  }
});

// --- C) participante sin ranked (unranked) ---

test('participante sin entrada Solo/Duo (league-v4 vacío): ranked.available=false, no rompe la vista', async () => {
  const mock = installFetchMock([
    accountRoute,
    inGameRoute(),
    ddragonVersionRoute,
    championJsonRoute,
    accountByPuuidRoute,
    unrankedRoute,
  ]);
  try {
    const result = await getRiotLiveGame(ENV);
    assert.equal(result.status, 'in_game');
    if (result.status !== 'in_game') return;
    const enemy = result.game.participants.find((p) => !p.isSelf);
    assert.equal(enemy?.ranked?.available, false);
    assert.equal(result.game.participants.length, 10);
  } finally {
    mock.restore();
  }
});

// --- D) fallo parcial de Riot en el enriquecimiento ---

test('fallo parcial (league-v4 y account-by-puuid caen para todos): la partida base sigue apareciendo completa', async () => {
  const mock = installFetchMock([
    accountRoute,
    inGameRoute(),
    ddragonVersionRoute,
    championJsonRoute,
    // Deliberadamente SIN mockear accountByPuuid/ranked → 500 por defecto.
  ]);
  try {
    const result = await getRiotLiveGame(ENV);
    assert.equal(result.status, 'in_game');
    if (result.status !== 'in_game') return;
    assert.equal(result.game.participants.length, 10);
    const enemy = result.game.participants.find((p) => !p.isSelf);
    // Sin enriquecer: se degrada, nunca rompe.
    assert.equal(enemy?.ranked, undefined);
    assert.equal(enemy?.riotIdResolved, false);
    assert.equal(enemy?.riotId, 'Invocador');
    // Lo base (campeón, equipo, hechizos) sigue resolviendo bien.
    assert.equal(enemy?.championName, 'Lucian');
    assert.ok(enemy?.teamId === 100 || enemy?.teamId === 200);
  } finally {
    mock.restore();
  }
});

// --- E) rate limited ---

test('rate_limited: spectator-v5 devolviendo 429 se traduce en status "rate_limited" con Retry-After', async () => {
  const mock = installFetchMock([
    accountRoute,
    {
      match: (url) => url.includes('/spectator/v5/active-games/'),
      status: 429,
      body: { status: { status_code: 429, message: 'Rate limit exceeded' } },
      headers: { 'Retry-After': '12' },
    },
  ]);
  try {
    const result = await getRiotLiveGame(ENV);
    assert.equal(result.status, 'rate_limited');
    if (result.status !== 'rate_limited') return;
    assert.equal(result.retryAfterSeconds, 12);
  } finally {
    mock.restore();
  }
});

// --- riot_error / unavailable genérico ---

test('unavailable: un 500 real de Riot en spectator-v5 se traduce en status "unavailable", nunca se presenta como "no está jugando"', async () => {
  const mock = installFetchMock([
    accountRoute,
    {
      match: (url) => url.includes('/spectator/v5/active-games/'),
      status: 503,
      body: { status: { status_code: 503, message: 'Service unavailable' } },
    },
  ]);
  try {
    const result = await getRiotLiveGame(ENV);
    assert.equal(result.status, 'unavailable');
    assert.notEqual(result.status, 'not_in_game');
  } finally {
    mock.restore();
  }
});

test('unavailable: sin API key configurada, nunca se intenta ninguna llamada de red', async () => {
  const mock = installFetchMock([]);
  try {
    const result = await getRiotLiveGame({ ...ENV, RIOT_API_KEY: '' });
    assert.equal(result.status, 'unavailable');
    assert.equal(mock.calls.length, 0);
  } finally {
    mock.restore();
  }
});

// --- J) comportamiento de caché ---

test('caché: dos llamadas seguidas dentro de la ventana de 45s solo golpean spectator-v5 una vez', async () => {
  const mock = installFetchMock([accountRoute, notInGameRoute]);
  try {
    await getRiotLiveGame(ENV);
    const callsAfterFirst = mock.calls.filter((url) => url.includes('/spectator/v5/')).length;
    await getRiotLiveGame(ENV);
    const callsAfterSecond = mock.calls.filter((url) => url.includes('/spectator/v5/')).length;
    assert.equal(callsAfterFirst, 1);
    assert.equal(callsAfterSecond, 1, 'la segunda llamada debe servirse desde caché, sin golpear Riot otra vez');
  } finally {
    mock.restore();
  }
});

// --- K) la API key nunca llega a la respuesta pública ---

test('la API key configurada nunca aparece en el LiveGameResult devuelto (ni siquiera serializado)', async () => {
  const mock = installFetchMock([accountRoute, inGameRoute(), ddragonVersionRoute, championJsonRoute, accountByPuuidRoute, rankedRoute]);
  try {
    const result = await getRiotLiveGame(ENV);
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes(ENV.RIOT_API_KEY!));
    assert.ok(!serialized.toLowerCase().includes('rgapi-'));
  } finally {
    mock.restore();
  }
});

test('ninguna URL llamada durante una partida en curso lleva la API key como query param (viaja solo en la cabecera X-Riot-Token)', async () => {
  const mock = installFetchMock([accountRoute, inGameRoute(), ddragonVersionRoute, championJsonRoute, accountByPuuidRoute, rankedRoute]);
  try {
    await getRiotLiveGame(ENV);
    for (const url of mock.calls) {
      assert.ok(!url.includes(ENV.RIOT_API_KEY!), `la API key apareció en la URL: ${url}`);
    }
  } finally {
    mock.restore();
  }
});

// --- L) transición in_game → not_in_game ---

test('transición: una partida activa que termina (spectator-v5 pasa a 404) se refleja tras invalidar la caché de esa ventana', async () => {
  const firstMock = installFetchMock([accountRoute, inGameRoute(), ddragonVersionRoute, championJsonRoute, accountByPuuidRoute, rankedRoute]);
  let first;
  try {
    first = await getRiotLiveGame(ENV);
  } finally {
    firstMock.restore();
  }
  assert.equal(first.status, 'in_game');

  // Simula el paso del tiempo más allá de la ventana de caché de 45s de
  // spectator (no se espera 45s reales en un test): se limpia solo la
  // caché en memoria, exactamente lo que ocurriría cuando expira el TTL.
  clearRiotMemoryCache();

  const secondMock = installFetchMock([accountRoute, notInGameRoute]);
  let second;
  try {
    second = await getRiotLiveGame(ENV);
  } finally {
    secondMock.restore();
  }
  assert.equal(second.status, 'not_in_game');
});
