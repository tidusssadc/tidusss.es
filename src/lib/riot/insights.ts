import { riotDefaults } from '../../config/riot';
import type { RecentMatch, RiotOverview } from './types';

/**
 * "Insights" deterministas del Control Room de /competitivo (encargo V4 §17).
 *
 * REGLAS:
 *  - Solo HECHOS derivados de datos que Riot ya trajo — cero llamadas nuevas,
 *    cero persistencia propia.
 *  - Nunca lenguaje causal ("estás jugando mejor porque…"), nunca una
 *    recomendación, nunca un "score" propietario. Una frase = una cifra real
 *    con su muestra.
 *  - Cada regla tiene un umbral de muestra: una racha de 1 no es una racha,
 *    un 100% WR en 1 partida no es un insight (mismo criterio que
 *    `performance.ts` / `MIN_RELATION_SAMPLE`).
 *  - Si nada supera su umbral, se devuelve `[]` y la UI no pinta el bloque.
 *
 * El texto es visible (español); el módulo es puro y testeable sin DOM.
 */

export interface DeterministicInsight {
  /** Clave estable para deduplicar / ordenar / testear — nunca se muestra. */
  key: string;
  /** Frase corta en español, ya formateada. */
  text: string;
}

const MIN_STREAK = 2;
const MIN_CHAMPION_SAMPLE = 3;
const MIN_FORM_DELTA = 5; // puntos porcentuales de WR reciente vs muestra completa
const RECENT_CONCENTRATION_WINDOW = 5;

const oneDecimal = (value: number) =>
  value.toFixed(1).replace('.', ',').replace(',0', '');

const perMinute = (total: number, durationSeconds: number) =>
  total / (Math.max(1, durationSeconds) / 60);

const soloMatches = (matches: readonly RecentMatch[]): RecentMatch[] =>
  matches.filter(
    (match) => match.queueId === riotDefaults.soloQueueId && !match.remake,
  );

/**
 * Devuelve entre 0 y `limit` insights, en orden de prioridad fija (sesión →
 * concentración → forma → CS/min → mejor campeón → mejor daño). El orden es
 * determinista: los mismos datos producen siempre la misma lista.
 */
export const buildDeterministicInsights = (
  overview: Pick<RiotOverview, 'today' | 'recent' | 'performance'>,
  limit = 4,
): DeterministicInsight[] => {
  const out: DeterministicInsight[] = [];
  const { today, recent, performance } = overview;

  // 1 · Racha de la sesión de hoy.
  if (today.streak && today.streak.games >= MIN_STREAK) {
    const noun = today.streak.result === 'win' ? 'victorias' : 'derrotas';
    out.push({
      key: 'session-streak',
      text: `${today.streak.games} ${noun} seguidas hoy`,
    });
  }

  // 2 · Concentración de campeón en las últimas partidas.
  const recentSolo = soloMatches(recent.matches);
  const window = recentSolo.slice(0, RECENT_CONCENTRATION_WINDOW);
  if (window.length === RECENT_CONCENTRATION_WINDOW) {
    const counts = new Map<string, number>();
    for (const match of window)
      counts.set(match.championName, (counts.get(match.championName) ?? 0) + 1);
    const [name, games] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    if (name && games && games >= 3) {
      out.push({
        key: 'recent-concentration',
        text: `${games} de las últimas ${RECENT_CONCENTRATION_WINDOW} partidas con ${name}`,
      });
    }
  }

  // 3 · Forma reciente vs muestra completa (solo si el salto es real).
  const recentWr = performance.windowRecent.winRate;
  const fullWr = performance.windowFull.winRate;
  if (
    recentWr !== undefined &&
    fullWr !== undefined &&
    performance.windowRecent.sampleSize >= 10 &&
    Math.abs(recentWr - fullWr) >= MIN_FORM_DELTA
  ) {
    const dir = recentWr > fullWr ? 'sube' : 'baja';
    out.push({
      key: 'form-shift',
      text: `La forma ${dir}: ${recentWr}% WR en las últimas ${performance.windowRecent.sampleSize} vs ${fullWr}% en la muestra`,
    });
  }

  // 4 · CS/min de la ventana de 10.
  const window10 = performance.trend.find((point) => point.windowSize === 10);
  if (window10?.averageCsPerMinute !== undefined) {
    out.push({
      key: 'recent-csm',
      text: `${oneDecimal(window10.averageCsPerMinute)} CS/min de media en las últimas 10`,
    });
  }

  // 5 · Mejor WR reciente por campeón con muestra suficiente.
  const bestChampion = [...performance.champions]
    .filter((champion) => champion.games >= MIN_CHAMPION_SAMPLE)
    .sort(
      (a, b) => b.winRate - a.winRate || b.games - a.games,
    )[0];
  if (bestChampion && bestChampion.winRate >= 55) {
    out.push({
      key: 'best-champion',
      text: `Mejor WR reciente: ${bestChampion.championName} ${bestChampion.winRate}% (${bestChampion.games} partidas)`,
    });
  }

  // 6 · Mejor daño/min de la muestra reciente (una sola partida, dato directo).
  let best: { value: number; match: RecentMatch } | undefined;
  for (const match of recentSolo) {
    const value = perMinute(match.damageToChampions, match.durationSeconds);
    if (!best || value > best.value) best = { value, match };
  }
  if (best && recentSolo.length >= 5) {
    out.push({
      key: 'best-dpm',
      text: `Mejor daño/min reciente: ${Math.round(best.value)} con ${best.match.championName}`,
    });
  }

  return out.slice(0, limit);
};

