import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGenerationLogEntry } from '../../src/domain/knowledge-generation/logging.ts';
import type { GenerationResult } from '../../src/domain/knowledge-generation/types.ts';

const generated = (overrides: Partial<GenerationResult> = {}): GenerationResult => ({
  text: 'Texto real con contenido sensible que nunca debería registrarse.',
  usedSourceIds: ['a'],
  warnings: [],
  provider: 'claude',
  status: 'generated',
  ...overrides,
});

test('un resultado exitoso produce un log con outcome "success"', () => {
  const entry = buildGenerationLogEntry(generated(), 3, 250);
  assert.equal(entry.outcome, 'success');
  assert.equal(entry.provider, 'claude');
  assert.equal(entry.durationMs, 250);
  assert.equal(entry.documentCount, 3);
});

test('el log nunca contiene el texto completo de la respuesta', () => {
  const entry = buildGenerationLogEntry(generated(), 3, 250);
  assert.ok(!JSON.stringify(entry).includes('contenido sensible'));
});

test('un fallback por fuente desconocida produce un código de error clasificado, sin exponer el texto original', () => {
  const entry = buildGenerationLogEntry(
    {
      text: 'Respuesta determinista real.',
      usedSourceIds: [],
      warnings: ['Cita fuentes fuera de la lista permitida: knowledge:x'],
      provider: 'local-deterministic',
      status: 'fallback',
    },
    2,
    10,
  );
  assert.equal(entry.outcome, 'fallback');
  assert.equal(entry.errorCode, 'UNKNOWN_SOURCE_ID');
  assert.ok(!JSON.stringify(entry).includes('knowledge:x'));
});

test('un proveedor no configurado produce el outcome correcto y el código correspondiente', () => {
  const entry = buildGenerationLogEntry(
    {
      text: undefined,
      usedSourceIds: [],
      warnings: ['Claude no está configurado: falta CLAUDE_API_KEY.'],
      provider: 'claude',
      status: 'provider-not-configured',
    },
    1,
    2,
  );
  assert.equal(entry.outcome, 'provider-not-configured');
  assert.equal(entry.errorCode, 'PROVIDER_NOT_CONFIGURED');
});

test('un estado "not-applicable" no lleva código de error (no fue un fallo, fue una decisión correcta)', () => {
  const entry = buildGenerationLogEntry(
    { text: undefined, usedSourceIds: [], warnings: [], provider: 'none', status: 'not-applicable' },
    0,
    1,
  );
  assert.equal(entry.outcome, 'not-applicable');
  assert.equal(entry.errorCode, undefined);
});

test('el log nunca incluye una clave, cabecera o dato sensible: su forma solo tiene los 6 campos permitidos', () => {
  const entry = buildGenerationLogEntry(generated(), 3, 250);
  assert.deepEqual(Object.keys(entry).sort(), [
    'documentCount',
    'durationMs',
    'errorCode',
    'outcome',
    'provider',
    'status',
  ]);
});
