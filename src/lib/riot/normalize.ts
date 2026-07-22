import type {
  RankedSummary,
  RecentMatch,
  RiotLeagueEntryDto,
  RiotMatchDto,
} from './types';

const queueLabels: Record<number, string> = {
  400: 'Normal Draft',
  420: 'Solo Queue',
  430: 'Normal',
  440: 'Flex',
  450: 'ARAM',
  490: 'Quickplay',
};

export const formatRankLabel = (tier?: string, rank?: string) => {
  if (!tier) return 'Sin clasificación';
  const apexTiers = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER']);
  return apexTiers.has(tier) ? tier : [tier, rank].filter(Boolean).join(' ');
};

export const safePercentage = (wins: number, losses: number) => {
  const total = wins + losses;
  return total > 0 ? Math.round((wins / total) * 100) : undefined;
};

export const formatGameDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
};

export const normalizeRanked = (
  entries: RiotLeagueEntryDto[],
): RankedSummary => {
  const solo = entries.find((entry) => entry.queueType === 'RANKED_SOLO_5x5');
  if (!solo) return { available: false, queueType: 'RANKED_SOLO_5x5' };
  const wins = Math.max(0, solo.wins ?? 0);
  const losses = Math.max(0, solo.losses ?? 0);
  return {
    available: true,
    queueType: 'RANKED_SOLO_5x5',
    tier: solo.tier,
    rank: solo.rank,
    leaguePoints: solo.leaguePoints,
    wins,
    losses,
    winRate: safePercentage(wins, losses),
  };
};

export const normalizeMatch = (
  match: RiotMatchDto,
  puuid: string,
  championUrl: (name: string) => string,
  itemUrl: (id: number) => string,
): RecentMatch | null => {
  const info = match.info;
  const participant = info?.participants?.find((item) => item.puuid === puuid);
  const matchId = match.metadata?.matchId;
  if (!info || !participant || !matchId || !info.gameCreation) return null;
  const durationSeconds = Math.max(1, info.gameDuration ?? 0);
  const kills = Math.max(0, participant.kills ?? 0);
  const deaths = Math.max(0, participant.deaths ?? 0);
  const assists = Math.max(0, participant.assists ?? 0);
  const cs =
    Math.max(0, participant.totalMinionsKilled ?? 0) +
    Math.max(0, participant.neutralMinionsKilled ?? 0);
  const championName = participant.championName || 'Desconocido';
  const items = [
    participant.item0,
    participant.item1,
    participant.item2,
    participant.item3,
    participant.item4,
    participant.item5,
    participant.item6,
  ].filter((item): item is number => Boolean(item));
  const queueId = info.queueId ?? 0;
  return {
    matchId,
    championId: participant.championId ?? 0,
    championName,
    championImageUrl:
      championName === 'Desconocido' ? undefined : championUrl(championName),
    win: Boolean(participant.win),
    kills,
    deaths,
    assists,
    kda: Number(((kills + assists) / Math.max(1, deaths)).toFixed(2)),
    cs,
    csPerMinute: Number((cs / (durationSeconds / 60)).toFixed(1)),
    durationSeconds,
    durationLabel: formatGameDuration(durationSeconds),
    queueId,
    queueLabel: queueLabels[queueId] || `Modo ${queueId}`,
    playedAt: new Date(info.gameCreation ?? 0).toISOString(),
    items,
    itemImageUrls: items.map(itemUrl),
    remake: Boolean(participant.gameEndedInEarlySurrender),
  };
};
