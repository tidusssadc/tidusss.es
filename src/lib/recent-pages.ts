/**
 * Historial local de navegación — ligero y privado, sin servidor. Guarda
 * como máximo 5 páginas reales visitadas (título + URL + fecha), nunca
 * preguntas completas ni datos personales, y nunca sale del navegador.
 */

const STORAGE_KEY = 'tidusss:recent-pages';
const MAX_ENTRIES = 5;

export interface RecentPageEntry {
  readonly href: string;
  readonly title: string;
  readonly visitedAt: string;
}

/** Rutas que no aportan valor como "continuar leyendo" — el propio buscador y la portada. */
const EXCLUDED_PATHS = new Set(['/', '/buscar']);

export const readRecentPages = (): RecentPageEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is RecentPageEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as RecentPageEntry).href === 'string' &&
        typeof (entry as RecentPageEntry).title === 'string' &&
        typeof (entry as RecentPageEntry).visitedAt === 'string',
    );
  } catch {
    return [];
  }
};

export const recordPageVisit = (href: string, title: string): void => {
  try {
    const path = href.split('?')[0] ?? href;
    if (EXCLUDED_PATHS.has(path)) return;
    const existing = readRecentPages().filter((entry) => entry.href !== href);
    const next = [{ href, title, visitedAt: new Date().toISOString() }, ...existing].slice(
      0,
      MAX_ENTRIES,
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage puede fallar (modo privado, cuota) — el historial es una
    // mejora, nunca un requisito: fallar en silencio es correcto aquí.
  }
};

export const clearRecentPages = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ver nota en recordPageVisit.
  }
};
