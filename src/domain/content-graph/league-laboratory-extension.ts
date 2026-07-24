import {
  adcTierListChampions,
  officialAdcTierList,
  patch1514,
} from '../../data/league-laboratory';
import {
  championAppearsInTierListRelation,
  championToContentEntity,
  patchToContentEntity,
  tierListFeaturesChampionRelation,
  tierListToContentEntity,
  tierListTracksPatchRelation,
} from '../league-laboratory';
import type { ContentEntity, ContentRelation } from './types';

/**
 * Todo lo que el League Laboratory aporta al Content Graph vive aquí, no
 * repartido dentro de `registry.ts`. Así, cada herramienta nueva del
 * Laboratorio (Build Explorer, Matchup Explorer...) solo amplía este
 * archivo — `registry.ts` no vuelve a tocarse por cada herramienta nueva.
 * Ver ADR en PLATFORM_BIBLE.md.
 */

export const leagueLaboratoryEntities: ContentEntity[] = [
  ...adcTierListChampions.map((champion) => ({
    ...championToContentEntity(champion),
    href: `/campeones/${champion.slug}`,
  })),
  patchToContentEntity(patch1514),
  { ...tierListToContentEntity(officialAdcTierList), href: '/tier-list' },
];

export const leagueLaboratoryRelations: ContentRelation[] = [
  ...officialAdcTierList.entries.flatMap((entry) => [
    tierListFeaturesChampionRelation(officialAdcTierList, entry.championId),
    championAppearsInTierListRelation(officialAdcTierList, entry.championId),
  ]),
  tierListTracksPatchRelation(officialAdcTierList),
];
