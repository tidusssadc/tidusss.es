import {
  buildLabRegistry,
  getCatalogCoverage,
} from '../domain/league-laboratory';
import {
  buildEditorialChampionsChain,
  buildEditorialConceptsChain,
  buildEditorialMatchupsChain,
  primaryFromChain,
  resolveChain,
  type ResolvedGoal,
} from '../domain/goals';
import {
  adcLabChampions,
  championCatalog,
  leagueLaboratoryConcepts,
  leagueLaboratoryMatchups,
  leagueLaboratoryPatches,
  officialAdcTierList,
} from '../data/league-laboratory';

/**
 * Las tres cadenas editoriales resueltas contra el catálogo real, conocido
 * en build time (nunca requieren una petición de red): campeones revisados,
 * conceptos de Academia publicados y matchups reales publicados.
 */
export const resolveEditorialGoals = (): ResolvedGoal[] => {
  const registry = buildLabRegistry({
    catalog: championCatalog,
    champions: adcLabChampions,
    patches: leagueLaboratoryPatches,
    tierLists: [officialAdcTierList],
  });
  const { reviewed } = getCatalogCoverage(registry);

  return [
    ...resolveChain(buildEditorialChampionsChain(), reviewed),
    ...resolveChain(buildEditorialConceptsChain(), leagueLaboratoryConcepts.length),
    ...resolveChain(buildEditorialMatchupsChain(), leagueLaboratoryMatchups.length),
  ];
};

/**
 * Un único hito representativo por cada cadena editorial (el activo, o el
 * último conseguido si la cadena entera ya está completa) — para mostrar
 * "Progreso editorial" como tres filas, una por categoría, nunca como la
 * lista plana de todos los hitos posibles.
 */
export const resolvePrimaryEditorialGoals = (): ResolvedGoal[] => {
  const registry = buildLabRegistry({
    catalog: championCatalog,
    champions: adcLabChampions,
    patches: leagueLaboratoryPatches,
    tierLists: [officialAdcTierList],
  });
  const { reviewed } = getCatalogCoverage(registry);

  return [
    primaryFromChain(resolveChain(buildEditorialChampionsChain(), reviewed)),
    primaryFromChain(
      resolveChain(buildEditorialConceptsChain(), leagueLaboratoryConcepts.length),
    ),
    primaryFromChain(
      resolveChain(buildEditorialMatchupsChain(), leagueLaboratoryMatchups.length),
    ),
  ].filter((goal): goal is ResolvedGoal => goal !== undefined);
};
