import type { GoalChainDefinition, GoalMilestone } from './types';

const numberFormat = new Intl.NumberFormat('es-ES');

const milestone = (
  category: GoalMilestone['category'],
  target: number,
  unit: string,
  source: GoalMilestone['source'],
  href: string,
  order: number,
  title: string,
  description?: string,
): GoalMilestone => ({
  id: `${category}-${target}`,
  category,
  title,
  description,
  target,
  unit,
  source,
  href,
  order,
});

/**
 * Los números de cada cadena son el encargo real de Fase VI — no se
 * derivan de ningún dato en vivo, son el itinerario editorial fijado de
 * antemano. Lo dinámico es SIEMPRE qué hito de la cadena está activo hoy,
 * nunca la cadena en sí.
 */
export const YOUTUBE_SUBSCRIBER_CHAIN: GoalChainDefinition = {
  category: 'youtube-subscribers',
  title: 'Suscriptores de YouTube',
  source: 'youtube',
  href: '/comunidad',
  milestones: [3500, 4000, 5000, 7500, 10000].map((target, index) =>
    milestone(
      'youtube-subscribers',
      target,
      'suscriptores',
      'youtube',
      '/comunidad',
      index,
      `${numberFormat.format(target)} suscriptores`,
    ),
  ),
};

export const YOUTUBE_VIDEO_CHAIN: GoalChainDefinition = {
  category: 'youtube-videos',
  title: 'Vídeos publicados',
  source: 'youtube',
  href: '/comunidad',
  milestones: [500, 600, 750, 1000].map((target, index) =>
    milestone(
      'youtube-videos',
      target,
      'vídeos',
      'youtube',
      '/comunidad',
      index,
      `${numberFormat.format(target)} vídeos publicados`,
    ),
  ),
};

/**
 * Sin Grandmaster: el encargo lo permite "únicamente si el sistema puede
 * representarlo correctamente con datos reales" — `RankedSummary` (Riot)
 * no expone ningún histórico de máximo competitivo, así que no hay dato
 * real con el que medir ese hito. Añadirlo sería inventar un umbral.
 */
export const COMPETITIVE_LP_CHAIN: GoalChainDefinition = {
  category: 'competitive-lp',
  title: 'Liga de puntos en Solo/Duo',
  source: 'riot',
  href: '/competitivo',
  milestones: [800, 900].map((target, index) =>
    milestone(
      'competitive-lp',
      target,
      'LP',
      'riot',
      '/competitivo',
      index,
      `${target} LP`,
    ),
  ),
};

/**
 * Constructores (no datos estáticos): el valor real de cada hito editorial
 * se conoce en build time a partir del catálogo real — nunca se
 * hardcodea aquí un número que ya vive en `league-laboratory`.
 */
export const buildEditorialChampionsChain = (): GoalChainDefinition => ({
  category: 'editorial-champions',
  title: 'Campeones completamente revisados',
  source: 'editorial',
  href: '/campeones',
  milestones: [2, 5].map((target, index) =>
    milestone(
      'editorial-champions',
      target,
      'campeones revisados',
      'editorial',
      '/campeones',
      index,
      `${target} campeones completamente revisados`,
    ),
  ),
});

export const buildEditorialConceptsChain = (): GoalChainDefinition => ({
  category: 'editorial-concepts',
  title: 'Conceptos de Academia',
  source: 'editorial',
  href: '/academia',
  milestones: [10].map((target, index) =>
    milestone(
      'editorial-concepts',
      target,
      'conceptos publicados',
      'editorial',
      '/academia',
      index,
      `${target} conceptos de Academia publicados`,
    ),
  ),
});

export const buildEditorialMatchupsChain = (): GoalChainDefinition => ({
  category: 'editorial-matchups',
  title: 'Matchups publicados',
  source: 'editorial',
  href: '/campeones/lucian',
  milestones: [5].map((target, index) =>
    milestone(
      'editorial-matchups',
      target,
      'matchups publicados',
      'editorial',
      '/campeones/lucian',
      index,
      `${target} matchups reales publicados`,
    ),
  ),
});
