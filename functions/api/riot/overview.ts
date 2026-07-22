import type { RiotEnvironment } from '../../../src/config/riot';
import {
  getRiotOverview,
  publicRiotError,
  RiotApiError,
  type RiotPublicResponse,
} from '../../../src/lib/riot';

interface PagesContext {
  request: Request;
  env: RiotEnvironment;
}

export const onRequest = async ({ request, env }: PagesContext) => {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'GET' },
    });
  }
  try {
    const data = await getRiotOverview(env);
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
