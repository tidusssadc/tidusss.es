import { getLatestYouTubeVideos } from '../../src/services/youtube';

interface PagesContext {
  request: Request;
  env: { YOUTUBE_API_KEY?: string; YOUTUBE_CHANNEL_ID?: string };
}

export const onRequest = async ({ request, env }: PagesContext) => {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'GET', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }

  try {
    const result = await getLatestYouTubeVideos(
      8,
      env.YOUTUBE_API_KEY,
      env.YOUTUBE_CHANNEL_ID,
    );
    return Response.json(result, {
      status: result.videos.length ? 200 : 503,
      headers: {
        'X-Robots-Tag': 'noindex, nofollow',
        // Cloudflare conserva una copia compartida y permite servirla mientras revalida.
        'Cache-Control': result.videos.length
          ? 'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400, stale-if-error=86400'
          : 'no-store',
      },
    });
  } catch (error) {
    console.error('[youtube-feed-endpoint]', {
      code: error instanceof Error ? error.message : 'YOUTUBE_UNAVAILABLE',
    });
    return Response.json(
      {
        videos: [],
        state: env.YOUTUBE_API_KEY ? 'temporary-error' : 'missing-key',
        updatedAt: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      },
    );
  }
};
