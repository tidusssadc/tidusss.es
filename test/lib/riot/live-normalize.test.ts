import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLiveGame, normalizeLiveParticipant, summarizeLobbyRank } from '../../../src/lib/riot/live-normalize.ts';
import type { LiveParticipant } from '../../../src/lib/riot/live-types.ts';
import type { RiotCurrentGameInfoDto, RiotCurrentGameParticipantDto } from '../../../src/lib/riot/types.ts';
import type { LiveNormalizeContext } from '../../../src/lib/riot/live-normalize.ts';
import type { KnownPlayerIdentity } from '../../../src/lib/riot/live-types.ts';

const SELF_PUUID = 'self-puuid-tidusss';

const participant = (
  overrides: Partial<RiotCurrentGameParticipantDto> = {},
): RiotCurrentGameParticipantDto => ({
  puuid: `puuid-${Math.random().toString(36).slice(2)}`,
  championId: 236,
  teamId: 100,
  spell1Id: 4,
  spell2Id: 7,
  profileIconId: 100,
  perks: { perkIds: [8005], perkStyle: 8000, perkSubStyle: 8100 },
  summonerName: '',
  ...overrides,
});

const baseCtx = (overrides: Partial<LiveNormalizeContext> = {}): LiveNormalizeContext => ({
  selfPuuid: SELF_PUUID,
  championNameById: new Map([[236, 'Lucian']]),
  championUrl: (name) => `https://ddragon.example/champion/${name}.png`,
  summonerSpellUrl: (name) => `https://ddragon.example/spell/${name}.png`,
  profileIconUrl: (id) => `https://ddragon.example/profileicon/${id}.png`,
  keystoneById: new Map(),
  riotIdByPuuid: new Map(),
  rankedByPuuid: new Map(),
  identityFor: () => undefined,
  ...overrides,
});

const buildGame = (
  participants: RiotCurrentGameParticipantDto[],
): RiotCurrentGameInfoDto => ({
  gameId: 123456789,
  gameType: 'MATCHED_GAME',
  gameStartTime: Date.parse('2026-09-08T20:00:00Z'),
  mapId: 11,
  gameLength: 754,
  platformId: 'EUW1',
  gameMode: 'CLASSIC',
  gameQueueConfigId: 420,
  bannedChampions: [{ championId: 236, teamId: 100, pickTurn: 1 }],
  participants,
});

const tenParticipants = () => [
  participant({ puuid: SELF_PUUID, championId: 236, teamId: 100 }),
  ...Array.from({ length: 9 }, (_, index) =>
    participant({ teamId: index < 4 ? 100 : 200, championId: 1 }),
  ),
];

// --- B) in_game con 10 participantes ---

test('normaliza una partida real con 10 participantes en 2 equipos de 5', () => {
  const raw = buildGame(tenParticipants());
  const game = normalizeLiveGame(raw, baseCtx({ championNameById: new Map([[236, 'Lucian'], [1, 'Annie']]) }));
  assert.ok(game);
  assert.equal(game!.participants.length, 10);
  assert.equal(game!.teams.length, 2);
  const blue = game!.teams.find((team) => team.teamId === 100);
  const red = game!.teams.find((team) => team.teamId === 200);
  assert.equal(blue?.participants.length, 5);
  assert.equal(red?.participants.length, 5);
});

test('detecta a Tidusss por PUUID exacto, nunca por posición ni nombre', () => {
  const raw = buildGame(tenParticipants());
  const game = normalizeLiveGame(raw, baseCtx());
  const self = game!.participants.filter((p) => p.isSelf);
  assert.equal(self.length, 1);
  assert.equal(self[0]?.puuid, SELF_PUUID);
});

test('gameId/queueLabel/mapName/duración se normalizan desde los datos reales de spectator-v5', () => {
  const raw = buildGame(tenParticipants());
  const game = normalizeLiveGame(raw, baseCtx());
  assert.equal(game!.gameId, 123456789);
  assert.equal(game!.queueId, 420);
  assert.equal(game!.queueLabel, 'Solo Queue');
  assert.equal(game!.mapId, 11);
  assert.equal(game!.mapName, 'Grieta del Invocador');
  assert.equal(game!.gameLengthSeconds, 754);
  assert.equal(game!.gameStartedAt, '2026-09-08T20:00:00.000Z');
});

test('una queueId desconocida nunca se inventa un nombre: usa el mismo fallback genérico que el resto del sitio', () => {
  const raw = { ...buildGame(tenParticipants()), gameQueueConfigId: 9999 };
  const game = normalizeLiveGame(raw, baseCtx());
  assert.equal(game!.queueLabel, 'Modo 9999');
});

test('mapId desconocido deja mapName ausente, nunca adivinado', () => {
  const raw = { ...buildGame(tenParticipants()), mapId: 30 };
  const game = normalizeLiveGame(raw, baseCtx());
  assert.equal(game!.mapName, undefined);
});

