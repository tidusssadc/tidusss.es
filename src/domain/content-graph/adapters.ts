import type { RecentMatch } from '../../lib/riot';
import type { YouTubeVideo } from '../../types/content';
import type { ContentEntity, ContentRelation } from './types';

export const videoToContentEntity = (video: YouTubeVideo): ContentEntity => ({
  id: `video:${video.id}`,
  kind: 'video',
  title: video.title,
  href: video.url,
  external: true,
  source: 'youtube',
  status: 'available',
});

export const matchToContentEntity = (match: RecentMatch): ContentEntity => ({
  id: `match:${match.matchId}`,
  kind: 'match',
  title: `${match.championName} · ${match.kills}/${match.deaths}/${match.assists}`,
  description: `${match.queueLabel} · ${match.durationLabel}`,
  source: 'riot',
  status: 'available',
});

export const championFromMatch = (match: RecentMatch): ContentEntity => ({
  id: `champion:${match.championName.toLocaleLowerCase('es-ES')}`,
  kind: 'champion',
  title: match.championName,
  source: 'riot',
  status: 'available',
});

export const matchChampionRelation = (match: RecentMatch): ContentRelation => ({
  from: `match:${match.matchId}`,
  to: `champion:${match.championName.toLocaleLowerCase('es-ES')}`,
  kind: 'played-with',
  label: `Partida con ${match.championName}`,
  priority: 100,
  source: 'provider',
});

export const verifiedMatchVideoRelation = (
  matchId: string,
  videoId: string,
): ContentRelation => ({
  from: `video:${videoId}`,
  to: `match:${matchId}`,
  kind: 'documents',
  label: 'Partida utilizada',
  priority: 100,
  source: 'verified-manual',
});
