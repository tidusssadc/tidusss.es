import {
  getTwitchStatus,
  type TwitchEnvironment,
} from '../../../src/services/twitch';
import type { TwitchStatusResponse } from '../../../src/types/platforms';

interface Context {
  request: Request;
  env: TwitchEnvironment;
}
let cached:
  | {
      data: Awaited<ReturnType<typeof getTwitchStatus>>;
      expires: number;
      staleUntil: number;
    }
  | undefined;
const apiHeaders = { 'X-Robots-Tag': 'noindex, nofollow' };

export const onRequest = async ({ request, env }: Context) => {
  if (request.method !== 'GET')
    return new Response('Method not allowed', {
      status: 405,
      headers: { ...apiHeaders, Allow: 'GET' },
    });
  if (
    !env.TWITCH_CLIENT_ID ||
    !env.TWITCH_CLIENT_SECRET ||
    !env.TWITCH_USER_LOGIN
  ) {
    return Response.json(
      {
        ok: true,
        data: {
          isLive: false,
          state: 'not-configured',
          updatedAt: new Date().toISOString(),
        },
        meta: {
          cached: false,
          updatedAt: new Date().toISOString(),
          source: 'twitch',
        },
      } satisfies TwitchStatusResponse,
      { headers: apiHeaders },
    );
  }
  try {
    const fromCache = Boolean(cached && cached.expires > Date.now());
    const data = fromCache
      ? cached!.data
      : await getTwitchStatus(env as Required<TwitchEnvironment>);
    if (!fromCache) {
      const now = Date.now();
      cached = {
        data,
        expires: now + 60_000,
        staleUntil: now + 5 * 60_000,
      };
    }
    return Response.json(
      {
        ok: true,
        data,
        meta: {
          cached: fromCache,
          updatedAt: data.updatedAt,
          source: 'twitch',
        },
      } satisfies TwitchStatusResponse,
      {
        headers: {
          ...apiHeaders,
          'Cache-Control':
            'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
        },
      },
    );
  } catch (error) {
    if (cached && cached.staleUntil > Date.now()) {
      return Response.json(
        {
          ok: true,
          data: cached.data,
          meta: {
            cached: true,
            updatedAt: cached.data.updatedAt,
            source: 'twitch',
          },
        } satisfies TwitchStatusResponse,
        {
          headers: {
            ...apiHeaders,
            'Cache-Control': 'public, max-age=15, s-maxage=30',
            Warning: '110 - "Response is stale"',
          },
        },
      );
    }
    const code = error instanceof Error ? error.message : 'TWITCH_UNAVAILABLE';
    console.error('[twitch-endpoint]', { code, cachedFallback: false });
    return Response.json(
      {
        ok: false,
        error: {
          code,
          message: 'El estado del directo no está disponible ahora mismo.',
        },
      } satisfies TwitchStatusResponse,
      { status: code === 'TWITCH_RATE_LIMIT' ? 429 : 503, headers: apiHeaders },
    );
  }
};
