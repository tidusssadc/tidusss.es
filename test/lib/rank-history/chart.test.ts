import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRankChartPoints, buildSparklinePath } from '../../../src/lib/rank-history/chart.ts';
import type { RankEvolutionPoint } from '../../../src/lib/rank-history/evolution.ts';

const point = (
  tier: string,
  rank: string | undefined,
  leaguePoints: number,
  observedAt: string,
): RankEvolutionPoint => ({ tier, rank, leaguePoints, observedAt });

test('buildRankChartPoints: lista vacía devuelve [], nunca un punto inventado', () => {
  assert.deepEqual(buildRankChartPoints([], 280, 64), []);
});

test('buildRankChartPoints: un único punto se centra (x e y a mitad de rango)', () => {
  const points = buildRankChartPoints([point('GOLD', 'II', 40, '2026-09-01')], 280, 64, 6);
  assert.equal(points.length, 1);
  assert.equal(points[0]!.x, 6 + (280 - 12) / 2);
  assert.equal(points[0]!.y, 6 + (64 - 12) / 2);
});

test('buildRankChartPoints: todos los puntos dentro de los límites del viewBox (con padding)', () => {
  const width = 280;
  const height = 64;
  const padding = 6;
  const chronological = [
    point('GOLD', 'IV', 0, '2026-08-01'),
    point('GOLD', 'II', 50, '2026-08-10'),
    point('PLATINUM', 'IV', 0, '2026-08-20'),
    point('DIAMOND', 'I', 95, '2026-09-01'),
  ];
  const points = buildRankChartPoints(chronological, width, height, padding);
  for (const p of points) {
    assert.ok(p.x >= padding - 0.01 && p.x <= width - padding + 0.01);
    assert.ok(p.y >= padding - 0.01 && p.y <= height - padding + 0.01);
  }
});

test('buildRankChartPoints: una subida real de rango se dibuja hacia ARRIBA (Y menor) en coordenadas SVG', () => {
  const chronological = [point('GOLD', 'IV', 0, '2026-08-01'), point('DIAMOND', 'I', 95, '2026-09-01')];
  const points = buildRankChartPoints(chronological, 280, 64, 6);
  assert.ok(points[1]!.y < points[0]!.y);
});

test('buildRankChartPoints: rango plano (mismo tier/division/LP siempre) centra la línea, sin dividir por cero', () => {
  const chronological = [
    point('GOLD', 'II', 40, '2026-08-01'),
    point('GOLD', 'II', 40, '2026-08-15'),
    point('GOLD', 'II', 40, '2026-09-01'),
  ];
  const points = buildRankChartPoints(chronological, 280, 64, 6);
  const centerY = 6 + (64 - 12) / 2;
  for (const p of points) assert.equal(p.y, centerY);
});

test('buildRankChartPoints: el orden X sigue el orden cronológico (más antiguo a la izquierda)', () => {
  const chronological = [point('GOLD', 'IV', 0, '2026-08-01'), point('GOLD', 'III', 0, '2026-08-15'), point('GOLD', 'II', 0, '2026-09-01')];
  const points = buildRankChartPoints(chronological, 280, 64, 6);
  assert.ok(points[0]!.x < points[1]!.x);
  assert.ok(points[1]!.x < points[2]!.x);
});

// --- buildSparklinePath ---

test('buildSparklinePath: sin puntos, path vacío', () => {
  assert.equal(buildSparklinePath([]), '');
});

test('buildSparklinePath: empieza con M y sigue con L por cada punto adicional', () => {
  const points = buildRankChartPoints(
    [point('GOLD', 'IV', 0, '2026-08-01'), point('GOLD', 'II', 0, '2026-08-15'), point('PLATINUM', 'IV', 0, '2026-09-01')],
    280,
    64,
    6,
  );
  const path = buildSparklinePath(points);
  assert.ok(path.startsWith('M '));
  assert.equal(path.split(' L ').length, 3);
});