test('gameStartTime en 0 (partida sin reloj todavía) deja gameStartedAt ausente, nunca una fecha falsa', () => {
  const raw = { ...buildGame(tenParticipants()), gameStartTime: 0 };
  const game = normalizeLiveGame(raw, baseCtx());
  assert.equal(game!.gameStartedAt, undefined);
});

// --- Campeón: solo se resuelve si el id numérico existe en el mapa real ---

test('un championId presente en el mapa de Data Dragon resuelve nombre e icono reales', () => {
  const result = normalizeLiveParticipant(participant({ championId: 236 }), baseCtx());
  assert.equal(result?.championName, 'Lucian');
  assert.equal(result?.championImageUrl, 'https://ddragon.example/champion/Lucian.png');
});

test('un championId ausente del mapa (no confirmado) deja el nombre/icono sin resolver, nunca adivinado', () => {
  const result = normalizeLiveParticipant(participant({ championId: 999999 }), baseCtx());
  assert.equal(result?.championName, undefined);
  assert.equal(result?.championImageUrl, undefined);
  assert.equal(result?.championId, 999999);
});

// --- C) participante sin clasificación ranked ---

test('un participante sin entrada ranked no bloquea el resto: ranked queda ausente, el resto de campos normaliza igual', () => {
  const result = normalizeLiveParticipant(participant(), baseCtx({ rankedByPuuid: new Map() }));
  assert.equal(result?.ranked, undefined);
  assert.ok(result?.championName);
});

test('un participante con ranked disponible expone tier/rank/LP/winrate ya calculados', () => {
  const puuid = 'ranked-puuid';
  const ctx = baseCtx({
    rankedByPuuid: new Map([
      [puuid, { available: true, tier: 'GOLD', rank: 'II', leaguePoints: 45, wins: 30, losses: 20, winRate: 60 }],
    ]),
  });
  const result = normalizeLiveParticipant(participant({ puuid }), ctx);
  assert.equal(result?.ranked?.tier, 'GOLD');
  assert.equal(result?.ranked?.winRate, 60);
});

// --- Riot ID: resuelto vía account-v1, nunca inventado ---

test('un Riot ID no resuelto usa el placeholder "Invocador", nunca un nombre inventado', () => {
  const result = normalizeLiveParticipant(participant({ summonerName: '' }), baseCtx());
  assert.equal(result?.riotId, 'Invocador');
  assert.equal(result?.riotIdResolved, false);
});

test('un Riot ID resuelto vía account-v1 se usa tal cual, marcado como resuelto', () => {
  const puuid = 'resolved-puuid';
  const ctx = baseCtx({ riotIdByPuuid: new Map([[puuid, 'Tidusss#FFX']]) });
  const result = normalizeLiveParticipant(participant({ puuid }), ctx);
  assert.equal(result?.riotId, 'Tidusss#FFX');
  assert.equal(result?.riotIdResolved, true);
});

// --- Forma reciente: solo para Tidusss ---

test('recentForm solo se adjunta al participante que es Tidusss, nunca a los otros 9', () => {
  const raw = buildGame(tenParticipants());
  const game = normalizeLiveGame(
    raw,
    baseCtx({ selfRecentForm: { sampleSize: 5, wins: 3, losses: 2, winRate: 60, averageKda: 3.2 } }),
  );
  const self = game!.participants.find((p) => p.isSelf);
  const others = game!.participants.filter((p) => !p.isSelf);
  assert.deepEqual(self?.recentForm, { sampleSize: 5, wins: 3, losses: 2, winRate: 60, averageKda: 3.2 });
  assert.ok(others.every((p) => p.recentForm === undefined));
});

// --- Identidad conocida (PRO/streamer) ---

test('la identidad conocida se adjunta cuando identityFor la resuelve, ausente cuando no', () => {
  const identity: KnownPlayerIdentity = {
    displayName: 'Jugador Pro',
    isPro: true,
    isStreamer: false,
    team: 'KC',
  };
  const withIdentity = normalizeLiveParticipant(
    participant(),
    baseCtx({ identityFor: () => identity }),
  );
  const withoutIdentity = normalizeLiveParticipant(participant(), baseCtx());
  assert.deepEqual(withIdentity?.identity, identity);
  assert.equal(withoutIdentity?.identity, undefined);
});

// --- Hechizos de invocador y árbol de runas ---

test('los hechizos de invocador reales se resuelven a nombre + icono conocidos', () => {
  const result = normalizeLiveParticipant(participant({ spell1Id: 4, spell2Id: 11 }), baseCtx());
  assert.equal(result?.summonerSpells.length, 2);
  assert.equal(result?.summonerSpells[0]?.name, 'Flash');
  assert.equal(result?.summonerSpells[1]?.name, 'Smite');
});

