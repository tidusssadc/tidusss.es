import type { VideoContentLink } from '../../config/video-content-links';
import type {
  Build,
  ChampionCatalogEntry,
  ChampionEditorialStatus,
  ChampionKnowledge,
  Concept,
  ConceptId,
  Guide,
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
  /** El catálogo factual completo (~170 campeones), generado desde Data Dragon. */
  catalog: readonly ChampionCatalogEntry[];
  /** La capa editorial: solo los campeones de los que el Laboratorio dice algo. */
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
  /** Metadata editorial de vídeos reales — ver `config/video-content-links.ts`. */
  videoLinks: readonly VideoContentLink[];
}

/**
 * Construye un registro inmutable a partir de datos ya conocidos en build
 * time. No hay estado compartido entre llamadas: cada página del Laboratorio
 * construye el suyo con los datos que necesita y lo pasa explícitamente a
 * las funciones de consulta. Ver ADR-006 en PLATFORM_BIBLE.md.
 */
export const buildLabRegistry = (seed: Partial<LabRegistry>): LabRegistry => ({
  catalog: seed.catalog ?? [],
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
  videoLinks: seed.videoLinks ?? [],
});

export const getCatalogEntry = (registry: LabRegistry, id: LabChampionId) =>
  registry.catalog.find((entry) => entry.id === id);

export const getLabChampion = (registry: LabRegistry, id: LabChampionId) =>
  registry.champions.find((champion) => champion.id === id);

/**
 * Única fuente de verdad para el estado editorial de un campeón. Ningún
 * componente ni página debe reimplementar esta lógica con condicionales
 * propios (`if (labChampion?.profile) ...`): siempre a través de esta
 * función, para que el criterio "qué cuenta como revisado / borrador /
 * pendiente" viva en un solo sitio.
 */
export const resolveChampionEditorialStatus = (
  labChampion: LabChampion | undefined,
): ChampionEditorialStatus => {
  if (labChampion?.profile) return 'reviewed';
  if (labChampion) return 'draft';
  return 'pending';
};

export const getPatch = (registry: LabRegistry, id: PatchId) =>
  registry.patches.find((patch) => patch.id === id);

export const getConcept = (registry: LabRegistry, id: ConceptId) =>
  registry.concepts.find((concept) => concept.id === id);

const isGuide = (article: KnowledgeArticle): article is Guide =>
  article.format === 'guide';

/**
 * Un campeón no tiene una lista de conceptos propia calculada desde cero:
 * se alcanzan por dos vías, ambas fusionadas aquí para que ningún
 * componente tenga que conocer ninguna de las dos por separado — (1) lo que
 * sí lo menciona (guías, matchups, sinergias) y (2) `LabChampion.coreConceptIds`,
 * la curación editorial directa de qué conceptos son fundamentales para
 * entender a este campeón en concreto.
 */
const getRelatedConceptsFor = (
  registry: LabRegistry,
  id: LabChampionId,
  labChampion: LabChampion | undefined,
): Concept[] => {
  const conceptIds = new Set<ConceptId>();
  labChampion?.coreConceptIds?.forEach((c) => conceptIds.add(c));
  registry.articles
    .filter((article) => article.relatedChampionIds?.includes(id))
    .forEach((article) =>
      article.relatedConceptIds?.forEach((c) => conceptIds.add(c)),
    );
  registry.matchups
    .filter(
      (matchup) =>
        matchup.championId === id || matchup.opponentChampionId === id,
    )
    .forEach((matchup) =>
      matchup.relatedConceptIds?.forEach((c) => conceptIds.add(c)),
    );
  registry.synergies
    .filter((synergy) => synergy.championIds.includes(id))
    .forEach((synergy) =>
      synergy.relatedConceptIds?.forEach((c) => conceptIds.add(c)),
    );
  return [...conceptIds].flatMap((conceptId) => {
    const concept = getConcept(registry, conceptId);
    return concept ? [concept] : [];
  });
};

/**
 * Funciona para cualquiera de los ~170 campeones del catálogo, tenga o no
 * curación editorial. Sin `LabChampion`, devuelve `labChampion: undefined`
 * y listas vacías — nunca `undefined` para el conjunto entero, porque el
 * campeón como sujeto siempre existe si está en el catálogo.
 */
export const getChampionKnowledge = (
  registry: LabRegistry,
  id: LabChampionId,
): ChampionKnowledge | undefined => {
  const catalogEntry = getCatalogEntry(registry, id);
  if (!catalogEntry) return undefined;
  const labChampion = getLabChampion(registry, id);
  return {
    catalogEntry,
    labChampion,
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
    guides: registry.articles.filter(
      (article) => isGuide(article) && article.scope.championId === id,
    ) as Guide[],
    concepts: getRelatedConceptsFor(registry, id, labChampion),
    tierListAppearances: registry.tierLists.flatMap((tierList) => {
      const entry = tierList.entries.find(
        (candidate) => candidate.championId === id,
      );
      return entry ? [{ tierList, entry }] : [];
    }),
    videos: registry.videoLinks.filter((link) =>
      link.championIds?.includes(id),
    ),
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
    articles: registry.articles.filter(
      (article) => article.scope.patchId === id,
    ),
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

/**
 * La edición vigente de la Tier List para un rol: la publicada cuyo parche
 * tiene el `sequence` más alto. Reutiliza `Patch.sequence` (ya existente,
 * pensado exactamente para poder ordenar parches sin comparar strings) en
 * vez de introducir un flag "actual" separado que pudiera desincronizarse.
 * Prepara el histórico por parche sin ningún selector ni ruta nueva: cuando
 * exista una segunda edición publicada, esta función simplemente empieza a
 * devolver la más reciente.
 */
export const getCurrentTierList = (registry: LabRegistry, role?: Role) =>
  registry.tierLists
    .filter(
      (tierList) => tierList.role === role && tierList.status === 'published',
    )
    .map((tierList) => {
      const patch = registry.patches.find((p) => p.id === tierList.patchId);
      return patch ? { tierList, patch } : undefined;
    })
    .filter((entry): entry is { tierList: TierList; patch: Patch } =>
      Boolean(entry),
    )
    .sort((a, b) => b.patch.sequence - a.patch.sequence)[0]?.tierList;

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
    (article): article is Guide =>
      isGuide(article) &&
      (filter?.championId === undefined ||
        article.scope.championId === filter.championId) &&
      (filter?.role === undefined || article.scope.role === filter.role),
  );
