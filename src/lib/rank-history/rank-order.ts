/**
 * Orden real de rango de League of Legends (encargo §24) — función
 * explícita y testeada, nunca una escala LP inventada entre tiers. Master
 * y superiores no tienen division; se comparan solo por tier y, dentro
 * del mismo tier, por LP (que en Master+ sí es una escala continua real).
 */

const TIER_ORDER = [
  'IRON',
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'EMERALD',
  'DIAMOND',
  'MASTER',
  'GRANDMASTER',
  'CHALLENGER',
] as const;

/** Ascendente: IV es la división más baja de un tier, I la más alta. */
const DIVISION_ORDER = ['IV', 'III', 'II', 'I'] as const;

export const APEX_TIERS = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER']);

const tierIndex = (tier?: string) => {
  if (!tier) return -1;
  const index = TIER_ORDER.indexOf(tier.toUpperCase() as (typeof TIER_ORDER)[number]);
  return index;
};

const divisionIndex = (division?: string) => {
  if (!division) return -1;
  return DIVISION_ORDER.indexOf(division.toUpperCase() as (typeof DIVISION_ORDER)[number]);
};

export interface ComparableRank {
  tier?: string;
  rank?: string;
  leaguePoints?: number;
}

/**
 * -1 si `a` < `b`, 0 si son iguales a efectos de orden, 1 si `a` > `b`.
 * Sin clasificar (`tier` ausente) siempre es lo más bajo. Nunca lanza —
 * datos parciales se tratan como "lo más bajo posible" de forma
 * consistente, nunca como error.
 */
export const compareRank = (a: ComparableRank, b: ComparableRank): number => {
  const tierA = tierIndex(a.tier);
  const tierB = tierIndex(b.tier);
  if (tierA !== tierB) return tierA < tierB ? -1 : 1;
  if (tierA === -1) return 0; // ambos sin clasificar

  const isApexA = a.tier ? APEX_TIERS.has(a.tier.toUpperCase()) : false;
  if (!isApexA) {
    const divA = divisionIndex(a.rank);
    const divB = divisionIndex(b.rank);
    if (divA !== divB) return divA < divB ? -1 : 1;
  }

  const lpA = a.leaguePoints ?? 0;
  const lpB = b.leaguePoints ?? 0;
  if (lpA !== lpB) return lpA < lpB ? -1 : 1;
  return 0;
};

/** El más alto de la lista según `compareRank` — `undefined` si la lista está vacía. */
export const highestRank = <T extends ComparableRank>(
  entries: readonly T[],
): T | undefined =>
  entries.reduce<T | undefined>(
    (best, entry) => (!best || compareRank(entry, best) > 0 ? entry : best),
    undefined,
  );

export type RankTransitionDirection = 'up' | 'down';

export interface RankTransition<T extends ComparableRank = ComparableRank> {
  from: T;
  to: T;
  direction: RankTransitionDirection;
}

/**
 * Compara SOLO tier+division (nunca LP) — para decidir si hubo un
 * cambio de rango real entre dos snapshots. El LP sube y baja partida a
 * partida sin que eso sea una "transición de rango"; una transición es
 * cruzar de división o de tier.
 */
const compareTierDivision = (a: ComparableRank, b: ComparableRank): number => {
  const tierA = tierIndex(a.tier);
  const tierB = tierIndex(b.tier);
  if (tierA !== tierB) return tierA < tierB ? -1 : 1;
  if (tierA === -1) return 0;
  const isApexA = a.tier ? APEX_TIERS.has(a.tier.toUpperCase()) : false;
  if (isApexA) return 0; // Master+ no tiene division real que comparar aquí
  const divA = divisionIndex(a.rank);
  const divB = divisionIndex(b.rank);
  if (divA !== divB) return divA < divB ? -1 : 1;
  return 0;
};

/**
 * Transiciones REALES entre snapshots consecutivos (ordenados
 * cronológicamente, más antiguo primero) — solo cambios de tier/division,
 * nunca fluctuaciones de LP dentro de la misma división. Nunca la
 * palabra "promoción" si no hay una comparación real que la respalde
 * (encargo §23: "si podemos inferirla inequívocamente entre snapshots:
 * documentar algoritmo" — este es el algoritmo: comparar tier+division
 * de cada par consecutivo, sin adivinar nada que ocurriera entre medias
 * ni tratar el LP como si fuera parte del cambio de rango).
 */
export const detectRankTransitions = <T extends ComparableRank>(
  chronological: readonly T[],
): RankTransition<T>[] => {
  const transitions: RankTransition<T>[] = [];
  for (let i = 1; i < chronological.length; i += 1) {
    const from = chronological[i - 1]!;
    const to = chronological[i]!;
    const comparison = compareTierDivision(to, from);
    if (comparison === 0) continue;
    transitions.push({ from, to, direction: comparison > 0 ? 'up' : 'down' });
  }
  return transitions;
};
