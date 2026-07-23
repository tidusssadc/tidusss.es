export interface MatchVideoLink {
  matchId: string;
  youtubeVideoId: string;
  source: 'manual' | 'verified-metadata';
  confidence: 'verified';
  createdAt?: string;
}

/**
 * matchId: se obtiene de data.recent.matches[].matchId en /api/riot/overview.
 * youtubeVideoId: son los 11 caracteres que siguen a ?v= en la URL de YouTube.
 */
export const matchVideoLinks: MatchVideoLink[] = [];
