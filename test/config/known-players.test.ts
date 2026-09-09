import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findKnownPlayerIdentity, knownPlayerIdentities } from '../../src/config/known-players.ts';
import type { KnownPlayerIdentity } from '../../src/lib/riot/live-types.ts';

// --- Dataset real: primer batch importado (Sprint 2, Competitivo V2) vía
// `npm run identities:verify` — cada PUUID de aquí es real, resuelto contra
// Riot Account-V1 en el propio importador (nunca copiado de LoLPros/DeepLoL
// sin revalidar). Estos tests operan sobre los datos YA importados como
// fixture local — nunca llaman a Riot (§23 del encargo). No fijan cifras
// exactas (el dataset se puede volver a regenerar) — solo invariantes de
// integridad que SIEMPRE deben cumplirse. ---

test('el registro real tiene un primer batch importado, con un mínimo razonable de identidades', () => {
  assert.ok(
    knownPlayerIdentities.length >= 50,
    `se esperaban al menos 50 identidades reales, hay ${knownPlayerIdentities.length}`,
  );
});

test('toda identidad real tiene displayName y al menos un PUUID o Riot ID verificado — nunca una entrada vacía', () => {
  for (const identity of knownPlayerIdentities) {
    assert.ok(identity.displayName.trim().length > 0, 'displayName vacío');
    assert.ok(
      (identity.puuids?.length ?? 0) > 0 || (identity.riotIds?.length ?? 0) > 0,
      `"${identity.displayName}" no tiene ningún PUUID ni Riot ID`,
    );
    assert.ok(
      identity.isPro || identity.isStreamer,
      `"${identity.displayName}" no es PRO ni STREAMER — no debería estar en el registro`,
    );
  }
});

test('ningún PUUID real se repite entre dos identidades distintas del registro', () => {
  const ownerByPuuid = new Map<string, string>();
  for (const identity of knownPlayerIdentities) {
    for (const puuid of identity.puuids ?? []) {
      const owner = ownerByPuuid.get(puuid);
      assert.ok(
        !owner || owner === identity.displayName,
        `PUUID ${puuid} aparece tanto en "${owner}" como en "${identity.displayName}"`,
      );
      ownerByPuuid.set(puuid, identity.displayName);
    }
  }
});

test('cada identidad real con varios PUUIDs (multicuenta) resuelve correctamente por CUALQUIERA de ellos — nunca una identidad separada por cuenta', () => {
  const multiAccount = knownPlayerIdentities.filter((identity) => (identity.puuids?.length ?? 0) > 1);
  assert.ok(multiAccount.length > 0, 'se esperaba al menos una identidad real con varias cuentas');
  for (const identity of multiAccount) {
    for (const puuid of identity.puuids ?? []) {
      const resolved = findKnownPlayerIdentity(puuid, undefined, knownPlayerIdentities);
      assert.equal(resolved?.displayName, identity.displayName);
    }
  }
});

test('cada identidad real resuelve por Riot ID exacto (insensible a mayúsculas), igual que por PUUID', () => {
  const sample = knownPlayerIdentities.slice(0, 15);
  for (const identity of sample) {
    for (const riotId of identity.riotIds ?? []) {
      assert.equal(
        findKnownPlayerIdentity(undefined, riotId.toUpperCase(), knownPlayerIdentities)?.displayName,
        identity.displayName,
      );
    }
  }
});

test('existen identidades reales PRO, STREAMER y PRO+STREAMER en el dataset importado', () => {
  assert.ok(knownPlayerIdentities.some((i) => i.isPro && !i.isStreamer), 'falta algún PRO puro');
  assert.ok(knownPlayerIdentities.some((i) => i.isStreamer && !i.isPro), 'falta algún STREAMER puro');
  assert.ok(knownPlayerIdentities.some((i) => i.isPro && i.isStreamer), 'falta algún PRO + STREAMER');
});

test('un PUUID/Riot ID que no está en el registro real no resuelve nada — nunca un falso positivo', () => {
  assert.equal(
    findKnownPlayerIdentity('puuid-que-no-existe-en-el-registro', 'Cualquiera Inventado#XXXX'),
    undefined,
  );
});

// --- Matching sintético: PUUID exacto primero, Riot ID exacto como
// fallback controlado, nunca por parecido de nombre. ---

const pro: KnownPlayerIdentity = {
  puuids: ['puuid-pro-1'],
  riotIds: ['ProPlayer#KC1'],
  displayName: 'Jugador Pro',
  isPro: true,
  isStreamer: false,
  team: 'KC',
  source: 'confirmado por el equipo',
  lastVerifiedAt: '2026-08-01',
};

const streamer: KnownPlayerIdentity = {
  puuids: ['puuid-streamer-1'],
  riotIds: ['StreamerName#EUW'],
  displayName: 'Streamer Conocido',
  isPro: false,
  isStreamer: true,
  streamUrl: 'https://twitch.tv/streamername',
  source: 'confirmado por la propia persona',
  lastVerifiedAt: '2026-08-01',
};

