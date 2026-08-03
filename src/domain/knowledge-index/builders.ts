import type {
  Build,
  BuildItemChoice,
  ChampionCatalogEntry,
  Concept,
  EditorialConfidence,
  LabChampion,
  LabChampionId,
  ReviewedTierListEntry,
  RuneChoice,
  RunePage,
  Synergy,
  TierList,
} from '../league-laboratory';
import type { KnowledgeDocument, KnowledgeDocumentType } from './types';

/**
 * Productores puros: cada uno recibe una entidad real de `league-laboratory`
 * (más el nombre/URL ya resueltos por quien llama — nunca los deriva de un
 * slug ni de texto libre) y devuelve `KnowledgeDocument[]`. Ninguno muta su
 * entrada, ninguno lanza, ninguno depende de red/reloj/aleatoriedad.
 */

const makeDocument = (document: KnowledgeDocument): KnowledgeDocument => document;

// --- Campeón: identidad, entendimiento, rasgos, historial ---

/**
 * Combina los campos editoriales de `LabChampion` (roles seguidos, estilo de
 * juego, nota de especialidad) en un único documento de identidad. No
 * incluye datos puramente factuales de Data Dragon (clase oficial de Riot,
 * dificultad oficial) — esos no son criterio editorial de Tidusss, son
 * hechos de Riot, y el encargo excluye explícitamente "contenido puramente
 * factual sin valor editorial".
 */
export const championIdentityDocuments = (
  labChampion: LabChampion,
  catalogEntry: ChampionCatalogEntry,
  url: string,
): KnowledgeDocument[] => {
  const parts = [
    labChampion.signatureNote,
    labChampion.roles.length > 0
      ? `Rol que sigue el Laboratorio: ${labChampion.roles.join(', ')}.`
      : undefined,
    labChampion.playstyleTags.length > 0
      ? `Estilo de juego: ${labChampion.playstyleTags.join(', ')}.`
      : undefined,
  ].filter((part): part is string => Boolean(part && part.trim().length > 0));
  if (parts.length === 0) return [];
  return [
    makeDocument({
      id: `knowledge:${labChampion.id}:identity`,
      type: 'champion-identity',
      title: `Identidad y estilo de juego de ${catalogEntry.name}`,
      content: parts.join(' '),
      url,
      source: 'editorial',
      language: 'es',
      sourceEntityId: labChampion.id,
      relatedEntityIds: [labChampion.id],
    }),
  ];
};

/**
 * "Entendiendo a X": el resumen y el atractivo del campeón según Tidusss,
 * más su veredicto editorial de perfil — tres documentos distintos porque
 * responden a tres preguntas distintas ("¿quién es?", "¿por qué jugarlo?",
 * "¿qué opina Tidusss?"), nunca un único bloque de texto sin estructura.
 */
export const championUnderstandingDocuments = (
  labChampion: LabChampion,
  championName: string,
  url: string,
): KnowledgeDocument[] => {
  const profile = labChampion.profile;
  if (!profile) return [];
  const confidence: EditorialConfidence = profile.editorialTake.confidence;
  return [
    makeDocument({
      id: `knowledge:${labChampion.id}:understanding:summary`,
      type: 'champion-understanding',
      title: `¿Quién es ${championName}?`,
      content: profile.summary,
      url,
      source: 'editorial',
      language: 'es',
      sourceEntityId: labChampion.id,
      confidence,
      relatedEntityIds: [labChampion.id],
    }),
    makeDocument({
      id: `knowledge:${labChampion.id}:understanding:appeal`,
      type: 'champion-understanding',
      title: `¿Por qué merece la pena jugar a ${championName}?`,
      content: profile.appeal,
      url,
      source: 'editorial',
      language: 'es',
      sourceEntityId: labChampion.id,
      confidence,
      relatedEntityIds: [labChampion.id],
    }),
    makeDocument({
      id: `knowledge:${labChampion.id}:editorial-take`,
      type: 'champion-editorial-take',
      title: `Lo que piensa Tidusss de ${championName}`,
      content: `${profile.editorialTake.verdict} ${profile.editorialTake.reasoning}`,
      url,
      source: 'editorial',
      language: 'es',
      sourceEntityId: labChampion.id,
      confidence,
      relatedEntityIds: [labChampion.id],
    }),
  ];
};

const traitDocuments = (
  labChampion: LabChampion,
  championName: string,
  url: string,
  items: readonly string[],
  type: KnowledgeDocumentType,
  idSegment: string,
  titlePrefix: string,
  confidence: EditorialConfidence,
): KnowledgeDocument[] =>
  items.map((content, index) =>
    makeDocument({
      id: `knowledge:${labChampion.id}:${idSegment}:${index}`,
      type,
      title: `${titlePrefix} de ${championName}`,
      content,
      url,
      source: 'editorial',
      language: 'es',
      sourceEntityId: labChampion.id,
      confidence,
      relatedEntityIds: [labChampion.id],
    }),
  );

