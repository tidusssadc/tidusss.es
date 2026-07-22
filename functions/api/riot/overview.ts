import type { RiotEnvironment } from '../../../src/config/riot';
import {
  getRiotOverview,
  publicRiotError,
  RiotApiError,
  type RiotDiagnosticEvent,
  type RiotPublicResponse,
} from '../../../src/lib/riot';

interface PagesContext {
  request: Request;
  env: RiotEnvironment;
}

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

export const onRequest = async ({ request, env }: PagesContext) => {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'GET' },
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
    const body: RiotPublicResponse = { ok: true, data };
    return Response.json(body, {
      headers: {
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
        'Cache-Control':
          status === 404 ? 'public, s-maxage=900' : 'public, s-maxage=60',
        ...(retryAfter ? { 'Retry-After': retryAfter } : {}),
      },
    });
  }
};
