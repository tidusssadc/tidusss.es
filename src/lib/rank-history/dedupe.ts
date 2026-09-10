import type { NewRankSnapshot, RankSnapshot } from './types';

/**
 * Política de deduplicación (encargo §18). Guardar un snapshot nuevo
 * solo si:
 *   - es el primero (nunca se reconstruye historia anterior), o
 *   - tier/division/LP/wins/losses cambiaron respecto al último real, o
 *   - ha pasado el intervalo de heartbeat (prueba de que se sigue
 *     observando aunque nada haya cambiado — nunca miles de filas
 *     idénticas cada visita).
 */
export const HEARTBEAT_MS = 6 * 60 * 60_000; // 6h — encargo §21, prioriza coste Riot sobre granularidad

export const hasRankChanged = (
  latest: RankSnapshot,
  candidate: NewRankSnapshot,
): boolean =>
  latest.tier !== candidate.tier ||
  latest.rank !== candidate.rank ||
  latest.leaguePoints !== candidate.leaguePoints ||
  latest.wins !== candidate.wins ||
  latest.losses !== candidate.losses;

export interface DedupeDecision {
  shouldInsert: boolean;
  reason: 'first-snapshot' | 'changed' | 'heartbeat-elapsed' | 'unchanged';
}

export const decideSnapshot = (
  latest: RankSnapshot | undefined,
  candidate: NewRankSnapshot,
  now: number = Date.now(),
): DedupeDecision => {
  if (!latest) return { shouldInsert: true, reason: 'first-snapshot' };
  if (hasRankChanged(latest, candidate))
    return { shouldInsert: true, reason: 'changed' };
  const elapsed = now - Date.parse(latest.observedAt);
  if (!Number.isFinite(elapsed) || elapsed >= HEARTBEAT_MS)
    return { shouldInsert: true, reason: 'heartbeat-elapsed' };
  return { shouldInsert: false, reason: 'unchanged' };
};
