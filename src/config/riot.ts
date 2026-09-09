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
  // 30: suficiente para que el perfil competitivo avanzado (KDA/CSM/GPM/DPM
  // por ventana, campeones, actividad, sinergias) tenga una muestra con
  // sentido sin descargar la temporada completa en cada caché fría — cada
  // partida se cachea 7 días de forma independiente (`riot:match:{id}` en
  // `index.ts`), así que solo paga esta llamada quien encuentra la caché
  // vacía o expirada, nunca cada visitante.
  recentMatchIds: 30,
  recentSoloSample: 10,
} as const;

export const getRiotConfig = (env: RiotEnvironment) => ({
  apiKey: env.RIOT_API_KEY?.trim() || undefined,
  gameName: env.RIOT_GAME_NAME?.trim() || riotDefaults.gameName,
  tagLine: env.RIOT_TAG_LINE?.trim() || riotDefaults.tagLine,
  platformRoute: env.RIOT_PLATFORM_ROUTE?.trim() || riotDefaults.platformRoute,
  regionalRoute: env.RIOT_REGIONAL_ROUTE?.trim() || riotDefaults.regionalRoute,
});