const proAndStreamer: KnownPlayerIdentity = {
  puuids: ['puuid-both-1'],
  riotIds: ['ProStreamer#EUW'],
  displayName: 'Pro y Streamer',
  isPro: true,
  isStreamer: true,
  team: 'MAD',
  streamUrl: 'https://twitch.tv/prostreamer',
};

const registry: KnownPlayerIdentity[] = [pro, streamer, proAndStreamer];

// F) known pro
test('un PUUID conocido de un jugador PRO resuelve isPro=true, isStreamer=false', () => {
  const identity = findKnownPlayerIdentity('puuid-pro-1', undefined, registry);
  assert.equal(identity?.isPro, true);
  assert.equal(identity?.isStreamer, false);
  assert.equal(identity?.team, 'KC');
});

// G) known streamer
test('un PUUID conocido de un streamer resuelve isStreamer=true, isPro=false', () => {
  const identity = findKnownPlayerIdentity('puuid-streamer-1', undefined, registry);
  assert.equal(identity?.isStreamer, true);
  assert.equal(identity?.isPro, false);
  assert.equal(identity?.streamUrl, 'https://twitch.tv/streamername');
});

// H) pro + streamer
test('un PUUID conocido con ambos flags resuelve isPro=true e isStreamer=true a la vez', () => {
  const identity = findKnownPlayerIdentity('puuid-both-1', undefined, registry);
  assert.equal(identity?.isPro, true);
  assert.equal(identity?.isStreamer, true);
});

test('el fallback por Riot ID exacto funciona cuando no hay PUUID que coincida', () => {
  const identity = findKnownPlayerIdentity(undefined, 'ProPlayer#KC1', registry);
  assert.equal(identity?.displayName, 'Jugador Pro');
});

test('el fallback por Riot ID es insensible a mayúsculas, pero exige coincidencia exacta completa', () => {
  assert.equal(findKnownPlayerIdentity(undefined, 'proplayer#kc1', registry)?.displayName, 'Jugador Pro');
  assert.equal(findKnownPlayerIdentity(undefined, 'ProPlayer', registry), undefined);
  assert.equal(findKnownPlayerIdentity(undefined, 'ProPlayerX#KC1', registry), undefined);
});

// I) Riot ID duplicado pero el PUUID exacto gana
test('si un PUUID desconocido llega junto a un Riot ID que SÍ coincide con otra identidad, el Riot ID exacto resuelve igualmente (no hay PUUID en conflicto real)', () => {
  const identity = findKnownPlayerIdentity('puuid-no-registrado', 'StreamerName#EUW', registry);
  assert.equal(identity?.displayName, 'Streamer Conocido');
});

test('un PUUID exacto siempre gana sobre cualquier Riot ID pasado a la vez, aunque ese Riot ID pertenezca a otra identidad', () => {
  // Caso explícito del encargo: "Riot ID conocido duplicado pero PUUID
  // exacto gana" — aquí el PUUID pasado es el del streamer, pero el Riot
  // ID que se pasa junto (por error, o porque coincide) es el del pro.
  // El PUUID manda: debe resolver al streamer, nunca al pro.
  const identity = findKnownPlayerIdentity('puuid-streamer-1', 'ProPlayer#KC1', registry);
  assert.equal(identity?.displayName, 'Streamer Conocido');
});

test('ninguna coincidencia parcial de nombre resuelve una identidad: sin PUUID exacto ni Riot ID exacto, no hay match', () => {
  assert.equal(findKnownPlayerIdentity('puuid-parecido', 'ProPlay#KC1', registry), undefined);
});

test('una identidad puede tener varias cuentas conocidas (varios riotIds) y cualquiera de ellas resuelve', () => {
  const multiAccount: KnownPlayerIdentity = {
    puuids: ['puuid-main'],
    riotIds: ['Cuenta1#EUW', 'Cuenta2#EUW'],
    displayName: 'Con dos cuentas',
    isPro: true,
    isStreamer: true,
  };
  const localRegistry = [multiAccount];
  assert.equal(findKnownPlayerIdentity(undefined, 'Cuenta1#EUW', localRegistry)?.displayName, 'Con dos cuentas');
  assert.equal(findKnownPlayerIdentity(undefined, 'Cuenta2#EUW', localRegistry)?.displayName, 'Con dos cuentas');
});

test('una identidad puede tener varios PUUIDs verificados (multicuenta) y CUALQUIERA de ellos resuelve por PUUID exacto — nunca una identidad separada por cuenta', () => {
  const multiAccount: KnownPlayerIdentity = {
    puuids: ['puuid-main-a', 'puuid-main-b', 'puuid-main-c'],
    riotIds: ['CuentaA#EUW', 'CuentaB#EUW', 'CuentaC#EUW'],
    displayName: 'Jugador Multicuenta',
    isPro: true,
    isStreamer: false,
  };
  const localRegistry = [multiAccount];
  assert.equal(findKnownPlayerIdentity('puuid-main-a', undefined, localRegistry)?.displayName, 'Jugador Multicuenta');
  assert.equal(findKnownPlayerIdentity('puuid-main-b', undefined, localRegistry)?.displayName, 'Jugador Multicuenta');
  assert.equal(findKnownPlayerIdentity('puuid-main-c', undefined, localRegistry)?.displayName, 'Jugador Multicuenta');
});
