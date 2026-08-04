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
  /** Consejos rápidos y accionables, distintos de `commonMistakes` (qué evitar) y `strengths` (identidad). Ausente mientras no exista una lista real y propia. */
  quickTips?: readonly string[];
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
  /** Cuándo y qué ha cambiado en el propio análisis editorial de este campeón — nunca inventado, solo lo que realmente ha ocurrido. */
  editorialHistory?: readonly EditorialHistoryEntry[];
  /**
   * Los conceptos del Laboratorio fundamentales para entender a este
   * campeón — curación editorial directa, distinta de los conceptos que
   * `getChampionKnowledge` deriva automáticamente de sus matchups/guías.
   * Solo debe apuntar a conceptos genuinamente evidenciados por el propio
   * `profile` del campeón (fortalezas, debilidades, errores comunes), nunca
   * una lista completa "porque sí".
   */
  coreConceptIds?: readonly ConceptId[];
}

export interface Patch {
  id: PatchId;
  label: string;
  sequence: number;
  releasedAt?: string;
  dataDragonVersion?: string;
  editorialSummary?: string;
}

/**
 * "No te digo qué construir. Te explico por qué." Una elección de objeto
 * nunca es solo un id: siempre lleva el razonamiento que la justifica. Un
 * objeto sin `reasoning` no pertenece a una build editorial — pertenece a
 * una tabla de estadísticas, que es exactamente lo que este dominio no
 * quiere ser.
 */
export interface BuildItemAlternative {
  /**
   * El nombre es el dato real y obligatorio; `itemId` (para resolver el
   * icono de Data Dragon) es opcional porque no siempre se conoce sin
   * consultar una fuente externa — mostrar el nombre nunca debe esperar a
   * que exista un id.
   */
  name: string;
  itemId?: number;
  /** Cuándo elegir esta alternativa en vez del objeto principal. */
  whenToPreferInstead: string;
}

export interface BuildItemChoice {
  name: string;
  itemId?: number;
  /** Cuándo comprarlo (p. ej. "Primer back", "Antes del segundo objetivo grande"). Ausente si es evidente por su posición (objetos iniciales). */
  timing?: string;
  /** Por qué esta elección — el corazón del bloque editorial, nunca vacío. */
  reasoning: string;
  pros?: readonly string[];
  cons?: readonly string[];
  alternatives?: readonly BuildItemAlternative[];
}

export type BuildVariant = 'primary' | 'situational';

export interface Build {
  id: BuildId;
  title: string;
  championId: LabChampionId;
  role: Role;
  patchId: PatchId;
  /** `primary`: la build por defecto. `situational`: una alternativa condicionada a `situationalContext`. */
  variant: BuildVariant;
  /** Obligatorio cuando `variant` es `situational`: qué condición (o preferencia editorial) hace elegir esta ruta en vez de la principal. */
  situationalContext?: string;
  startingItems: readonly BuildItemChoice[];
  /** Independientes del resto de la build: ninguna bota se presenta como universalmente superior a otra. */
  boots?: readonly BuildItemChoice[];
  coreItems: readonly BuildItemChoice[];
  situationalItems: readonly BuildItemChoice[];
  skillOrder?: readonly string[];
  skillOrderReasoning?: string;
  summonerSpellIds?: readonly number[];
  runePageId?: RunePageId;
  editorialTake: EditorialTake;
}

/**
 * Igual que `BuildItemChoice`: una runa sin explicación no aporta más que
 * el icono que ya muestra Data Dragon. `reasoning` es opcional solo porque
 * algunas runas (p. ej. un fragmento de estadística menor) pueden ser
 * evidentes por convención — nunca porque se nos olvidara explicarla.
 * `name` es el dato real y obligatorio; `runeId` (para el icono) es
 * opcional por el mismo motivo que en `BuildItemChoice`.
 */
export interface RuneChoice {
  name: string;
  runeId?: number;
  reasoning?: string;
}

export interface RunePage {
  id: RunePageId;
  title: string;
  championId: LabChampionId;
  role: Role;
  patchId: PatchId;
  /** Ausente mientras no se confirme qué árbol es — nunca se rellena con una suposición. */
  primaryTreeId?: number;
  primaryRunes: readonly RuneChoice[];
  secondaryTreeId?: number;
  secondaryRunes: readonly RuneChoice[];
  statShards: readonly RuneChoice[];
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
  /** Consejos rápidos y accionables, distintos de las notas de fase de partida. */
  tips?: readonly string[];
  /** Enlace a un vídeo real que documenta este matchup — nunca inventado; ausente mientras no exista uno verificado. */
  videoUrl?: string;
  /** Enlace a una partida real que ilustra este matchup — mismo criterio que `videoUrl`. */
  matchHref?: string;
  editorialTake: EditorialTake;
  relatedConceptIds?: readonly ConceptId[];
}

export interface Synergy {
  id: SynergyId;
  championIds: readonly LabChampionId[];
  type: SynergyType;
  roles?: readonly Role[];
  patchId: PatchId;
  /** Consejos rápidos para ejecutar la sinergia en partida. */
  tips?: readonly string[];
  editorialTake: EditorialTake;
  relatedConceptIds?: readonly ConceptId[];
}

/**
 * Una entrada del historial editorial de un campeón: cuándo y qué cambió en
 * el propio análisis de Tidusss — no confundir con parches de balance de
 * Riot (eso sería `ChampionCatalogEntry`/futuros datos factuales de Riot,
 * todavía sin modelar porque no hay ninguna fuente real de esos datos hoy).
 */
export interface EditorialHistoryEntry {
  /** Fecha ISO (YYYY-MM-DD) del cambio editorial. */
  date: string;
  patchId?: PatchId;
  /** Etiqueta breve y real del cambio — nunca genérica ("Guía actualizada") ni idéntica entre entradas: es lo que distingue una entrada de otra en un listado cronológico (p. ej. `/actividad`). */
  title: string;
  summary: string;
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
