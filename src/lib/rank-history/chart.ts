import { rankOrdinal } from './rank-order';
import type { RankEvolutionPoint } from './evolution';

/** Punto ya proyectado a coordenadas de SVG (0..width, 0..height) — listo para pintar, nunca para leer como dato. */
export interface RankChartPoint {
  x: number;
  y: number;
  observedAt: string;
  tier?: string;
  rank?: string;
  leaguePoints?: number;
}

/**
 * Proyecta el histórico cronológico a puntos de sparkline. Espaciado en X
 * por ÍNDICE, no por tiempo real: con la política de heartbeat de 6h los
 * huecos entre observaciones son irregulares (una sesión larga produce
 * varias seguidas, un fin de semana sin jugar no produce ninguna) — un eje
 * de tiempo real aplastaría casi todos los puntos en un extremo. Un
 * espaciado uniforme es más legible en un sparkline compacto y no finge
 * precisión temporal que el propio muestreo no tiene.
 *
 * Y usa `rankOrdinal` (tier→division→LP aplanado) invertido, nunca el LP
 * crudo — ver su documentación para el porqué (encargo §27).
 */
export const buildRankChartPoints = (
  chronological: readonly RankEvolutionPoint[],
  width: number,
  height: number,
  padding = 6,
): RankChartPoint[] => {
  if (chronological.length === 0) return [];
  const ordinals = chronological.map(rankOrdinal);
  const min = Math.min(...ordinals);
  const max = Math.max(...ordinals);
  const span = max - min;
  const usableWidth = Math.max(0, width - padding * 2);
  const usableHeight = Math.max(0, height - padding * 2);
  return chronological.map((point, index) => {
    const xRatio = chronological.length === 1 ? 0.5 : index / (chronological.length - 1);
    // Rango plano (span === 0, p. ej. un único tier/division/LP repetido en
    // todas las observaciones): línea centrada, ni arriba ni abajo — nunca
    // una división por 0.
    const yRatio = span === 0 ? 0.5 : (ordinals[index]! - min) / span;
    return {
      x: padding + xRatio * usableWidth,
      // Y de SVG crece hacia abajo — invertido para que "más alto" se
      // dibuje arriba, como espera cualquiera que lea un gráfico.
      y: padding + (1 - yRatio) * usableHeight,
      observedAt: point.observedAt,
      tier: point.tier,
      rank: point.rank,
      leaguePoints: point.leaguePoints,
    };
  });
};

/** `d` de un `<path>` de SVG en línea recta entre puntos — sin librería de charting (mismo principio que el Timeline). */
export const buildSparklinePath = (points: readonly RankChartPoint[]): string =>
  points.length === 0
    ? ''
    : points
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
        .join(' ');
