import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectCrossIdentityPuuidConflicts,
  mergeIdentity,
  mergeWithExisting,
  resolveCandidates,
  verifyBatch,
} from '../../../scripts/identities/resolve.ts';
import type { AccountResolver, IdentityCandidate, ResolvedRiotAccount } from '../../../scripts/identities/types.ts';
import type { KnownPlayerIdentity } from '../../../src/lib/riot/live-types.ts';

const VERIFIED_AT = '2026-09-09T00:00:00.000Z';

const candidate = (overrides: Partial<IdentityCandidate> = {}): IdentityCandidate => ({
  displayName: 'Jugador',
  riotId: 'Jugador#EUW',
  isPro: true,
  isStreamer: false,
  ...overrides,
});

/** Mock de Account-V1: nunca red real — resuelve por tabla fija o lanza "cuenta no encontrada". */
const mockResolver = (
  accounts: Record<string, ResolvedRiotAccount>,
): AccountResolver => {
  return async (gameName, tagLine) => {
    const key = `${gameName}#${tagLine}`;
    const account = accounts[key];
    if (!account) throw new Error('RIOT_ACCOUNT_NOT_FOUND');
    return account;
  };
};

// --- account-v1 resolve / Riot ID inexistente / batch continúa tras error ---

test('resolveCandidates resuelve cada candidato vía el resolver inyectado, sin tocar red real', async () => {
  const resolver = mockResolver({ 'Jugador#EUW': { puuid: 'puuid-1', gameName: 'Jugador', tagLine: 'EUW' } });
  const { resolved, errors } = await resolveCandidates([candidate()], resolver);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0]?.account.puuid, 'puuid-1');
  assert.equal(errors.length, 0);
});

test('resolveCandidates reporta un Riot ID que Riot no encuentra, sin lanzar', async () => {
  const resolver = mockResolver({});
  const { resolved, errors } = await resolveCandidates([candidate({ riotId: 'Fantasma#EUW' })], resolver);
  assert.equal(resolved.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0]?.reason ?? '', /RIOT_ACCOUNT_NOT_FOUND/);
});

test('resolveCandidates: un error en un candidato no detiene la resolución del resto del lote', async () => {
  const resolver = mockResolver({
    'Bueno#EUW': { puuid: 'puuid-bueno', gameName: 'Bueno', tagLine: 'EUW' },
  });
  const { resolved, errors } = await resolveCandidates(
    [candidate({ displayName: 'Malo', riotId: 'Malo#EUW' }), candidate({ displayName: 'Bueno', riotId: 'Bueno#EUW' })],
    resolver,
  );
  assert.equal(errors.length, 1);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0]?.candidate.displayName, 'Bueno');
});

test('resolveCandidates reporta una cuenta sin PUUID en la respuesta (defensivo)', async () => {
  const resolver: AccountResolver = async () => ({ puuid: '', gameName: 'X', tagLine: 'EUW' });
  const { resolved, errors } = await resolveCandidates([candidate()], resolver);
  assert.equal(resolved.length, 0);
  assert.match(errors[0]?.reason ?? '', /sin PUUID/);
});

// --- multicuentas: mismo displayName en el lote -> UNA identidad con varios PUUIDs ---

test('verifyBatch agrupa por displayName: dos cuentas de la misma persona producen UNA identidad con dos PUUIDs', async () => {
  const resolver = mockResolver({
    'CuentaA#EUW': { puuid: 'puuid-a', gameName: 'CuentaA', tagLine: 'EUW' },
    'CuentaB#EUW': { puuid: 'puuid-b', gameName: 'CuentaB', tagLine: 'EUW' },
  });
  const candidates = [
    candidate({ displayName: 'Multi', riotId: 'CuentaA#EUW', isPro: true }),
    candidate({ displayName: 'multi', riotId: 'CuentaB#EUW', isPro: true }), // mismo nombre, distinta capitalización
  ];
  const result = await verifyBatch(candidates, [], resolver, VERIFIED_AT);
  assert.equal(result.verifiedIdentities, 1);
  assert.equal(result.multiAccountIdentities, 1);
  const identity = result.mergedRegistry[0];
  assert.equal(identity?.puuids?.length, 2);
  assert.ok(identity?.puuids?.includes('puuid-a'));
  assert.ok(identity?.puuids?.includes('puuid-b'));
});

