import { buildRankChartPoints, type RankChartPoint } from './chart';
import { formatRankLabel } from './format';
import { madridDate, relativeTime } from '../time';
import type { RankEvolutionSummary } from './evolution';

/** Dimensiones del sparkline — compartidas entre el cálculo de puntos y el `viewBox` del SVG en el componente. */
export const RANK_CHART_WIDTH = 280;
export const RANK_CHART_HEIGHT = 64;

export type RankEvolutionViewState = 'hidden' | 'empty' | 'single' | 'chart';

/**
 * Vista ya formateada para el componente — toda la lógica de "qué mostrar"
 * vive aquí (testeable sin DOM), el componente solo pinta. Copy exacto del
 * encargo Night Shift §36/§37: "Peak observado", "Seguimiento desde...",
 * nunca "Peak Season" ni una promesa de "récord histórico".
 */
export interface RankEvolutionView {
  state: RankEvolutionViewState;
  currentLabel?: string;
  currentLpLabel?: string;
  sinceLabel?: string;
  peakLabel?: string;
  latestTransitionLabel?: string;
  points: RankChartPoint[];
}

const HIDDEN_VIEW: RankEvolutionView = { state: 'hidden', points: [] };

const lpLabel = (leaguePoints?: number): string | undefined =>
  leaguePoints === undefined ? undefined : `${leaguePoints} LP`;

const arrow = (direction: 'up' | 'down'): string => (direction === 'up' ? '↑' : '↓');

/**
 * `now`: inyectable para tests deterministas — en producción el componente
 * lo deja en el `Date.now()` real por defecto (mismo patrón que
 * `recordObservationIfDue`).
 */
export const buildRankEvolutionView = (
  summary: RankEvolutionSummary,
  now: number = Date.now(),
): RankEvolutionView => {
  // Storage no configurado o degradado — nunca se distingue de "0
  // snapshots reales" con un mensaje de error: el bloque simplemente no
  // aparece, igual que el resto de Competitivo cuando algo opcional falta.
  if (!summary.available) return HIDDEN_VIEW;

  if (summary.sampleCount === 0) return { state: 'empty', points: [] };

  const current = summary.latest;
  const currentLabel = current ? formatRankLabel(current.tier, current.rank) : undefined;
  const currentLpLabel = current ? lpLabel(current.leaguePoints) : undefined;
  const sinceLabel = summary.firstObservedAt
    ? `Seguimiento desde ${madridDate(summary.firstObservedAt) ?? ''}`.trim()
    : undefined;

  if (summary.sampleCount === 1) {
    return { state: 'single', currentLabel, currentLpLabel, sinceLabel, points: [] };
  }

  const peakLabel = summary.peak
    ? `Peak observado: ${formatRankLabel(summary.peak.tier, summary.peak.rank)}`
    : undefined;

  const lastTransition = summary.transitions.at(-1);
  const latestTransitionLabel = lastTransition
    ? `${arrow(lastTransition.direction)} ${formatRankLabel(lastTransition.fromTier, lastTransition.fromRank)} → ${formatRankLabel(lastTransition.toTier, lastTransition.toRank)} · ${relativeTime(lastTransition.observedAt, new Date(now)) ?? ''}`.trim()
    : undefined;

  return {
    state: 'chart',
    currentLabel,
    currentLpLabel,
    sinceLabel,
    peakLabel,
    latestTransitionLabel,
    points: buildRankChartPoints(summary.points, RANK_CHART_WIDTH, RANK_CHART_HEIGHT),
  };
};
