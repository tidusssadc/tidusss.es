import type {
  MatchIcon,
  MatchParticipant,
  RankedSummary,
  RecentMatch,
  RiotLeagueEntryDto,
  RiotMatchDto,
  RiotParticipantDto,
} from './types';

/**
 * Exportados (no solo locales de este módulo): `live-normalize.ts` los
 * reutiliza para resolver hechizos/árbol de runas de "Partida en curso" —
 * mismo mapa, una sola fuente, nunca duplicado.
 */
export const summonerSpells: Record<number, { name: string; asset: string }> = {
  1: { name: 'Cleanse', asset: 'SummonerBoost' },
  3: { name: 'Exhaust', asset: 'SummonerExhaust' },
  4: { name: 'Flash', asset: 'SummonerFlash' },
  6: { name: 'Ghost', asset: 'SummonerHaste' },
  7: { name: 'Heal', asset: 'SummonerHeal' },
  11: { name: 'Smite', asset: 'SummonerSmite' },
  12: { name: 'Teleport', asset: 'SummonerTeleport' },
  14: { name: 'Ignite', asset: 'SummonerDot' },
  21: { name: 'Barrier', asset: 'SummonerBarrier' },
};

/**
 * El icono de cada ÁRBOL de runas (a diferencia del icono de una runa
 * concreta) no vive en `Styles/{Nombre}/{Nombre}.png` — esa ruta devuelve
 * 403 en el CDN real de Data Dragon. El nombre de archivo correcto lleva un
 * prefijo numérico que ni siquiera coincide siempre con el nombre del árbol
 * (Inspiración es "7203_Whimsy.png"). Verificado contra
 * `cdn/16.14.1/data/es_ES/runesReforged.json` real — no es una suposición.
 */
export const runeStyles: Record<number, { name: string; imageUrl: string }> = {
  8000: {
    name: 'Precisión',
    imageUrl:
      'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7201_Precision.png',
  },
  8100: {
    name: 'Dominación',
    imageUrl:
      'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7200_Domination.png',
  },
  8200: {
    name: 'Brujería',
    imageUrl:
      'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7202_Sorcery.png',
  },
  8300: {
    name: 'Inspiración',
    imageUrl:
      'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7203_Whimsy.png',
  },
  8400: {
    name: 'Valor',
    imageUrl:
      'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7204_Resolve.png',
  },
};

const participantItems = (participant: RiotParticipantDto) =>
  [
    participant?.item0,
    participant?.item1,
    participant?.item2,
    participant?.item3,
    participant?.item4,
    participant?.item5,
    participant?.item6,
  ].filter((item): item is number => Boolean(item));

export const queueLabels: Record<number, string> = {
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
  summonerSpellUrl: (name: string) => string,
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
  const items = participantItems(participant);
  const queueId = info.queueId ?? 0;
  const toParticipant = (
    player: NonNullable<typeof info.participants>[number],
  ): MatchParticipant => {
    const playerItems = participantItems(player);
    const playerChampion = player.championName || 'Desconocido';
    return {
      displayName: player.riotIdGameName || player.summonerName || 'Invocador',
      championName: playerChampion,
      championImageUrl:
        playerChampion === 'Desconocido'
          ? undefined
          : championUrl(playerChampion),
      teamId: player.teamId ?? 0,
      win: Boolean(player.win),
      kills: Math.max(0, player.kills ?? 0),
      deaths: Math.max(0, player.deaths ?? 0),
      assists: Math.max(0, player.assists ?? 0),
      cs:
        Math.max(0, player.totalMinionsKilled ?? 0) +
        Math.max(0, player.neutralMinionsKilled ?? 0),
      damageToChampions: Math.max(0, player.totalDamageDealtToChampions ?? 0),
      goldEarned: Math.max(0, player.goldEarned ?? 0),
      visionScore: Math.max(0, player.visionScore ?? 0),
      items: playerItems,
      itemImageUrls: playerItems.map(itemUrl),
      position: player.teamPosition || player.individualPosition || undefined,
    };
  };
  const teams = (info.teams ?? []).map((team) => ({
    teamId: team.teamId ?? 0,
    win: Boolean(team.win),
    participants: (info.participants ?? [])
      .filter((player) => player.teamId === team.teamId)
      .map(toParticipant),
    objectives: {
      towers: Math.max(0, team.objectives?.tower?.kills ?? 0),
      dragons: Math.max(0, team.objectives?.dragon?.kills ?? 0),
      barons: Math.max(0, team.objectives?.baron?.kills ?? 0),
    },
  }));
  const spells = [participant.summoner1Id, participant.summoner2Id].flatMap(
    (id): MatchIcon[] => {
      if (!id) return [];
      const spell = summonerSpells[id];
      return [
        {
          id,
          name: spell?.name ?? `Hechizo ${id}`,
          imageUrl: spell ? summonerSpellUrl(spell.asset) : undefined,
        },
      ];
    },
  );
  const runes = (participant.perks?.styles ?? []).flatMap(
    ({ style }): MatchIcon[] => {
      if (!style) return [];
      const rune = runeStyles[style];
      return [
        {
          id: style,
          name: rune?.name ?? `Rama ${style}`,
          imageUrl: rune?.imageUrl,
        },
      ];
    },
  );
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
    damageToChampions: Math.max(
      0,
      participant.totalDamageDealtToChampions ?? 0,
    ),
    goldEarned: Math.max(0, participant.goldEarned ?? 0),
    visionScore: Math.max(0, participant.visionScore ?? 0),
    position:
      participant.teamPosition ||
      participant.individualPosition ||
      'Sin posición',
    summonerSpells: spells,
    runes,
    teams,
    teamId: participant.teamId ?? 0,
    remake: Boolean(participant.gameEndedInEarlySurrender),
  };
};
