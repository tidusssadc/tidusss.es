export type YouTubeContentType = 'video' | 'short';

export interface YouTubeVideo {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  publishedAt: string;
  durationSeconds: number | null;
  durationLabel: string | null;
  contentType: YouTubeContentType;
}

export type YouTubeFeedState =
  'available' | 'empty' | 'missing-key' | 'partial' | 'temporary-error';

export interface YouTubeFeedResult {
  videos: YouTubeVideo[];
  state: YouTubeFeedState;
  updatedAt: string;
}

export interface ContentProvider<T> {
  getLatest(limit?: number): Promise<T[]>;
}
