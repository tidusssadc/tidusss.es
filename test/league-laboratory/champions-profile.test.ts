import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lucian } from '../../src/data/league-laboratory/champions.ts';

test('Lucian tiene consejos rápidos reales, no una lista vacía', () => {
  assert.ok(lucian.profile?.quickTips && lucian.profile.quickTips.length > 0);
  for (const tip of lucian.profile?.quickTips ?? []) {
    assert.ok(tip.length > 0);
  }
});

test('los errores frecuentes de Lucian no tienen entradas duplicadas', () => {
  const mistakes = lucian.profile?.commonMistakes ?? [];
  assert.equal(new Set(mistakes).size, mistakes.length);
});

test('las fortalezas y debilidades de Lucian mencionan la curva de escalado (temprano/medio fuerte, late más débil)', () => {
  const strengths = lucian.profile?.strengths.join(' ') ?? '';
  const weaknesses = lucian.profile?.weaknesses.join(' ') ?? '';
  assert.match(strengths, /temprana y media/);
  assert.match(weaknesses, /late/);
});
