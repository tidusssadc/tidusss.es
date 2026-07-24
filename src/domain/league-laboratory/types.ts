export type Role = 'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'UTILITY';

export type TierGrade = 'S+' | 'S' | 'A' | 'B' | 'C' | 'D';

export type EditorialConfidence = 'low' | 'medium' | 'high';

export type ArticleFormat = 'guide' | 'analysis' | 'editorial' | 'explainer';

export type SynergyType =
  'lane-duo' | 'team-comp' | 'engage-combo' | 'peel-combo';

export type MatchupDifficulty = 'easy' | 'even' | 'hard';

export type CompetitiveQueue = 'solo-duo' | 'flex' | 'aram' | 'normal';

export type EditorialReviewStatus = 'reviewed' | 'placeholder';

/**
 * Estado editorial de un campeón dentro del Laboratorio, derivado siempre por
 * `resolveChampionEditorialStatus` (registry.ts) a partir de la presencia de
 * `LabChampion` y de `LabChampion.profile` — nunca decidido a mano ni
 * duplicado con condicionales sueltos en componentes o páginas.
 *
 * - `reviewed`: tiene `LabChampion` con `profile` (análisis editorial real).
 * - `draft`: tiene `LabChampion` pero sin `profile` todavía (presencia
 *   curada — roles, playstyle — sin veredicto editorial completo).
 * - `pending`: no tiene `LabChampion`; solo existe en el catálogo factual.
 */
export type ChampionEditorialStatus = 'reviewed' | 'draft' | 'pending';

export type ChampionDifficulty = 'low' | 'medium' | 'high';

export type LabEntityKind =
  | 'champion'
  | 'patch'
  | 'build'
  | 'rune-page'
  | 'matchup'
  | 'synergy'
  | 'concept'
  | 'knowledge-article'
  | 'tier-list'
  | 'meta-state';

export type LabEntityId = `${LabEntityKind}:${string}`;
export type LabChampionId = `champion:${string}`;
export type PatchId = `patch:${string}`;
export type BuildId = `build:${string}`;
export type RunePageId = `rune-page:${string}`;
export type MatchupId = `matchup:${string}`;
export type SynergyId = `synergy:${string}`;
export type ConceptId = `concept:${string}`;
export type KnowledgeArticleId = `knowledge-article:${string}`;
export type TierListId = `tier-list:${string}`;
export type MetaStateId = `meta-state:${string}`;

export interface EditorialTake {
  verdict: string;
  reasoning: string;
  confidence: EditorialConfidence;
  lastReviewedPatch?: PatchId;
}

export interface KnowledgeScope {
  championId?: LabChampionId;
  role?: Role;
  patchId?: PatchId;
}

/**
 * El perfil editorial de un campeón: quién es, por qué merece la pena
 * jugarlo, qué opina Tidusss de él en general. Es deliberadamente distinto
 * de un `TierListEntry`: el tier cambia cada parche, este perfil no. Un
 * campeón puede llevar años en el canal sin que su identidad editorial
 * cambie, aunque su tier suba o baje en cada Tier List.
 */
export interface ChampionProfile {
  summary: string;
  appeal: string;
  editorialTake: EditorialTake;
  strengths: readonly string[];
  weaknesses: readonly string[];
  commonMistakes: readonly string[];
  powerSpikes: readonly string[];
  difficulty: ChampionDifficulty;
}

/**
 * La capa FACTUAL de un campeón: hechos objetivos y oficiales de Riot
 * (nombre, título, clases, dificultad según Riot, clave de Data Dragon).
 * Existe para los ~170 campeones del juego, generada por
 * `scripts/sync-champion-catalog.mjs` desde Data Dragon — nunca escrita a
 * mano. No contiene ni una palabra de criterio de Tidusss: eso vive en
 * `LabChampion`, que es opcional y mucho más escaso.
 */
export interface ChampionCatalogEntry {
  id: LabChampionId;
  slug: string;
  name: string;
  /** Título oficial de Riot (p. ej. "La Hija del Vacío"), verificado — nunca inventado. */
  title: string;
  /** Clases oficiales de Riot (p. ej. ["Marksman"]) — no confundir con `Role` (posición competitiva). */
  tags: readonly string[];
  /** Dificultad oficial de Riot, 1-10. Distinta de `ChampionProfile.difficulty`, que es el criterio propio de Tidusss. */
  riotDifficulty: number;
  dataDragonKey: string;
}

/**
 * La capa EDITORIAL de un campeón: lo que Tidusss ha decidido curar sobre
 * él. Existe solo para los campeones de los que el Laboratorio dice algo —
 * hoy un puñado, con vocación de crecer sin que la arquitectura cambie.
 * Referencia un `ChampionCatalogEntry` por `id`; nunca duplica sus datos.
 */
