import { platforms } from '../config/platforms';
import type {
  ContentProvider,
  YouTubeFeedResult,
  YouTubeVideo,
} from '../types/content';

const decodeXml = (value: string) =>
  value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');

const readTag = (entry: string, tag: string) => {
  const match = entry.match(
    new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`),
  );
  return match?.[1]?.trim() ?? '';
};

export const formatDuration = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const parseIsoDuration = (duration: string) => {
  const match = duration.match(
    /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/,
  );
  if (!match) return null;
  return (
    Number(match[1] ?? 0) * 86400 +
    Number(match[2] ?? 0) * 3600 +
    Number(match[3] ?? 0) * 60 +
    Number(match[4] ?? 0)
  );
};

export const parseYouTubeFeed = (xml: string, limit = 8): YouTubeVideo[] =>
  [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
    .slice(0, limit)
    .map((match) => {
      const entry = match[1] ?? '';
      const id = readTag(entry, 'yt:videoId');
      return {
        id,
        title: decodeXml(readTag(entry, 'title')),
        publishedAt: readTag(entry, 'published'),
        url: `https://www.youtube.com/watch?v=${id}`,
        thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        durationSeconds: null,
        durationLabel: null,
        contentType: 'video' as const,
      };
    })
    .filter((video) => video.id && video.title);

export const youtubeFeedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${platforms.youtube.channelId}`;

const getLatestFromYouTubeRss = async (channelId: string, limit: number) => {
  const response = await fetch(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`,
    { headers: { accept: 'application/atom+xml' } },
  );
  if (!response.ok) return [];
  return parseYouTubeFeed(await response.text(), limit);
};

interface Thumbnail {
  url?: string;
}

interface YouTubeChannelResponse {
  items?: Array<{
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }>;
}

interface YouTubeApiErrorResponse {
  error?: { errors?: Array<{ reason?: string }> };
}

interface YouTubePlaylistResponse {
  items?: Array<{
    snippet?: {
      resourceId?: { videoId?: string };
      title?: string;
      publishedAt?: string;
      thumbnails?: {
        maxres?: Thumbnail;
        standard?: Thumbnail;
        high?: Thumbnail;
        medium?: Thumbnail;
        default?: Thumbnail;
      };
    };
  }>;
}

interface YouTubeDetailsResponse {
  items?: Array<{
    id?: string;
    contentDetails?: { duration?: string };
  }>;
}

const requestJson = async <T>(
  url: string,
  phase: 'channels.list' | 'playlistItems.list' | 'videos.list',
): Promise<T | null> => {
  const response = await fetch(url);
  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => ({}))) as YouTubeApiErrorResponse;
    const reason = payload.error?.errors?.[0]?.reason;
    const code =
      reason === 'quotaExceeded' || reason === 'dailyLimitExceeded'
        ? 'YOUTUBE_QUOTA_EXCEEDED'
        : reason === 'keyInvalid' || reason === 'accessNotConfigured'
          ? 'YOUTUBE_AUTH_FAILED'
          : response.status === 429
            ? 'YOUTUBE_RATE_LIMIT'
            : 'YOUTUBE_UNAVAILABLE';
    console.error('[youtube-integration]', {
      phase,
      status: response.status,
      code,
    });
    throw new Error(code);
  }
  return (await response.json()) as T;
};

