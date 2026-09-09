export type RiotDataState =
  'available' | 'partial' | 'unranked' | 'no-recent-matches';

export interface RiotProfile {
  riotId: string;
  gameName: string;
  tagLine: string;
  region: 'EUW';
  profileIconId?: number;
  profileIconUrl?: string;
  summonerLevel?: number;
}

export interface RankedSummary {
  available: boolean;
  queueType: 'RANKED_SOLO_5x5';
  tier?: string;
  rank?: string;
  leaguePoints?: number;
  wins?: number;
  losses?: number;
  winRate?: number;
}

export interface RecentMatch {
  matchId: string;
  championId: number;
  championName: string;
  championImageUrl?: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  cs: number;
  csPerMinute: number;
  durationSeconds: number;
  durationLabel: string;
  queueId: number;
  queueLabel: string;
  playedAt: string;
  items: number[];
  itemImageUrls: string[];
  damageToChampions: number;
  goldEarned: number;
  visionScore: number;
  position: string;
  summonerSpells: MatchIcon[];
  runes: MatchIcon[];
  teams: MatchTeam[];
  teamId: number;
  lpDelta?: number;
  badges?: MatchBadge[];
  remake: boolean;
}

export type MatchBadge =
  | 'MVP'
  | 'Carry'
  | 'Perfect CS'
  | 'S+'
  | 'Penta'
  | 'Legendary'
  | 'Hot Streak'
  | 'New Record'
  | 'Best Game Today';

export interface MatchIcon {
  id: number;
  name: string;
  imageUrl?: string;
}

export interface MatchParticipant {
  displayName: string;
  championName: string;
  championImageUrl?: string;
  teamId: number;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  damageToChampions: number;
  goldEarned: number;
  visionScore: number;
  items: number[];
  itemImageUrls: string[];
}

export interface MatchTeam {
  teamId: number;
  win: boolean;
  participants: MatchParticipant[];
  objectives: {
    towers: number;
    dragons: number;
    barons: number;
  };
}

export interface ChampionPerformance {
  championName: string;
  championImageUrl?: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  averageKills: number;
  averageDeaths: number;
  averageAssists: number;
  averageKda: number;
  averageCsPerMinute: number;
}

export interface RecentPerformance {
  sampleSize: number;
  wins: number;
  losses: number;
  winRate?: number;
  averageKda?: number;
  averageCsPerMinute?: number;
  averageDamageToChampions?: number;
  mostPlayedChampion?: ChampionPerformance;
  lucian?: ChampionPerformance;
  champions: ChampionPerformance[];
  positions: Array<{ position: string; games: number; percentage: number }>;
  primaryPosition?: string;
  gamesLastSevenDays: number;
  lastPlayedAt?: string;
  editorialSummary: string[];
  matches: RecentMatch[];
}

export interface TodaySoloQueue {
  games: number;
  wins: number;
  losses: number;
  winRate?: number;
  averageKda?: number;
  mostPlayedChampion?: ChampionPerformance;
  streak?: { result: 'win' | 'loss'; games: number };
  lastPlayedAt?: string;
  activity: 'recent' | 'inactive' | 'no-games';
  lpDelta?: number;
  lpDeltaEstimated: true;
  matches: RecentMatch[];
}

export interface RiotOverview {
  profile: RiotProfile;
  ranked: RankedSummary;
  recent: RecentPerformance;
  today: TodaySoloQueue;
  updatedAt: string;
  stale: boolean;
  state: RiotDataState;
  source: 'Riot Games API';
}

export type RiotPublicResponse =
  | {
      ok: true;
      data: RiotOverview;
      meta?: { cached: boolean; updatedAt: string; source: 'riot' };
    }
  | {
      ok: false;
      error: { code: string; message: string };
    };

export interface RiotAccountDto {
  puuid?: string;
  gameName?: string;
  tagLine?: string;
}

export interface RiotSummonerDto {
  id?: string;
  profileIconId?: number;
  summonerLevel?: number;
}

export interface RiotLeagueEntryDto {
  queueType?: string;
  tier?: string;
  rank?: string;
  leaguePoints?: number;
  wins?: number;
  losses?: number;
}

export interface RiotParticipantDto {
  puuid?: string;
  championId?: number;
  championName?: string;
  win?: boolean;
  kills?: number;
  deaths?: number;
  assists?: number;
  teamId?: number;
  riotIdGameName?: string;
  summonerName?: string;
  individualPosition?: string;
  teamPosition?: string;
  totalMinionsKilled?: number;
  neutralMinionsKilled?: number;
  totalDamageDealtToChampions?: number;
  goldEarned?: number;
  visionScore?: number;
  summoner1Id?: number;
  summoner2Id?: number;
  perks?: {
    styles?: Array<{
      style?: number;
      selections?: Array<{ perk?: number }>;
    }>;
  };
  item0?: number;
  item1?: number;
  item2?: number;
  item3?: number;
  item4?: number;
  item5?: number;
  item6?: number;
  gameEndedInEarlySurrender?: boolean;
}

export interface RiotTeamDto {
  teamId?: number;
  win?: boolean;
  objectives?: {
    tower?: { kills?: number };
    dragon?: { kills?: number };
    baron?: { kills?: number };
  };
}

export interface RiotMatchDto {
  metadata?: { matchId?: string };
  info?: {
    gameCreation?: number;
    gameDuration?: number;
    queueId?: number;
    participants?: RiotParticipantDto[];
    teams?: RiotTeamDto[];
  };
}

// --- SPECTATOR-V5 (partida en curso) ---

export interface RiotCurrentGameParticipantDto {
  puuid?: string;
  championId?: number;
  teamId?: number;
  spell1Id?: number;
  spell2Id?: number;
  profileIconId?: number;
  perks?: {
    perkIds?: number[];
    perkStyle?: number;
    perkSubStyle?: number;
  };
  /** Campo heredado de Riot, ya no fiable como identidad — el Riot ID real se resuelve aparte vía account-v1 por PUUID. */
  summonerName?: string;
  bot?: boolean;
}

export interface RiotCurrentGameBanDto {
  championId?: number;
  teamId?: number;
  pickTurn?: number;
}

export interface RiotCurrentGameInfoDto {
  gameId?: number;
  gameType?: string;
  gameStartTime?: number;
  mapId?: number;
  gameLength?: number;
  platformId?: string;
  gameMode?: string;
  bannedChampions?: RiotCurrentGameBanDto[];
  gameQueueConfigId?: number;
  participants?: RiotCurrentGameParticipantDto[];
}
