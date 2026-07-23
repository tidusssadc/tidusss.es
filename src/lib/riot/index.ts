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

  const account = await cached(
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
  const matchResults = await Promise.allSettled(
    matchIds.value.map((matchId) =>
      cached(`riot:match:${matchId}`, 24 * HOUR, 7 * 24 * HOUR, () =>
        client.get<RiotMatchDto>(
          `${regionalBase}/lol/match/v5/matches/${encode(matchId)}`,
          {
            phase: 'matches',
            endpoint: 'MATCH-V5 /lol/match/v5/matches/{matchId}',
          },
        ),
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
export type { RiotDiagnosticEvent, RiotDiagnosticLogger } from './client';
export type * from './types';
