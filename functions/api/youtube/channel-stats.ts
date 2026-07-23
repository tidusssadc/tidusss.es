import { getYouTubeChannelStats } from '../../../src/services/youtube-stats';
import {
  isYouTubeChannelId,
  YouTubeServiceError,
} from '../../../src/services/youtube';
import type { YouTubeStatsResponse } from '../../../src/types/platforms';

interface Context {
  request: Request;
  env: { YOUTUBE_API_KEY?: string; YOUTUBE_CHANNEL_ID?: string };
}

let cached:
  | {
      data: Awaited<ReturnType<typeof getYouTubeChannelStats>>;
      channelId: string;
      expires: number;
      staleUntil: number;
    }
  | undefined;

const apiHeaders = { 'X-Robots-Tag': 'noindex, nofollow' };

export const onRequest = async ({ request, env }: Context) => {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { ...apiHeaders, Allow: 'GET' },
    });
  }

  const apiKey = env.YOUTUBE_API_KEY?.trim();
  const channelId = env.YOUTUBE_CHANNEL_ID?.trim();
  console.info('[youtube-stats-endpoint]', {
    phase: 'configuration',
    apiKeyPresent: Boolean(apiKey),
    channelIdPresent: Boolean(channelId),
  });
  if (!apiKey || !channelId) {
    return Response.json(
      {
        ok: false,
        error: {
          code: 'YOUTUBE_NOT_CONFIGURED',
          message:
            'Las estadísticas del canal no están disponibles ahora mismo.',
        },
      } satisfies YouTubeStatsResponse,
      { status: 503, headers: apiHeaders },
    );
  }
  if (!isYouTubeChannelId(channelId)) {
    return Response.json(
      {
        ok: false,
        error: {
          code: 'YOUTUBE_INVALID_CHANNEL_ID',
          message:
            'Las estadísticas del canal no están disponibles ahora mismo.',
        },
      } satisfies YouTubeStatsResponse,
      { status: 400, headers: apiHeaders },
    );
  }

  try {
    const fromCache = Boolean(
      cached && cached.channelId === channelId && cached.expires > Date.now(),
    );
    const data = fromCache
      ? cached!.data
      : await getYouTubeChannelStats(apiKey, channelId);

    if (!fromCache) {
      const now = Date.now();
      cached = {
        data,
        channelId,
        expires: now + 180_000,
        staleUntil: now + 10 * 60_000,
      };
    }

    return Response.json(
      {
        ok: true,
        data,
        meta: {
          cached: fromCache,
          updatedAt: data.updatedAt,
          source: 'youtube',
        },
      } satisfies YouTubeStatsResponse,
      {
        headers: {
          ...apiHeaders,
          'Cache-Control':
            'public, max-age=60, s-maxage=180, stale-while-revalidate=600',
        },
      },
    );
  } catch (error) {
    if (
      cached &&
      cached.channelId === channelId &&
      cached.staleUntil > Date.now()
    ) {
      return Response.json(
        {
          ok: true,
          data: cached.data,
          meta: {
            cached: true,
            updatedAt: cached.data.updatedAt,
            source: 'youtube',
          },
        } satisfies YouTubeStatsResponse,
        {
          headers: {
            ...apiHeaders,
            'Cache-Control': 'public, max-age=30, s-maxage=60',
            Warning: '110 - "Response is stale"',
          },
        },
      );
    }
    const code =
      error instanceof YouTubeServiceError
        ? error.code
        : 'YOUTUBE_UPSTREAM_ERROR';
    console.error('[youtube-stats-endpoint]', {
      phase: error instanceof YouTubeServiceError ? error.phase : 'unknown',
      status: error instanceof YouTubeServiceError ? error.status : undefined,
      code,
      cachedFallback: false,
    });
    return Response.json(
      {
        ok: false,
        error: {
          code,
          message:
            'Las estadísticas del canal no están disponibles ahora mismo.',
        },
      } satisfies YouTubeStatsResponse,
      {
        status: code === 'YOUTUBE_QUOTA_EXCEEDED' ? 429 : 503,
        headers: apiHeaders,
      },
    );
  }
};
