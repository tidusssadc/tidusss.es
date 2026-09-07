import type { VideoContentLink } from '../../config/video-content-links';
import type { YouTubeVideo } from '../../types/content';
import {
  championToContentEntity,
  conceptToContentEntity,
  synergyToContentEntity,
  type ChampionCatalogEntry,
  type Concept,
  type Synergy,
} from '../league-laboratory';
import { videoToContentEntity } from './adapters';
import type { ContentEntity, ContentRelation } from './types';

/**
 * Vídeo → campeón/sinergia/concepto — MVP de vídeos conectados. Función
 * pura (sin red: recibe los `YouTubeVideo` ya resueltos por quien llama)
 * para poder validarse con `validateContentGraph` como cualquier otro
 * grafo, sintético o real.
 *
 * Deliberadamente NO se registra en `content-graph/registry.ts`: ese
 * registro es estático y se prueba sin red (`docs/content-graph.md` ya
 * documenta que `video`/`match` son entidades de tiempo de petición, no de
 * build time). Esta función construye el mismo tipo de entidades/relaciones
 * con los mismos adaptadores, para uso puntual desde la página de
 * campeón — no amplía el grafo compartido.
 *
 * Solo conecta lo que el vocabulario actual ya soporta sin ambigüedad:
 * champion↔video (`features`) y, cuando corresponde, concept↔video/
 * synergy↔video (`documents`, mismo kind que ya usa `verifiedMatchVideoRelation`
 * para vídeo↔partida). `allySupportIds`/`enemyChampionIds` se conservan
 * como metadata en `VideoContentLink` para uso futuro — no generan
 * relación de grafo en este MVP, tal como se decidió explícitamente.
 */
export const buildVideoContentGraph = (input: {
  videos: readonly YouTubeVideo[];
  videoLinks: readonly VideoContentLink[];
  championCatalog: readonly ChampionCatalogEntry[];
  concepts: readonly Concept[];
  synergies: readonly Synergy[];
}): { entities: ContentEntity[]; relations: ContentRelation[] } => {
  const { videos, videoLinks, championCatalog, concepts, synergies } = input;
  const videosById = new Map(videos.map((video) => [video.id, video]));
  const catalogById = new Map(
    championCatalog.map((entry) => [entry.id, entry] as const),
  );
  const conceptById = new Map(concepts.map((concept) => [concept.id, concept]));

  const entities = new Map<string, ContentEntity>();
  const relations: ContentRelation[] = [];
  const addEntity = (entity: ContentEntity) => entities.set(entity.id, entity);

  for (const link of videoLinks) {
    const video = videosById.get(link.youtubeVideoId);
    if (!video) continue; // sin dato real resuelto, no se registra nada para este vídeo

    const videoEntity = videoToContentEntity(video);
    addEntity(videoEntity);

    for (const championId of link.championIds ?? []) {
      const catalogEntry = catalogById.get(championId);
      if (!catalogEntry) continue;
      addEntity(championToContentEntity(catalogEntry));
      relations.push({
        from: videoEntity.id,
        to: championId,
        kind: 'features',
        label: `Vídeo real de ${catalogEntry.name}`,
        priority: 60,
        source: 'verified-manual',
      });
    }

    for (const conceptId of link.conceptIds ?? []) {
      const concept = conceptById.get(conceptId);
      if (!concept) continue;
      addEntity(conceptToContentEntity(concept));
      relations.push({
        from: videoEntity.id,
        to: conceptId,
        kind: 'documents',
        label: `Demuestra: ${concept.title}`,
        priority: 55,
        source: 'verified-manual',
      });
    }

    // Sinergia: solo si el par (campeón principal + support aliado) del
    // vídeo coincide EXACTAMENTE con una sinergia ya editorial existente —
    // nunca se crea una sinergia nueva, nunca se fuerza una que no calce.
    const mainChampionId = link.championIds?.[0];
    const allySupportId = link.allySupportIds?.[0];
    if (mainChampionId && allySupportId) {
      const pair = new Set([mainChampionId, allySupportId]);
      const matchingSynergy = synergies.find(
        (synergy) =>
          synergy.championIds.length === pair.size &&
          synergy.championIds.every((id) => pair.has(id)),
      );
      if (matchingSynergy) {
        const championNames = matchingSynergy.championIds.map(
          (id) => catalogById.get(id)?.name ?? id,
        );
        addEntity(synergyToContentEntity(matchingSynergy, championNames));
        relations.push({
          from: videoEntity.id,
          to: matchingSynergy.id,
          kind: 'documents',
          label: 'Vídeo real de esta sinergia',
          priority: 55,
          source: 'verified-manual',
        });
      }
    }
  }

  return { entities: [...entities.values()], relations };
};
