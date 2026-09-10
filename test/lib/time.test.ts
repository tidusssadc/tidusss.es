import { test } from 'node:test';
import assert from 'node:assert/strict';
import { madridDate } from '../../src/lib/time.ts';

/**
 * Solo `madridDate` — el resto de `lib/time.ts` es preexistente y fuera del
 * alcance de esta sesión (Night Shift 2026-09-09, encargo: cambios de
 * sesión acotados a lo que realmente se toca).
 */

test('madridDate: sin valor devuelve undefined, nunca una fecha inventada', () => {
  assert.equal(madridDate(undefined), undefined);
});

test('madridDate: valor inválido devuelve undefined', () => {
  assert.equal(madridDate('no-es-una-fecha'), undefined);
});

test('madridDate: formatea día, mes abreviado y año en español', () => {
  const formatted = madridDate('2026-09-09T10:00:00.000Z');
  assert.match(formatted ?? '', /^9 sept\.? 2026$/);
});
