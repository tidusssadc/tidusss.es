/**
 * Funciones puras de normalización, sin ninguna dependencia de otros
 * archivos del dominio ni de Node/Astro/DOM. Se usan desde tres sitios
 * distintos con la misma lógica exacta, nunca reimplementada: el
 * generador (`scripts/sync-champion-catalog.mjs`), la búsqueda del
 * Centro de Campeones (en el navegador, vía Vite) y los tests.
 */

/**
 * Convierte una clave de Data Dragon (p. ej. "AurelionSol", "KSante") en un
 * slug de URL determinista ("aurelion-sol", "k-sante"). Inserta un guion en
 * cada transición de minúscula a mayúscula o de sigla a palabra, y pasa todo
 * a minúsculas. No depende de una lista de casos especiales: el mismo
 * algoritmo debe seguir funcionando para cualquier campeón futuro.
 */
export const slugifyChampionKey = (dataDragonKey: string): string =>
  dataDragonKey
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();

const COMBINING_DIACRITICS = /\p{Diacritic}/gu;
const APOSTROPHES_AND_DOTS = /['’.]/g;
const NON_ALPHANUMERIC_RUNS = /[^a-z0-9]+/gi;

/**
 * Normaliza un texto para comparaciones de búsqueda: quita tildes/diacríticos,
 * apóstrofes y puntuación, colapsa espacios y pasa a minúsculas. Determinista
 * y sin dependencias: soporta "kaisa" -> "Kai'Sa", "dr mundo" -> "Dr. Mundo",
 * "jarvan" como subcadena de "Jarvan IV", etc. No es una búsqueda difusa: es
 * una normalización simple aplicada por igual al texto y a la consulta.
 */
export const normalizeSearchText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .replace(APOSTROPHES_AND_DOTS, '')
    .replace(NON_ALPHANUMERIC_RUNS, ' ')
    .trim()
    .toLowerCase();