export const getLatestFromYouTubeApi = async (
  apiKey: string,
  limit = 8,
  channelId: string = platforms.youtube.channelId,
): Promise<YouTubeFeedResult> => {
  const updatedAt = new Date().toISOString();
  if (!/^UC[A-Za-z0-9_-]{22}$/.test(channelId)) {
    console.error('[youtube-integration]', {
      phase: 'configuration',
      code: 'YOUTUBE_CHANNEL_ID_INVALID',
    });
    throw new Error('YOUTUBE_CHANNEL_ID_INVALID');
  }
  const channelParams = new URLSearchParams({
    part: 'contentDetails',
    id: channelId,
    key: apiKey,
  });
  const channel = await requestJson<YouTubeChannelResponse>(
    `https://www.googleapis.com/youtube/v3/channels?${channelParams}`,
    'channels.list',
  );
  const uploads =
    channel?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) return { videos: [], state: 'temporary-error', updatedAt };

  const playlistParams = new URLSearchParams({
    part: 'snippet',
    playlistId: uploads,
    maxResults: String(limit),
    key: apiKey,
  });
  const playlist = await requestJson<YouTubePlaylistResponse>(
    `https://www.googleapis.com/youtube/v3/playlistItems?${playlistParams}`,
    'playlistItems.list',
  );
  const basicVideos = (playlist?.items ?? []).flatMap(({ snippet }) => {
    const id = snippet?.resourceId?.videoId;
    const title = snippet?.title;
    const publishedAt = snippet?.publishedAt;
    if (!id || !title || !publishedAt) return [];
    const thumbnails = snippet.thumbnails;
    return [
      {
        id,
        title,
        publishedAt,
        thumbnailUrl:
          thumbnails?.maxres?.url ??
          thumbnails?.standard?.url ??
          thumbnails?.high?.url ??
          thumbnails?.medium?.url ??
          thumbnails?.default?.url ??
          `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      },
    ];
  });
  if (!basicVideos.length) return { videos: [], state: 'empty', updatedAt };

  // videos.list acepta IDs agrupados: una sola unidad de cuota para todos.
  const detailsParams = new URLSearchParams({
    part: 'contentDetails',
    id: basicVideos.map(({ id }) => id).join(','),
    key: apiKey,
  });
  const details = await requestJson<YouTubeDetailsResponse>(
    `https://www.googleapis.com/youtube/v3/videos?${detailsParams}`,
    'videos.list',
  );
  const durations = new Map(
    (details?.items ?? []).flatMap((item) => {
      const rawDuration = item.contentDetails?.duration;
      const seconds = rawDuration ? parseIsoDuration(rawDuration) : null;
      return item.id && seconds !== null ? [[item.id, seconds] as const] : [];
    }),
  );
  const isPartial = durations.size !== basicVideos.length;
  const videos: YouTubeVideo[] = basicVideos.map((video) => {
    const durationSeconds = durations.get(video.id) ?? null;
    // YouTube no expone un indicador oficial estable: <= 60 s es una heurística.
    const contentType =
      durationSeconds !== null && durationSeconds <= 60 ? 'short' : 'video';
    return {
      ...video,
      durationSeconds,
      durationLabel:
        durationSeconds === null ? null : formatDuration(durationSeconds),
      contentType,
      url:
        contentType === 'short'
          ? `https://www.youtube.com/shorts/${video.id}`
          : `https://www.youtube.com/watch?v=${video.id}`,
    };
  });
  return { videos, state: isPartial ? 'partial' : 'available', updatedAt };
};

export const getLatestYouTubeVideos = async (
  limit = 8,
  apiKey?: string,
  channelId: string = platforms.youtube.channelId,
): Promise<YouTubeFeedResult> => {
  if (apiKey) {
    try {
      const result = await getLatestFromYouTubeApi(apiKey, limit, channelId);
      if (result.videos.length || result.state === 'empty') return result;
    } catch (error) {
      console.error('[youtube-feed]', {
        code: error instanceof Error ? error.message : 'YOUTUBE_UNAVAILABLE',
        fallback: 'rss',
      });
      // El RSS conserva contenido básico si YouTube Data API falla.
    }
  }
  let videos: YouTubeVideo[] = [];
  try {
    videos = await getLatestFromYouTubeRss(channelId, limit);
  } catch {
    // La respuesta normalizada del endpoint ya comunica la indisponibilidad.
  }
  return {
    videos,
    state: videos.length
      ? 'partial'
      : apiKey
        ? 'temporary-error'
        : 'missing-key',
    updatedAt: new Date().toISOString(),
  };
};

export const youtubeProvider: ContentProvider<YouTubeVideo> = {
  async getLatest(limit = 8) {
    try {
      return await getLatestFromYouTubeRss(platforms.youtube.channelId, limit);
    } catch {
      return [];
    }
  },
};
