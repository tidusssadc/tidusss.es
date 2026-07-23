import {
  getLatestYouTubeVideos,
  isYouTubeChannelId,
  YouTubeServiceError,
} from '../../src/services/youtube';
import type {
  YouTubeErrorCode,
  YouTubeFeedResponse,
  YouTubeFeedResult,
} from '../../src/types/content';

interface PagesContext {
  request: Request;
  env: { YOUTUBE_API_KEY?: string; YOUTUBE_CHANNEL_ID?: string };
}

interface CacheEntry {
  channelId: string;
  data: YouTubeFeedResult;
  expiresAt: number;
  staleUntil: number;
}

const cache = new Map<string, CacheEntry>();
const FRESH_TTL = 15 * 60_000;
const STALE_TTL = 6 * 60 * 60_000;
const apiHeaders = { 'X-Robots-Tag': 'noindex, nofollow' };

const clientMessage =
  'Los vídeos del canal no están disponibles en este momento.';

const errorStatus = (code: YouTubeErrorCode) => {
  if (code === 'YOUTUBE_INVALID_CHANNEL_ID') return 400;
  if (code === 'YOUTUBE_CHANNEL_NOT_FOUND') return 404;
  if (code === 'YOUTUBE_QUOTA_EXCEEDED') return 429;
  return 503;
};

const errorResponse = (code: YouTubeErrorCode) =>
  Response.json(
    {
      ok: false,
      error: { code, message: clientMessage },
    } satisfies YouTubeFeedResponse,
    {
      status: errorStatus(code),
      headers: { ...apiHeaders, 'Cache-Control': 'no-store' },
    },
  );

export const onRequest = async ({ request, env }: PagesContext) => {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { ...apiHeaders, Allow: 'GET' },
    });
  }

  const apiKey = env.YOUTUBE_API_KEY?.trim();
  const channelId = env.YOUTUBE_CHANNEL_ID?.trim();
  console.info('[youtube-feed-endpoint]', {
    phase: 'configuration',
    apiKeyPresent: Boolean(apiKey),
    channelIdPresent: Boolean(channelId),
  });
  if (!apiKey || !channelId) return errorResponse('YOUTUBE_NOT_CONFIGURED');
  if (!isYouTubeChannelId(channelId))
    return errorResponse('YOUTUBE_INVALID_CHANNEL_ID');

  const now = Date.now();
  const cached = cache.get(channelId);
  const requestUrl = new URL(request.url);
  const localRequest =
    requestUrl.hostname === '127.0.0.1' || requestUrl.hostname === 'localhost';
  const bypassLocalCache =
    localRequest && requestUrl.searchParams.get('fresh') === '1';
  if (cached && cached.expiresAt > now && !bypassLocalCache) {
    return Response.json(
      {
        ok: true,
        data: cached.data,
        meta: {
          source: 'youtube-api',
          cached: true,
          updatedAt: cached.data.updatedAt,
        },
      } satisfies YouTubeFeedResponse,
      {
        headers: {
          ...apiHeaders,
          'Cache-Control': 'public, max-age=60, s-maxage=300',
        },
      },
    );
  }

  try {
    const data = await getLatestYouTubeVideos(12, apiKey, channelId);
    const freshTtl = data.state === 'empty' ? 2 * 60_000 : FRESH_TTL;
    const staleTtl = data.state === 'empty' ? 5 * 60_000 : STALE_TTL;
    cache.set(channelId, {
      channelId,
      data,
      expiresAt: now + freshTtl,
      staleUntil: now + staleTtl,
    });
    return Response.json(
      {
        ok: true,
        data,
        meta: {
          source: 'youtube-api',
          cached: false,
          updatedAt: data.updatedAt,
        },
      } satisfies YouTubeFeedResponse,
      {
        headers: {
          ...apiHeaders,
          'Cache-Control':
            'public, max-age=60, s-maxage=900, stale-while-revalidate=3600',
        },
      },
    );
  } catch (error) {
    const serviceError =
      error instanceof YouTubeServiceError ? error : undefined;
    const code = serviceError?.code ?? 'YOUTUBE_UPSTREAM_ERROR';
    console.error('[youtube-feed-endpoint]', {
      phase: serviceError?.phase ?? 'unknown',
      status: serviceError?.status,
      code,
      cachedFallback: Boolean(cached && cached.staleUntil > now),
    });
    if (cached && cached.staleUntil > now) {
      return Response.json(
        {
          ok: true,
          data: cached.data,
          meta: {
            source: 'youtube-api',
            cached: true,
            stale: true,
            updatedAt: cached.data.updatedAt,
          },
        } satisfies YouTubeFeedResponse,
        {
          headers: {
            ...apiHeaders,
            'Cache-Control': 'public, max-age=30, s-maxage=60',
            Warning: '110 - "Response is stale"',
          },
        },
      );
    }
    return errorResponse(code);
  }
};
