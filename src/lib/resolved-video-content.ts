import { getVideoDetailsByIds } from '../services/youtube';
import { videoContentLinks } from '../config/video-content-links';
import type { YouTubeVideo } from '../types/content';

/**
 * Vídeos reales resueltos UNA SOLA VEZ en build time para los ids que ya
 * cita `config/video-content-links.ts` — mismo servicio/credenciales que
 * ya usa `/api/youtube` (`getVideoDetailsByIds`), solo que aquí en tiempo
 * de build en vez de tiempo de petición. Se resuelve una única vez a nivel
 * de módulo (nunca una vez por página de campeón generada) gracias al
 * cacheo natural de un módulo ES: todo lo que importe esta constante
 * recibe el mismo array ya resuelto.
 *
 * Nunca lanza: sin clave configurada, sin red o ante cualquier fallo de la
 * API, se resuelve a un array vacío — la sección "Vídeos relacionados"
 * simplemente no aparece, el mismo criterio que ya usa el resto del sitio
 * para contenido sin datos reales que mostrar (nunca un error de build).
 */
const resolveVideos = async (): Promise<YouTubeVideo[]> => {
  const apiKey = import.meta.env.YOUTUBE_API_KEY;
  const videoIds = videoContentLinks.map((link) => link.youtubeVideoId);
  if (!apiKey || videoIds.length === 0) return [];
  try {
    const result = await getVideoDetailsByIds(apiKey, videoIds);
    return result.videos;
  } catch (error) {
    console.warn(
      '[video-content-links] no se pudieron resolver los vídeos reales en build time:',
      error,
    );
    return [];
  }
};

export const resolvedVideoContent: YouTubeVideo[] = await resolveVideos();
