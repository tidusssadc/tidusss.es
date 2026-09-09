import type { RiotEnvironment } from '../../../src/config/riot';
import {
  getRiotOverview,
  publicRiotError,
  resolveSelfAccountPuuid,
  RiotApiError,
  type RiotDiagnosticEvent,
  type RiotPublicResponse,
} from '../../../src/lib/riot';
import { riotDefaults } from '../../../src/config/riot';
import {
  D1RankSnapshotRepository,
  recordObservationIfDue,
  type D1Database,
} from '../../../src/lib/rank-history';

interface Env extends RiotEnvironment {
  /** Binding D1 opcional — ver migrations/0001_rank_snapshots.sql. Sin él, el histórico se degrada honestamente (nunca rompe el resto de /api/riot/overview). */
  DB?: D1Database;
}

interface PagesContext {
  request: Request;
  env: Env;
  /** Deja completar el registro del snapshot tras enviar la respuesta — nunca añade latencia al camino crítico público (mismo criterio de coste que el resto de /api/riot/overview). */
  waitUntil: (promise: Promise<unknown>) => void;
}

const logObservation = (event: { event: string; reason: string; puuid?: string }) => {
  console.info({ scope: 'rank-history', ...event });
};

/**
 * Efecto secundario de esta petición pública: si Riot devuelve rango
 * real, intenta registrar un snapshot (Night Shift 2026-09-09, Fase C).
 * NUNCA bloquea ni puede romper la respuesta de overview — el histórico
 * es un extra, no una dependencia. Reutiliza el PUUID ya cacheado por
 * `getRiotOverview` en esta misma petición (0 llamadas Riot nuevas).
 */
const recordRankSnapshotIfPossible = async (
  env: Env,
  data: Awaited<ReturnType<typeof getRiotOverview>>,
) => {
  if (!data.ranked.available) return;
  // Sin binding DB (estado real de producción hoy: D1 aún no aprovisionado),
  // ni siquiera merece la pena resolver el PUUID — `recordObservationIfDue`
  // se degradaría igual, pero así no se hace ni ese trabajo de más en cada
  // petición (Night Shift 2026-09-09, Fase F — hallazgo de hardening).
  if (!env.DB) return;
  try {
    const puuid = await resolveSelfAccountPuuid(env);
    if (!puuid) return;
    const repository = new D1RankSnapshotRepository(env.DB);
    await recordObservationIfDue(
      repository,
      {
        puuid,
        queueType: riotDefaults.queueType,
        tier: data.ranked.tier,
        rank: data.ranked.rank,
        leaguePoints: data.ranked.leaguePoints,
        wins: data.ranked.wins ?? 0,
        losses: data.ranked.losses ?? 0,
        observedAt: data.updatedAt,
        source: 'overview',
      },
      logObservation,
    );
  } catch (error) {
    // Ver comentario arriba: nunca debe afectar la respuesta real.
    console.warn({
      scope: 'rank-history',
      event: 'unexpected-error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

const keyLengthBand = (length: number) => {
  if (length === 0) return '0';
  if (length < 20) return '1-19';
  if (length < 40) return '20-39';
  if (length < 60) return '40-59';
  return '60+';
};

const logDiagnostic = (diagnostic: RiotDiagnosticEvent) => {
  const payload = { scope: 'riot-overview', ...diagnostic };
  if (diagnostic.event === 'failure') console.warn(payload);
  else console.info(payload);
};

export const onRequest = async ({ request, env, waitUntil }: PagesContext) => {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'GET', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }
  const apiKey = env.RIOT_API_KEY?.trim() || '';
  console.info({
    scope: 'riot-overview',
    event: 'environment',
    apiKeyPresent: apiKey.length > 0,
    apiKeyLengthBand: keyLengthBand(apiKey.length),
    apiKeyFormatValid: /^RGAPI-[A-Za-z0-9-]{20,}$/.test(apiKey),
    variablesPresent: {
      gameName: Boolean(env.RIOT_GAME_NAME?.trim()),
      tagLine: Boolean(env.RIOT_TAG_LINE?.trim()),
      platformRoute: Boolean(env.RIOT_PLATFORM_ROUTE?.trim()),
      regionalRoute: Boolean(env.RIOT_REGIONAL_ROUTE?.trim()),
    },
  });
  try {
    const data = await getRiotOverview(env, logDiagnostic);
    waitUntil(recordRankSnapshotIfPossible(env, data));
    const body: RiotPublicResponse = {
      ok: true,
      data,
      meta: { cached: data.stale, updatedAt: data.updatedAt, source: 'riot' },
    };
    return Response.json(body, {
      headers: {
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control':
          'public, max-age=60, s-maxage=300, stale-while-revalidate=3600, stale-if-error=86400',
      },
    });
  } catch (error) {
    const publicError = publicRiotError(error);
    const status = error instanceof RiotApiError ? error.status : 503;
    console.warn({
      scope: 'riot-overview',
      event: 'normalized-error',
      phase: error instanceof RiotApiError ? error.phase : undefined,
      status,
      code: publicError.code,
    });
    const retryAfter =
      error instanceof RiotApiError && error.retryAfterSeconds
        ? String(error.retryAfterSeconds)
        : undefined;
    const body: RiotPublicResponse = { ok: false, error: publicError };
    return Response.json(body, {
      status,
      headers: {
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control':
          status === 404 ? 'public, s-maxage=900' : 'public, s-maxage=60',
        ...(retryAfter ? { 'Retry-After': retryAfter } : {}),
      },
    });
  }
};
