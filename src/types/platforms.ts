export interface YouTubeChannelStats {
  subscriberCount?: number;
  viewCount?: number;
  videoCount?: number;
  nextGoal?: number;
  progress?: number;
  updatedAt: string;
  isSubscriberCountRounded: true;
  state: 'available' | 'partial';
}

export type YouTubeStatsResponse =
  | {
      ok: true;
      data: YouTubeChannelStats;
      meta: { cached: boolean; updatedAt: string; source: 'youtube' };
    }
  | { ok: false; error: { code: string; message: string } };

export interface TwitchStatus {
  isLive: boolean;
  title?: string;
  category?: string;
  viewerCount?: number;
  startedAt?: string;
  thumbnailUrl?: string;
  updatedAt: string;
  state: 'online' | 'offline' | 'not-configured';
}

export type TwitchStatusResponse =
  | {
      ok: true;
      data: TwitchStatus;
      meta: { cached: boolean; updatedAt: string; source: 'twitch' };
    }
  | { ok: false; error: { code: string; message: string } };
