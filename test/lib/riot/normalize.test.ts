import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMatch } from '../../../src/lib/riot/normalize.ts';
import type { RiotMatchDto, RiotParticipantDto } from '../../../src/lib/riot/types.ts';
import type { KnownPlayerIdentity } from '../../../src/lib/riot/live-types.ts';

/**
 * `normalizeMatch` en sí (más allá de la resolución de Encuentros
 * PRO/STREAMER, Night Shift 2026-09-09 Fase E) no tenía tests directos
 * previos — su cobertura venía indirectamente de `live.test.ts`/
 * `performance.test.ts` sobre datos ya normalizados. Este archivo cubre
 * específicamente el comportamiento nuevo: identidad resuelta por PUUID
 * exacto, nunca para uno mismo, nunca inventada.
 */

const SELF_PUUID = 'self-puuid-tidusss';
const OPPONENT_PUUID = 'opponent-puuid-known-pro';
const OPPONENT_PUUID_ALT_ACCOUNT = 'opponent-puuid-known-pro-smurf';
const UNKNOWN_PUUID = 'opponent-puuid-unknown';

const championUrl = (name: string) => `champion:${name}`;
const itemUrl = (id: number) => `item:${id}`;
const summonerSpellUrl = (name: string) => `spell:${name}`;

const participant = (overrides: Partial<RiotParticipantDto>): RiotParticipantDto => ({
  puuid: 'filler-puuid',
  championName: 'Lucian',
  win: true,
  kills: 5,
  deaths: 2,
  assists: 4,
  teamId: 100,
  riotIdGameName: 'Jugador',
  teamPosition: 'BOTTOM',
  totalMinionsKilled: 100,
  neutralMinionsKilled: 0,
  totalDamageDealtToChampions: 10000,
  goldEarned: 8000,
  visionScore: 20,
  ...overrides,
});

const buildMatch = (participants: RiotParticipantDto[]): RiotMatchDto => ({
  metadata: { matchId: 'EUW1_1234567890' },
  info: {
    gameCreation: Date.parse('2026-09-01T10:00:00.000Z'),
    gameDuration: 1800,
    queueId: 420,
    participants,
    teams: [
      { teamId: 100, win: true, objectives: { tower: { kills: 5 }, dragon: { kills: 2 }, baron: { kills: 0 } } },
      { teamId: 200, win: false, objectives: { tower: { kills: 2 }, dragon: { kills: 1 }, baron: { kills: 0 } } },
    ],
  },
});

const PRO_IDENTITY: KnownPlayerIdentity = {
  puuids: [OPPONENT_PUUID, OPPONENT_PUUID_ALT_ACCOUNT],
  displayName: 'Jugador Pro Conocido',
  isPro: true,
  isStreamer: false,
  team: 'Equipo Ejemplo',
  role: 'ADC',
};

const identityFor = (puuid: string | undefined) =>
  puuid === OPPONENT_PUUID || puuid === OPPONENT_PUUID_ALT_ACCOUNT ? PRO_IDENTITY : undefined;

test('normalizeMatch: un oponente con PUUID exacto en el registro lleva su identity real', () => {
  const match = buildMatch([
    participant({ puuid: SELF_PUUID, teamId: 100 }),
    participant({ puuid: OPPONENT_PUUID, teamId: 200, teamPosition: 'BOTTOM' }),
  ]);
  const normalized = normalizeMatch(match, SELF_PUUID, championUrl, itemUrl, summonerSpellUrl, identityFor);
  const opponentTeam = normalized!.teams.find((t) => t.teamId === 200)!;
  assert.deepEqual(opponentTeam.participants[0]!.identity, PRO_IDENTITY);
});

test('normalizeMatch: nunca se resuelve identity para uno mismo, aunque el resolutor "coincidiera"', () => {
  const match = buildMatch([
    participant({ puuid: SELF_PUUID, teamId: 100 }),
    participant({ puuid: OPPONENT_PUUID, teamId: 200 }),
  ]);
  // Resolutor que "conocería" a cualquier PUUID — para probar que el propio jugador queda excluido explícitamente, no por casualidad de datos.
  const matchesEveryone = () => PRO_IDENTITY;
  const normalized = normalizeMatch(match, SELF_PUUID, championUrl, itemUrl, summonerSpellUrl, matchesEveryone);
  const selfTeam = normalized!.teams.find((t) => t.teamId === 100)!;
  assert.equal(selfTeam.participants[0]!.identity, undefined);
});

test('normalizeMatch: un oponente sin coincidencia real en el registro no lleva identity (nunca inventada)', () => {
  const match = buildMatch([
    participant({ puuid: SELF_PUUID, teamId: 100 }),
    participant({ puuid: UNKNOWN_PUUID, teamId: 200 }),
  ]);
  const normalized = normalizeMatch(match, SELF_PUUID, championUrl, itemUrl, summonerSpellUrl, identityFor);
  const opponentTeam = normalized!.teams.find((t) => t.teamId === 200)!;
  assert.equal(opponentTeam.participants[0]!.identity, undefined);
});

test('normalizeMatch: sin resolutor (llamador que no lo pasa), ningún participante lleva identity', () => {
  const match = buildMatch([
    participant({ puuid: SELF_PUUID, teamId: 100 }),
    participant({ puuid: OPPONENT_PUUID, teamId: 200 }),
  ]);
  const normalized = normalizeMatch(match, SELF_PUUID, championUrl, itemUrl, summonerSpellUrl);
  const opponentTeam = normalized!.teams.find((t) => t.teamId === 200)!;
  assert.equal(opponentTeam.participants[0]!.identity, undefined);
});

test('normalizeMatch: dos cuentas distintas de la misma persona (multi-cuenta) colapsan a la MISMA identity', () => {
  const match = buildMatch([
    participant({ puuid: SELF_PUUID, teamId: 100 }),
    participant({ puuid: OPPONENT_PUUID, teamId: 200, teamPosition: 'BOTTOM' }),
    participant({ puuid: OPPONENT_PUUID_ALT_ACCOUNT, teamId: 200, teamPosition: 'UTILITY' }),
  ]);
  const normalized = normalizeMatch(match, SELF_PUUID, championUrl, itemUrl, summonerSpellUrl, identityFor);
  const opponentTeam = normalized!.teams.find((t) => t.teamId === 200)!;
  assert.equal(opponentTeam.participants[0]!.identity, PRO_IDENTITY);
  assert.equal(opponentTeam.participants[1]!.identity, PRO_IDENTITY);
  assert.equal(opponentTeam.participants[0]!.identity, opponentTeam.participants[1]!.identity);
});
