import {
  getLabChampion,
  resolveChampionEditorialStatus,
  type LabRegistry,
} from './registry';
import type { LabChampionId } from './types';

/**
 * Todo lo que necesita el Centro de Campeones (`/campeones`) para calcular
 * datos reales — nunca escritos a mano — vive aquí, igual que
 * `content-graph/league-laboratory-extension.ts` concentra lo que el
 * Content Graph necesita. `registry.ts` no crece por cada herramienta nueva
 * del Laboratorio (ver ADR en PLATFORM_BIBLE.md).
 */

export interface CatalogCoverage {
  total: number;
  reviewed: number;
  draft: number;
  pending: number;
}

/**
 * Cuenta real de campeones por estado editorial — nunca un número escrito a
 * mano. Si el catálogo crece (Riot añade campeones) o se cura uno nuevo,
 * estos números cambian solos en el siguiente build.
 */
export const getCatalogCoverage = (registry: LabRegistry): CatalogCoverage => {
  const coverage: CatalogCoverage = {
    total: registry.catalog.length,
    reviewed: 0,
    draft: 0,
    pending: 0,
  };
  for (const entry of registry.catalog) {
    const status = resolveChampionEditorialStatus(
      getLabChampion(registry, entry.id),
    );
    coverage[status] += 1;
  }
  return coverage;
};

export type RiotDifficultyBucket = 'low' | 'medium' | 'high';

/**
 * Agrupa la dificultad oficial de Riot (0-10) en tres tramos para que el
 * filtro sea usable — nadie filtra por "dificultad 6" exacta. Los cortes
 * (0-3 / 4-7 / 8-10) son una decisión editorial de presentación, no un dato
 * de Riot; documentado aquí en un único sitio para no repetirlo en la
 * plantilla ni en el componente de filtros.
 */
export const resolveRiotDifficultyBucket = (
  riotDifficulty: number,
): RiotDifficultyBucket => {
  if (riotDifficulty <= 3) return 'low';
  if (riotDifficulty <= 7) return 'medium';
  return 'high';
};

export const isChampionInAnyTierList = (
  registry: LabRegistry,
  championId: LabChampionId,
): boolean =>
  registry.tierLists.some((tierList) =>
    tierList.entries.some((entry) => entry.championId === championId),
  );
