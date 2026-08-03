/**
 * Normalización determinista de texto en español — sin dependencias
 * externas (`String.prototype.normalize` es nativo de JavaScript). Usada
 * tanto por el recuperador local por términos como por el experimento de
 * espacio vectorial, para que ambos partan de la misma noción de "palabra".
 */
import { canonicalizeToken } from './synonyms';

/** Palabras vacías en español que no aportan señal de recuperación. Lista corta y deliberada, no un diccionario exhaustivo. */
const SPANISH_STOPWORDS = new Set([
  'a', 'al', 'algo', 'algun', 'alguna', 'como', 'con', 'cual',
  'cuando', 'de', 'del', 'desde', 'donde', 'el', 'ella',
  'en', 'entre', 'es', 'esa', 'ese', 'esta', 'este', 'hace', 'hacer',
  'hago', 'la', 'las', 'lo', 'los', 'mas', 'me', 'mi', 'mis',
  'mucho', 'muy', 'no', 'o', 'para', 'pero', 'por', 'que', 'quien',
  'se', 'ser', 'si', 'sin', 'sobre', 'su', 'sus', 'tan',
  'tiene', 'tu', 'un', 'una', 'uno', 'unos', 'y', 'ya',
  // Específica de este corpus, no del español general: "Tidusss" es la
  // firma editorial y aparece en prácticamente todo el contenido ("según
  // Tidusss...", "criterio de Tidusss...") — no discrimina entre
  // documentos, igual que el nombre de un campeón mencionado en la
  // pregunta se retira del solapamiento de términos (ver `local-provider.ts`).
  'tidusss',
]);

const COMBINING_DIACRITICS = new RegExp('[̀-ͯ]', 'g');

/** Minúsculas + sin diacríticos + sin puntuación — solo letras/números/espacios. */
export const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Tokeniza, elimina palabras vacías y tokens de un solo carácter (ruido, no
 * señal), y canonicaliza sinónimos/variantes (`synonyms.ts`) — aplicado por
 * igual a preguntas y a documentos, así que una variante en la pregunta
 * coincide con la forma real usada en el corpus sin necesidad de que
 * ambas usen literalmente la misma palabra.
 */
export const tokenize = (text: string): string[] =>
  normalizeText(text)
    .split(' ')
    .filter((token) => token.length > 1 && !SPANISH_STOPWORDS.has(token))
    .map(canonicalizeToken);

export const uniqueTokens = (text: string): Set<string> => new Set(tokenize(text));