test('verifyBatch combina isPro/isStreamer con OR entre cuentas de la misma persona (no es un conflicto)', async () => {
  const resolver = mockResolver({
    'CuentaPro#EUW': { puuid: 'puuid-pro', gameName: 'CuentaPro', tagLine: 'EUW' },
    'CuentaStream#EUW': { puuid: 'puuid-stream', gameName: 'CuentaStream', tagLine: 'EUW' },
  });
  const candidates = [
    candidate({ displayName: 'ProYStream', riotId: 'CuentaPro#EUW', isPro: true, isStreamer: false }),
    candidate({ displayName: 'ProYStream', riotId: 'CuentaStream#EUW', isPro: false, isStreamer: true }),
  ];
  const result = await verifyBatch(candidates, [], resolver, VERIFIED_AT);
  assert.equal(result.conflicts.length, 0);
  assert.equal(result.mergedRegistry[0]?.isPro, true);
  assert.equal(result.mergedRegistry[0]?.isStreamer, true);
  assert.equal(result.proAndStreamer, 1);
});

test('verifyBatch reporta conflicto (y excluye) cuando el mismo displayName trae un team distinto entre filas', async () => {
  const resolver = mockResolver({
    'A#EUW': { puuid: 'puuid-a', gameName: 'A', tagLine: 'EUW' },
    'B#EUW': { puuid: 'puuid-b', gameName: 'B', tagLine: 'EUW' },
  });
  const candidates = [
    candidate({ displayName: 'Conflicto', riotId: 'A#EUW', team: 'KC' }),
    candidate({ displayName: 'Conflicto', riotId: 'B#EUW', team: 'MAD' }),
  ];
  const result = await verifyBatch(candidates, [], resolver, VERIFIED_AT);
  assert.equal(result.verifiedIdentities, 0);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0]?.reason, 'candidatos-inconsistentes');
});

// --- duplicate PUUID / conflicto entre personas ---

test('verifyBatch detecta un PUUID que aparece bajo dos personas distintas y excluye a ambas', async () => {
  const resolver = mockResolver({
    'Nombre1#EUW': { puuid: 'puuid-compartido', gameName: 'Nombre1', tagLine: 'EUW' },
    'Nombre2#EUW': { puuid: 'puuid-compartido', gameName: 'Nombre2', tagLine: 'EUW' },
  });
  const candidates = [
    candidate({ displayName: 'Persona1', riotId: 'Nombre1#EUW' }),
    candidate({ displayName: 'Persona2', riotId: 'Nombre2#EUW' }),
  ];
  const result = await verifyBatch(candidates, [], resolver, VERIFIED_AT);
  assert.equal(result.verifiedIdentities, 0);
  assert.equal(result.mergedRegistry.length, 0);
  assert.equal(result.conflicts.some((c) => c.reason === 'puuid-duplicado-entre-personas'), true);
});

test('detectCrossIdentityPuuidConflicts no reporta nada cuando cada PUUID pertenece a una sola persona', () => {
  const { kept, conflicts } = detectCrossIdentityPuuidConflicts([
    { accounts: 1, identity: { displayName: 'A', puuids: ['p1'], isPro: true, isStreamer: false } },
    { accounts: 1, identity: { displayName: 'B', puuids: ['p2'], isPro: true, isStreamer: false } },
  ]);
  assert.equal(kept.length, 2);
  assert.equal(conflicts.length, 0);
});

// --- merge con registro existente ---

test('mergeIdentity une PUUIDs/Riot IDs, nunca degrada isPro/isStreamer de true a false', () => {
  const existing: KnownPlayerIdentity = {
    displayName: 'Existente',
    puuids: ['puuid-viejo'],
    riotIds: ['Viejo#EUW'],
    isPro: true,
    isStreamer: false,
    team: 'KC',
  };
  const incoming: KnownPlayerIdentity = {
    displayName: 'Existente',
    puuids: ['puuid-nuevo'],
    riotIds: ['Nuevo#EUW'],
    isPro: false,
    isStreamer: true,
  };
  const { merged, conflicts } = mergeIdentity(existing, incoming);
  assert.deepEqual(new Set(merged.puuids), new Set(['puuid-viejo', 'puuid-nuevo']));
  assert.deepEqual(new Set(merged.riotIds), new Set(['Viejo#EUW', 'Nuevo#EUW']));
  assert.equal(merged.isPro, true);
  assert.equal(merged.isStreamer, true);
  assert.equal(merged.team, 'KC');
  assert.equal(conflicts.length, 0);
});

test('mergeIdentity reporta conflicto y conserva el team existente cuando el nuevo difiere', () => {
  const existing: KnownPlayerIdentity = {
    displayName: 'Existente',
    puuids: ['p1'],
    isPro: true,
    isStreamer: false,
    team: 'KC',
  };
  const incoming: KnownPlayerIdentity = {
    displayName: 'Existente',
    puuids: ['p2'],
    isPro: true,
    isStreamer: false,
    team: 'MAD',
  };
  const { merged, conflicts } = mergeIdentity(existing, incoming);
  assert.equal(merged.team, 'KC');
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0]?.reason, 'conflicto-al-fusionar');
});