/**
 * "Δ de sesión" honesto: LP ganado/perdido desde el inicio de la sesión de
 * hoy, DERIVADO de un snapshot real de rango anterior a la primera partida
 * clasificatoria del día. Sin snapshot previo válido → `null` (la UI muestra
 * "Pendiente de histórico suficiente" y reserva el sitio). Nunca reconstruye
 * LP a partir de deltas de partida ni de nada que no sea un snapshot real.
 */
export interface RankPointLike {
  observedAt: string;
  tier?: string;
  rank?: string;
  leaguePoints?: number;
}

export interface SessionLpDelta {
  /** LP al inicio de la sesión, de un snapshot real. */
  fromLeaguePoints: number;
  toLeaguePoints: number;
  delta: number;
  /** `true` si el tier/división cambió entre el snapshot de inicio y ahora — entonces el número de LP crudo no cuenta toda la historia y la UI debe decir "subió de división", no "+N LP". */
  tierChanged: boolean;
  fromLabel: string;
  toLabel: string;
}

/** Master+ no tiene división: Riot a veces devuelve `rank: "I"`, los snapshots guardan `undefined`. Se normaliza para no leer eso como un cambio de división. */
const APEX_TIERS = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER']);
const divisionOf = (point: RankPointLike): string | undefined =>
  point.tier && APEX_TIERS.has(point.tier) ? undefined : point.rank;

const rankLabel = (point: RankPointLike): string =>
  [point.tier, divisionOf(point)].filter(Boolean).join(' ') || 'Sin clasificar';

export const deriveSessionLpDelta = (
  points: readonly RankPointLike[],
  sessionStartIso: string | undefined,
  current: RankPointLike | undefined,
): SessionLpDelta | null => {
  if (!sessionStartIso || !current || current.leaguePoints === undefined) return null;
  const startMs = new Date(sessionStartIso).getTime();
  if (Number.isNaN(startMs)) return null;
  // El último snapshot ESTRICTAMENTE anterior al inicio de la sesión.
  const prior = [...points]
    .filter((point) => {
      const ms = new Date(point.observedAt).getTime();
      return !Number.isNaN(ms) && ms < startMs && point.leaguePoints !== undefined;
    })
    .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime())[0];
  if (!prior || prior.leaguePoints === undefined) return null;
  return {
    fromLeaguePoints: prior.leaguePoints,
    toLeaguePoints: current.leaguePoints,
    delta: current.leaguePoints - prior.leaguePoints,
    tierChanged:
      prior.tier !== current.tier || divisionOf(prior) !== divisionOf(current),
    fromLabel: rankLabel(prior),
    toLabel: rankLabel(current),
  };
};
