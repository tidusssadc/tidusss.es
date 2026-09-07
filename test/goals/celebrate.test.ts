import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectNewlyCompletedGoal } from '../../src/domain/goals/celebrate.ts';
import type { ResolvedGoal } from '../../src/domain/goals/types.ts';

const goal = (id: string): ResolvedGoal => ({
  id,
  category: 'youtube-subscribers',
  title: `${id} de prueba`,
  current: 1,
  target: 1,
  unit: 'unidades',
  progress: 100,
  status: 'completed',
  source: 'youtube',
  href: '/comunidad',
});

// --- Nunca celebra en la primera visita ---

test('con knownCompletedIds null (primera visita) no celebra nada, aunque haya hitos ya conseguidos', () => {
  const result = selectNewlyCompletedGoal([goal('a'), goal('b')], null);
  assert.equal(result, undefined);
});

test('con knownCompletedIds null y ningún hito conseguido tampoco celebra nada', () => {
  const result = selectNewlyCompletedGoal([], null);
  assert.equal(result, undefined);
});

// --- Detecta un hito recién conseguido en visitas posteriores ---

test('celebra el hito conseguido que no estaba en el registro conocido', () => {
  const result = selectNewlyCompletedGoal([goal('a'), goal('b')], ['a']);
  assert.equal(result?.id, 'b');
});

test('nunca repite la celebración de un hito ya registrado como conocido', () => {
  const result = selectNewlyCompletedGoal([goal('a')], ['a']);
  assert.equal(result, undefined);
});

test('sin ningún hito conseguido, no hay nada que celebrar', () => {
  const result = selectNewlyCompletedGoal([], ['a']);
  assert.equal(result, undefined);
});

test('con varios hitos nuevos a la vez, celebra solo el primero (uno por carga, nunca varios a la vez)', () => {
  const result = selectNewlyCompletedGoal([goal('a'), goal('b'), goal('c')], []);
  assert.equal(result?.id, 'a');
});

test('es determinista: misma entrada, mismo resultado', () => {
  const first = selectNewlyCompletedGoal([goal('a'), goal('b')], ['a']);
  const second = selectNewlyCompletedGoal([goal('a'), goal('b')], ['a']);
  assert.deepEqual(first, second);
});
