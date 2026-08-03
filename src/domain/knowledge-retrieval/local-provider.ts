import type { KnowledgeDocument } from '../knowledge-index';
import { TYPE_KEYWORDS, resolveEntityDisplayName } from './corpus-index';
import { applyFilters, resolveFilters } from './filters';
import { normalizeText, tokenize, uniqueTokens } from './normalize';
import type {
  MatchReason,
  RetrievalCoverage,
  RetrievalProvider,
  RetrievalQuery,
  RetrievalResult,
  RetrievedDocument,
} from './types';

/**
 * Recuperación local, determinista, sin modelos externos ni dependencias
 * nuevas (Fase 2 del encargo): normalización + búsqueda por términos +
 * coincidencia de título + palabras clave de tipo/etiqueta + campeón +
 * parche + entidades relacionadas, combinados con una ponderación básica y
 * fija por campo. Esta es la línea base contra la que se compara después
 * el experimento de espacio vectorial (`vector-space-provider.ts`).
 *
 * Deliberadamente NO usa estadísticas de corpus (frecuencia de documento,
 * IDF): eso es lo que aporta de nuevo el experimento de Fase 5, para que la
 * comparación entre ambos sea real y no una reimplementación del mismo
 * método con otro nombre.
 *
 * Nota de diseño importante (encontrada evaluando la Fase 1 contra el
 * corpus real): cuando la pregunta nombra a un campeón, su nombre aparece,
 * trivialmente, en el título o el contenido de CASI todos los documentos de
 * ese campeón (un corpus de un solo campeón principal hace esto peor
 * todavía). Contar ese nombre dos veces — una como coincidencia de
 * título/contenido y otra como `champion-match` — infla por igual a todos
 * los documentos del campeón y ahoga el término realmente distintivo de la
 * pregunta (p. ej. "combos"). Por eso el nombre del campeón filtrado se
 * retira de los tokens usados para la coincidencia de título/contenido:
 * esa señal ya se cuenta, una única vez, como `champion-match`.
 */

const TITLE_WEIGHT = 3;
const CONTENT_WEIGHT = 1;
const TYPE_KEYWORD_WEIGHT = 2;
const CHAMPION_MATCH_WEIGHT = 3;
const PATCH_MATCH_WEIGHT = 2;
const RELATED_ENTITY_WEIGHT = 1.5;

/** Por debajo de este umbral, un documento no aporta señal real: no se devuelve. */
export const MIN_SCORE_THRESHOLD = 0.12;
/** Por encima de este umbral, la recuperación se considera cobertura completa. */
export const FULL_COVERAGE_THRESHOLD = 0.55;

const overlapCount = (queryTokens: ReadonlySet<string>, targetTokens: ReadonlySet<string>): number => {
  let count = 0;
  for (const token of queryTokens) if (targetTokens.has(token)) count += 1;
  return count;
};

const matchesTypeKeyword = (
  queryTokens: ReadonlySet<string>,
  documentType: KnowledgeDocument['type'],
): boolean =>
  TYPE_KEYWORDS.some(
    (entry) =>
      entry.types.includes(documentType) &&
      entry.keywords.some((keyword) => queryTokens.has(keyword)),
  );

interface ScoredDocument {
  readonly document: KnowledgeDocument;
  readonly rawScore: number;
  readonly maxPossible: number;
  readonly reasons: MatchReason[];
}

