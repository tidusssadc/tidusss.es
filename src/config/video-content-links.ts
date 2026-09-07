import type { ConceptId, LabChampionId } from '../domain/league-laboratory';

/**
 * Vídeos de YouTube conectados con el resto de tidusss.es — la fuente
 * única de metadata EDITORIAL sobre un vídeo (qué campeón, con qué
 * support aliado, contra qué rivales, qué concepto se demuestra).
 *
 * Nunca contiene datos que ya pertenecen a `YouTubeVideo` (título, url,
 * miniatura, duración, vistas, fecha) — `youtubeVideoId` es la única
 * unión, resuelta en tiempo real contra la API de YouTube ya existente.
 *
 * Mismo criterio que `config/match-video-links.ts`: toda relación aquí
 * es `verified-manual` — Tidusss ha revisado el vídeo y confirmado la
 * relación, nunca se infiere por título, miniatura o reconocimiento
 * automático (ver auditoría de vídeos, fase MVP).
 */
export interface VideoContentLink {
  youtubeVideoId: string;
  /** El/los campeón(es) que Tidusss juega en el vídeo. */
  championIds?: readonly LabChampionId[];
  /** Support aliado confirmado en la descripción/título del vídeo. */
  allySupportIds?: readonly LabChampionId[];
  /** Campeones rivales confirmados — nunca deducidos por el título. */
  enemyChampionIds?: readonly LabChampionId[];
  /** Conceptos de la Academia ADC que el vídeo demuestra explícitamente. */
  conceptIds?: readonly ConceptId[];
  source: 'verified-manual';
}

export const videoContentLinks: VideoContentLink[] = [
  {
    youtubeVideoId: '0euHsNWgxoo',
    championIds: ['champion:lucian'],
    allySupportIds: ['champion:janna'],
    enemyChampionIds: ['champion:kaisa', 'champion:nautilus'],
    conceptIds: ['concept:snowball'],
    source: 'verified-manual',
  },
  {
    youtubeVideoId: 'O_lk-TLvO6c',
    championIds: ['champion:lucian'],
    allySupportIds: ['champion:milio'],
    enemyChampionIds: ['champion:ezreal', 'champion:nami'],
    source: 'verified-manual',
  },
  {
    youtubeVideoId: 'mI2IcjtILQg',
    championIds: ['champion:lucian'],
    allySupportIds: ['champion:nami'],
    enemyChampionIds: ['champion:vayne', 'champion:rell'],
    conceptIds: ['concept:snowball'],
    source: 'verified-manual',
  },
  {
    youtubeVideoId: 'pUHbcSLgKKk',
    championIds: ['champion:lucian'],
    allySupportIds: ['champion:milio'],
    enemyChampionIds: ['champion:draven', 'champion:nautilus'],
    conceptIds: ['concept:snowball'],
    source: 'verified-manual',
  },
  {
    youtubeVideoId: 'VYUS1hU6wL4',
    championIds: ['champion:lucian'],
    allySupportIds: ['champion:neeko'],
    source: 'verified-manual',
  },
  {
    youtubeVideoId: 'ccPR2S0F8r4',
    championIds: ['champion:jhin'],
    allySupportIds: ['champion:bard'],
    source: 'verified-manual',
  },
  {
    youtubeVideoId: 'TN-zLOW6NCk',
    championIds: ['champion:jhin'],
    conceptIds: ['concept:snowball'],
    source: 'verified-manual',
  },
  {
    youtubeVideoId: 'To0_3raBTmQ',
    championIds: ['champion:ashe'],
    source: 'verified-manual',
  },
  {
    youtubeVideoId: '3vb0Wv7bnYY',
    championIds: ['champion:sivir'],
    source: 'verified-manual',
  },
  {
    youtubeVideoId: 'sszNi4SVJdo',
    championIds: ['champion:twitch'],
    source: 'verified-manual',
  },
];
