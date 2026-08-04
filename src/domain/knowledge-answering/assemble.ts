import { getContentConnections, getContentEntity } from '../content-graph';
import type { ContentEntityId } from '../content-graph';
import { leagueLaboratoryPatches } from '../../data/league-laboratory';
import { resolveEntityDisplayName } from '../knowledge-retrieval';
import type { KnowledgeDocument } from '../knowledge-index';
import type { EditorialConfidence } from '../league-laboratory';
import type { RetrievalResult, RetrievedDocument } from '../knowledge-retrieval';
import type { AnswerResult, AnswerSource, RelatedLink } from './types';

/**
 * Ensamblador de respuestas — determinista, sin IA generativa, sin
 * redacción libre (encargo, Fase 2/3). Cada frase que aparece en
 * `answer` es el `content` verbatim de un `KnowledgeDocument` real,
 * concatenado con reglas explícitas — nunca una paráfrasis ni una
 * afirmación nueva. Ver `docs/knowledge-answering.md` para el detalle de
 * cada regla.
 */

/** Cuántos documentos, como máximo, se combinan en el texto de la respuesta (sin contar por rellenar, ver `selectAnswerDocuments`). */
const TEXT_MERGE_LIMIT = 3;
/** Cuántas fuentes, como máximo, se citan en total (incluidas las que no llegan a fundirse en el texto). */
const SOURCES_LIMIT = 5;
/** Cuántos enlaces relacionados, como máximo, se muestran. */
const RELATED_LINKS_LIMIT = 6;

const CONFIDENCE_ORDER: Record<EditorialConfidence, number> = { low: 0, medium: 1, high: 2 };

const minConfidence = (
  confidences: readonly (EditorialConfidence | undefined)[],
): EditorialConfidence | undefined => {
  const real = confidences.filter((c): c is EditorialConfidence => c !== undefined);
  if (real.length === 0) return undefined;
  return real.reduce((min, current) => (CONFIDENCE_ORDER[current] < CONFIDENCE_ORDER[min] ? current : min));
};

const mostRecentDate = (dates: readonly (string | undefined)[]): string | undefined => {
  const real = dates.filter((d): d is string => Boolean(d));
  if (real.length === 0) return undefined;
  return real.reduce((latest, current) => (current > latest ? current : latest));
};

/**
 * "Si existe un documento principal de build y uno de razonamiento,
 * combinarlos" (encargo, Fase 3) — un `build-item`/`rune-choice` con su
 * propio `build-editorial-take`/`rune-editorial-take` (misma
 * `sourceEntityId`: pertenecen al mismo `Build`/`RunePage` real).
 */
const COMPANION_TYPE_BY_PRIMARY_TYPE: Partial<Record<string, string>> = {
  'build-item': 'build-editorial-take',
  'rune-choice': 'rune-editorial-take',
};

const findCompanion = (
  primary: KnowledgeDocument,
  candidates: readonly RetrievedDocument[],
): KnowledgeDocument | undefined => {
  const companionType = COMPANION_TYPE_BY_PRIMARY_TYPE[primary.type];
  if (!companionType) return undefined;
  return candidates.find(
    (retrieved) =>
      retrieved.document.type === companionType &&
      retrieved.document.sourceEntityId === primary.sourceEntityId,
  )?.document;
};

/**
 * "Si hay documentos contradictorios de parches distintos, no mezclarlos"
 * (encargo, Fase 3): un documento sin `patchId` propio (identidad,
 * conceptos) nunca entra en conflicto — solo se excluye un candidato
 * cuando AMBOS declaran un parche real y no coinciden.
 */
const sharesPatch = (primary: KnowledgeDocument, candidate: KnowledgeDocument): boolean =>
  !primary.patchId || !candidate.patchId || primary.patchId === candidate.patchId;

interface SelectedDocuments {
  readonly textMergeDocs: readonly KnowledgeDocument[];
  readonly citedDocs: readonly KnowledgeDocument[];
}

/**
 * "Fortaleza 0", "Fortaleza 1"... de un mismo campeón son entradas
 * hermanas de la misma lista real (`ChampionProfile.strengths` y
 * equivalentes) partida en un documento por elemento — no documentos
 * independientes que compitan entre sí. Si el motor de recuperación ya
 * juzgó relevante más de una (misma pregunta, mismo `type`, mismo
 * `sourceEntityId`: literalmente la misma lista de origen), fundirlas
 * todas es completar la respuesta con lo que ya está publicado, nunca
 * inventar nada — regresión real corregida en Fase V ("¿Cuándo empieza a
 * ser fuerte Lucian?" solo fundía un power spike de los dos reales).
 */
