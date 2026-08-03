import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateGenerationResult } from '../../src/domain/knowledge-generation/validate.ts';
import type { GenerationInput, GenerationResult } from '../../src/domain/knowledge-generation/types.ts';

const input = (overrides: Partial<GenerationInput> = {}): GenerationInput => ({
  query: 'pregunta',
  deterministicAnswer: 'Respuesta real.',
  status: 'sufficient',
  editorialConfidence: 'medium',
  retrievalConfidence: 0.8,
  coverage: 'full',
  allowedDocumentIds: ['a', 'b'],
  sources: [],
  toneInstructions: 'tono',
  ...overrides,
});

const generated = (overrides: Partial<GenerationResult> = {}): GenerationResult => ({
  text: 'Texto real reformulado.',
  usedSourceIds: ['a', 'b'],
  warnings: [],
  provider: 'test',
  status: 'generated',
  ...overrides,
});

test('un resultado bien formado pasa la validación', () => {
  const validation = validateGenerationResult(generated(), input());
  assert.deepEqual(validation, { valid: true, violations: [] });
});

test('un resultado que no es "generated" se considera válido sin más comprobaciones (nada que validar)', () => {
  const validation = validateGenerationResult(
    { text: undefined, usedSourceIds: [], warnings: [], provider: 'test', status: 'not-applicable' },
    input(),
  );
  assert.equal(validation.valid, true);
});

test('rechaza un resultado que cita un id fuera de la lista permitida', () => {
  const validation = validateGenerationResult(generated({ usedSourceIds: ['a', 'documento-inventado'] }), input());
  assert.equal(validation.valid, false);
  assert.ok(validation.violations.some((v) => v.includes('documento-inventado')));
});

test('rechaza un resultado que descarta todas las fuentes permitidas mientras declara éxito', () => {
  const validation = validateGenerationResult(generated({ usedSourceIds: [] }), input());
  assert.equal(validation.valid, false);
});

test('rechaza un texto vacío', () => {
  const validation = validateGenerationResult(generated({ text: '   ' }), input());
  assert.equal(validation.valid, false);
});

test('rechaza un texto excesivamente largo', () => {
  const validation = validateGenerationResult(generated({ text: 'x'.repeat(5000) }), input());
  assert.equal(validation.valid, false);
});

test('rechaza un texto que contiene una URL o ruta interna', () => {
  const validation = validateGenerationResult(
    generated({ text: 'Visita https://ejemplo.com/algo para más info.' }),
    input(),
  );
  assert.equal(validation.valid, false);
});

test('rechaza un texto que contiene una ruta interna del sitio, aunque no sea una URL completa', () => {
  const validation = validateGenerationResult(
    generated({ text: 'Consulta /campeones/lucian para más detalles.' }),
    input(),
  );
  assert.equal(validation.valid, false);
});

test('rechaza un texto que filtra instrucciones internas del sistema', () => {
  const validation = validateGenerationResult(
    generated({ text: 'Como modelo de lenguaje, sigo estas reglas.' }),
    input(),
  );
  assert.equal(validation.valid, false);
});

test('rechaza un texto que infla la confianza cuando la real no es alta', () => {
  const validation = validateGenerationResult(
    generated({ text: 'Esto tiene confianza muy alta.' }),
    input({ editorialConfidence: 'medium' }),
  );
  assert.equal(validation.valid, false);
});

test('no rechaza una frase de confianza alta cuando la confianza editorial real SÍ es alta', () => {
  const validation = validateGenerationResult(
    generated({ text: 'Esto tiene confianza muy alta y bien fundamentada.' }),
    input({ editorialConfidence: 'high' }),
  );
  assert.equal(validation.valid, true);
});

test('acumula todas las violaciones reales de un resultado roto en varios aspectos', () => {
  const validation = validateGenerationResult(
    generated({ text: '   ', usedSourceIds: ['inventado'] }),
    input(),
  );
  assert.ok(validation.violations.length >= 2);
});
