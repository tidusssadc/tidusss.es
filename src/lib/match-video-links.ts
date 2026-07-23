import type { MatchVideoLink } from '../config/match-video-links';
import type { YouTubeVideo } from '../types/content';

const MATCH_ID_PATTERN = /^[A-Z0-9]+_\d+$/i;
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export interface MatchVideoLinkIssue {
  index: number;
  reason:
    | 'INVALID_MATCH_ID'
    | 'INVALID_VIDEO_ID'
    | 'DUPLICATE_MATCH_ID'
    | 'VIDEO_NOT_FOUND';
}

export const validateMatchVideoLinks = (
  links: readonly MatchVideoLink[],
  videos?: readonly YouTubeVideo[],
) => {
  const issues: MatchVideoLinkIssue[] = [];
  const seenMatches = new Set<string>();
  links.forEach((link, index) => {
    if (!MATCH_ID_PATTERN.test(link.matchId))
      issues.push({ index, reason: 'INVALID_MATCH_ID' });
    if (!VIDEO_ID_PATTERN.test(link.youtubeVideoId))
      issues.push({ index, reason: 'INVALID_VIDEO_ID' });
    if (seenMatches.has(link.matchId))
      issues.push({ index, reason: 'DUPLICATE_MATCH_ID' });
    seenMatches.add(link.matchId);
    if (videos && !videos.some((video) => video.id === link.youtubeVideoId))
      issues.push({ index, reason: 'VIDEO_NOT_FOUND' });
  });
  return issues;
};

export const getVideoForMatch = (
  matchId: string,
  videos: readonly YouTubeVideo[],
  links: readonly MatchVideoLink[],
): YouTubeVideo | null => {
  const link = links.find(
    (candidate) =>
      candidate.matchId === matchId &&
      candidate.confidence === 'verified' &&
      (candidate.source === 'manual' ||
        candidate.source === 'verified-metadata'),
  );
  if (!link) return null;
  return videos.find((video) => video.id === link.youtubeVideoId) ?? null;
};
