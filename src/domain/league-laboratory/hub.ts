import {
  getCatalogEntry,
  getLabChampion,
  resolveChampionEditorialStatus,
  type LabRegistry,
} from './registry';
import type {
  ChampionCatalogEntry,
  LabChampion,
  LabChampionId,
  TierGrade,
} from './types';

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

export interface FeaturedChampion {
  catalogEntry: ChampionCatalogEntry;
  labChampion: LabChampion;
}

/**
 * "Contenido destacado" del Centro de Campeones — nunca una lista fija ni
 * elegida a mano. Un campeón se destaca únicamente cuando su estado
 * editorial real es 'reviewed' (perfil completo: veredicto, fortalezas,
 * debilidades, power spikes — no solo presencia curada). Hoy eso da
 * exactamente un resultado; si mañana solo hubiera uno, la sección seguiría
 * mostrando uno solo — nunca se completa con campeones en borrador.
 */
export const getFeaturedChampions = (
  registry: LabRegistry,
): FeaturedChampion[] =>
  registry.champions
    .filter(
      (champion) => resolveChampionEditorialStatus(champion) === 'reviewed',
    )
    .flatMap((champion) => {
      const catalogEntry = getCatalogEntry(registry, champion.id);
      return catalogEntry ? [{ catalogEntry, labChampion: champion }] : [];
    });

const TIER_RANK: Record<TierGrade, number> = {
  'S+': 0,
  S: 1,
  A: 2,
  B: 3,
  C: 4,
  D: 5,
};

export interface AdcRosterEntry {
  catalogEntry: ChampionCatalogEntry;
  /** Presente solo si Tidusss también lo ha curado en el Laboratorio (además de tenerlo en la Tier List) — nunca inventado. */
  labChampion: LabChampion | undefined;
  tier: TierGrade;
  isCounterPick: boolean;
}

/**
 * El roster ADC del hub: todo campeón con una entrada real y revisada en
 * la Tier List ADC — el rol competitivo de Tidusss, no una lista de
 * campeones curados a mano. Nunca reproduce el veredicto/razonamiento de
 * la Tier List (eso vive solo en /tier-list, que responde una pregunta
 * distinta: "qué jugaría Tidusss para subir Elo"): solo el tier y el
 * enlace a la ficha. Placeholder entries (sin tier todavía) se excluyen —
 * nada que mostrar sin un tier real.
 */
export const getAdcRoster = (registry: LabRegistry): AdcRosterEntry[] =>
  registry.tierLists
    .flatMap((tierList) => tierList.entries)
    .flatMap((entry) => {
      if (entry.reviewStatus !== 'reviewed') return [];
      const catalogEntry = getCatalogEntry(registry, entry.championId);
      if (!catalogEntry) return [];
      return [
        {
          catalogEntry,
          labChampion: getLabChampion(registry, entry.championId),
          tier: entry.tier,
          isCounterPick: entry.pickType === 'counter',
        },
      ];
    })
    .sort((a, b) => {
      if (a.isCounterPick !== b.isCounterPick) return a.isCounterPick ? 1 : -1;
      const tierDiff = TIER_RANK[a.tier] - TIER_RANK[b.tier];
      if (tierDiff !== 0) return tierDiff;
      return a.catalogEntry.name.localeCompare(b.catalogEntry.name, 'es');
    });
