import {
  getRiotConfig,
  riotDefaults,
  type RiotEnvironment,
} from '../../config/riot';
import { analyzeRecentSoloQueue, analyzeTodaySoloQueue } from './analytics';
import { cached } from './cache';
import { createRiotClient, type RiotDiagnosticLogger } from './client';
import { dataDragonUrls, getDataDragonVersion } from './datadragon';
import { RiotApiError } from './errors';
import { normalizeMatch, normalizeRanked } from './normalize';
import { buildProfilePerformance } from './performance';
import type {
  RiotAccountDto,
  RiotLeagueEntryDto,
  RiotMatchDto,
  RiotOverview,
  RiotSummonerDto,
} from './types';

const encode = encodeURIComponent;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Con `recentMatchIds` en 30 (antes 15), pedir el detalle de cada partida
 * a la vez con `Promise.all`/`allSettled` sin ningún límite arriesgaría un
 * pico de 30 peticiones simultáneas contra Match-V5 — el cliente Riot
 * (`client.ts`) no aplica ningún throttle propio. En la práctica esto solo
 * ocurre con la caché fría (cada partida individual se cachea 7 días), pero
 * sigue siendo el único punto real de riesgo de rate limit de toda esta
 * fase — de ahí el lote de 10 en 10 en vez de anadir una librería nueva.
 */
const CONCURRENT_MATCH_FETCHES = 10;
const mapWithConcurrency = async <T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> => {
  const results: PromiseSettledResult<R>[] = [];
  for (let index = 0; index < items.length; index += limit) {
    const batch = items.slice(index, index + limit);
    results.push(
      ...(await Promise.allSettled(batch.map((item) => mapper(item)))),
    );
  }
  return results;
};

/**
 * Cuenta/PUUID de Tidusss — extraído para que `getRiotOverview` y
 * `getRiotLiveGame` (`live.ts`) compartan exactamente la misma llamada y
 * la misma clave de caché (24h: el PUUID de una cuenta no cambia salvo que
 * cambien el Riot ID configurado), en vez de resolverlo dos veces.
 */
export const resolveSelfAccount = (
  client: ReturnType<typeof createRiotClient>,
  regionalBase: string,
  config: { gameName: string; tagLine: string },
) =>
  cached(
    `riot:account:${config.gameName}:${config.tagLine}`,
    24 * HOUR,
    24 * HOUR,
    () =>
      client.get<RiotAccountDto>(
        `${regionalBase}/riot/account/v1/accounts/by-riot-id/${encode(config.gameName)}/${encode(config.tagLine)}`,
        {
          phase: 'account',
          endpoint:
            'ACCOUNT-V1 /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}',
        },
      ),
  );

export const getRiotOverview = async (
  environment: RiotEnvironment,
  diagnostics?: RiotDiagnosticLogger,
): Promise<RiotOverview> => {
  const config = getRiotConfig(environment);
  if (!config.apiKey)
    throw new RiotApiError(
      'RIOT_API_KEY_MISSING',
      503,
      undefined,
      'configuration',
    );
  const client = createRiotClient({ apiKey: config.apiKey, diagnostics });
  const regionalBase = `https://${config.regionalRoute}.api.riotgames.com`;
  const platformBase = `https://${config.platformRoute}.api.riotgames.com`;

  const account = await resolveSelfAccount(client, regionalBase, config);
  const puuid = account.value.puuid;
  if (!puuid)
    throw new RiotApiError('RIOT_INVALID_RESPONSE', 502, undefined, 'account');

  const [summoner, leagueEntries, matchIds, dataDragonVersion] =
    await Promise.all([
      cached(`riot:summoner:${puuid}`, 6 * HOUR, 12 * HOUR, () =>
        client.get<RiotSummonerDto>(
          `${platformBase}/lol/summoner/v4/summoners/by-puuid/${encode(puuid)}`,
          {
            phase: 'summoner',
            endpoint: 'SUMMONER-V4 /lol/summoner/v4/summoners/by-puuid/{puuid}',
          },
        ),
      ),
      cached(`riot:ranked:${puuid}`, 10 * MINUTE, 6 * HOUR, () =>
        client.get<RiotLeagueEntryDto[]>(
          `${platformBase}/lol/league/v4/entries/by-puuid/${encode(puuid)}`,
          {
            phase: 'league',
            endpoint: 'LEAGUE-V4 /lol/league/v4/entries/by-puuid/{puuid}',
          },
        ),
      ),
      cached(`riot:matches:${puuid}`, 5 * MINUTE, HOUR, () =>
        client.get<string[]>(
          `${regionalBase}/lol/match/v5/matches/by-puuid/${encode(puuid)}/ids?start=0&count=${riotDefaults.recentMatchIds}`,
          {
            phase: 'matches',
            endpoint: 'MATCH-V5 /lol/match/v5/matches/by-puuid/{puuid}/ids',
          },
        ),
      ),
      getDataDragonVersion(),
    ]);

  const urls = dataDragonUrls(dataDragonVersion);
  const matchResults = await mapWithConcurrency(
    matchIds.value,
    CONCURRENT_MATCH_FETCHES,
    (matchId) =>
      cached(`riot:match:${matchId}`, 24 * HOUR, 7 * 24 * HOUR, () =>
        client.get<RiotMatchDto>(
          `${regionalBase}/lol/match/v5/matches/${encode(matchId)}`,
          {
            phase: 'matches',
            endpoint: 'MATCH-V5 /lol/match/v5/matches/{matchId}',
          },
        ),
      ),
  );
  const normalizedMatches = matchResults.flatMap((result) => {
    if (result.status !== 'fulfilled') return [];
    const match = normalizeMatch(
      result.value.value,
      puuid,
      urls.champion,
      urls.item,
      urls.summonerSpell,
    );
    return match ? [match] : [];
  });
  const recent = analyzeRecentSoloQueue(normalizedMatches);
  const today = analyzeTodaySoloQueue(normalizedMatches);
  // Mismo `normalizedMatches` que `recent`/`today` — el perfil competitivo
  // avanzado no dispara ninguna llamada Riot adicional (encargo §18/§19).
  const performance = buildProfilePerformance(normalizedMatches);
  const ranked = normalizeRanked(leagueEntries.value);
  const partial =
    matchResults.some((result) => result.status === 'rejected') ||
    !account.value.gameName ||
    !account.value.tagLine;
  const stale =
    account.stale ||
    summoner.stale ||
    leagueEntries.stale ||
    matchIds.stale ||
    matchResults.some(
      (result) => result.status === 'fulfilled' && result.value.stale,
    );

  return {
    profile: {
      riotId: `${account.value.gameName || config.gameName}#${account.value.tagLine || config.tagLine}`,
      gameName: account.value.gameName || config.gameName,
      tagLine: account.value.tagLine || config.tagLine,
      region: 'EUW',
      profileIconId: summoner.value.profileIconId,
      profileIconUrl:
        summoner.value.profileIconId === undefined
          ? undefined
          : urls.profileIcon(summoner.value.profileIconId),
      summonerLevel: summoner.value.summonerLevel,
    },
    ranked,
    recent,
    today,
    performance,
    updatedAt: new Date().toISOString(),
    stale,
    state: partial
      ? 'partial'
      : !ranked.available
        ? 'unranked'
        : recent.sampleSize === 0
          ? 'no-recent-matches'
          : 'available',
    source: 'Riot Games API',
  };
};

export * from './analytics';
export * from './cache';
export * from './errors';
export * from './normalize';
export * from './performance';
export type { RiotDiagnosticEvent, RiotDiagnosticLogger } from './client';
export type * from './types';
