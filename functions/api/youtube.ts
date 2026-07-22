import { getLatestYouTubeVideos } from '../../src/services/youtube';

interface PagesContext {
  request: Request;
  env: { YOUTUBE_API_KEY?: string };
}

export const onRequest = async ({ request, env }: PagesContext) => {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'GET' },
    });
  }

  try {
    const result = await getLatestYouTubeVideos(8, env.YOUTUBE_API_KEY);
    return Response.json(result, {
      status: result.videos.length ? 200 : 503,
      headers: {
        // Cloudflare conserva una copia compartida y permite servirla mientras revalida.
        'Cache-Control': result.videos.length
          ? 'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400, stale-if-error=86400'
          : 'no-store',
      },
    });
  } catch {
    return Response.json(
      {
        videos: [],
        state: env.YOUTUBE_API_KEY ? 'temporary-error' : 'missing-key',
        updatedAt: new Date().toISOString(),
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
};
