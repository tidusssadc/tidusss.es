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
  champions: LabChampion[];
  patches: Patch[];
  builds: Build[];
  runePages: RunePage[];
  matchups: Matchup[];
  synergies: Synergy[];
  concepts: Concept[];
  articles: KnowledgeArticle[];
  tierLists: TierList[];
  metaStates: MetaState[];
}

export const labRegistry: LabRegistry = {
  champions: [],
  patches: [],
  builds: [],
  runePages: [],
  matchups: [],
  synergies: [],
  concepts: [],
  articles: [],
  tierLists: [],
  metaStates: [],
};

export const getLabChampion = (id: LabChampionId) =>
  labRegistry.champions.find((champion) => champion.id === id);

export const getPatch = (id: PatchId) =>
  labRegistry.patches.find((patch) => patch.id === id);

export const getConcept = (id: ConceptId) =>
  labRegistry.concepts.find((concept) => concept.id === id);

export const getChampionKnowledge = (
  id: LabChampionId,
): ChampionKnowledge | undefined => {
  const champion = getLabChampion(id);
  if (!champion) return undefined;
  return {
    champion,
    builds: labRegistry.builds.filter((build) => build.championId === id),
    runePages: labRegistry.runePages.filter(
      (runePage) => runePage.championId === id,
    ),
    matchups: labRegistry.matchups.filter(
      (matchup) =>
        matchup.championId === id || matchup.opponentChampionId === id,
    ),
    synergies: labRegistry.synergies.filter((synergy) =>
      synergy.championIds.includes(id),
    ),
    articles: labRegistry.articles.filter(
      (article) =>
        article.relatedChampionIds?.includes(id) ||
        article.scope.championId === id,
    ),
    tierListAppearances: labRegistry.tierLists.flatMap((tierList) => {
      const entry = tierList.entries.find(
        (candidate) => candidate.championId === id,
      );
      return entry ? [{ tierList, entry }] : [];
    }),
  };
};

export const getPatchKnowledge = (id: PatchId): PatchKnowledge | undefined => {
  const patch = getPatch(id);
  if (!patch) return undefined;
  return {
    patch,
    metaState: labRegistry.metaStates.find((state) => state.patchId === id),
    tierLists: labRegistry.tierLists.filter(
      (tierList) => tierList.patchId === id,
    ),
    builds: labRegistry.builds.filter((build) => build.patchId === id),
    runePages: labRegistry.runePages.filter(
      (runePage) => runePage.patchId === id,
    ),
    articles: labRegistry.articles.filter(
      (article) => article.scope.patchId === id,
    ),
  };
};

export const getMatchupsFor = (championId: LabChampionId, role?: Role) =>
  labRegistry.matchups.filter(
    (matchup) =>
      (matchup.championId === championId ||
        matchup.opponentChampionId === championId) &&
      (role === undefined || matchup.role === role),
  );

export const getSynergiesFor = (championId: LabChampionId) =>
  labRegistry.synergies.filter((synergy) =>
    synergy.championIds.includes(championId),
  );

export const getTierList = (patchId: PatchId, role?: Role) =>
  labRegistry.tierLists.find(
    (tierList) => tierList.patchId === patchId && tierList.role === role,
  );

export const getMetaTimeline = () =>
  labRegistry.metaStates
    .map((state) => {
      const patch = labRegistry.patches.find(
        (candidate) => candidate.id === state.patchId,
      );
      return patch ? { patch, metaState: state } : undefined;
    })
    .filter((entry): entry is { patch: Patch; metaState: MetaState } =>
      Boolean(entry),
    )
    .sort((a, b) => a.patch.sequence - b.patch.sequence);

export const getGuides = (filter?: { championId?: LabChampionId; role?: Role }) =>
  labRegistry.articles.filter(
    (article) =>
      article.format === 'guide' &&
      (filter?.championId === undefined ||
        article.scope.championId === filter.championId) &&
      (filter?.role === undefined || article.scope.role === filter.role),
  );
