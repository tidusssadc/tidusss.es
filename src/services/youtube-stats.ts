import { YOUTUBE_SUBSCRIBER_CHAIN, primaryFromChain, resolveChain } from '../domain/goals';
import { platforms } from '../config/platforms';
import type { YouTubeChannelStats } from '../types/platforms';
import { getYouTubeChannel } from './youtube';

export const getYouTubeChannelStats = async (
  apiKey: string,
  channelId: string = platforms.youtube.channelId,
): Promise<YouTubeChannelStats> => {
  const channel = await getYouTubeChannel(apiKey, channelId);
  const subscriberCount = channel.subscriberCount;
  // El "próximo hito" ya no es un cálculo propio de este servicio: viene de
  // la misma cadena dinámica que usa el resto del sitio (Home, Comunidad),
  // así que nunca puede desincronizarse de lo que se muestra ahí.
  const primary = subscriberCount === undefined
    ? undefined
    : primaryFromChain(resolveChain(YOUTUBE_SUBSCRIBER_CHAIN, subscriberCount));
  return {
    subscriberCount,
    viewCount: channel.viewCount,
    videoCount: channel.videoCount,
    nextGoal: primary?.target,
    progress: primary?.progress,
    updatedAt: new Date().toISOString(),
    isSubscriberCountRounded: true,
    state: subscriberCount === undefined ? 'partial' : 'available',
  };
};
