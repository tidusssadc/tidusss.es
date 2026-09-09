/**
 * Subconjunto mínimo de la API real de D1 (`@cloudflare/workers-types`)
 * que este módulo necesita — definido localmente para no añadir una
 * dependencia nueva solo por los tipos (mismo criterio "sin librerías
 * innecesarias" que el resto del proyecto, p. ej. los gráficos del
 * Timeline en SVG puro). Estructuralmente compatible con el binding real
 * de Cloudflare: si algún día se instala `@cloudflare/workers-types`,
 * este tipo puede sustituirse sin tocar el resto del módulo.
 */
export interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success: boolean;
  meta?: { last_row_id?: number; changes?: number };
}

export interface D1PreparedStatement {
  bind: (...values: unknown[]) => D1PreparedStatement;
  first: <T = Record<string, unknown>>(colName?: string) => Promise<T | null>;
  run: <T = Record<string, unknown>>() => Promise<D1Result<T>>;
  all: <T = Record<string, unknown>>() => Promise<D1Result<T>>;
}

export interface D1Database {
  prepare: (query: string) => D1PreparedStatement;
}