test('el árbol principal/secundario de runas se resuelve por perkStyle/perkSubStyle', () => {
  const result = normalizeLiveParticipant(
    participant({ perks: { perkIds: [8005], perkStyle: 8000, perkSubStyle: 8200 } }),
    baseCtx(),
  );
  assert.equal(result?.primaryRuneTree?.name, 'Precisión');
  assert.equal(result?.secondaryRuneTree?.name, 'Brujería');
});

// --- Keystone exacta (spectator-v5 sí la da: perks.perkIds[0]) ---

test('la keystone exacta se resuelve por perkIds[0] contra el mapa de runesReforged, cuando el id resuelve', () => {
  const keystoneById = new Map([[8128, { name: 'Dark Harvest', imageUrl: 'https://ddragon.example/perk/8128.png' }]]);
  const result = normalizeLiveParticipant(
    participant({ perks: { perkIds: [8128, 8126], perkStyle: 8100, perkSubStyle: 8000 } }),
    baseCtx({ keystoneById }),
  );
  assert.equal(result?.keystone?.id, 8128);
  assert.equal(result?.keystone?.name, 'Dark Harvest');
  assert.equal(result?.keystone?.imageUrl, 'https://ddragon.example/perk/8128.png');
});

test('un id de keystone que no resuelve contra el mapa deja el nombre genérico, nunca inventado por campeón/build', () => {
  const result = normalizeLiveParticipant(
    participant({ perks: { perkIds: [999999], perkStyle: 8100, perkSubStyle: 8000 } }),
    baseCtx({ keystoneById: new Map() }),
  );
  assert.equal(result?.keystone?.id, 999999);
  assert.equal(result?.keystone?.name, 'Runa 999999');
  assert.equal(result?.keystone?.imageUrl, undefined);
});

test('sin perkIds (Riot no lo trae), la keystone queda ausente — nunca inferida', () => {
  const result = normalizeLiveParticipant(
    participant({ perks: { perkStyle: 8100, perkSubStyle: 8000 } }),
    baseCtx(),
  );
  assert.equal(result?.keystone, undefined);
});

// --- Baneos ---

test('los baneos reales se normalizan y resuelven contra el mismo mapa de campeones', () => {
  const raw = buildGame(tenParticipants());
  const game = normalizeLiveGame(raw, baseCtx());
  assert.equal(game!.bannedChampions.length, 1);
  assert.equal(game!.bannedChampions[0]?.championName, 'Lucian');
});

// --- Participante sin PUUID: nunca se inventa uno ---

test('un participante de spectator-v5 sin PUUID (dato inválido) se descarta, nunca se inventa un id', () => {
  const result = normalizeLiveParticipant(participant({ puuid: undefined }), baseCtx());
  assert.equal(result, null);
});

// --- summarizeLobbyRank: nunca una media, solo el tier que más se repite ---

const rankedParticipant = (tier?: string): LiveParticipant => ({
  puuid: `p-${Math.random()}`,
  riotId: 'X#EUW',
  riotIdResolved: true,
  championId: 1,
  teamId: 100,
  summonerSpells: [],
  isSelf: false,
  ranked: tier ? { available: true, tier } : { available: false },
});

test('summarizeLobbyRank elige el tier que más se repite (moda), nunca una media de LP', () => {
  const summary = summarizeLobbyRank([
    rankedParticipant('MASTER'),
    rankedParticipant('MASTER'),
    rankedParticipant('DIAMOND'),
  ]);
  assert.equal(summary.predominantTier, 'MASTER');
  assert.equal(summary.participantsWithRank, 3);
  assert.equal(summary.totalParticipants, 3);
});

test('summarizeLobbyRank cuenta correctamente cuántos participantes tienen rango disponible frente al total', () => {
  const summary = summarizeLobbyRank([
    rankedParticipant('MASTER'),
    rankedParticipant(undefined),
    rankedParticipant(undefined),
  ]);
  assert.equal(summary.participantsWithRank, 1);
  assert.equal(summary.totalParticipants, 3);
  assert.equal(summary.predominantTier, 'MASTER');
});

test('summarizeLobbyRank sin ningún participante con rango disponible deja predominantTier ausente, nunca inventado', () => {
  const summary = summarizeLobbyRank([rankedParticipant(undefined), rankedParticipant(undefined)]);
  assert.equal(summary.participantsWithRank, 0);
  assert.equal(summary.predominantTier, undefined);
});

test('normalizeLiveGame adjunta lobbyRank calculado sobre los participantes reales de la partida', () => {
  const raw = buildGame(tenParticipants());
  const game = normalizeLiveGame(raw, baseCtx());
  assert.ok(game?.lobbyRank);
  assert.equal(game!.lobbyRank.totalParticipants, 10);
});
