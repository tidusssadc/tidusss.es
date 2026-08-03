import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalDeterministicGenerator } from '../../src/domain/knowledge-generation/local-generator.ts';
import type { GenerationInput } from '../../src/domain/knowledge-generation/types.ts';

const input = (overrides: Partial<GenerationInput> = {}): GenerationInput => ({
  query: 'pregunta',
  deterministicAnswer: 'Respuesta determinista real.',
  status: 'sufficient',
  retrievalConfidence: 0.9,
  coverage: 'full',
  allowedDocumentIds: ['a', 'b'],
  sources: [],
  toneInstructions: 'tono',
  ...overrides,
});

test('createLocalDeterministicGenerator conserva la respuesta determinista sin cambiar ni una palabra', async () => {
  const generator = createLocalDeterministicGenerator();
  const result = await generator.generate(input());
  assert.equal(result.text, 'Respuesta determinista real.');
  assert.equal(result.status, 'generated');
  assert.equal(result.provider, 'local-deterministic');
});

test('createLocalDeterministicGenerator cita exactamente los ids permitidos, sin inventar ninguno', async () => {
  const generator = createLocalDeterministicGenerator();
  const result = await generator.generate(input({ allowedDocumentIds: ['x', 'y', 'z'] }));
  assert.deepEqual(result.usedSourceIds, ['x', 'y', 'z']);
});

test('createLocalDeterministicGenerator no necesita red: funciona de forma síncrona por dentro y determinista', async () => {
  const generator = createLocalDeterministicGenerator();
  const first = await generator.generate(input());
  const second = await generator.generate(input());
  assert.deepEqual(first, second);
});

test('createLocalDeterministicGenerator nunca produce advertencias', async () => {
  const generator = createLocalDeterministicGenerator();
  const result = await generator.generate(input());
  assert.deepEqual(result.warnings, []);
});
