import type { GoalCategory, GoalChainDefinition, GoalStatus, ResolvedGoal } from './types';

/** Redondeado a un decimal, siempre entre 0 y 100 — un valor por encima del target nunca produce una barra rota. */
export const clampProgress = (current: number, target: number): number => {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((current / target) * 1000) / 10));
};

/**
 * Resuelve una cadena completa contra un único valor real. Nunca retrocede
 * "a mano": el estado de cada hito se deriva siempre del mismo `current`,
 * así que un hito ya superado se mantiene `completed` mientras el valor
 * real siga siendo igual o mayor — sin ningún flag editable.
 *
 * `current === undefined` (fuente caída o todavía sin responder) marca
 * TODA la cadena como `no-data`: nunca se interpreta la ausencia de dato
 * como "0 de camino a inventar progreso".
 */
export const resolveChain = (
  chain: GoalChainDefinition,
  current: number | undefined,
): ResolvedGoal[] => {
  const sorted = [...chain.milestones].sort((a, b) => a.order - b.order);

  if (current === undefined) {
    return sorted.map((entry) => ({
      id: entry.id,
      category: entry.category,
      title: entry.title,
      description: entry.description,
      current: undefined,
      target: entry.target,
      unit: entry.unit,
      progress: undefined,
      status: (entry.paused ? 'paused' : 'no-data') satisfies GoalStatus,
      source: entry.source,
      href: entry.href,
      achievedAt: entry.achievedAt,
      editorialPriority: entry.editorialPriority,
    }));
  }

  const activeIndex = sorted.findIndex((entry) => !entry.paused && current < entry.target);

  return sorted.map((entry, index) => {
    if (entry.paused) {
      return {
        id: entry.id,
        category: entry.category,
        title: entry.title,
        description: entry.description,
        current: undefined,
        target: entry.target,
        unit: entry.unit,
        progress: undefined,
        status: 'paused' as const,
        source: entry.source,
        href: entry.href,
        achievedAt: entry.achievedAt,
        editorialPriority: entry.editorialPriority,
      };
    }
    const reached = current >= entry.target;
    const status: GoalStatus = reached ? 'completed' : index === activeIndex ? 'active' : 'upcoming';
    const next = status === 'active' ? sorted[index + 1] : undefined;
    return {
      id: entry.id,
      category: entry.category,
      title: entry.title,
      description: entry.description,
      current,
      target: entry.target,
      unit: entry.unit,
      progress: clampProgress(current, entry.target),
      status,
      source: entry.source,
      href: entry.href,
      achievedAt: entry.achievedAt,
      editorialPriority: entry.editorialPriority,
      nextMilestone: next ? { id: next.id, title: next.title, target: next.target } : undefined,
    };
  });
};

/**
 * El único hito "representativo" de una cadena para mostrar como objetivo
 * de esa categoría: el activo si existe, o si la cadena entera ya está
 * completada, el último hito real (nunca `undefined` solo porque no queda
 * ningún reto pendiente — un canal que ha superado todos los hitos
 * definidos sigue teniendo algo real que mostrar: el último que alcanzó).
 */
export const primaryFromChain = (resolved: readonly ResolvedGoal[]): ResolvedGoal | undefined => {
  const active = resolved.find((entry) => entry.status === 'active');
  if (active) return active;
  for (let index = resolved.length - 1; index >= 0; index -= 1) {
    if (resolved[index]?.status === 'completed') return resolved[index];
  }
  return resolved[0];
};

/**
 * Pesos editoriales reales de cada categoría — nunca "el que tenga el
 * porcentaje más alto gana": así "455/500 vídeos" (91%) no domina para
 * siempre frente a un objetivo competitivo real más cerca de importar.
 * Ajustables aquí mismo si el criterio editorial cambia; nunca se leen de
 * fuera de este archivo.
 */
const CATEGORY_WEIGHT: Record<GoalCategory, number> = {
  'competitive-lp': 1.5,
  'youtube-subscribers': 1.2,
  'youtube-videos': 0.8,
  'editorial-champions': 0.9,
  'editorial-concepts': 0.7,
  'editorial-matchups': 0.7,
};

/**
 * Selección determinista del objetivo principal entre varias cadenas.
 * Nunca aleatoria, nunca rotación por fecha: mismo conjunto de entrada,
 * mismo resultado siempre.
 *
 * 1. Si algún objetivo activo declara `editorialPriority`, gana el de
 *    mayor valor entre esos — anula el cálculo automático por completo.
 * 2. Si no, gana `progreso × peso de categoría` — combina "qué tan cerca
 *    está" con "qué tan relevante es esa categoría", nunca solo lo primero.
 * 3. Empate exacto → orden alfabético del id, para que el resultado sea
 *    100% reproducible incluso en un empate real.
 */
export const selectPrimaryGoal = (goals: readonly ResolvedGoal[]): ResolvedGoal | undefined => {
  const active = goals.filter((entry) => entry.status === 'active');
  if (active.length === 0) return undefined;

  const withPriority = active.filter((entry) => entry.editorialPriority !== undefined);
  const pool = withPriority.length > 0 ? withPriority : active;

  const scored = pool.map((entry) => ({
    entry,
    score: entry.editorialPriority ?? (entry.progress ?? 0) * CATEGORY_WEIGHT[entry.category],
  }));
  scored.sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id));
  return scored[0]?.entry;
};
