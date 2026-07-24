import {
  adcLabChampions,
  championCatalog,
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
 *
 * Deliberadamente NO se registran los ~170 campeones del catálogo, solo los
 * que tienen curación editorial (`adcLabChampions`, hoy 4). El Content
 * Graph es para relaciones reales que ofrecer en "sigue explorando"; un
 * campeón de catálogo sin ninguna relación curada no aporta nada al grafo
 * y solo lo saturaría. Su página en `/campeones/<slug>` sigue existiendo y
 * es perfectamente visitable — solo no es un nodo navegable del grafo. El
 * Centro de Campeones (`/campeones`) sí es su punto de entrada real, por
 * eso todas esas páginas llevan además un enlace plano (no una relación de
 * grafo) de vuelta al catálogo completo — igual que ya llevan uno a
 * `/tier-list` y a `/live`.
 */

const championHubEntity: ContentEntity = {
  id: 'tool:champion-hub',
  kind: 'tool',
  title: 'Centro de Campeones',
  description:
    'Busca y filtra en el catálogo completo de campeones del Laboratorio.',
  href: '/campeones',
  source: 'editorial',
  status: 'available',
};

export const leagueLaboratoryEntities: ContentEntity[] = [
  ...adcLabChampions.map((labChampion) => {
    const catalogEntry = championCatalog.find(
      (entry) => entry.id === labChampion.id,
    );
    if (!catalogEntry) {
      throw new Error(
        `${labChampion.id} no existe en el catálogo generado — ejecuta npm run sync:champions o revisa src/data/league-laboratory/champions.ts.`,
      );
    }
    return {
      ...championToContentEntity(catalogEntry, labChampion),
      href: `/campeones/${catalogEntry.slug}`,
    };
  }),
  patchToContentEntity(patch1514),
  { ...tierListToContentEntity(officialAdcTierList), href: '/tier-list' },
  championHubEntity,
];

export const leagueLaboratoryRelations: ContentRelation[] = [
  ...officialAdcTierList.entries.flatMap((entry) => [
    tierListFeaturesChampionRelation(officialAdcTierList, entry.championId),
    championAppearsInTierListRelation(officialAdcTierList, entry.championId),
  ]),
  tierListTracksPatchRelation(officialAdcTierList),
  ...adcLabChampions.flatMap((labChampion) => {
    const catalogEntry = championCatalog.find(
      (entry) => entry.id === labChampion.id,
    );
    const championName = catalogEntry?.name ?? labChampion.id;
    return [
      {
        from: championHubEntity.id,
        to: labChampion.id,
        kind: 'features' as const,
        label: `Ver la ficha de ${championName}`,
        priority: 55,
        source: 'editorial' as const,
      },
      {
        from: labChampion.id,
        to: championHubEntity.id,
        kind: 'related-to' as const,
        label: 'Ver el catálogo completo de campeones',
        priority: 45,
        source: 'editorial' as const,
      },
    ];
  }),
  {
    from: championHubEntity.id,
    to: officialAdcTierList.id,
    kind: 'features',
    label: 'Ver la Tier List oficial ADC',
    priority: 60,
    source: 'editorial',
  },
  {
    from: officialAdcTierList.id,
    to: championHubEntity.id,
    kind: 'related-to',
    label: 'Explorar el catálogo completo de campeones',
    priority: 55,
    source: 'editorial',
  },
];
