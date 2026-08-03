import type {
  ContentEntity,
  ContentEntityId,
  ContentRelation,
} from '../content-graph/types';
import type {
  Build,
  ChampionCatalogEntry,
  Concept,
  EditorialHistoryEntry,
  Guide,
  LabChampion,
  Matchup,
  Patch,
  PatchId,
  RunePage,
  Synergy,
  TierList,
} from './types';

const guideEntityId = (guide: Guide): ContentEntity['id'] =>
  `guide:${guide.id.slice('knowledge-article:'.length)}`;

/**
 * Solo tiene sentido registrar en el Content Graph los campeones con
 * curación editorial real (`labChampion`) — el catálogo entero (~170) no
 * tiene relaciones que ofrecer y saturaría el grafo sin ningún beneficio
 * de navegación. Ver ADR correspondiente en PLATFORM_BIBLE.md.
 */
export const championToContentEntity = (
  catalogEntry: ChampionCatalogEntry,
  labChampion?: LabChampion,
): ContentEntity => ({
  id: catalogEntry.id,
  kind: 'champion',
  title: catalogEntry.name,
  description: labChampion?.signatureNote,
  source: 'editorial',
  status: 'available',
});

export const patchToContentEntity = (patch: Patch): ContentEntity => ({
  id: patch.id,
  kind: 'patch',
  title: `Parche ${patch.label}`,
  description: patch.editorialSummary,
  source: 'editorial',
  status: 'available',
});

export const buildToContentEntity = (build: Build): ContentEntity => ({
  id: build.id,
  kind: 'build',
  title: build.title,
  description: build.editorialTake.verdict,
  source: 'editorial',
  status: 'available',
});

export const guideToContentEntity = (guide: Guide): ContentEntity => ({
  id: guideEntityId(guide),
  kind: 'guide',
  title: guide.title,
  description: guide.keyTakeaway,
  source: 'editorial',
  status: guide.status === 'published' ? 'available' : 'planned',
});

export const matchupToContentEntity = (
  matchup: Matchup,
  championName: string,
  opponentName: string,
): ContentEntity => ({
  id: matchup.id,
  kind: 'matchup',
  title: `${championName} vs ${opponentName}`,
  description: matchup.editorialTake.verdict,
  source: 'editorial',
  status: 'available',
});

export const tierListToContentEntity = (tierList: TierList): ContentEntity => ({
  id: tierList.id,
  kind: 'tier-list',
  title: tierList.title,
  source: 'editorial',
  status: tierList.status === 'published' ? 'available' : 'planned',
});

/**
 * `championName` se recibe como parámetro explícito en vez de derivarse del
 * `championId` de la build: el id solo contiene el slug (`lucian`), nunca el
 * nombre editorial real (`Lucian`) — usar el slug directamente en un label
 * visible produciría una capitalización incorrecta. El nombre real siempre
 * viene del catálogo, nunca de una transformación de texto sobre el id.
 */
export const buildDocumentsChampionRelation = (
  build: Build,
  championName: string,
): ContentRelation => ({
  from: buildToContentEntity(build).id,
  to: build.championId,
  kind: 'documents',
  label: `Cómo jugar ${championName} con esta build`,
  priority: 80,
  source: 'editorial',
});

export const guideDocumentsChampionRelation = (guide: Guide): ContentRelation => ({
  from: guideToContentEntity(guide).id,
  to: guide.scope.championId,
  kind: 'documents',
  label: `Guía: ${guide.title}`,
  priority: 90,
  source: 'editorial',
});

export const tierListFeaturesChampionRelation = (
  tierList: TierList,
  championId: Build['championId'],
  label = 'Ver el perfil completo del campeón',
): ContentRelation => ({
  from: tierListToContentEntity(tierList).id,
  to: championId,
  kind: 'features',
  label,
  priority: 70,
  source: 'editorial',
});

export const tierListTracksPatchRelation = (
  tierList: TierList,
): ContentRelation => ({
  from: tierListToContentEntity(tierList).id,
  to: tierList.patchId,
  kind: 'tracks',
  label: `Parche de referencia`,
  priority: 50,
  source: 'editorial',
});

export const championAppearsInTierListRelation = (
  tierList: TierList,
  championId: Build['championId'],
): ContentRelation => ({
  from: championId,
  to: tierListToContentEntity(tierList).id,
  kind: 'tracks',
  label: 'Ver en la Tier List oficial',
  priority: 65,
  source: 'editorial',
});

export const matchupRelatedToChampionRelation = (
  matchup: Matchup,
  championName: string,
  opponentName: string,
): ContentRelation => ({
  from: matchupToContentEntity(matchup, championName, opponentName).id,
  to: matchup.championId,
  kind: 'related-to',
  label: 'Matchup analizado',
  priority: 60,
  source: 'editorial',
});

// --- Fase C: rune-page, synergy, concept, editorial-log ---

export const runePageToContentEntity = (runePage: RunePage): ContentEntity => ({
  id: runePage.id,
  kind: 'rune-page',
  title: runePage.title,
  description: runePage.editorialTake.verdict,
  source: 'editorial',
  status: 'available',
});