export interface LabChampion {
  id: LabChampionId;
  /** Roles en los que este sitio sigue al campeón (p. ej. ADC para Lucian). Vacío si todavía no se ha curado. */
  roles: readonly Role[];
  signatureRole?: Role;
  isSignatureChampion: boolean;
  /** Lectura propia de Tidusss del estilo de juego — distinta de `ChampionCatalogEntry.tags` (las clases oficiales de Riot). */
  playstyleTags: readonly string[];
  signatureNote?: string;
  /** Ausente mientras no exista un perfil editorial real y revisado. */
  profile?: ChampionProfile;
}

export interface Patch {
  id: PatchId;
  label: string;
  sequence: number;
  releasedAt?: string;
  dataDragonVersion?: string;
  editorialSummary?: string;
}

export interface Build {
  id: BuildId;
  title: string;
  championId: LabChampionId;
  role: Role;
  patchId: PatchId;
  startingItemIds: readonly number[];
  coreItemIds: readonly number[];
  situationalItemIds: readonly number[];
  skillOrder?: readonly string[];
  summonerSpellIds?: readonly number[];
  runePageId?: RunePageId;
  editorialTake: EditorialTake;
}

export interface RunePage {
  id: RunePageId;
  title: string;
  championId: LabChampionId;
  role: Role;
  patchId: PatchId;
  primaryTreeId: number;
  primaryRuneIds: readonly number[];
  secondaryTreeId: number;
  secondaryRuneIds: readonly number[];
  statShardIds: readonly number[];
  editorialTake: EditorialTake;
}

export interface Matchup {
  id: MatchupId;
  championId: LabChampionId;
  opponentChampionId: LabChampionId;
  role: Role;
  patchId: PatchId;
  favoredChampionId?: LabChampionId;
  difficulty: MatchupDifficulty;
  earlyGameNote?: string;
  midGameNote?: string;
  lateGameNote?: string;
  editorialTake: EditorialTake;
  relatedConceptIds?: readonly ConceptId[];
}

export interface Synergy {
  id: SynergyId;
  championIds: readonly LabChampionId[];
  type: SynergyType;
  roles?: readonly Role[];
  patchId: PatchId;
  editorialTake: EditorialTake;
  relatedConceptIds?: readonly ConceptId[];
}

export interface Concept {
  id: ConceptId;
  title: string;
  category: string;
  summary: string;
  bodyRef?: string;
  relatedConceptIds?: readonly ConceptId[];
}

export interface KnowledgeArticle {
  id: KnowledgeArticleId;
  title: string;
  format: ArticleFormat;
  scope: KnowledgeScope;
  keyTakeaway?: string;
  relatedConceptIds?: readonly ConceptId[];
  relatedChampionIds?: readonly LabChampionId[];
  publishedAt?: string;
  status: 'draft' | 'published';
}

export type Guide = KnowledgeArticle & {
  format: 'guide';
  scope: KnowledgeScope & { championId: LabChampionId; role: Role };
};

interface TierListEntryBase {
  championId: LabChampionId;
  editorialTake: EditorialTake;
  strengths?: readonly string[];
  weaknesses?: readonly string[];
  buildId?: BuildId;
  runePageId?: RunePageId;
}

export interface ReviewedTierListEntry extends TierListEntryBase {
  reviewStatus: 'reviewed';
  tier: TierGrade;
  trend?: 'rising' | 'falling' | 'stable';
}

export interface PlaceholderTierListEntry extends TierListEntryBase {
  reviewStatus: 'placeholder';
}

export type TierListEntry = ReviewedTierListEntry | PlaceholderTierListEntry;

export interface TierList {
  id: TierListId;
  title: string;
  patchId: PatchId;
  role?: Role;
  queue: CompetitiveQueue;
  entries: readonly TierListEntry[];
  methodologyNote?: string;
  publishedAt?: string;
  status: 'draft' | 'published';
}

export interface MetaState {
  id: MetaStateId;
  patchId: PatchId;
  summary: string;
  risingChampionIds?: readonly LabChampionId[];
  fallingChampionIds?: readonly LabChampionId[];
  relatedArticleIds?: readonly KnowledgeArticleId[];
}

export interface ChampionKnowledge {
  catalogEntry: ChampionCatalogEntry;
  /** Ausente para la inmensa mayoría de campeones: todavía no tienen ninguna curación editorial. */
  labChampion?: LabChampion;
  builds: readonly Build[];
  runePages: readonly RunePage[];
  matchups: readonly Matchup[];
  synergies: readonly Synergy[];
  guides: readonly Guide[];
  concepts: readonly Concept[];
  tierListAppearances: readonly { tierList: TierList; entry: TierListEntry }[];
}

export interface PatchKnowledge {
  patch: Patch;
  metaState?: MetaState;
  tierLists: readonly TierList[];
  builds: readonly Build[];
  runePages: readonly RunePage[];
  articles: readonly KnowledgeArticle[];
}
