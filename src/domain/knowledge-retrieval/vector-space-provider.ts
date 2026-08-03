import type { KnowledgeDocument } from '../knowledge-index';
import { applyFilters, resolveFilters } from './filters';
import { normalizeText, tokenize } from './normalize';
import { FULL_COVERAGE_THRESHOLD, MIN_SCORE_THRESHOLD } from './local-provider';
import type {
  RetrievalCoverage,
  RetrievalProvider,
  RetrievalQuery,
  RetrievalResult,
  RetrievedDocument,
} from './types';

/**
 * Experimento local de espacio vectorial (Fase 5 del encargo) — TF-IDF +
 * similitud del coseno. Esto es lo que se PUEDE ejecutar hoy, en local, sin
 * credenciales, sin red y sin coste:
 *
 * - No es un embedding neuronal de verdad (no captura sinónimos ni
 *   parafraseo semántico — "sufre en late" no se relacionará
 *   automáticamente con "pierde impacto si la partida se alarga" salvo que
 *   compartan literalmente algún término). Llamarlo "embeddings" sería
 *   impreciso y engañoso.
 * - Es, en cambio, la técnica clásica de espacio vectorial disperso más
 *   cercana a lo que un embedding real aportaría, y sirve exactamente para
 *   lo que pide el encargo: una comparación honesta frente a la línea base
 *   de términos, sobre el mismo conjunto de evaluación, sin activar nada
 *   en producción ni depender de una cuenta, clave o binding de Cloudflare.
 *
 * `docs/knowledge-retrieval.md` §6 documenta qué haría falta para un
 * proveedor de embeddings real (Workers AI / Vectorize / API externa) — ese
 * proveedor no se activa aquí, solo se deja preparada la interfaz
 * (`RetrievalProvider`) para que pueda sustituir a este experimento sin
 * tocar el conjunto de evaluación ni el resto del dominio.
 */

type SparseVector = ReadonlyMap<string, number>;

const termFrequencies = (tokens: readonly string[]): Map<string, number> => {
  const frequencies = new Map<string, number>();
  for (const token of tokens) frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  return frequencies;
};

const vectorNorm = (vector: SparseVector): number => {
  let sumOfSquares = 0;
  for (const weight of vector.values()) sumOfSquares += weight * weight;
  return Math.sqrt(sumOfSquares);
};

const cosineSimilarity = (a: SparseVector, b: SparseVector): number => {
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  let dotProduct = 0;
  for (const [term, weight] of smaller) {
    const otherWeight = larger.get(term);
    if (otherWeight !== undefined) dotProduct += weight * otherWeight;
  }
  const normProduct = vectorNorm(a) * vectorNorm(b);
  return normProduct === 0 ? 0 : dotProduct / normProduct;
};

interface CorpusVectorSpace {
  readonly documentFrequency: ReadonlyMap<string, number>;
  readonly documentCount: number;
  readonly documentVectors: ReadonlyMap<string, SparseVector>;
}

const documentText = (document: KnowledgeDocument): string => `${document.title} ${document.content}`;

/**
 * Construye el espacio vectorial completo del corpus una sola vez —
 * determinista, sin `Math.random`/`Date.now`, sin red. `idf(term) =
 * log(N / df(term))`, la formulación TF-IDF estándar sin suavizado
 * adicional (el corpus es pequeño y cerrado, no hace falta).
 */
const buildVectorSpace = (corpus: readonly KnowledgeDocument[]): CorpusVectorSpace => {
  const documentTokens = new Map<string, string[]>();
  const documentFrequency = new Map<string, number>();

  for (const document of corpus) {
    const tokens = tokenize(documentText(document));
    documentTokens.set(document.id, tokens);
    for (const term of new Set(tokens)) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const documentCount = corpus.length;
  const idf = (term: string): number => {
    const df = documentFrequency.get(term) ?? 0;
    if (df === 0) return 0;
    return Math.log(documentCount / df);
  };

  const documentVectors = new Map<string, SparseVector>();
  for (const document of corpus) {
    const tokens = documentTokens.get(document.id) ?? [];
    const frequencies = termFrequencies(tokens);
    const vector = new Map<string, number>();
    for (const [term, count] of frequencies) {
      const weight = count * idf(term);
      if (weight > 0) vector.set(term, weight);
    }
    documentVectors.set(document.id, vector);
  }

  return { documentFrequency, documentCount, documentVectors };
};

const queryVector = (queryText: string, space: CorpusVectorSpace): SparseVector => {
  const tokens = tokenize(queryText);
  const frequencies = termFrequencies(tokens);
  const vector = new Map<string, number>();
  for (const [term, count] of frequencies) {
    const df = space.documentFrequency.get(term) ?? 0;
    if (df === 0) continue; // término fuera del vocabulario del corpus: no aporta señal, no se inventa una
    const weight = count * Math.log(space.documentCount / df);
    if (weight > 0) vector.set(term, weight);
  }
  return vector;
};

const coverageFor = (topScore: number): RetrievalCoverage => {
  if (topScore >= FULL_COVERAGE_THRESHOLD) return 'full';
  if (topScore >= MIN_SCORE_THRESHOLD) return 'partial';
  return 'none';
};

const byScoreThenId = (a: RetrievedDocument, b: RetrievedDocument): number =>
  b.score - a.score || (a.document.id < b.document.id ? -1 : a.document.id > b.document.id ? 1 : 0);

export const createVectorSpaceProvider = (
  corpus: readonly KnowledgeDocument[],
): RetrievalProvider => {
  const space = buildVectorSpace(corpus);

  return {
    name: 'local-tfidf-vector-space',
    retrieve(query: RetrievalQuery): RetrievalResult {
      const normalizedText = normalizeText(query.text);
      const filtersApplied = resolveFilters(query, normalizedText);
      const candidates = applyFilters(corpus, filtersApplied);
      const qVector = queryVector(query.text, space);

      if (qVector.size === 0 && !filtersApplied.championId && !filtersApplied.patchId) {
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
        .map((document): RetrievedDocument => {
          const docVector = space.documentVectors.get(document.id) ?? new Map();
          const score = cosineSimilarity(qVector, docVector);
          return {
            document,
            score,
            reasons: score > 0 ? (['vector-similarity'] as const) : [],
          };
        })
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
  };
};
