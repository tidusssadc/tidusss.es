export type Role = 'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'UTILITY';

export type TierGrade = 'S+' | 'S' | 'A' | 'B' | 'C' | 'D';

export type EditorialConfidence = 'low' | 'medium' | 'high';

export type ArticleFormat = 'guide' | 'analysis' | 'editorial' | 'explainer';

export type SynergyType =
  | 'lane-duo'
  | 'team-comp'
  | 'engage-combo'
  | 'peel-combo';

export type MatchupDifficulty = 'easy' | 'even' | 'hard';

export type CompetitiveQueue = 'solo-duo' | 'flex' | 'aram' | 'normal';

export type EditorialReviewStatus = 'reviewed' | 'placeholder';

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

export interface LabChampion {
  id: LabChampionId;
  slug: string;
  name: string;
  /** Título oficial del campeón (p. ej. "El Purificador"). Opcional a propósito: solo se rellena cuando el título exacto está verificado. */
  title?: string;
  roles: readonly Role[];
  signatureRole?: Role;
  isSignatureChampion: boolean;
  playstyleTags: readonly string[];
  signatureNote?: string;
  /** Clave interna de Data Dragon (p. ej. "Kaisa"), solo para resolver assets. */
  dataDragonKey?: string;
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
  champion: LabChampion;
  builds: readonly Build[];
  runePages: readonly RunePage[];
  matchups: readonly Matchup[];
  synergies: readonly Synergy[];
  articles: readonly KnowledgeArticle[];
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
