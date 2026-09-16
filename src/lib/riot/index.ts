import {
  getRiotConfig,
  riotDefaults,
  type RiotEnvironment,
} from '../../config/riot';
import { findKnownPlayerIdentity, knownPlayerIdentities } from '../../config/known-players';
import { analyzeRecentSoloQueue, analyzeTodaySoloQueue } from './analytics';
import { cached } from './cache';
import { createRiotClient, type RiotDiagnosticLogger } from './client';
import {
  dataDragonUrls,
  getDataDragonItems,
  getDataDragonVersion,
} from './datadragon';
import { RiotApiError } from './errors';
import { normalizeMatch, normalizeRanked } from './normalize';
import { buildProfilePerformance } from './performance';
import { normalizeMatchTimeline } from './timeline-normalize';
import type {
  RankedSummary,
  RiotAccountDto,
  RiotLeagueEntryDto,
  RiotMatchDto,
  RiotOverview,
  RiotSummonerDto,
} from './types';
import type { MatchTimeline, RiotTimelineDto } from './timeline-types';

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
      // Encuentros PRO/STREAMER (Fase E) — mismo Identity Registry curado
      // y el mismo matcher exacto-por-PUUID que ya usa "Partida en curso"
      // (`live.ts`), sin llamada Riot adicional: opera sobre el match que
      // ya se acaba de traer/cachear.
      (participantPuuid) =>
        findKnownPlayerIdentity(participantPuuid, undefined, knownPlayerIdentities),
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

/**
 * El PUUID real de Tidusss, solo — para el histórico de rango (Night
 * Shift 2026-09-09, `src/lib/rank-history`), que necesita una identidad
 * técnica estable pero NUNCA debe volver a resolver la cuenta por su
 * cuenta. Reutiliza `resolveSelfAccount` (misma clave de caché de 24h
 * que ya calienta `getRiotOverview`/`getRiotLiveGame`) — en el caso real
 * (se llama justo después de un `getRiotOverview` en la misma petición),
 * esto es una lectura de caché de memoria, cero llamadas Riot nuevas.
 * El PUUID nunca se expone en `RiotOverview` (tipo público del cliente).
 */
export const resolveSelfAccountPuuid = async (
  environment: RiotEnvironment,
  diagnostics?: RiotDiagnosticLogger,
): Promise<string | undefined> => {
  const config = getRiotConfig(environment);
  if (!config.apiKey) return undefined;
  const client = createRiotClient({ apiKey: config.apiKey, diagnostics });
  const regionalBase = `https://${config.regionalRoute}.api.riotgames.com`;
  try {
    const account = await resolveSelfAccount(client, regionalBase, config);
    return account.value.puuid;
  } catch {
    return undefined;
  }
};

export interface RiotRankObservation {
  puuid: string;
  ranked: RankedSummary;
  /** Momento real de la observación (ISO 8601 UTC) — generado aquí, nunca heredado de una caché stale. */
  observedAt: string;
  /** `true` solo si LEAGUE-V4 se sirvió stale tras un fallo (nunca un fallo silencioso: el snapshot sigue siendo dato real, solo no fresco). */
  rankedStale: boolean;
}

/**
 * Camino LIGERO para el histórico de rango (Night Shift cierre §18/§19).
 * SOLO resuelve:
 *   - cuenta/PUUID  → ACCOUNT-V1  (misma clave `riot:account:*`, caché 24h)
 *   - rango Solo/Duo → LEAGUE-V4  (misma clave `riot:ranked:{puuid}`, caché 10min)
 *
 * NUNCA toca SUMMONER-V4, MATCH-V5 (ids ni detalle), Match Timeline ni
 * Data Dragon. El cron de snapshots corre cada ~30 min y no puede
 * permitirse el `getRiotOverview` completo (hasta 30 detalles de partida)
 * solo para leer LP. Comparte exactamente las claves de caché de
 * `getRiotOverview`, así que una visita reciente a /competitivo y este
 * cron se aprovechan mutuamente cuando caen en el mismo isolate — nunca
 * se afirma que esa caché esté garantizada compartida entre isolates
 * (misma advertencia que el resto de `src/lib/riot`).
 */
export const getRiotRankObservation = async (
  environment: RiotEnvironment,
  diagnostics?: RiotDiagnosticLogger,
): Promise<RiotRankObservation> => {
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

  const leagueEntries = await cached(
    `riot:ranked:${puuid}`,
    10 * MINUTE,
    6 * HOUR,
    () =>
      client.get<RiotLeagueEntryDto[]>(
        `${platformBase}/lol/league/v4/entries/by-puuid/${encode(puuid)}`,
        {
          phase: 'league',
          endpoint: 'LEAGUE-V4 /lol/league/v4/entries/by-puuid/{puuid}',
        },
      ),
  );

  return {
    puuid,
    ranked: normalizeRanked(leagueEntries.value),
    observedAt: new Date().toISOString(),
    rankedStale: leagueEntries.stale,
  };
};

