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
}

export interface ChampionPerformance {
  championName: string;
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
  mostPlayedChampion?: ChampionPerformance;
  lucian?: ChampionPerformance;
  matches: RecentMatch[];
}

export interface RiotOverview {
  profile: RiotProfile;
  ranked: RankedSummary;
  recent: RecentPerformance;
  updatedAt: string;
  stale: boolean;
  state: RiotDataState;
  source: 'Riot Games API';
}

export type RiotPublicResponse =
  | { ok: true; data: RiotOverview }
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
  totalMinionsKilled?: number;
  neutralMinionsKilled?: number;
  item0?: number;
  item1?: number;
  item2?: number;
  item3?: number;
  item4?: number;
  item5?: number;
  item6?: number;
}

export interface RiotMatchDto {
  metadata?: { matchId?: string };
  info?: {
    gameCreation?: number;
    gameDuration?: number;
    queueId?: number;
    participants?: RiotParticipantDto[];
  };
}
