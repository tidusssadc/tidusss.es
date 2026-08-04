import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampProgress, primaryFromChain, resolveChain, selectPrimaryGoal } from '../../src/domain/goals/resolve.ts';
import {
  COMPETITIVE_LP_CHAIN,
  YOUTUBE_SUBSCRIBER_CHAIN,
  YOUTUBE_VIDEO_CHAIN,
  buildEditorialChampionsChain,
  buildEditorialConceptsChain,
  buildEditorialMatchupsChain,
} from '../../src/domain/goals/chains.ts';
import type { GoalChainDefinition } from '../../src/domain/goals/types.ts';

const chain = (targets: readonly number[], overrides: Partial<GoalChainDefinition> = {}): GoalChainDefinition => ({
  category: 'youtube-subscribers',
  title: 'Cadena de prueba',
  source: 'youtube',
  href: '/comunidad',
  milestones: targets.map((target, index) => ({
    id: `test-${target}`,
    category: 'youtube-subscribers',
    title: `${target} de prueba`,
    target,
    unit: 'unidades',
    source: 'youtube',
    href: '/comunidad',
    order: index,
  })),
  ...overrides,
});

// --- Detección automática de objetivo completado ---

test('un valor por debajo del primer hito deja ese hito como activo, no completado', () => {
  const [first] = resolveChain(chain([3500, 4000]), 3400);
  assert.equal(first?.status, 'active');
});

test('un valor que alcanza exactamente el target marca ese hito como completado', () => {
  const [first] = resolveChain(chain([3500, 4000]), 3500);
  assert.equal(first?.status, 'completed');
});

test('un valor que supera el primer hito lo marca completado y activa el siguiente', () => {
  const [first, second] = resolveChain(chain([3500, 4000]), 3600);
  assert.equal(first?.status, 'completed');
  assert.equal(second?.status, 'active');
});

// --- Valores superiores a varias metas ---

test('un valor que supera varios hitos a la vez los marca todos como completados', () => {
  const resolved = resolveChain(chain([3500, 4000, 5000, 7500, 10000]), 5100);
  const statuses = resolved.map((entry) => entry.status);
  assert.deepEqual(statuses, ['completed', 'completed', 'completed', 'active', 'upcoming']);
});

test('un valor que supera incluso el último hito de la cadena no deja ningún hito activo', () => {
  const resolved = resolveChain(chain([500, 600]), 750);
  assert.ok(resolved.every((entry) => entry.status === 'completed'));
});

// --- Selección del siguiente objetivo ---

test('el hito activo expone el siguiente hito real de la cadena', () => {
  const [first] = resolveChain(chain([3500, 4000, 5000]), 3400);
  assert.equal(first?.nextMilestone?.target, 4000);
});

test('ausencia de siguiente objetivo: el último hito activo no tiene nextMilestone', () => {
  const resolved = resolveChain(chain([500, 600]), 550);
  const active = resolved.find((entry) => entry.status === 'active');
  assert.equal(active?.id, 'test-600');
  assert.equal(active?.nextMilestone, undefined);
});

// --- Datos temporalmente ausentes / caída de API ---

test('sin valor real (API caída), toda la cadena queda en estado "sin datos" — nunca en 0 inventado', () => {
  const resolved = resolveChain(chain([3500, 4000]), undefined);
  assert.ok(resolved.every((entry) => entry.status === 'no-data'));
  assert.ok(resolved.every((entry) => entry.current === undefined));
  assert.ok(resolved.every((entry) => entry.progress === undefined));
});

// --- Progreso > 100% ---

test('clampProgress nunca supera 100 aunque el valor real duplique el target', () => {
  assert.equal(clampProgress(1000, 500), 100);
});

test('clampProgress nunca baja de 0', () => {
  assert.equal(clampProgress(-5, 500), 0);
});

// --- Objetivos pausados ---

test('un hito marcado como pausado nunca calcula progreso ni compite por ser el activo', () => {
  const paused = chain([800], { category: 'competitive-lp' });
  const withPause = {
    ...paused,
    milestones: paused.milestones.map((m) => ({ ...m, paused: true })),
  };
  const [resolved] = resolveChain(withPause, 900);
  assert.equal(resolved?.status, 'paused');
  assert.equal(resolved?.progress, undefined);
});

// --- primaryFromChain ---