test('verifyBatch, con registro existente, fusiona una nueva cuenta de la misma persona (match por Riot ID ya conocido) en vez de duplicarla', async () => {
  // El batch debe incluir también la cuenta YA conocida (mismo Riot ID que
  // el registro existente) junto a la nueva — es esa coincidencia real,
  // nunca el displayName por sí solo, la que permite fusionar con el
  // registro existente en vez de crear una segunda persona (§6: solo
  // PUUID/Riot ID cuentan como evidencia, nunca "mismo nombre" a secas).
  const existing: KnownPlayerIdentity[] = [
    { displayName: 'Jugador', puuids: ['puuid-antiguo'], riotIds: ['Jugador#EUW'], isPro: true, isStreamer: false },
  ];
  const resolver = mockResolver({
    'Jugador#EUW': { puuid: 'puuid-antiguo', gameName: 'Jugador', tagLine: 'EUW' },
    'JugadorSmurf#EUW': { puuid: 'puuid-nuevo', gameName: 'JugadorSmurf', tagLine: 'EUW' },
  });
  const candidates = [
    candidate({ displayName: 'Jugador', riotId: 'Jugador#EUW' }),
    candidate({ displayName: 'Jugador', riotId: 'JugadorSmurf#EUW' }),
  ];
  const result = await verifyBatch(candidates, existing, resolver, VERIFIED_AT);
  assert.equal(result.mergedRegistry.length, 1, 'no debe duplicar la persona');
  assert.equal(result.mergedRegistry[0]?.puuids?.length, 2);
});

test('mergeWithExisting NUNCA fusiona solo por compartir displayName: sin PUUID ni Riot ID en común, son personas distintas', () => {
  const existing: KnownPlayerIdentity[] = [
    { displayName: 'Jugador', puuids: ['puuid-antiguo'], riotIds: ['Jugador#EUW'], isPro: true, isStreamer: false },
  ];
  const { registry, conflicts } = mergeWithExisting(existing, [
    { displayName: 'Jugador', puuids: ['puuid-totalmente-distinto'], riotIds: ['OtraCuenta#NA1'], isPro: false, isStreamer: true },
  ]);
  assert.equal(registry.length, 2, 'sin PUUID/Riot ID en común, nunca se fusiona solo por el nombre');
  assert.equal(conflicts.length, 0);
});

test('mergeWithExisting deja intactas las identidades existentes que ningún candidato del batch toca', () => {
  const existing: KnownPlayerIdentity[] = [
    { displayName: 'Sin tocar', puuids: ['p-intacto'], isPro: true, isStreamer: false },
  ];
  const { registry, conflicts } = mergeWithExisting(existing, [
    { displayName: 'Nueva', puuids: ['p-nuevo'], isPro: false, isStreamer: true },
  ]);
  assert.equal(registry.length, 2);
  assert.equal(registry[0], existing[0]);
  assert.equal(conflicts.length, 0);
});

// --- salida determinista ---

test('verifyBatch es determinista: el mismo input produce el mismo mergedRegistry (mismo orden, mismos valores)', async () => {
  const resolver = mockResolver({ 'Jugador#EUW': { puuid: 'puuid-1', gameName: 'Jugador', tagLine: 'EUW' } });
  const runOnce = () => verifyBatch([candidate()], [], resolver, VERIFIED_AT);
  const [first, second] = await Promise.all([runOnce(), runOnce()]);
  assert.deepEqual(first.mergedRegistry, second.mergedRegistry);
});

// --- pros/streamers/pro+streamer en el resumen ---

test('verifyBatch cuenta correctamente pros/streamers/pro+streamer/multicuentas en el resumen', async () => {
  const resolver = mockResolver({
    'Pro1#EUW': { puuid: 'p1', gameName: 'Pro1', tagLine: 'EUW' },
    'Strm1#EUW': { puuid: 'p2', gameName: 'Strm1', tagLine: 'EUW' },
  });
  const candidates = [
    candidate({ displayName: 'Solo pro', riotId: 'Pro1#EUW', isPro: true, isStreamer: false }),
    candidate({ displayName: 'Solo streamer', riotId: 'Strm1#EUW', isPro: false, isStreamer: true }),
  ];
  const result = await verifyBatch(candidates, [], resolver, VERIFIED_AT);
  assert.equal(result.pros, 1);
  assert.equal(result.streamers, 1);
  assert.equal(result.proAndStreamer, 0);
});
