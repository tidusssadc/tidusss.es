import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateAnswer, resolveDisplayText } from '../../src/domain/knowledge-generation/orchestrate.ts';
import { createLocalDeterministicGenerator } from '../../src/domain/knowledge-generation/local-generator.ts';
import {
  createConfidenceInflationFakeGenerator,
  createDropsAllSourcesFakeGenerator,
  createThrowingFakeGenerator,
  createUnknownSourceFakeGenerator,
  createWellBehavedFakeGenerator,
} from '../../src/domain/knowledge-generation/evaluation/fakes.ts';
import type { AnswerResult } from '../../src/domain/knowledge-answering/types.ts';

const answer = (overrides: Partial<AnswerResult> = {}): AnswerResult => ({
  query: 'pregunta',
  status: 'sufficient',
  answer: 'Respuesta determinista real.',
  editorialConfidence: 'medium',
  retrievalConfidence: 0.8,
  coverage: 'full',
  sources: [
    {
      documentId: 'a',
      title: 'Fuente A',
      url: '/campeones/lucian',
      type: 'champion-identity',
      excerpt: 'Contenido real.',
    },
  ],
  relatedLinks: [],
  insufficientInformation: false,
  rejectionReasons: [],
  ...overrides,
});

test('un AnswerResult con status "sufficient" invoca al generador y produce "generated" si todo es válido', async () => {
  const result = await generateAnswer(answer(), createWellBehavedFakeGenerator('Texto reformulado real.'));
  assert.equal(result.status, 'generated');
  assert.equal(result.text, 'Texto reformulado real.');
});

test('un AnswerResult con status "insufficient-information" nunca invoca al generador', async () => {
  const rejected = answer({ status: 'insufficient-information', answer: undefined, sources: [] });
  const generator = createWellBehavedFakeGenerator('Esto nunca debería aparecer.');
  const result = await generateAnswer(rejected, generator);
  assert.equal(result.status, 'not-applicable');
  assert.equal(result.text, undefined);
});

test('un AnswerResult con status "out-of-scope" nunca invoca al generador', async () => {
  const rejected = answer({ status: 'out-of-scope', answer: undefined, sources: [] });
  const result = await generateAnswer(rejected, createWellBehavedFakeGenerator('nunca'));
  assert.equal(result.status, 'not-applicable');
});

test('un generador que lanza una excepción produce fallback al determinista, nunca una excepción sin capturar', async () => {
  const result = await generateAnswer(answer(), createThrowingFakeGenerator());
  assert.equal(result.status, 'fallback');
  assert.equal(result.text, 'Respuesta determinista real.');
});

test('un generador "provider-not-configured" produce ese mismo estado en el resultado final, con el texto determinista disponible', async () => {
  const notConfigured = {
    name: 'fake-not-configured',
    generate: () =>
      Promise.resolve({
        text: undefined,
        usedSourceIds: [],
        warnings: ['sin credenciales'],
        provider: 'claude',
        status: 'provider-not-configured' as const,
      }),
  };
  const result = await generateAnswer(answer(), notConfigured);
  assert.equal(result.status, 'provider-not-configured');
  assert.equal(result.text, 'Respuesta determinista real.');
});

test('un generador que descarta todas las fuentes cae al determinista', async () => {
  const result = await generateAnswer(answer(), createDropsAllSourcesFakeGenerator());
  assert.equal(result.status, 'fallback');
  assert.equal(result.text, 'Respuesta determinista real.');
});

test('un generador que cita una fuente desconocida cae al determinista', async () => {
  const result = await generateAnswer(answer(), createUnknownSourceFakeGenerator());
  assert.equal(result.status, 'fallback');
});

test('un generador que infla la confianza cae al determinista', async () => {
  const result = await generateAnswer(answer({ editorialConfidence: 'medium' }), createConfidenceInflationFakeGenerator());
  assert.equal(result.status, 'fallback');
  assert.equal(result.text, 'Respuesta determinista real.');
});

test('resolveDisplayText nunca deja el texto en undefined cuando existe una respuesta determinista', async () => {
  const result = await generateAnswer(answer(), createThrowingFakeGenerator());
  assert.equal(resolveDisplayText(answer(), result), 'Respuesta determinista real.');
});

test('la web nunca depende exclusivamente de Claude: el generador local, usado solo, siempre produce "generated"', async () => {
  const result = await generateAnswer(answer(), createLocalDeterministicGenerator());
  assert.equal(result.status, 'generated');
  assert.equal(result.text, 'Respuesta determinista real.');
});

test('el orquestador nunca cambia confianza, cobertura, parche ni fecha editorial — no existen en GenerationResult', async () => {
  const result = await generateAnswer(answer(), createWellBehavedFakeGenerator('Texto nuevo.'));
  assert.ok(!('editorialConfidence' in result));
  assert.ok(!('coverage' in result));
  assert.ok(!('patchId' in result));
  assert.ok(!('editorialDate' in result));
});
