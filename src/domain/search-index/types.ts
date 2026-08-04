/**
 * El Índice de Búsqueda describe el conjunto mínimo de datos públicos que el
 * buscador global necesita para funcionar en el cliente, sin red y sin
 * exponer nada que no sea ya público en el sitio (nunca `EditorialTake`
 * completo, nunca contenido sin URL real). Cada entrada representa un
 * destino real y navegable — nunca un resultado inventado.
 */

export type SearchEntryCategory =
  | 'pagina'
  | 'campeon'
  | 'guia'
  | 'build'
  | 'academia'
  | 'herramienta'
  | 'tier-list'
  | 'actualizacion'
  | 'pregunta'
  /** Nunca sale del índice estático (`buildSearchIndex`): lo añade el cliente al abrir el buscador, con datos reales de `/api/youtube`. */
  | 'video';

export interface SearchEntry {
  readonly id: string;
  readonly category: SearchEntryCategory;
  readonly title: string;
  /** Frase breve, ya editorial o factual — nunca generada en el cliente. */
  readonly description: string;
  /** URL real, con ancla real cuando corresponde a una sección concreta. */
  readonly href: string;
  /** Alias/variantes reales (nombre de campeón sin diacríticos, socios de sinergia, objetos de la build...) — nunca inventadas. */
  readonly keywords: readonly string[];
  readonly patchLabel?: string;
  readonly editorialStatus?: 'reviewed' | 'draft' | 'pending';
}

export const SEARCH_CATEGORY_LABEL: Record<SearchEntryCategory, string> = {
  pagina: 'Páginas',
  campeon: 'Campeones',
  guia: 'Guías',
  build: 'Builds y runas',
  academia: 'Academia',
  herramienta: 'Herramientas',
  'tier-list': 'Tier List',
  actualizacion: 'Actualizaciones',
  pregunta: 'Preguntas sugeridas',
  video: 'Vídeos',
};