const scoreDocument = (
  document: KnowledgeDocument,
  corpus: readonly KnowledgeDocument[],
  contentQueryTokens: ReadonlySet<string>,
  normalizedQueryText: string,
  mentionedChampionId: string | undefined,
  mentionedPatchId: string | undefined,
): ScoredDocument => {
  const titleTokens = uniqueTokens(document.title);
  const contentTokens = uniqueTokens(document.content);
  const reasons: MatchReason[] = [];

  const titleOverlap = overlapCount(contentQueryTokens, titleTokens);
  const contentOverlap = overlapCount(contentQueryTokens, contentTokens);
  if (titleOverlap > 0) reasons.push('title-match');
  if (contentOverlap > 0) reasons.push('content-term-match');

  let rawScore = titleOverlap * TITLE_WEIGHT + contentOverlap * CONTENT_WEIGHT;
  let maxPossible = contentQueryTokens.size * (TITLE_WEIGHT + CONTENT_WEIGHT);

  if (matchesTypeKeyword(contentQueryTokens, document.type)) {
    rawScore += TYPE_KEYWORD_WEIGHT;
    maxPossible += TYPE_KEYWORD_WEIGHT;
    reasons.push('type-keyword-match');
  }

  if (mentionedChampionId) {
    maxPossible += CHAMPION_MATCH_WEIGHT;
    if (document.relatedEntityIds.includes(mentionedChampionId)) {
      rawScore += CHAMPION_MATCH_WEIGHT;
      reasons.push('champion-match');
    }
  }

  // Solo premia una entidad relacionada (socio de sinergia, concepto) que la PROPIA pregunta nombra — nunca porque el documento ya la traiga en su título.
  const otherRelatedIds = document.relatedEntityIds.filter((id) => id !== mentionedChampionId);
  if (otherRelatedIds.length > 0) {
    maxPossible += RELATED_ENTITY_WEIGHT;
    const queryNamesOtherRelatedEntity = otherRelatedIds.some((id) => {
      const displayName = resolveEntityDisplayName(id, corpus);
      return Boolean(displayName) && normalizedQueryText.includes(normalizeText(displayName!));
    });
    if (queryNamesOtherRelatedEntity) {
      rawScore += RELATED_ENTITY_WEIGHT;
      reasons.push('related-entity-match');
    }
  }

  if (mentionedPatchId) {
    maxPossible += PATCH_MATCH_WEIGHT;
    if (document.patchId === mentionedPatchId) {
      rawScore += PATCH_MATCH_WEIGHT;
      reasons.push('patch-match');
    }
  }

  /**
   * Guardrail: reconocer el nombre de un campeón (o un parche) en la
   * pregunta NUNCA es, por sí solo, señal suficiente de que un documento
   * responde a la pregunta — sería declarar cobertura solo por reconocer
   * una entidad, sin ninguna relación real con lo que se preguntó (p. ej.
   * "¿Cuánto burst tiene Lucian?": reconocer a Lucian no debería bastar
   * para dar por buena cualquiera de sus decenas de documentos si ninguno
   * menciona realmente "burst"). Se exige al menos una señal de contenido
   * real (título, texto o tipo/etiqueta) antes de contar `champion-match`
   * o `patch-match`.
   */
  const hasRealContentSignal =
    reasons.includes('title-match') ||
    reasons.includes('content-term-match') ||
    reasons.includes('type-keyword-match');
  if (!hasRealContentSignal) {
    return { document, rawScore: 0, maxPossible, reasons: [] };
  }

  return { document, rawScore, maxPossible, reasons };
};

const toRetrievedDocument = (scored: ScoredDocument): RetrievedDocument => ({
  document: scored.document,
  score: scored.maxPossible > 0 ? Math.min(1, scored.rawScore / scored.maxPossible) : 0,
  reasons: scored.reasons,
});

const coverageFor = (topScore: number): RetrievalCoverage => {
  if (topScore >= FULL_COVERAGE_THRESHOLD) return 'full';
  if (topScore >= MIN_SCORE_THRESHOLD) return 'partial';
  return 'none';
};

const byScoreThenId = (a: RetrievedDocument, b: RetrievedDocument): number =>
  b.score - a.score || (a.document.id < b.document.id ? -1 : a.document.id > b.document.id ? 1 : 0);

/**
 * Construye un proveedor local determinista sobre un corpus dado. Recibe el
 * corpus como parámetro (no importa `knowledgeDocuments` directamente) para
 * poder probarse con corpus sintéticos en `test/knowledge-retrieval/`, igual
 * que `resolveConnections` en `domain/content-graph/registry.ts`.
 */
export const createLocalProvider = (
  corpus: readonly KnowledgeDocument[],
): RetrievalProvider => ({
  name: 'local-term-based',
  retrieve(query: RetrievalQuery): RetrievalResult {
    const normalizedText = normalizeText(query.text);
    const meaningfulTokens = uniqueTokens(query.text);
    const filtersApplied = resolveFilters(query, normalizedText);
    const candidates = applyFilters(corpus, filtersApplied);

    const championNameTokens = filtersApplied.championId
      ? new Set(tokenize(resolveEntityDisplayName(filtersApplied.championId, corpus) ?? ''))
      : new Set<string>();
    const contentQueryTokens = new Set(
      [...meaningfulTokens].filter((token) => !championNameTokens.has(token)),
    );

    if (meaningfulTokens.size === 0 && !filtersApplied.championId && !filtersApplied.patchId) {
      return {
        query: query.text,
        documents: [],
        coverage: 'none',
        retrievalConfidence: 0,
        insufficientInformation: true,
        filtersApplied,
      };
    }

    const scored = candidates
      .map((document) =>
        scoreDocument(
          document,
          corpus,
          contentQueryTokens,
          normalizedText,
          filtersApplied.championId,
          filtersApplied.patchId,
        ),
      )
      .map(toRetrievedDocument)
      .filter((retrieved) => retrieved.score >= MIN_SCORE_THRESHOLD)
      .sort(byScoreThenId);

    const limited = query.limit === undefined ? scored : scored.slice(0, query.limit);
    const topScore = limited[0]?.score ?? 0;
    const coverage = candidates.length === 0 ? 'none' : coverageFor(topScore);

    return {
      query: query.text,
      documents: limited,
      coverage,
      retrievalConfidence: topScore,
      insufficientInformation: coverage === 'none',
      filtersApplied,
    };
  },
});
