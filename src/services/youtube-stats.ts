import { nextSubscriberGoal } from '../config/goals';
import { platforms } from '../config/platforms';
import type { YouTubeChannelStats } from '../types/platforms';
import { getYouTubeChannel } from './youtube';

export const getYouTubeChannelStats = async (
  apiKey: string,
  channelId: string = platforms.youtube.channelId,
): Promise<YouTubeChannelStats> => {
  const channel = await getYouTubeChannel(apiKey, channelId);
  const subscriberCount = channel.subscriberCount;
  const nextGoal =
    subscriberCount === undefined
      ? undefined
      : nextSubscriberGoal(subscriberCount);
  return {
    subscriberCount,
    viewCount: channel.viewCount,
    videoCount: channel.videoCount,
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
