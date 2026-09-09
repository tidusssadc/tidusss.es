import { detectRankTransitions, highestRank } from './rank-order';
import type { RankSnapshot } from './types';

export interface RankEvolutionPoint {
  observedAt: string;
  tier?: string;
  rank?: string;
  leaguePoints?: number;
}

export interface RankEvolutionTransition {
  observedAt: string;
  direction: 'up' | 'down';
  fromTier?: string;
  fromRank?: string;
  toTier?: string;
  toRank?: string;
}

/**
 * Vista pública — nunca "Peak Season" ni "promoción" sin base real
 * (encargo §22/§23/§36). Función pura: opera sobre snapshots ya
 * obtenidos por el repositorio, sin tocar red/D1 — testeable sin mocks
 * de almacenamiento.
 */
export interface RankEvolutionSummary {
  available: boolean;
  sampleCount: number;
  firstObservedAt?: string;
  latest?: RankEvolutionPoint;
  /** El rango más alto realmente observado — nunca "de la season". */
  peak?: RankEvolutionPoint;
  transitions: RankEvolutionTransition[];
  /** Cronológico, más antiguo primero — listo para el chart. */
  points: RankEvolutionPoint[];
}

const toPoint = (snapshot: RankSnapshot): RankEvolutionPoint => ({
  observedAt: snapshot.observedAt,
  tier: snapshot.tier,
  rank: snapshot.rank,
  leaguePoints: snapshot.leaguePoints,
});

/**
 * `recentDescending`: snapshots más recientes primero (tal como los da
 * `listRecent`). `firstObservedAt`: puede venir de una consulta aparte
 * (el primer snapshot real puede no estar entre los N más recientes que
 * se cargan para el gráfico) — encargo §26, "inicio del seguimiento"
 * siempre debe ser el primero real, no el primero de la ventana visible.
 */
export const buildRankEvolution = (
  recentDescending: readonly RankSnapshot[],
  firstObservedAt: string | undefined,
): RankEvolutionSummary => {
  if (recentDescending.length === 0) {
    return {
      available: true,
      sampleCount: 0,
      transitions: [],
      points: [],
    };
  }
  const chronological = [...recentDescending].reverse();
  const peakSnapshot = highestRank(recentDescending);
  const transitions = detectRankTransitions(chronological).map(
    (transition): RankEvolutionTransition => ({
      observedAt: transition.to.observedAt,
      direction: transition.direction,
      fromTier: transition.from.tier,
      fromRank: transition.from.rank,
      toTier: transition.to.tier,
      toRank: transition.to.rank,
    }),
  );
  return {
    available: true,
    sampleCount: recentDescending.length,
    firstObservedAt: firstObservedAt ?? chronological[0]!.observedAt,
    latest: toPoint(recentDescending[0]!),
    peak: peakSnapshot ? toPoint(peakSnapshot) : undefined,
    transitions,
    points: chronological.map(toPoint),
  };
};

/** Cuando no hay repositorio configurado — nunca se confunde con "0 snapshots reales". */
export const unavailableRankEvolution = (): RankEvolutionSummary => ({
  available: false,
  sampleCount: 0,
  transitions: [],
  points: [],
});
