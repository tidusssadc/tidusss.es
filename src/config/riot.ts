export interface RiotEnvironment {
  RIOT_API_KEY?: string;
  RIOT_GAME_NAME?: string;
  RIOT_TAG_LINE?: string;
  RIOT_PLATFORM_ROUTE?: string;
  RIOT_REGIONAL_ROUTE?: string;
}

export const riotDefaults = {
  gameName: 'Tidusss',
  tagLine: 'FFX',
  platformRoute: 'euw1',
  regionalRoute: 'europe',
  regionLabel: 'EUW',
  queueType: 'RANKED_SOLO_5x5',
  soloQueueId: 420,
  recentMatchIds: 15,
  recentSoloSample: 10,
} as const;

export const getRiotConfig = (env: RiotEnvironment) => ({
  apiKey: env.RIOT_API_KEY?.trim() || undefined,
  gameName: env.RIOT_GAME_NAME?.trim() || riotDefaults.gameName,
  tagLine: env.RIOT_TAG_LINE?.trim() || riotDefaults.tagLine,
  platformRoute: env.RIOT_PLATFORM_ROUTE?.trim() || riotDefaults.platformRoute,
  regionalRoute: env.RIOT_REGIONAL_ROUTE?.trim() || riotDefaults.regionalRoute,
});
