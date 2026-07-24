import type {
  Build,
  ChampionKnowledge,
  Concept,
  ConceptId,
  KnowledgeArticle,
  LabChampion,
  LabChampionId,
  Matchup,
  MetaState,
  Patch,
  PatchId,
  PatchKnowledge,
  Role,
  RunePage,
  Synergy,
  TierList,
} from './types';

export interface LabRegistry {
  champions: readonly LabChampion[];
  patches: readonly Patch[];
  builds: readonly Build[];
  runePages: readonly RunePage[];
  matchups: readonly Matchup[];
  synergies: readonly Synergy[];
  concepts: readonly Concept[];
  articles: readonly KnowledgeArticle[];
  tierLists: readonly TierList[];
  metaStates: readonly MetaState[];
}

/**
 * Construye un registro inmutable a partir de datos ya conocidos en build
 * time. No hay estado compartido entre llamadas: cada página del Laboratorio
 * construye el suyo con los datos que necesita y lo pasa explícitamente a
 * las funciones de consulta. Ver ADR correspondiente en PLATFORM_BIBLE.md
 * (sustituye al singleton mutable `labRegistry`/`hydrateLabRegistry` de la
 * Phase 1, que arriesgaba interferencia entre páginas del Laboratorio en el
 * mismo build).
 */
export const buildLabRegistry = (seed: Partial<LabRegistry>): LabRegistry => ({
  champions: seed.champions ?? [],
  patches: seed.patches ?? [],
  builds: seed.builds ?? [],
  runePages: seed.runePages ?? [],
  matchups: seed.matchups ?? [],
  synergies: seed.synergies ?? [],
  concepts: seed.concepts ?? [],
  articles: seed.articles ?? [],
  tierLists: seed.tierLists ?? [],
  metaStates: seed.metaStates ?? [],
});

export const getLabChampion = (registry: LabRegistry, id: LabChampionId) =>
  registry.champions.find((champion) => champion.id === id);

export const getPatch = (registry: LabRegistry, id: PatchId) =>
  registry.patches.find((patch) => patch.id === id);

export const getConcept = (registry: LabRegistry, id: ConceptId) =>
  registry.concepts.find((concept) => concept.id === id);

export const getChampionKnowledge = (
  registry: LabRegistry,
  id: LabChampionId,
): ChampionKnowledge | undefined => {
  const champion = getLabChampion(registry, id);
  if (!champion) return undefined;
  return {
    champion,
    builds: registry.builds.filter((build) => build.championId === id),
    runePages: registry.runePages.filter(
      (runePage) => runePage.championId === id,
    ),
    matchups: registry.matchups.filter(
      (matchup) =>
        matchup.championId === id || matchup.opponentChampionId === id,
    ),
    synergies: registry.synergies.filter((synergy) =>
      synergy.championIds.includes(id),
    ),
    articles: registry.articles.filter(
      (article) =>
        article.relatedChampionIds?.includes(id) ||
        article.scope.championId === id,
    ),
    tierListAppearances: registry.tierLists.flatMap((tierList) => {
      const entry = tierList.entries.find(
        (candidate) => candidate.championId === id,
      );
      return entry ? [{ tierList, entry }] : [];
    }),
  };
};

export const getPatchKnowledge = (
  registry: LabRegistry,
  id: PatchId,
): PatchKnowledge | undefined => {
  const patch = getPatch(registry, id);
  if (!patch) return undefined;
  return {
    patch,
    metaState: registry.metaStates.find((state) => state.patchId === id),
    tierLists: registry.tierLists.filter((tierList) => tierList.patchId === id),
    builds: registry.builds.filter((build) => build.patchId === id),
    runePages: registry.runePages.filter((runePage) => runePage.patchId === id),
    articles: registry.articles.filter((article) => article.scope.patchId === id),
  };
};

export const getMatchupsFor = (
  registry: LabRegistry,
  championId: LabChampionId,
  role?: Role,
) =>
  registry.matchups.filter(
    (matchup) =>
      (matchup.championId === championId ||
        matchup.opponentChampionId === championId) &&
      (role === undefined || matchup.role === role),
  );

export const getSynergiesFor = (
  registry: LabRegistry,
  championId: LabChampionId,
) =>
  registry.synergies.filter((synergy) =>
    synergy.championIds.includes(championId),
  );

export const getTierList = (
  registry: LabRegistry,
  patchId: PatchId,
  role?: Role,
) =>
  registry.tierLists.find(
    (tierList) => tierList.patchId === patchId && tierList.role === role,
  );

export const getMetaTimeline = (registry: LabRegistry) =>
  registry.metaStates
    .map((state) => {
      const patch = registry.patches.find(
        (candidate) => candidate.id === state.patchId,
      );
      return patch ? { patch, metaState: state } : undefined;
    })
    .filter((entry): entry is { patch: Patch; metaState: MetaState } =>
      Boolean(entry),
    )
    .sort((a, b) => a.patch.sequence - b.patch.sequence);

export const getGuides = (
  registry: LabRegistry,
  filter?: { championId?: LabChampionId; role?: Role },
) =>
  registry.articles.filter(
    (article) =>
      article.format === 'guide' &&
      (filter?.championId === undefined ||
        article.scope.championId === filter.championId) &&
      (filter?.role === undefined || article.scope.role === filter.role),
  );
