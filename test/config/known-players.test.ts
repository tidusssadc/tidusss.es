import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findKnownPlayerIdentity, knownPlayerIdentities } from '../../src/config/known-players.ts';
import type { KnownPlayerIdentity } from '../../src/lib/riot/live-types.ts';

// --- Dataset real: vacío hoy a propósito (ninguna identidad verificada
// todavía) — ver el comentario de `known-players.ts` para cómo se añaden. ---

test('el registro real de identidades conocidas está vacío hoy, sin cuentas inventadas', () => {
  assert.deepEqual(knownPlayerIdentities, []);
});

test('sobre el registro real (vacío), ninguna búsqueda resuelve nada — nunca un falso positivo', () => {
  assert.equal(findKnownPlayerIdentity('cualquier-puuid', 'Cualquiera#EUW'), undefined);
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
