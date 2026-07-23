export type YouTubeContentType = 'video' | 'short';

export interface YouTubeVideo {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  publishedAt: string;
  durationSeconds: number | null;
  durationLabel: string | null;
  viewCount?: number;
  isShort: boolean;
  contentType: YouTubeContentType;
}

export type YouTubeFeedState = 'available' | 'empty' | 'partial';

export interface YouTubeFeedResult {
  videos: YouTubeVideo[];
  state: YouTubeFeedState;
  updatedAt: string;
}

export type YouTubeErrorCode =
  | 'YOUTUBE_NOT_CONFIGURED'
  | 'YOUTUBE_INVALID_CHANNEL_ID'
  | 'YOUTUBE_AUTH_FAILED'
  | 'YOUTUBE_QUOTA_EXCEEDED'
  | 'YOUTUBE_CHANNEL_NOT_FOUND'
  | 'YOUTUBE_PLAYLIST_NOT_FOUND'
  | 'YOUTUBE_UPSTREAM_ERROR'
  | 'YOUTUBE_INVALID_RESPONSE';

export type YouTubeFeedResponse =
  | {
      ok: true;
      data: YouTubeFeedResult;
      meta: {
        source: 'youtube-api';
        cached: boolean;
        stale?: boolean;
        updatedAt: string;
      };
    }
  | {
      ok: false;
      error: { code: YouTubeErrorCode; message: string };
    };

export interface ContentProvider<T> {
  getLatest(limit?: number): Promise<T[]>;
}
