import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leagueLaboratoryConcepts } from '../../src/data/league-laboratory/concepts.ts';
import { lucian } from '../../src/data/league-laboratory/champions.ts';

test('todos los ids de concepto son únicos', () => {
  const ids = leagueLaboratoryConcepts.map((concept) => concept.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('ningún concepto tiene título o resumen vacío', () => {
  for (const concept of leagueLaboratoryConcepts) {
    assert.ok(concept.title.length > 0, `título vacío en ${concept.id}`);
    assert.ok(concept.summary.length > 0, `resumen vacío en ${concept.id}`);
    assert.ok(concept.category.length > 0, `categoría vacía en ${concept.id}`);
  }
});

test('los 6 conceptos requeridos por el encargo existen', () => {
  const ids = new Set<string>(
    leagueLaboratoryConcepts.map((concept) => concept.id),
  );
  for (const expected of [
    'concept:spacing',
    'concept:power-spike',
    'concept:snowball',
    'concept:trading',
    'concept:tempo',
    'concept:wave-management',
  ]) {
    assert.ok(ids.has(expected), `falta ${expected}`);
  }
});

test('cada concepto que Lucian enlaza directamente (coreConceptIds) existe de verdad en el catálogo de conceptos', () => {
  const ids = new Set(leagueLaboratoryConcepts.map((concept) => concept.id));
  assert.ok(lucian.coreConceptIds && lucian.coreConceptIds.length > 0);
  for (const id of lucian.coreConceptIds ?? []) {
    assert.ok(ids.has(id), `Lucian enlaza a un concepto inexistente: ${id}`);
  }
});
