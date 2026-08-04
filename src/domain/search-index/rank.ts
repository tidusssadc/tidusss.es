import { canonicalizeToken, tokenize } from '../knowledge-retrieval';
import { normalizeSearchText } from '../league-laboratory';
import type { SearchEntry } from './types';

export interface SearchMatch {
  readonly entry: SearchEntry;
  readonly score: number;
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const startsAtWordBoundary = (haystack: string, needle: string): boolean =>
  new RegExp(`(^|\\s)${escapeRegExp(needle)}`).test(haystack);

/**
 * Puntúa un token de la consulta contra una entrada, en el orden de
 * prioridad del encargo: 1) título exacto, 2) alias/nombre normalizado
 * (prefijo/límite de palabra — cubre "kaisa" -> "Kai'Sa" vía
 * `normalizeSearchText`, el mismo sistema que ya usa el buscador del Centro
 * de Campeones), 3) sección/keyword real (objeto, runa, socio de sinergia),
 * 4) contenido semántico, reutilizando los sinónimos ya validados de
 * `knowledge-retrieval/synonyms.ts` (soporte/support, intercambio/trading,
 * poder/power spike...) en vez de duplicarlos. Devuelve `null` si el token
 * no aparece por ningún criterio real — nunca inventa una coincidencia.
 *
 * Deliberadamente NO se añade aquí un alias tipo "ie" -> "Filo Infinito":
 * ninguna fuente del dominio valida esa equivalencia hoy, y el encargo pide
 * explícitamente no inventarla.
 */
const scoreToken = (
  token: string,
  titleNorm: string,
  keywordNorms: readonly string[],
  descriptionNorm: string,
  contentTokens: ReadonlySet<string>,
): number | null => {
  if (titleNorm === token) return 100;
  if (titleNorm.startsWith(token)) return 88;
  if (startsAtWordBoundary(titleNorm, token)) return 78;
  if (keywordNorms.includes(token)) return 66;
  if (keywordNorms.some((keyword) => keyword.includes(token))) return 52;
  if (titleNorm.includes(token)) return 40;
  // El token de consulta se canonicaliza igual que ya hace `tokenize()` al
  // construir `contentTokens` — sin esto, "support" (consulta) nunca
  // encontraba "soporte" (contenido real), aunque ambos son la misma forma
  // canónica ya validada en `knowledge-retrieval/synonyms.ts`.
  if (contentTokens.has(canonicalizeToken(token))) return 24;
  if (descriptionNorm.includes(token)) return 12;
  return null;
};

/**
 * Búsqueda AND: cada token de la consulta debe encontrar coincidencia real
 * en la entrada (por el criterio que sea) para que esa entrada aparezca —
 * una consulta de dos palabras nunca la aprueba una entrada que solo
 * coincide en una. La puntuación final es la media de las puntuaciones por
 * token, así un título corto que coincide exactamente siempre gana a un
 * título largo que solo contiene la consulta como subcadena.
 */
export const searchEntries = (
  entries: readonly SearchEntry[],
  query: string,
  options: { limit?: number } = {},
): SearchMatch[] => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];
  const queryTokens = normalizedQuery.split(' ').filter(Boolean);
  if (queryTokens.length === 0) return [];

  const matches: SearchMatch[] = [];
  for (const entry of entries) {
    const titleNorm = normalizeSearchText(entry.title);
    const keywordNorms = entry.keywords.map(normalizeSearchText);
    const descriptionNorm = normalizeSearchText(entry.description);
    const contentTokens = new Set(tokenize(`${entry.title} ${entry.description}`));

    let total = 0;
    let allTokensMatched = true;
    for (const token of queryTokens) {
      const tokenScore = scoreToken(token, titleNorm, keywordNorms, descriptionNorm, contentTokens);
      if (tokenScore === null) {
        allTokensMatched = false;
        break;
      }
      total += tokenScore;
    }
    if (!allTokensMatched) continue;
    matches.push({ entry, score: total / queryTokens.length });
  }

  matches.sort(
    (a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, 'es'),
  );
  return options.limit === undefined ? matches : matches.slice(0, options.limit);
};
