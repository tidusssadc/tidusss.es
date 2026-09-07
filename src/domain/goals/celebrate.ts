import type { ResolvedGoal } from './types';

/**
 * Decide qué hito conseguido merece una celebración discreta — pura y sin
 * ningún acceso a almacenamiento: quien la llama es responsable de leer y
 * escribir el registro de "hitos ya vistos" (hoy, `localStorage` por
 * navegador; ver nota de persistencia más abajo) y de pasar aquí solo los
 * datos ya resueltos.
 *
 * Reglas:
 * - `knownCompletedIds === null` significa "primera visita registrada de
 *   este navegador" — nunca se celebra nada en ese caso: los hitos ya
 *   conseguidos entonces no son un logro "recién ocurrido" para nadie, son
 *   simplemente el estado con el que esta persona encuentra el sitio.
 * - En cualquier otra visita, se celebra como máximo un hito por carga: el
 *   primero (en el orden recibido) que no estuviera ya en el registro
 *   conocido. Nunca se repite el mismo hito dos veces para el mismo
 *   navegador.
 *
 * Límite de persistencia real (documentado, no resuelto todavía): este
 * registro vive únicamente en `localStorage`, así que es por navegador, no
 * global — dos personas (o la misma persona en dos dispositivos) pueden ver
 * la celebración por separado, y borrar datos del sitio la repite. Esto es
 * intencionadamente aceptable porque el HECHO de que un objetivo esté
 * conseguido nunca depende de este registro (se recalcula siempre en vivo
 * contra el dato real) — lo único que vive aquí es "¿ya le enseñé el aviso
 * a esta persona?", nunca el registro global del logro en sí. Si en el
 * futuro se quiere una celebración verdaderamente global (una sola vez para
 * todo el mundo, con fecha real de consecución), hace falta una tabla
 * mínima en D1: `goal_id TEXT PRIMARY KEY, achieved_at TEXT NOT NULL` — no
 * se ha añadido en esta fase porque no era realmente necesaria todavía.
 */
export const selectNewlyCompletedGoal = (
  completed: readonly ResolvedGoal[],
  knownCompletedIds: readonly string[] | null,
): ResolvedGoal | undefined => {
  if (knownCompletedIds === null) return undefined;
  const known = new Set(knownCompletedIds);
  return completed.find((goal) => !known.has(goal.id));
};