/**
 * Un documento por fortaleza/debilidad/error frecuente/power spike/consejo
 * rápido — nunca el perfil entero como un solo bloque. Cada uno hereda la
 * confianza del veredicto editorial del perfil: no tienen una confianza
 * propia en el dominio de origen, y esa confianza sí describe legítimamente
 * al perfil completo, incluidos estos campos.
 */
export const championProfileTraitDocuments = (
  labChampion: LabChampion,
  championName: string,
  url: string,
): KnowledgeDocument[] => {
  const profile = labChampion.profile;
  if (!profile) return [];
  const confidence = profile.editorialTake.confidence;
  return [
    ...traitDocuments(labChampion, championName, url, profile.strengths, 'champion-strength', 'strength', 'Fortaleza', confidence),
    ...traitDocuments(labChampion, championName, url, profile.weaknesses, 'champion-weakness', 'weakness', 'Debilidad', confidence),
    ...traitDocuments(labChampion, championName, url, profile.commonMistakes, 'champion-common-mistake', 'common-mistake', 'Error frecuente', confidence),
    ...traitDocuments(labChampion, championName, url, profile.powerSpikes, 'champion-power-spike', 'power-spike', 'Power spike', confidence),
    ...traitDocuments(labChampion, championName, url, profile.quickTips ?? [], 'champion-quick-tip', 'quick-tip', 'Consejo rápido', confidence),
  ];
};

/**
 * Un documento por entrada real del historial editorial — nunca uno
 * agregado. Cada uno conserva su propia fecha y, cuando existe, su
 * `patchId` real (nunca inferido de la fecha ni del texto).
 */
export const editorialHistoryDocuments = (
  labChampion: LabChampion,
  championName: string,
  url: string,
): KnowledgeDocument[] =>
  (labChampion.editorialHistory ?? []).map((entry, index) =>
    makeDocument({
      id: `knowledge:${labChampion.id}:editorial-history:${index}`,
      type: 'champion-editorial-history',
      title: `Historial editorial de ${championName}`,
      content: entry.summary,
      url,
      source: 'editorial',
      language: 'es',
      sourceEntityId: labChampion.id,
      date: entry.date,
      patchId: entry.patchId,
      relatedEntityIds: [labChampion.id],
    }),
  );

// --- Build ---

const buildItemChoiceDocuments = (
  build: Build,
  championName: string,
  url: string,
  items: readonly BuildItemChoice[],
  slot: string,
): KnowledgeDocument[] =>
  items.map((item, index) =>
    makeDocument({
      id: `knowledge:${build.id}:item:${slot}:${index}`,
      type: 'build-item',
      title: `${item.name} en la build de ${championName} (${build.title})`,
      content: item.reasoning,
      url,
      source: 'editorial',
      language: 'es',
      sourceEntityId: build.id,
      patchId: build.patchId,
      confidence: build.editorialTake.confidence,
      relatedEntityIds: [build.championId],
    }),
  );

/**
 * Un documento por elección de objeto (con su razonamiento real) en cada
 * ranura de la build, más un documento aparte para el veredicto editorial
 * del build completo — exactamente la granularidad que fija
 * `docs/pregunta-a-tidusss.md` §4.1. Las alternativas de objeto
 * (`BuildItemAlternative`) no generan documento propio en esta v1: no
 * estaban en el alcance pedido, y añadirlas ahora habría sido ampliar el
 * encargo sin que se pidiera.
 */
export const buildDocuments = (
  build: Build,
  championName: string,
  url: string,
): KnowledgeDocument[] => [
  ...buildItemChoiceDocuments(build, championName, url, build.startingItems, 'starting'),
  ...buildItemChoiceDocuments(build, championName, url, build.boots ?? [], 'boots'),
  ...buildItemChoiceDocuments(build, championName, url, build.coreItems, 'core'),
  ...buildItemChoiceDocuments(build, championName, url, build.situationalItems, 'situational'),
  makeDocument({
    id: `knowledge:${build.id}:editorial-take`,
    type: 'build-editorial-take',
    title: `Veredicto de Tidusss sobre "${build.title}"`,
    content: `${build.editorialTake.verdict} ${build.editorialTake.reasoning}`,
    url,
    source: 'editorial',
    language: 'es',
    sourceEntityId: build.id,
    patchId: build.patchId,
    confidence: build.editorialTake.confidence,
    relatedEntityIds: [build.championId],
  }),
];

// --- RunePage ---

const runeChoiceDocuments = (
  runePage: RunePage,
  championName: string,
  url: string,
  choices: readonly RuneChoice[],
  slot: string,
): KnowledgeDocument[] =>
  choices
    .filter((choice): choice is RuneChoice & { reasoning: string } =>
      Boolean(choice.reasoning && choice.reasoning.trim().length > 0),
    )
    .map((choice, index) =>
      makeDocument({
        id: `knowledge:${runePage.id}:choice:${slot}:${index}`,
        type: 'rune-choice',
        title: `${choice.name} en las runas de ${championName}`,
        content: choice.reasoning,
        url,
        source: 'editorial',
        language: 'es',
        sourceEntityId: runePage.id,
        patchId: runePage.patchId,
        confidence: runePage.editorialTake.confidence,
        relatedEntityIds: [runePage.championId],
      }),
    );

