import { platforms } from '../config/platforms';
import type {
  ContentProvider,
  YouTubeErrorCode,
  YouTubeFeedResult,
  YouTubeVideo,
} from '../types/content';

const CHANNEL_ID_PATTERN = /^UC[A-Za-z0-9_-]{22}$/;
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export class YouTubeServiceError extends Error {
  constructor(
    public readonly code: YouTubeErrorCode,
    public readonly phase:
      'configuration' | 'channels.list' | 'playlistItems.list' | 'videos.list',
    public readonly status = 502,
  ) {
    super(code);
    this.name = 'YouTubeServiceError';
  }
}

export const isYouTubeChannelId = (value?: string): value is string =>
  Boolean(value && CHANNEL_ID_PATTERN.test(value));

export const isYouTubeVideoId = (value?: string): value is string =>
  Boolean(value && VIDEO_ID_PATTERN.test(value));

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
        isShort: false,
        contentType: 'video' as const,
      };
    })
    .filter((video) => isYouTubeVideoId(video.id) && video.title);

export const youtubeFeedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${platforms.youtube.channelId}`;

interface Thumbnail {
  url?: string;
}

interface YouTubeApiErrorResponse {
  error?: { errors?: Array<{ reason?: string }> };
}

interface YouTubeChannelResponse {
  items?: Array<{
    id?: string;
    snippet?: { title?: string; customUrl?: string };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
    statistics?: {
      subscriberCount?: string;
      viewCount?: string;
      videoCount?: string;
      hiddenSubscriberCount?: boolean;
    };
  }>;
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
    contentDetails?: { videoId?: string; videoPublishedAt?: string };
  }>;
}

interface YouTubeDetailsResponse {
  items?: Array<{
    id?: string;
    snippet?: {
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
    contentDetails?: { duration?: string };
    statistics?: { viewCount?: string };
  }>;
}

export interface YouTubeChannelData {
  id: string;
  title?: string;
  customUrl?: string;
  uploadsPlaylistId: string;
  subscriberCount?: number;
  viewCount?: number;
  videoCount?: number;
  hiddenSubscriberCount: boolean;
}

const asCount = (value?: string) =>
  value && /^\d+$/.test(value) ? Number(value) : undefined;

const normalizedError = (status: number, reason?: string): YouTubeErrorCode => {
  if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded')
    return 'YOUTUBE_QUOTA_EXCEEDED';
  if (
    reason === 'keyInvalid' ||
    reason === 'accessNotConfigured' ||
    status === 401
  )
    return 'YOUTUBE_AUTH_FAILED';
  return 'YOUTUBE_UPSTREAM_ERROR';
};

const requestJson = async <T>(
  url: string,
  phase: YouTubeServiceError['phase'],
): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => ({}))) as YouTubeApiErrorResponse;
    const code = normalizedError(
      response.status,
      payload.error?.errors?.[0]?.reason,
    );
    console.error('[youtube-integration]', {
      phase,
      status: response.status,
      code,
    });
    throw new YouTubeServiceError(code, phase, response.status);
  }
  try {
    return (await response.json()) as T;
  } catch {
    console.error('[youtube-integration]', {
      phase,
      status: response.status,
      code: 'YOUTUBE_INVALID_RESPONSE',
    });
    throw new YouTubeServiceError(
      'YOUTUBE_INVALID_RESPONSE',
      phase,
      response.status,
    );
  }
};

export const getYouTubeChannel = async (
  apiKey: string,
  channelId: string,
): Promise<YouTubeChannelData> => {
  if (!apiKey)
    throw new YouTubeServiceError(
      'YOUTUBE_NOT_CONFIGURED',
      'configuration',
      503,
    );
  if (!isYouTubeChannelId(channelId))
    throw new YouTubeServiceError(
      'YOUTUBE_INVALID_CHANNEL_ID',
      'configuration',
      400,
    );
  const params = new URLSearchParams({
    part: 'contentDetails,statistics,snippet',
    id: channelId,
    key: apiKey,
  });
  const payload = await requestJson<YouTubeChannelResponse>(
    `https://www.googleapis.com/youtube/v3/channels?${params}`,
    'channels.list',
  );
  const channel = payload.items?.[0];
  if (!channel || channel.id !== channelId)
    throw new YouTubeServiceError(
      'YOUTUBE_CHANNEL_NOT_FOUND',
      'channels.list',
      404,
    );
  const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId)
    throw new YouTubeServiceError(
      'YOUTUBE_PLAYLIST_NOT_FOUND',
      'channels.list',
      404,
    );
  return {
    id: channel.id,
    title: channel.snippet?.title,
    customUrl: channel.snippet?.customUrl,
    uploadsPlaylistId,
    subscriberCount: channel.statistics?.hiddenSubscriberCount
      ? undefined
      : asCount(channel.statistics?.subscriberCount),
    viewCount: asCount(channel.statistics?.viewCount),
    videoCount: asCount(channel.statistics?.videoCount),
    hiddenSubscriberCount: Boolean(channel.statistics?.hiddenSubscriberCount),
  };
};

/**
 * Núcleo compartido de mapeo `videos.list` → `YouTubeVideo[]` — usado tanto
 * por "los N más recientes" (`getLatestFromYouTubeApi`) como por "estos ids
 * concretos" (`getVideoDetailsByIds`). Un único sitio decide qué es un
 * Short, cómo se arma la URL y qué miniatura se prioriza, para que ambos
 * caminos nunca puedan divergir en el criterio.
 */
