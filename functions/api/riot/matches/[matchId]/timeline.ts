import type { RiotEnvironment } from '../../../../../src/config/riot';
import {
  getMatchTimeline,
  publicRiotError,
  RiotApiError,
  type MatchTimelinePublicResponse,
  type RiotDiagnosticEvent,
} from '../../../../../src/lib/riot';

interface PagesContext {
  request: Request;
  env: RiotEnvironment;
  params: { matchId?: string | string[] };
}

const logDiagnostic = (diagnostic: RiotDiagnosticEvent) => {
  const payload = { scope: 'riot-match-timeline', ...diagnostic };
  if (diagnostic.event === 'failure') console.warn(payload);
  else console.info(payload);
};

/**
 * `GET /api/riot/matches/{matchId}/timeline` — Timeline-V5, siempre bajo
 * demanda (nunca disparado por `/api/riot/overview` ni `/api/riot/live`,
 * encargo §29). Valida formato + pertenencia al historial reciente
 * conocido de Tidusss antes de tocar Riot (encargo §5) — nunca es un proxy
 * Riot arbitrario. Cachea 30 días (partida terminada = inmutable).
 */
export const onRequest = async ({ request, env, params }: PagesContext) => {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'GET', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }
  const matchId = Array.isArray(params.matchId)
    ? params.matchId[0]
    : params.matchId;
  if (!matchId) {
    const body: MatchTimelinePublicResponse = {
      ok: false,
      error: publicRiotError(
        new RiotApiError('RIOT_MATCH_ID_INVALID', 400, undefined, 'timeline'),
      ),
    };
    return Response.json(body, {
      status: 400,
      headers: { 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }
  try {
    const data = await getMatchTimeline(env, matchId, logDiagnostic);
    const body: MatchTimelinePublicResponse = { ok: true, data };
    return Response.json(body, {
      headers: {
        'X-Robots-Tag': 'noindex, nofollow',
        // Partida terminada = prácticamente inmutable: TTL de edge muy
        // largo. `s-maxage` solo garantiza algo si el PoP realmente
        // comparte caché — ver el informe de entrega para la distinción
        // honesta proceso/edge (mismo criterio que el resto del proyecto).
        'Cache-Control':
          'public, max-age=3600, s-maxage=2592000, stale-while-revalidate=2592000, stale-if-error=2592000',
      },
    });
  } catch (error) {
    const publicError = publicRiotError(error);
    const status = error instanceof RiotApiError ? error.status : 503;
    console.warn({
      scope: 'riot-match-timeline',
      event: 'normalized-error',
      phase: error instanceof RiotApiError ? error.phase : undefined,
      status,
      code: publicError.code,
    });
    const retryAfter =
      error instanceof RiotApiError && error.retryAfterSeconds
        ? String(error.retryAfterSeconds)
        : undefined;
    const body: MatchTimelinePublicResponse = { ok: false, error: publicError };
    return Response.json(body, {
      status,
      headers: {
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control':
          status === 404 ? 'public, s-maxage=900' : 'public, s-maxage=30',
        ...(retryAfter ? { 'Retry-After': retryAfter } : {}),
      },
    });
  }
};