/** Solo los ids que terminan en el índice numérico de una lista real (`...:power-spike:0`, `...:weakness:2`) — nunca un documento 1:1 como `champion-identity` o `synergy`, que nunca tiene hermanos reales aunque comparta `sourceEntityId` con otro documento por casualidad. */
const isListItemId = (id: string): boolean => /:\d+$/.test(id);

const findSiblings = (
  primary: KnowledgeDocument,
  candidates: readonly RetrievedDocument[],
): KnowledgeDocument[] => {
  if (!isListItemId(primary.id)) return [];
  return candidates
    .map((retrieved) => retrieved.document)
    .filter(
      (document) =>
        document.id !== primary.id &&
        document.type === primary.type &&
        document.sourceEntityId === primary.sourceEntityId &&
        isListItemId(document.id),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
};

/**
 * Decide qué documentos se funden en el texto de la respuesta y cuáles se
 * citan como fuente adicional. Nunca "rellena" el texto con documentos de
 * menor relevancia solo para alcanzar un número: o hay un compañero real
 * de razonamiento, o hay hermanos reales de la misma lista de origen, o se
 * incluye todo lo que empata exactamente con la puntuación del documento
 * principal — en los tres casos, hasta `TEXT_MERGE_LIMIT`, nunca más.
 */
const selectAnswerDocuments = (documents: readonly RetrievedDocument[]): SelectedDocuments => {
  const primary = documents[0]!.document;
  const eligible = documents.filter((retrieved) => sharesPatch(primary, retrieved.document));

  const companion = findCompanion(primary, eligible);
  const siblings = findSiblings(primary, eligible);
  const textMergeDocs = companion
    ? [primary, companion]
    : siblings.length > 0
      ? [primary, ...siblings].sort((a, b) => a.id.localeCompare(b.id)).slice(0, TEXT_MERGE_LIMIT)
      : eligible
          .filter((retrieved) => retrieved.score === eligible[0]!.score)
          .slice(0, TEXT_MERGE_LIMIT)
          .map((retrieved) => retrieved.document);

  // Toda fuente fundida en el texto SIEMPRE se cita — nunca puede quedar
  // fuera de `citedDocs` por no estar entre las primeras `SOURCES_LIMIT`
  // posiciones de `eligible` (un compañero de razonamiento puede puntuar
  // más bajo que otros candidatos con un proveedor distinto al local).
  const textMergeIds = new Set(textMergeDocs.map((document) => document.id));
  const additionalDocs = eligible
    .map((retrieved) => retrieved.document)
    .filter((document) => !textMergeIds.has(document.id))
    .slice(0, Math.max(0, SOURCES_LIMIT - textMergeDocs.length));

  return { textMergeDocs, citedDocs: [...textMergeDocs, ...additionalDocs] };
};

const toAnswerSource = (document: KnowledgeDocument): AnswerSource => ({
  documentId: document.id,
  title: document.title,
  url: document.url,
  type: document.type,
  patchId: document.patchId,
  editorialDate: document.date,
  excerpt: document.content,
});

/**
 * Enlaces relacionados reales (Fase 5): se resuelven exclusivamente contra
 * el Content Graph (relaciones ya curadas — "sigue explorando") y contra
 * las `relatedEntityIds` que el propio documento ya declara — nunca se
 * inventa una recomendación. Si un id no resuelve a una entidad real y
 * navegable del grafo, simplemente no aparece.
 */
const collectRelatedLinks = (citedDocs: readonly KnowledgeDocument[]): RelatedLink[] => {
  const seen = new Set<string>();
  const links: RelatedLink[] = [];

  const addEntity = (id: string): void => {
    if (seen.has(id) || links.length >= RELATED_LINKS_LIMIT) return;
    const entity = getContentEntity(id as ContentEntityId);
    if (!entity || entity.status !== 'available' || !entity.href) return;
    seen.add(id);
    links.push({ id: entity.id, title: entity.title, href: entity.href, kind: entity.kind });
  };

  for (const document of citedDocs) {
    if (links.length >= RELATED_LINKS_LIMIT) break;
    for (const connection of getContentConnections(document.sourceEntityId as ContentEntityId)) {
      if (links.length >= RELATED_LINKS_LIMIT) break;
      addEntity(connection.target.id);
    }
    for (const relatedId of document.relatedEntityIds) {
      if (links.length >= RELATED_LINKS_LIMIT) break;
      addEntity(relatedId);
    }
  }

  return links;
};

const emptyQuestionAnswer = (query: string): AnswerResult => ({
  query,
  status: 'empty-question',
  retrievalConfidence: 0,
  coverage: 'none',
  sources: [],
  relatedLinks: [],
  insufficientInformation: true,
  rejectionReasons: ['La pregunta está vacía.'],
});

const patchLabelById = new Map(leagueLaboratoryPatches.map((patch) => [patch.id, patch.label]));

const noCoverageAnswer = (result: RetrievalResult): AnswerResult => {
  const championId = result.filtersApplied.championId;
  const patchId = result.filtersApplied.patchId;

  if (championId) {
    const championName = resolveEntityDisplayName(championId, []) ?? championId;
    return {
      query: result.query,
      status: 'insufficient-information',
      retrievalConfidence: result.retrievalConfidence,
      coverage: result.coverage,
      sources: [],
      relatedLinks: [],
      insufficientInformation: true,
      rejectionReasons: [
        `Se reconoce a ${championName} como campeón real, pero no existe contenido editorial de Tidusss que responda a esta pregunta todavía.`,
      ],
    };
  }

  if (patchId) {
    const patchLabel = patchLabelById.get(patchId) ?? patchId;
    return {
      query: result.query,
      status: 'insufficient-information',
      retrievalConfidence: result.retrievalConfidence,
      coverage: result.coverage,
      sources: [],
      relatedLinks: [],
      insufficientInformation: true,
      rejectionReasons: [
        `Se reconoce el parche ${patchLabel}, pero no existe contenido editorial de Tidusss que responda a esta pregunta todavía.`,
      ],
    };
  }

  return {
    query: result.query,
    status: 'out-of-scope',
    retrievalConfidence: result.retrievalConfidence,
    coverage: result.coverage,
    sources: [],
    relatedLinks: [],
    insufficientInformation: true,
    rejectionReasons: [
      'Ningún término de la pregunta pertenece al vocabulario del corpus editorial de Tidusss.',
    ],
  };
};

/**
 * Punto de entrada único del motor de respuesta. Recibe el resultado de
 * CUALQUIER `RetrievalProvider` (línea base local, espacio vectorial, o un
 * futuro proveedor de embeddings reales — el ensamblador no sabe ni le
 * importa cuál) y devuelve el contrato completo de `AnswerResult`.
 */
export const assembleAnswer = (result: RetrievalResult): AnswerResult => {
  try {
    if (result.query.trim().length === 0) {
      return emptyQuestionAnswer(result.query);
    }

    if (result.insufficientInformation || result.documents.length === 0) {
      return noCoverageAnswer(result);
    }

    const { textMergeDocs, citedDocs } = selectAnswerDocuments(result.documents);

    // Fusionar varios fragmentos exige que cada uno termine en puntuación
    // real antes de concatenarlos — algunos elementos de listas editoriales
    // (fortalezas, debilidades) no llevan punto final propio porque nunca
    // antes se habían mostrado seguidos de otro fragmento. Nunca se toca la
    // redacción, solo se asegura el punto final que ya falta.
    const withTerminalPunctuation = (text: string): string =>
      /[.!?]$/.test(text.trim()) ? text : `${text.trim()}.`;
    const answer = textMergeDocs
      .map((document) => withTerminalPunctuation(document.content))
      .join(' ');
    const editorialConfidence = minConfidence(textMergeDocs.map((document) => document.confidence));
    const editorialDate = mostRecentDate(citedDocs.map((document) => document.date));
    const primary = textMergeDocs[0]!;
    const agreeingPatchId = citedDocs.every(
      (document) => !document.patchId || document.patchId === primary.patchId,
    )
      ? primary.patchId
      : undefined;

    return {
      query: result.query,
      status: result.coverage === 'full' ? 'sufficient' : 'partial',
      answer,
      editorialConfidence,
      retrievalConfidence: result.retrievalConfidence,
      coverage: result.coverage,
      sources: citedDocs.map(toAnswerSource),
      editorialDate,
      patchId: agreeingPatchId,
      relatedLinks: collectRelatedLinks(citedDocs),
      insufficientInformation: false,
      rejectionReasons: [],
    };
  } catch {
    return {
      query: result?.query ?? '',
      status: 'internal-error',
      retrievalConfidence: 0,
      coverage: 'none',
      sources: [],
      relatedLinks: [],
      insufficientInformation: true,
      rejectionReasons: ['Error interno al procesar la pregunta.'],
    };
  }
};
