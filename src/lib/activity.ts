import type { RecentMatch } from './riot';
import type { YouTubeVideo } from '../types/content';
import { isValidTimestamp } from './time.ts';

export interface ActivityEvent {
  id: string;
  type: 'match' | 'video';
  title: string;
  detail: string;
  timestamp: string;
  source: 'riot' | 'youtube';
  href?: string;
}

export const buildActivity = (
  matches: RecentMatch[] = [],
  videos: YouTubeVideo[] = [],
) => {
  const events: ActivityEvent[] = [
    ...matches.map((match) => ({
      id: `riot:${match.matchId}`,
      type: 'match' as const,
      title: match.win ? 'Victoria en SoloQ' : 'Partida de SoloQ',
      detail: `${match.championName} · ${match.kills}/${match.deaths}/${match.assists}`,
      timestamp: match.playedAt,
      source: 'riot' as const,
    })),
    ...videos.map((video) => ({
      id: `youtube:${video.id}`,
      type: 'video' as const,
      title: 'Vídeo publicado',
      detail: video.title,
      timestamp: video.publishedAt,
      source: 'youtube' as const,
      href: video.url,
    })),
  ].filter((event) => isValidTimestamp(event.timestamp));

  return [...new Map(events.map((event) => [event.id, event])).values()].sort(
    (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp),
  );
};