const mapVideoDetails = (details: YouTubeDetailsResponse): YouTubeVideo[] =>
  (details.items ?? []).flatMap((item): YouTubeVideo[] => {
    if (!isYouTubeVideoId(item.id) || !item.snippet?.title) return [];
    const durationSeconds = item.contentDetails?.duration
      ? parseIsoDuration(item.contentDetails.duration)
      : null;
    // La API no expone un indicador de Shorts; la duración es metadata editorial.
    const isShort = durationSeconds !== null && durationSeconds <= 180;
    const thumbnails = item.snippet.thumbnails;
    return [
      {
        id: item.id,
        title: item.snippet.title,
        publishedAt: item.snippet.publishedAt ?? '',
        thumbnailUrl:
          thumbnails?.maxres?.url ??
          thumbnails?.standard?.url ??
          thumbnails?.high?.url ??
          thumbnails?.medium?.url ??
          thumbnails?.default?.url ??
          `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
        durationSeconds,
        durationLabel:
          durationSeconds === null ? null : formatDuration(durationSeconds),
        viewCount: asCount(item.statistics?.viewCount),
        isShort,
        contentType: isShort ? 'short' : 'video',
        url: isShort
          ? `https://www.youtube.com/shorts/${item.id}`
          : `https://www.youtube.com/watch?v=${item.id}`,
      },
    ];
  });

export const getLatestFromYouTubeApi = async (
  apiKey: string,
  limit = 8,
  channelId: string = platforms.youtube.channelId,
): Promise<YouTubeFeedResult> => {
  const updatedAt = new Date().toISOString();
  const channel = await getYouTubeChannel(apiKey, channelId);
  const playlistParams = new URLSearchParams({
    part: 'snippet,contentDetails',
    playlistId: channel.uploadsPlaylistId,
    maxResults: String(Math.min(Math.max(limit, 1), 50)),
    key: apiKey,
  });
  const playlist = await requestJson<YouTubePlaylistResponse>(
    `https://www.googleapis.com/youtube/v3/playlistItems?${playlistParams}`,
    'playlistItems.list',
  );
  const videoIds = (playlist.items ?? [])
    .map(
      ({ contentDetails, snippet }) =>
        contentDetails?.videoId ?? snippet?.resourceId?.videoId,
    )
    .filter(isYouTubeVideoId);
  if (!videoIds.length) return { videos: [], state: 'empty', updatedAt };

  const detailsParams = new URLSearchParams({
    part: 'snippet,contentDetails,statistics',
    id: videoIds.join(','),
    key: apiKey,
  });
  const details = await requestJson<YouTubeDetailsResponse>(
    `https://www.googleapis.com/youtube/v3/videos?${detailsParams}`,
    'videos.list',
  );
  const videos = mapVideoDetails(details);
  if (!videos.length)
    throw new YouTubeServiceError(
      'YOUTUBE_INVALID_RESPONSE',
      'videos.list',
      502,
    );
  return {
    videos,
    state: videos.length === videoIds.length ? 'available' : 'partial',
    updatedAt,
  };
};

/**
 * Vídeos concretos por id — mismo `videos.list` que ya usa
 * `getLatestFromYouTubeApi` para resolver detalles, pero sin pasar antes
 * por `playlistItems.list`: no necesitamos "los más recientes", ya
 * conocemos los ids exactos (los mismos que ya cita
 * `config/video-content-links.ts`). Reutiliza la API ya integrada, no una
 * nueva — mismo endpoint, mismas credenciales, mismo mapeo.
 */
export const getVideoDetailsByIds = async (
  apiKey: string,
  videoIds: readonly string[],
): Promise<YouTubeFeedResult> => {
  const updatedAt = new Date().toISOString();
  if (!apiKey)
    throw new YouTubeServiceError(
      'YOUTUBE_NOT_CONFIGURED',
      'configuration',
      503,
    );
  const validIds = videoIds.filter(isYouTubeVideoId);
  if (!validIds.length) return { videos: [], state: 'empty', updatedAt };

  const detailsParams = new URLSearchParams({
    part: 'snippet,contentDetails,statistics',
    id: validIds.join(','),
    key: apiKey,
  });
  const details = await requestJson<YouTubeDetailsResponse>(
    `https://www.googleapis.com/youtube/v3/videos?${detailsParams}`,
    'videos.list',
  );
  const videos = mapVideoDetails(details);
  return {
    videos,
    state: videos.length === validIds.length ? 'available' : 'partial',
    updatedAt,
  };
};

export const getLatestYouTubeVideos = async (
  limit = 8,
  apiKey?: string,
  channelId: string = platforms.youtube.channelId,
): Promise<YouTubeFeedResult> => {
  if (!apiKey)
    throw new YouTubeServiceError(
      'YOUTUBE_NOT_CONFIGURED',
      'configuration',
      503,
    );
  return getLatestFromYouTubeApi(apiKey, limit, channelId);
};

export const youtubeProvider: ContentProvider<YouTubeVideo> = {
  async getLatest(limit = 8) {
    const response = await fetch(youtubeFeedUrl, {
      headers: { accept: 'application/atom+xml' },
    });
    if (!response.ok) return [];
    return parseYouTubeFeed(await response.text(), limit);
  },
};
