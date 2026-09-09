import { queueLabels, runeStyles, summonerSpells } from './normalize';
import type {
  RiotCurrentGameBanDto,
  RiotCurrentGameInfoDto,
  RiotCurrentGameParticipantDto,
} from './types';
import type {
  KnownPlayerIdentity,
  LiveGame,
  LiveGameBan,
  LiveGameTeam,
  LiveParticipant,
  LiveParticipantRanked,
  LiveParticipantRecentForm,
  LiveRuneTree,
  LiveSummonerSpell,
} from './live-types';

/**
 * Nombres de mapa reales y estables (Riot no los expone como texto en
 * spectator-v5, solo `mapId`) — los únicos que puede jugar Tidusss en
 * SoloQ/Flex/ARAM hoy. Un id no listado se queda sin `mapName` (ausente,
 * nunca inventado) en vez de mostrar un nombre adivinado.
 */
const mapNames: Record<number, string> = {
  11: 'Grieta del Invocador',
  12: 'Aullido del Abismo (ARAM)',
};

/** Único punto donde se decide "campeón desconocido": el numérico no resolvió contra el mapa real de Data Dragon (`champion.json`), nunca se adivina un nombre. */
const resolveChampion = (
  championId: number | undefined,
  championNameById: ReadonlyMap<number, string>,
  championUrl: (name: string) => string,
): { championName?: string; championImageUrl?: string } => {
  const name = championId !== undefined ? championNameById.get(championId) : undefined;
  return name ? { championName: name, championImageUrl: championUrl(name) } : {};
};

const resolveSummonerSpells = (
  ids: readonly (number | undefined)[],
  summonerSpellUrl: (name: string) => string,
): LiveSummonerSpell[] =>
  ids.flatMap((id): LiveSummonerSpell[] => {
    if (!id) return [];
    const spell = summonerSpells[id];
    return [
      {
        id,
        name: spell?.name ?? `Hechizo ${id}`,
        imageUrl: spell ? summonerSpellUrl(spell.asset) : undefined,
      },
    ];
  });

/**
 * Igual que el resto del sitio (`normalize.ts`): solo se resuelve el
 * ÁRBOL de runas (`perkStyle`/`perkSubStyle`), nunca la runa concreta
 * (keystone) — Data Dragon no da un mapa id→icono para eso sin cargar
 * `runesReforged.json` completo, y esta fase no lo introduce.
 */
const resolveRuneTree = (styleId: number | undefined): LiveRuneTree | undefined => {
  if (!styleId) return undefined;
  const style = runeStyles[styleId];
  return { styleId, name: style?.name ?? `Rama ${styleId}`, imageUrl: style?.imageUrl };
};

export interface LiveNormalizeContext {
  selfPuuid: string;
  championNameById: ReadonlyMap<number, string>;
  championUrl: (name: string) => string;
  summonerSpellUrl: (name: string) => string;
  profileIconUrl: (id: number) => string;
  /** "GameName#TAG" por puuid — ausente si account-v1 no lo pudo resolver para ese participante. */
  riotIdByPuuid: ReadonlyMap<string, string>;
  rankedByPuuid: ReadonlyMap<string, LiveParticipantRanked>;
  identityFor: (
    puuid: string | undefined,
    riotId: string | undefined,
  ) => KnownPlayerIdentity | undefined;
  /** Solo para Tidusss — ver `LiveParticipantRecentForm`. */
  selfRecentForm?: LiveParticipantRecentForm;
}

export const normalizeLiveParticipant = (
  raw: RiotCurrentGameParticipantDto,
  ctx: LiveNormalizeContext,
): LiveParticipant | null => {
  const puuid = raw.puuid;
  if (!puuid) return null;
  const isSelf = puuid === ctx.selfPuuid;
  const resolvedRiotId = ctx.riotIdByPuuid.get(puuid);
  const { championName, championImageUrl } = resolveChampion(
    raw.championId,
    ctx.championNameById,
    ctx.championUrl,
  );
  return {
    puuid,
    riotId: resolvedRiotId || raw.summonerName || 'Invocador',
    riotIdResolved: Boolean(resolvedRiotId),
    championId: raw.championId ?? 0,
    championName,
    championImageUrl,
    teamId: raw.teamId ?? 0,
    summonerSpells: resolveSummonerSpells(
      [raw.spell1Id, raw.spell2Id],
      ctx.summonerSpellUrl,
    ),
    primaryRuneTree: resolveRuneTree(raw.perks?.perkStyle),
    secondaryRuneTree: resolveRuneTree(raw.perks?.perkSubStyle),
    profileIconId: raw.profileIconId,
    profileIconUrl:
      raw.profileIconId === undefined ? undefined : ctx.profileIconUrl(raw.profileIconId),
    isSelf,
    identity: ctx.identityFor(puuid, resolvedRiotId),
    ranked: ctx.rankedByPuuid.get(puuid),
    recentForm: isSelf ? ctx.selfRecentForm : undefined,
  };
};

const normalizeBan = (
  raw: RiotCurrentGameBanDto,
  championNameById: ReadonlyMap<number, string>,
  championUrl: (name: string) => string,
): LiveGameBan | null => {
  if (raw.championId === undefined || raw.teamId === undefined) return null;
  const { championName, championImageUrl } = resolveChampion(
    raw.championId,
    championNameById,
    championUrl,
  );
  return {
    championId: raw.championId,
    championName,
    championImageUrl,
    teamId: raw.teamId,
    pickTurn: raw.pickTurn ?? 0,
  };
};

/**
 * Punto de entrada único: transforma la respuesta cruda de spectator-v5
 * (ya validada como "hay partida activa" por quien llama) en el dominio
 * normalizado `LiveGame`. Nunca lanza por datos ausentes/parciales — un
 * campo que no resolvió simplemente queda `undefined`, nunca inventado.
 */
export const normalizeLiveGame = (
  raw: RiotCurrentGameInfoDto,
  ctx: LiveNormalizeContext,
  source: LiveGame['source'] = 'spectator',
): LiveGame | null => {
  if (raw.gameId === undefined) return null;
  const participants = (raw.participants ?? []).flatMap((participant) => {
    const normalized = normalizeLiveParticipant(participant, ctx);
    return normalized ? [normalized] : [];
  });
  const teamIds = [...new Set(participants.map((participant) => participant.teamId))].sort(
    (a, b) => a - b,
  );
  const teams: LiveGameTeam[] = teamIds.map((teamId) => ({
    teamId,
    participants: participants.filter((participant) => participant.teamId === teamId),
  }));
  const queueId = raw.gameQueueConfigId ?? 0;
  return {
    gameId: raw.gameId,
    gameMode: raw.gameMode ?? 'CLASSIC',
    gameType: raw.gameType ?? 'MATCHED_GAME',
    queueId,
    queueLabel: queueLabels[queueId] || `Modo ${queueId}`,
    mapId: raw.mapId ?? 0,
    mapName: raw.mapId === undefined ? undefined : mapNames[raw.mapId],
    gameStartedAt:
      raw.gameStartTime !== undefined && raw.gameStartTime > 0
        ? new Date(raw.gameStartTime).toISOString()
        : undefined,
    gameLengthSeconds: Math.max(0, raw.gameLength ?? 0),
    platformId: raw.platformId ?? '',
    participants,
    teams,
    bannedChampions: (raw.bannedChampions ?? []).flatMap((ban) => {
      const normalized = normalizeBan(ban, ctx.championNameById, ctx.championUrl);
      return normalized ? [normalized] : [];
    }),
    source,
  };
};

export type { LiveParticipantRanked, LiveParticipantRecentForm };
