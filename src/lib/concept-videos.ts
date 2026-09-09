import { videoContentLinks } from '../config/video-content-links';
import type { ConceptId } from '../domain/league-laboratory';
import type { YouTubeVideo } from '../types/content';

/**
 * Vídeos reales de un concepto de Aprende ADC — misma relación
 * `conceptIds` ya curada en `config/video-content-links.ts` (nunca una
 * relación nueva: solo lee la que ya existía; el gap real era que ninguna
 * superficie la consumía todavía). Mismo patrón que ya usa
 * `campeones/[slug].astro` para vídeos de campeón, generalizado a
 * conceptos: cruza los ids curados con los vídeos ya resueltos (build time,
 * `resolvedVideoContent`) y solo devuelve los que se pudieron resolver.
 *
 * Función pura y sin dependencia de red: recibe `videos` ya resueltos como
 * segundo parámetro (nunca importa `resolved-video-content.ts` — ese
 * módulo arrastra `services/youtube.ts`, que el test runner de Node no
 * puede cargar por una sintaxis de TypeScript que su modo "strip-only" no
 * soporta; mantener esta función independiente de esa cadena de imports es
 * lo que la hace testable sin red). Un concepto sin ningún vídeo curado
 * resuelve a `[]`, nunca a una sección rellenada por rellenar.
 */
export const videosForConcept = (
  conceptId: ConceptId,
  videos: readonly YouTubeVideo[],
): YouTubeVideo[] => {
  const videoIds = new Set(
    videoContentLinks
      .filter((link) => link.conceptIds?.includes(conceptId))
      .map((link) => link.youtubeVideoId),
  );
  return videos
    .filter((video) => videoIds.has(video.id))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
};