/**
 * Igual criterio que `buildDocuments`. `secondaryRunes`/`statShards` suelen
 * llegar vacíos (pendientes de análisis, ver `rune-pages.ts`) — un array
 * vacío produce, correctamente, cero documentos: nunca se fabrica un
 * documento de relleno para una rama "pendiente de análisis".
 */
export const runePageDocuments = (
  runePage: RunePage,
  championName: string,
  url: string,
): KnowledgeDocument[] => [
  ...runeChoiceDocuments(runePage, championName, url, runePage.primaryRunes, 'primary'),
  ...runeChoiceDocuments(runePage, championName, url, runePage.secondaryRunes, 'secondary'),
  ...runeChoiceDocuments(runePage, championName, url, runePage.statShards, 'shard'),
  makeDocument({
    id: `knowledge:${runePage.id}:editorial-take`,
    type: 'rune-editorial-take',
    title: `Veredicto de Tidusss sobre las runas de ${championName}`,
    content: `${runePage.editorialTake.verdict} ${runePage.editorialTake.reasoning}`,
    url,
    source: 'editorial',
    language: 'es',
    sourceEntityId: runePage.id,
    patchId: runePage.patchId,
    confidence: runePage.editorialTake.confidence,
    relatedEntityIds: [runePage.championId],
  }),
];

// --- Synergy ---

/**
 * Un documento por sinergia (ya es la unidad atómica de sentido, igual que
 * fija `docs/pregunta-a-tidusss.md` §4.1) — verdict + reasoning + tips
 * reales, si existen. `relatedEntityIds` incluye a todos los campeones de
 * la sinergia (propietario y socio) y los conceptos que la propia entidad
 * ya declara relacionados, si los hay — nunca inferidos por texto.
 */
export const synergyDocuments = (
  synergy: Synergy,
  championNames: readonly string[],
  url: string,
): KnowledgeDocument[] => {
  const tipsText =
    synergy.tips && synergy.tips.length > 0 ? ` ${synergy.tips.join(' ')}` : '';
  return [
    makeDocument({
      id: `knowledge:${synergy.id}:editorial-take`,
      type: 'synergy',
      title: `Sinergia: ${championNames.join(' + ')}`,
      content: `${synergy.editorialTake.verdict} ${synergy.editorialTake.reasoning}${tipsText}`,
      url,
      source: 'editorial',
      language: 'es',
      sourceEntityId: synergy.id,
      patchId: synergy.patchId,
      confidence: synergy.editorialTake.confidence,
      relatedEntityIds: [...synergy.championIds, ...(synergy.relatedConceptIds ?? [])],
    }),
  ];
};

// --- Concept ---

/**
 * Un documento por concepto — ya es atómico por diseño (`concepts.ts`).
 * Deliberadamente **sin** `confidence`: un `Concept` es una definición
 * objetiva de vocabulario ya establecido en League of Legends, no una
 * opinión editorial de Tidusss (comentario explícito en el propio dominio
 * de origen) — asignarle un nivel de confianza sería fingir que es un
 * veredicto cuando no lo es.
 */
export const conceptDocuments = (
  concept: Concept,
  relatedChampionIds: readonly LabChampionId[],
  url: string,
): KnowledgeDocument[] => [
  makeDocument({
    id: `knowledge:${concept.id}:summary`,
    type: 'concept',
    title: concept.title,
    content: concept.summary,
    url,
    source: 'editorial',
    language: 'es',
    sourceEntityId: concept.id,
    relatedEntityIds: [...relatedChampionIds, ...(concept.relatedConceptIds ?? [])],
  }),
];

// --- TierList ---

/**
 * Un documento por entrada **revisada** — nunca por una entrada
 * `placeholder`. Eso se decide en el productor de más alto nivel
 * (`registry.ts`), que solo llama a esta función con entradas cuyo
 * `reviewStatus` ya es `'reviewed'` (el tipo `ReviewedTierListEntry` lo
 * garantiza en tiempo de compilación).
 */
export const tierListEntryDocuments = (
  tierList: TierList,
  entry: ReviewedTierListEntry,
  championName: string,
  url: string,
): KnowledgeDocument[] => {
  const traits = [
    entry.strengths && entry.strengths.length > 0
      ? `Fortalezas señaladas en esta Tier List: ${entry.strengths.join('; ')}.`
      : undefined,
    entry.weaknesses && entry.weaknesses.length > 0
      ? `Debilidades señaladas en esta Tier List: ${entry.weaknesses.join('; ')}.`
      : undefined,
  ].filter((part): part is string => Boolean(part));
  return [
    makeDocument({
      id: `knowledge:${tierList.id}:entry:${entry.championId}`,
      type: 'tier-list-entry',
      title: `${championName} en ${tierList.title} (tier ${entry.tier})`,
      content: [entry.editorialTake.verdict, entry.editorialTake.reasoning, ...traits].join(' '),
      url,
      source: 'editorial',
      language: 'es',
      sourceEntityId: tierList.id,
      patchId: tierList.patchId,
      confidence: entry.editorialTake.confidence,
      relatedEntityIds: [entry.championId],
    }),
  ];
};
