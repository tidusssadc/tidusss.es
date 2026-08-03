import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findAnswersMixingPatches,
  findAnswersWithDuplicateSources,
  findAnswersWithInconsistentShape,
  findAnswersWithInvalidRelatedLinks,
  findAnswersWithUnsupportedText,
  validateAnswers,
} from '../../src/domain/knowledge-answering/invariants.ts';
import type { AnswerResult } from '../../src/domain/knowledge-answering/types.ts';

const source = (overrides: Partial<AnswerResult['sources'][number]> = {}): AnswerResult['sources'][number] => ({
  documentId: 'a',
  title: 'Título',
  url: '/campeones/lucian',
  type: 'champion-identity',
  excerpt: 'Contenido real.',
  ...overrides,
});

const answer = (overrides: Partial<AnswerResult> = {}): AnswerResult => ({
  query: 'pregunta',
  status: 'sufficient',
  answer: 'Contenido real.',
  retrievalConfidence: 0.9,
  coverage: 'full',
  sources: [source()],
  relatedLinks: [],
  insufficientInformation: false,
  rejectionReasons: [],
  ...overrides,
});

test('findAnswersWithInconsistentShape detecta una respuesta "sufficient" sin fuentes', () => {
  const broken = answer({ sources: [] });
  assert.deepEqual(findAnswersWithInconsistentShape([broken]), [broken]);
});

test('findAnswersWithInconsistentShape detecta un rechazo con texto de respuesta presente', () => {
  const broken = answer({
    status: 'out-of-scope',
    sources: [],
    insufficientInformation: true,
    rejectionReasons: ['motivo'],
  });
  assert.deepEqual(findAnswersWithInconsistentShape([broken]), [broken]);
});

test('findAnswersWithInconsistentShape no reporta nada sobre una respuesta bien formada', () => {
  assert.deepEqual(findAnswersWithInconsistentShape([answer()]), []);
});

test('findAnswersWithUnsupportedText detecta una frase que no existe en ninguna fuente citada', () => {
  const broken = answer({ answer: 'Esta frase no está respaldada por ninguna fuente real.' });
  assert.deepEqual(findAnswersWithUnsupportedText([broken]), [broken]);
});

test('findAnswersWithUnsupportedText no reporta nada cuando el texto es verbatim de las fuentes', () => {
  const valid = answer({
    answer: 'Contenido real.',
    sources: [source({ excerpt: 'Contenido real.' })],
  });
  assert.deepEqual(findAnswersWithUnsupportedText([valid]), []);
});

test('findAnswersWithDuplicateSources detecta un documento citado dos veces', () => {
  const broken = answer({ sources: [source({ documentId: 'a' }), source({ documentId: 'a' })] });
  assert.deepEqual(findAnswersWithDuplicateSources([broken]), [broken]);
});

test('findAnswersMixingPatches detecta una fuente con un patchId distinto al de la respuesta', () => {
  const broken = answer({
    patchId: 'patch:26-14',
    sources: [source({ patchId: 'patch:15-14' })],
  });
  assert.deepEqual(findAnswersMixingPatches([broken]), [broken]);
});

test('findAnswersMixingPatches no reporta nada cuando una fuente no declara parche propio', () => {
  const valid = answer({ patchId: 'patch:26-14', sources: [source({ patchId: undefined })] });
  assert.deepEqual(findAnswersMixingPatches([valid]), []);
});

test('findAnswersWithInvalidRelatedLinks detecta un enlace sin href', () => {
  const broken = answer({ relatedLinks: [{ id: 'x', title: 'X', href: '', kind: 'champion' }] });
  assert.deepEqual(findAnswersWithInvalidRelatedLinks([broken]), [broken]);
});

test('validateAnswers agrega todas las violaciones de un conjunto sintético roto', () => {
  const broken = answer({ sources: [] });
  const violations = validateAnswers([broken]);
  assert.ok(violations.some((v) => v.includes('inconsistente')));
});

test('validateAnswers no reporta violaciones sobre una respuesta sintética válida', () => {
  assert.deepEqual(validateAnswers([answer()]), []);
});