test('primaryFromChain devuelve el hito activo cuando existe', () => {
  const resolved = resolveChain(chain([3500, 4000]), 3400);
  assert.equal(primaryFromChain(resolved)?.status, 'active');
});

test('primaryFromChain devuelve el último hito completado cuando toda la cadena ya se ha superado', () => {
  const resolved = resolveChain(chain([500, 600]), 750);
  const primary = primaryFromChain(resolved);
  assert.equal(primary?.status, 'completed');
  assert.equal(primary?.target, 600);
});

// --- Metas encadenadas (nunca retrocede) ---

test('una cadena completa mantiene cada hito alcanzado como completado, en orden', () => {
  const resolved = resolveChain(chain([2, 5]), 5);
  assert.deepEqual(resolved.map((entry) => entry.status), ['completed', 'completed']);
});

// --- Selección determinista del objetivo principal ---

test('selectPrimaryGoal elige el objetivo activo con mayor progreso ponderado por categoría', () => {
  const lp = resolveChain(COMPETITIVE_LP_CHAIN, 780); // cerca del primer hito (800), categoría con más peso
  const videos = resolveChain(YOUTUBE_VIDEO_CHAIN, 455); // 91% de progreso, pero categoría con menos peso
  const primary = selectPrimaryGoal([...lp, ...videos]);
  assert.equal(primary?.category, 'competitive-lp');
});

test('selectPrimaryGoal respeta una prioridad editorial explícita por encima del cálculo automático', () => {
  const videos = resolveChain(YOUTUBE_VIDEO_CHAIN, 455).map((entry) =>
    entry.status === 'active' ? { ...entry, editorialPriority: 100 } : entry,
  );
  const subs = resolveChain(YOUTUBE_SUBSCRIBER_CHAIN, 3499);
  const primary = selectPrimaryGoal([...videos, ...subs]);
  assert.equal(primary?.category, 'youtube-videos');
});

test('selectPrimaryGoal es determinista: mismo conjunto de entrada, mismo resultado siempre', () => {
  const goals = [
    ...resolveChain(YOUTUBE_SUBSCRIBER_CHAIN, 3400),
    ...resolveChain(YOUTUBE_VIDEO_CHAIN, 455),
    ...resolveChain(COMPETITIVE_LP_CHAIN, 757),
  ];
  const first = selectPrimaryGoal(goals);
  const second = selectPrimaryGoal(goals);
  assert.equal(first?.id, second?.id);
});

test('selectPrimaryGoal devuelve undefined cuando ningún objetivo está activo', () => {
  const allCompleted = resolveChain(chain([500, 600]), 750);
  assert.equal(selectPrimaryGoal(allCompleted), undefined);
});

// --- No mostrar datos inventados ---

test('ningún hito resuelto inventa un current cuando la fuente no ha respondido', () => {
  const resolved = resolveChain(YOUTUBE_SUBSCRIBER_CHAIN, undefined);
  for (const entry of resolved) {
    assert.equal(entry.current, undefined);
  }
});

// --- No mostrar lenguaje interno de desarrollo ---

const BANNED_TERMS = [
  'fase de producto',
  'ecosistema conectado',
  'implementación',
  'arquitectura',
  'content graph',
  'knowledge index',
];

test('ningún título o descripción de las cadenas reales usa lenguaje interno de desarrollo', () => {
  const chains = [
    YOUTUBE_SUBSCRIBER_CHAIN,
    YOUTUBE_VIDEO_CHAIN,
    COMPETITIVE_LP_CHAIN,
    buildEditorialChampionsChain(),
    buildEditorialConceptsChain(),
    buildEditorialMatchupsChain(),
  ];
  for (const definition of chains) {
    for (const entry of definition.milestones) {
      const text = `${entry.title} ${entry.description ?? ''}`.toLowerCase();
      for (const banned of BANNED_TERMS) {
        assert.ok(!text.includes(banned), `"${banned}" aparece en "${entry.title}"`);
      }
    }
  }
});

// --- Cadenas reales: sin Grandmaster (no medible con datos reales) ---

test('la cadena de LP competitivo no incluye Grandmaster — no hay dato real de máximo histórico', () => {
  const titles = COMPETITIVE_LP_CHAIN.milestones.map((entry) => entry.title.toLowerCase());
  assert.ok(!titles.some((title) => title.includes('grandmaster')));
});
