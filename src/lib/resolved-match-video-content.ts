import { getVideoDetailsByIds } from '../services/youtube';
import { matchVideoLinks } from '../config/match-video-links';
import type { YouTubeVideo } from '../types/content';

/**
 * Metadata real de YouTube para los vídeos que `config/match-video-links.ts`
 * ya cita — resuelta UNA SOLA VEZ en build time, exactamente igual que
 * `resolved-video-content.ts` hace para `video-content-links` (mismo
 * servicio, mismas credenciales, mismo `getVideoDetailsByIds`).
 *
 * Por qué existe: `getVideoForMatch` (lib/match-video-links.ts) necesita el
 * `YouTubeVideo` completo (título, miniatura, duración) para pintar
 * `MatchVideoPanel`, pero el único origen que `LiveDashboard.astro` tenía
 * hasta ahora era `/api/youtube` — los 12 vídeos MÁS RECIENTES del canal.
 * Una asociación `matchId ↔ youtubeVideoId` es permanente y verificada; no
 * debería dejar de resolverse solo porque el vídeo ya no esté entre los 12
 * últimos subidos. Esta constante resuelve exactamente los vídeos que
 * `matchVideoLinks` necesita — ni uno más — independientemente de cuántas
 * subidas nuevas haya habido desde entonces.
 *
 * Con `matchVideoLinks` vacío (estado real hoy), `videoIds` es un array
 * vacío y `getVideoDetailsByIds` no llega a hacer ninguna petición de red
 * (su propio guard interno corta antes) — cero coste mientras no haya
 * ninguna asociación real configurada.
 *
 * Nunca lanza: sin clave configurada, sin red o ante cualquier fallo de la
 * API, se resuelve a un array vacío — el vídeo de esa partida simplemente
 * no se muestra (mismo criterio de degradación silenciosa que ya usa el
 * resto del sitio), nunca un error de build ni una `MatchCard` rota.
 */
const resolveMatchVideos = async (): Promise<YouTubeVideo[]> => {
  const apiKey = import.meta.env.YOUTUBE_API_KEY;
  const videoIds = [...new Set(matchVideoLinks.map((link) => link.youtubeVideoId))];
  if (!apiKey || videoIds.length === 0) return [];
  try {
    const result = await getVideoDetailsByIds(apiKey, videoIds);
    return result.videos;
  } catch (error) {
    console.warn(
      '[match-video-links] no se pudieron resolver los vídeos reales en build time:',
      error,
    );
    return [];
  }
};

export const resolvedMatchVideoContent: YouTubeVideo[] = await resolveMatchVideos();
