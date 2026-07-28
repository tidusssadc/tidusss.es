import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lucian } from '../../src/data/league-laboratory/champions.ts';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

test('el historial editorial de Lucian existe y tiene fechas ISO válidas', () => {
  assert.ok(lucian.editorialHistory && lucian.editorialHistory.length > 0);
  for (const entry of lucian.editorialHistory ?? []) {
    assert.match(entry.date, ISO_DATE, `fecha inválida: ${entry.date}`);
    assert.ok(
      !Number.isNaN(new Date(`${entry.date}T00:00:00`).getTime()),
      `fecha no parseable: ${entry.date}`,
    );
    assert.ok(
      entry.summary.length > 0,
      'una entrada de historial no puede estar vacía',
    );
  }
});

test('el historial editorial de Lucian está en orden cronológico ascendente en los datos de origen', () => {
  const dates = (lucian.editorialHistory ?? []).map((entry) => entry.date);
  const sorted = [...dates].sort();
  assert.deepEqual(
    dates,
    sorted,
    'las entradas deberían escribirse en orden cronológico en champions.ts, aunque la UI las muestre en orden inverso',
  );
});