// --- Match Timeline (Match-V5 Timeline) — on-demand, nunca en la ruta
// crítica de /api/riot/overview ni /api/riot/live (encargo §29). ---

/**
 * Formato real de un matchId de Riot: `{PLATAFORMA}_{id numérico}` (p. ej.
 * `EUW1_1234567890`). Validado ANTES de tocar red — nunca se envía a Riot
 * (ni se acepta como parámetro de caché) un matchId con forma sospechosa.
 */
export const MATCH_ID_PATTERN = /^[A-Z]{2,4}[0-9]?_\d{1,15}$/;

export const getMatchTimeline = async (
  environment: RiotEnvironment,
  matchId: string,
  diagnostics?: RiotDiagnosticLogger,
): Promise<MatchTimeline> => {
  const config = getRiotConfig(environment);
  if (!config.apiKey)
    throw new RiotApiError(
      'RIOT_API_KEY_MISSING',
      503,
      undefined,
      'configuration',
    );
  if (!MATCH_ID_PATTERN.test(matchId))
    throw new RiotApiError('RIOT_MATCH_ID_INVALID', 400, undefined, 'timeline');

  const client = createRiotClient({ apiKey: config.apiKey, diagnostics });
  const regionalBase = `https://${config.regionalRoute}.api.riotgames.com`;

  const account = await resolveSelfAccount(client, regionalBase, config);
  const puuid = account.value.puuid;
  if (!puuid)
    throw new RiotApiError('RIOT_INVALID_RESPONSE', 502, undefined, 'account');

  // Alcance (encargo §5): el matchId pedido debe pertenecer al conjunto
  // reciente conocido de Tidusss — misma clave de caché que ya usa
  // `getRiotOverview`, así que en caché caliente esto no añade ninguna
  // llamada Riot nueva. Nunca se acepta un matchId ajeno solo por tener
  // forma válida: este endpoint no es un proxy Riot arbitrario.
  const matchIds = await cached(`riot:matches:${puuid}`, 5 * MINUTE, HOUR, () =>
    client.get<string[]>(
      `${regionalBase}/lol/match/v5/matches/by-puuid/${encode(puuid)}/ids?start=0&count=${riotDefaults.recentMatchIds}`,
      {
        phase: 'matches',
        endpoint: 'MATCH-V5 /lol/match/v5/matches/by-puuid/{puuid}/ids',
      },
    ),
  );
  if (!matchIds.value.includes(matchId))
    throw new RiotApiError('RIOT_MATCH_NOT_FOUND', 404, undefined, 'timeline');

  const [matchDetail, timelineDetail, dataDragonVersion] = await Promise.all([
    // Misma clave que `getRiotOverview` — si el detalle de esta partida ya
    // está caliente (lo normal: todo el Historial visible viene de esas
    // mismas 30), esto es una lectura de caché, no una llamada Riot nueva.
    cached(`riot:match:${matchId}`, 24 * HOUR, 7 * 24 * HOUR, () =>
      client.get<RiotMatchDto>(
        `${regionalBase}/lol/match/v5/matches/${encode(matchId)}`,
        {
          phase: 'matches',
          endpoint: 'MATCH-V5 /lol/match/v5/matches/{matchId}',
        },
      ),
    ),
    // Una partida terminada es prácticamente inmutable: TTL de 30 días.
    // Caché de memoria de proceso — el mismo tipo (isolate-local, no
    // compartida) que el resto de este proyecto; ver informe de entrega
    // para la distinción honesta proceso/edge.
    cached(
      `riot:timeline:${matchId}`,
      30 * 24 * HOUR,
      30 * 24 * HOUR,
      () =>
        client.get<RiotTimelineDto>(
          `${regionalBase}/lol/match/v5/matches/${encode(matchId)}/timeline`,
          {
            phase: 'timeline',
            endpoint:
              'MATCH-V5 /lol/match/v5/matches/{matchId}/timeline',
          },
        ),
    ),
    getDataDragonVersion(),
  ]);

  const itemIndex = await getDataDragonItems(dataDragonVersion);
  const urls = dataDragonUrls(dataDragonVersion);

  const timeline = normalizeMatchTimeline({
    matchId,
    timelineDto: timelineDetail.value,
    matchDto: matchDetail.value,
    selfPuuid: puuid,
    itemIndex,
    itemImageUrl: urls.item,
    updatedAt: new Date().toISOString(),
  });
  if (!timeline)
    throw new RiotApiError(
      'RIOT_INVALID_RESPONSE',
      502,
      undefined,
      'timeline',
    );
  return timeline;
};

export * from './analytics';
export * from './cache';
export * from './errors';
export * from './insights';
export * from './normalize';
export * from './performance';
export * from './timeline-normalize';
export type { RiotDiagnosticEvent, RiotDiagnosticLogger } from './client';
export type * from './types';
export type * from './timeline-types';
