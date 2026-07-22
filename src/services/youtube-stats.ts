import { nextSubscriberGoal } from '../config/goals';
import { platforms } from '../config/platforms';
import type { YouTubeChannelStats } from '../types/platforms';

interface ChannelResponse {
  items?: Array<{
    statistics?: {
      subscriberCount?: string;
      viewCount?: string;
      videoCount?: string;
      hiddenSubscriberCount?: boolean;
    };
  }>;
  error?: { errors?: Array<{ reason?: string }> };
}

const youtubeErrorCode = (status: number, reason?: string) => {
  if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded')
    return 'YOUTUBE_QUOTA_EXCEEDED';
  if (
    reason === 'keyInvalid' ||
    reason === 'accessNotConfigured' ||
    status === 401
  )
    return 'YOUTUBE_AUTH_FAILED';
  if (status === 429) return 'YOUTUBE_RATE_LIMIT';
  return 'YOUTUBE_UNAVAILABLE';
};

const asCount = (value?: string) =>
  value && /^\d+$/.test(value) ? Number(value) : undefined;

export const getYouTubeChannelStats = async (
  apiKey: string,
  channelId: string = platforms.youtube.channelId,
): Promise<YouTubeChannelStats> => {
  if (!/^UC[A-Za-z0-9_-]{22}$/.test(channelId)) {
    console.error('[youtube-integration]', {
      phase: 'configuration',
      code: 'YOUTUBE_CHANNEL_ID_INVALID',
    });
    throw new Error('YOUTUBE_CHANNEL_ID_INVALID');
  }
  const params = new URLSearchParams({
    part: 'statistics',
    id: channelId,
    key: apiKey,
  });
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?${params}`,
  );
  const payload = (await response.json()) as ChannelResponse;
  if (!response.ok) {
    const reason = payload.error?.errors?.[0]?.reason;
    const code = youtubeErrorCode(response.status, reason);
    console.error('[youtube-integration]', {
      phase: 'channels.list',
      status: response.status,
      code,
    });
    throw new Error(code);
  }
  const statistics = payload.items?.[0]?.statistics;
  if (!statistics) {
    console.error('[youtube-integration]', {
      phase: 'channels.list',
      status: response.status,
      code: 'YOUTUBE_CHANNEL_NOT_FOUND',
    });
    throw new Error('YOUTUBE_CHANNEL_NOT_FOUND');
  }
  const subscriberCount = statistics.hiddenSubscriberCount
    ? undefined
    : asCount(statistics.subscriberCount);
  const nextGoal =
    subscriberCount === undefined
      ? undefined
      : nextSubscriberGoal(subscriberCount);
  return {
    subscriberCount,
    viewCount: asCount(statistics.viewCount),
    videoCount: asCount(statistics.videoCount),
    nextGoal,
    progress:
      subscriberCount !== undefined && nextGoal
        ? Number(((subscriberCount / nextGoal) * 100).toFixed(1))
        : undefined,
    updatedAt: new Date().toISOString(),
    isSubscriberCountRounded: true,
    state: subscriberCount === undefined ? 'partial' : 'available',
  };
};