export const runePageDocumentsChampionRelation = (
  runePage: RunePage,
  championName: string,
): ContentRelation => ({
  from: runePageToContentEntity(runePage).id,
  to: runePage.championId,
  kind: 'documents',
  label: `Runas recomendadas para ${championName}`,
  priority: 80,
  source: 'editorial',
});

/**
 * `Synergy` no tiene `title` propio: se compone a partir de los nombres
 * reales de los campeones que involucra (dato estructural, `championIds`
 * resuelto contra el catálogo) — nunca un texto libre inventado.
 */
export const synergyToContentEntity = (
  synergy: Synergy,
  championNames: readonly string[],
): ContentEntity => ({
  id: synergy.id,
  kind: 'synergy',
  title: championNames.join(' + '),
  description: synergy.editorialTake.verdict,
  source: 'editorial',
  status: 'available',
});

export const synergyDocumentsChampionRelation = (
  synergy: Synergy,
  championId: Synergy['championIds'][number],
): ContentRelation => ({
  from: synergy.id,
  to: championId,
  kind: 'documents',
  label: 'Sinergia analizada',
  priority: 40,
  source: 'editorial',
});

/**
 * `synergizes-with` conecta directamente a dos campeones (regla de
 * dirección, `docs/content-graph.md` §4.2/§6.1) — nunca al nodo `synergy`
 * intermedio, y nunca se genera la relación inversa automáticamente:
 * quien llama a esta función decide un único sentido. `fromChampionId`/
 * `toChampionId` se tipan contra `ContentEntityId` genérico, no
 * `LabChampionId`, para no acoplar esta relación a League of Legends.
 */
export const championSynergizesWithRelation = (
  fromChampionId: ContentEntityId,
  toChampionId: ContentEntityId,
  toChampionName: string,
): ContentRelation => ({
  from: fromChampionId,
  to: toChampionId,
  kind: 'synergizes-with',
  label: `Sinergia con ${toChampionName}`,
  priority: 40,
  source: 'editorial',
});

export const conceptToContentEntity = (concept: Concept): ContentEntity => ({
  id: concept.id,
  kind: 'concept',
  title: concept.title,
  description: concept.summary,
  source: 'editorial',
  status: 'available',
});

/**
 * `explains` sale del concepto hacia la entidad que enseña, nunca al
 * revés, y nunca se genera la inversa automáticamente. `targetId` se tipa
 * contra `ContentEntityId` genérico, no `LabChampionId`: un concepto debe
 * poder explicar cualquier entidad del grafo, no solo un campeón.
 */
export const conceptExplainsRelation = (
  concept: Concept,
  targetId: ContentEntityId,
  targetName: string,
): ContentRelation => ({
  from: conceptToContentEntity(concept).id,
  to: targetId,
  kind: 'explains',
  label: `Concepto clave de ${targetName}`,
  priority: 35,
  source: 'editorial',
});

const editorialLogId = (championId: LabChampion['id']): ContentEntity['id'] =>
  `editorial-log:${championId.slice('champion:'.length)}`;

/**
 * `editorial-log` es un patrón, no una entidad exclusiva de campeón
 * (`docs/content-graph.md` §3.2) — su primer productor real es el
 * historial editorial de un `LabChampion`. Un único nodo 1:1 agrega todas
 * las entradas; ninguna entrada individual se convierte en un nodo propio
 * porque el dominio de origen no le da un identificador direccionable.
 */
export const editorialLogToContentEntity = (
  championId: LabChampion['id'],
  championName: string,
  history: readonly EditorialHistoryEntry[],
): ContentEntity => ({
  id: editorialLogId(championId),
  kind: 'editorial-log',
  title: `Historial editorial de ${championName}`,
  description: history[history.length - 1]?.summary,
  source: 'editorial',
  status: 'available',
});

export const editorialLogDocumentsChampionRelation = (
  championId: LabChampion['id'],
  championName: string,
): ContentRelation => ({
  from: editorialLogId(championId),
  to: championId,
  kind: 'documents',
  label: `Historial editorial de ${championName}`,
  priority: 30,
  source: 'editorial',
});

/**
 * `changed-in` solo se genera para entradas con `patchId` explícito —
 * nunca se infiere un parche a partir de una fecha o de texto libre
 * (principio §1.1). Deduplicado por parche: varias entradas reales pueden
 * compartir el mismo `patchId` y no deben producir relaciones repetidas.
 */
export const editorialLogChangedInRelations = (
  championId: LabChampion['id'],
  history: readonly EditorialHistoryEntry[],
): ContentRelation[] => {
  const patchIds = [
    ...new Set(
      history
        .map((entry) => entry.patchId)
        .filter((patchId): patchId is PatchId => patchId !== undefined),
    ),
  ];
  return patchIds.map((patchId) => ({
    from: editorialLogId(championId),
    to: patchId,
    kind: 'changed-in',
    label: 'Cambió en este parche',
    priority: 20,
    source: 'editorial',
  }));
};
