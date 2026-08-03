import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findDocumentsMissingSourceEntityId,
  findDocumentsWithInvalidLanguageOrSource,
  findDocumentsWithInvalidUrl,
  findDocumentsWithoutRelatedEntities,
  findDuplicateDocumentIds,
  findEmptyContentDocuments,
  findEmptyTitleDocuments,
  validateKnowledgeIndex,
} from '../../src/domain/knowledge-index/invariants.ts';
import type { KnowledgeDocument } from '../../src/domain/knowledge-index/types.ts';

const doc = (overrides: Partial<KnowledgeDocument> = {}): KnowledgeDocument => ({
  id: 'knowledge:champion:test:identity',
  type: 'champion-identity',
  title: 'Título de prueba',
  content: 'Contenido de prueba real y no vacío.',
  url: '/campeones/test',
  source: 'editorial',
  language: 'es',
  sourceEntityId: 'champion:test',
  relatedEntityIds: ['champion:test'],
  ...overrides,
});

test('findDuplicateDocumentIds detecta un id repetido', () => {
  const documents = [doc({ id: 'a' }), doc({ id: 'a' }), doc({ id: 'b' })];
  assert.deepEqual(findDuplicateDocumentIds(documents), ['a']);
});

test('findDuplicateDocumentIds no reporta nada sobre ids únicos', () => {
  assert.deepEqual(findDuplicateDocumentIds([doc({ id: 'a' }), doc({ id: 'b' })]), []);
});

test('findEmptyContentDocuments detecta contenido vacío o solo espacios', () => {
  const documents = [doc({ content: '' }), doc({ content: '   ' }), doc({ content: 'real' })];
  assert.equal(findEmptyContentDocuments(documents).length, 2);
});

test('findEmptyTitleDocuments detecta título vacío', () => {
  assert.equal(findEmptyTitleDocuments([doc({ title: '' })]).length, 1);
  assert.deepEqual(findEmptyTitleDocuments([doc()]), []);
});

test('findDocumentsMissingSourceEntityId detecta sourceEntityId vacío', () => {
  assert.equal(findDocumentsMissingSourceEntityId([doc({ sourceEntityId: '' })]).length, 1);
  assert.deepEqual(findDocumentsMissingSourceEntityId([doc()]), []);
});

test('findDocumentsWithInvalidUrl acepta una ruta relativa real, con o sin ancla', () => {
  assert.deepEqual(findDocumentsWithInvalidUrl([doc({ url: '/campeones/lucian' })]), []);
  assert.deepEqual(
    findDocumentsWithInvalidUrl([doc({ url: '/campeones/lucian#build-heading' })]),
    [],
  );
  assert.deepEqual(findDocumentsWithInvalidUrl([doc({ url: '/tier-list' })]), []);
});

test('findDocumentsWithInvalidUrl rechaza una URL externa o vacía', () => {
  assert.equal(findDocumentsWithInvalidUrl([doc({ url: 'https://otra-web.com/x' })]).length, 1);
  assert.equal(findDocumentsWithInvalidUrl([doc({ url: '' })]).length, 1);
});

test('findDocumentsWithoutRelatedEntities detecta una lista de relacionados vacía', () => {
  assert.equal(findDocumentsWithoutRelatedEntities([doc({ relatedEntityIds: [] })]).length, 1);
  assert.deepEqual(findDocumentsWithoutRelatedEntities([doc()]), []);
});

test('findDocumentsWithInvalidLanguageOrSource detecta un idioma o fuente fuera del vocabulario cerrado', () => {
  const leaked = Object.assign({}, doc(), { language: 'en' }) as unknown as KnowledgeDocument;
  assert.equal(findDocumentsWithInvalidLanguageOrSource([leaked]).length, 1);
});

test('validateKnowledgeIndex agrega todas las violaciones de un índice sintético roto', () => {
  const documents = [doc({ id: 'a' }), doc({ id: 'a', content: '' })];
  const violations = validateKnowledgeIndex(documents);
  assert.ok(violations.some((message) => message.includes('duplicado')));
  assert.ok(violations.some((message) => message.includes('sin contenido')));
});

test('validateKnowledgeIndex no reporta violaciones sobre un índice sintético válido', () => {
  assert.deepEqual(validateKnowledgeIndex([doc({ id: 'a' }), doc({ id: 'b' })]), []);
});
