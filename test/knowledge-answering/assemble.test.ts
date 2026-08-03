import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assembleAnswer } from '../../src/domain/knowledge-answering/assemble.ts';
import type { KnowledgeDocument } from '../../src/domain/knowledge-index/types.ts';
import type { RetrievalResult, RetrievedDocument } from '../../src/domain/knowledge-retrieval/types.ts';

const doc = (overrides: Partial<KnowledgeDocument> = {}): KnowledgeDocument => ({
  id: 'knowledge:champion:lucian:identity',
  type: 'champion-identity',
  title: 'Identidad de Lucian',
  content: 'Contenido real de prueba.',
  url: '/campeones/lucian',
  source: 'editorial',
  language: 'es',
  sourceEntityId: 'champion:lucian',
  relatedEntityIds: ['champion:lucian'],
  ...overrides,
});

const retrieved = (document: KnowledgeDocument, score = 0.5): RetrievedDocument => ({
  document,
  score,
  reasons: ['content-term-match'],
});

const retrievalResult = (
  documents: readonly RetrievedDocument[],
  overrides: Partial<RetrievalResult> = {},
): RetrievalResult => ({
  query: 'pregunta de prueba',
  documents,
  coverage: 'partial',
  retrievalConfidence: documents[0]?.score ?? 0,
  insufficientInformation: documents.length === 0,
  filtersApplied: {},
  ...overrides,
});

// --- Estados obligatorios ---

test('coverage "full" produce status "sufficient"', () => {
  const answer = assembleAnswer(retrievalResult([retrieved(doc())], { coverage: 'full' }));
  assert.equal(answer.status, 'sufficient');
  assert.equal(answer.insufficientInformation, false);
});

test('coverage "partial" produce status "partial"', () => {
  const answer = assembleAnswer(retrievalResult([retrieved(doc())], { coverage: 'partial' }));
  assert.equal(answer.status, 'partial');
});

test('insufficientInformation con un campeón real reconocido produce status "insufficient-information", nunca "out-of-scope"', () => {
  const answer = assembleAnswer(
    retrievalResult([], {
      coverage: 'none',
      insufficientInformation: true,
      filtersApplied: { championId: 'champion:draven' },
    }),
  );
  assert.equal(answer.status, 'insufficient-information');
  assert.ok(answer.rejectionReasons[0]?.includes('Draven'));
  assert.equal(answer.sources.length, 0);
  assert.equal(answer.answer, undefined);
});

test('insufficientInformation sin ningún filtro reconocido produce status "out-of-scope"', () => {
  const answer = assembleAnswer(
    retrievalResult([], { coverage: 'none', insufficientInformation: true, filtersApplied: {} }),
  );
  assert.equal(answer.status, 'out-of-scope');
  assert.equal(answer.sources.length, 0);
});

test('una pregunta vacía produce status "empty-question", incluso si el proveedor devolviera algo', () => {
  const answer = assembleAnswer(
    retrievalResult([retrieved(doc())], { query: '', coverage: 'full', insufficientInformation: false }),
  );
  assert.equal(answer.status, 'empty-question');
  assert.equal(answer.sources.length, 0);
});

test('un error interno inesperado produce status "internal-error", nunca una excepción sin capturar', () => {
  const malformed = { query: 'algo', insufficientInformation: false, documents: null } as unknown as RetrievalResult;
  const answer = assembleAnswer(malformed);
  assert.equal(answer.status, 'internal-error');
  assert.equal(answer.sources.length, 0);
  assert.equal(answer.rejectionReasons.length, 1);
});

// --- Ensamblaje (Fase 3) ---

test('un build-item y su build-editorial-take (misma sourceEntityId) se combinan en el texto', () => {
  const item = doc({
    id: 'knowledge:build:test:item:core:0',
    type: 'build-item',
    title: 'Objeto de prueba',
    content: 'Razón real del objeto.',
    sourceEntityId: 'build:test',
    patchId: 'patch:26-14',
    confidence: 'high',
  });
  const take = doc({
    id: 'knowledge:build:test:editorial-take',
    type: 'build-editorial-take',
    title: 'Veredicto de la build de prueba',
    content: 'Veredicto real de la build.',
    sourceEntityId: 'build:test',
    patchId: 'patch:26-14',
    confidence: 'high',
  });
  const answer = assembleAnswer(
    retrievalResult([retrieved(item, 0.9), retrieved(take, 0.5)], { coverage: 'full' }),
  );
  assert.match(answer.answer ?? '', /Razón real del objeto\./);
  assert.match(answer.answer ?? '', /Veredicto real de la build\./);
  assert.deepEqual(
    answer.sources.map((s) => s.documentId),
    ['knowledge:build:test:item:core:0', 'knowledge:build:test:editorial-take'],
  );
});

test('documentos con parches distintos nunca se funden en el mismo texto de respuesta', () => {
  const currentPatch = doc({
    id: 'knowledge:champion:lucian:common-mistake:0',
    type: 'champion-common-mistake',
    content: 'Error real del parche actual.',
    patchId: 'patch:26-14',
  });
  const otherPatch = doc({
    id: 'knowledge:champion:lucian:common-mistake:1',
    type: 'champion-common-mistake',
    content: 'Error real de un parche distinto.',
    patchId: 'patch:15-14',
  });
  const answer = assembleAnswer(
    retrievalResult([retrieved(currentPatch, 0.5), retrieved(otherPatch, 0.5)], { coverage: 'full' }),
  );
  assert.ok(!answer.answer?.includes('parche distinto'));
  assert.ok(!answer.sources.some((s) => s.documentId === otherPatch.id));
});

test('un documento sin patchId propio nunca se excluye por "conflicto" de parche', () => {
  const patched = doc({
    id: 'knowledge:champion:lucian:common-mistake:0',
    type: 'champion-common-mistake',
    content: 'Error real con parche.',
    patchId: 'patch:26-14',
  });
  const unpatched = doc({
    id: 'knowledge:champion:lucian:identity',
    type: 'champion-identity',
    content: 'Identidad real sin parche propio.',
  });
  const answer = assembleAnswer(
    retrievalResult([retrieved(patched, 0.5), retrieved(unpatched, 0.5)], { coverage: 'full' }),
  );
  assert.ok(answer.sources.some((s) => s.documentId === unpatched.id));
});

test('todos los documentos empatados con el mejor puntuado se funden en el texto, hasta el límite', () => {
  const tied = ['a', 'b', 'c', 'd'].map((suffix) =>
    doc({
      id: `knowledge:champion:lucian:common-mistake:${suffix}`,
      type: 'champion-common-mistake',
      content: `Error real ${suffix}.`,
    }),
  );
  const answer = assembleAnswer(
    retrievalResult(
      tied.map((d) => retrieved(d, 0.3)),
      { coverage: 'full' },
    ),
  );
  const mergedCount = tied.filter((d) => answer.answer?.includes(d.content)).length;
  assert.equal(mergedCount, 3, 'debe fundir hasta 3 documentos empatados, nunca más ni menos');
});

test('nunca rellena el texto con un documento de menor puntuación cuando no hay empate real', () => {
  const best = doc({ id: 'a', content: 'Mejor puntuado.' });
  const worse = doc({ id: 'b', content: 'Peor puntuado.' });
  const answer = assembleAnswer(
    retrievalResult([retrieved(best, 0.9), retrieved(worse, 0.3)], { coverage: 'full' }),
  );
  assert.equal(answer.answer, 'Mejor puntuado.');
});

// --- Confianza (nunca inventada, nunca mezclada con la de recuperación) ---

test('la confianza editorial es el mínimo entre los documentos fundidos en el texto', () => {
  const high = doc({ id: 'a', content: 'Alto.', confidence: 'high' });
  const low = doc({
    id: 'knowledge:build:test:editorial-take',
    type: 'build-editorial-take',
    content: 'Bajo.',
    confidence: 'low',
    sourceEntityId: 'build:test',
  });
  const item = doc({
    id: 'knowledge:build:test:item:core:0',
    type: 'build-item',
    content: 'Alto.',
    confidence: 'high',
    sourceEntityId: 'build:test',
  });
  const answer = assembleAnswer(retrievalResult([retrieved(item, 0.9), retrieved(low, 0.5)], { coverage: 'full' }));
  assert.equal(answer.editorialConfidence, 'low');
  void high;
});

test('la confianza editorial es undefined cuando ningún documento fundido declara confianza (p. ej. un concepto)', () => {
  const concept = doc({ id: 'knowledge:concept:test:summary', type: 'concept', content: 'Definición real.' });
  const answer = assembleAnswer(retrievalResult([retrieved(concept, 0.5)], { coverage: 'full' }));
  assert.equal(answer.editorialConfidence, undefined);
});

test('la confianza de recuperación nunca se filtra a la confianza editorial ni viceversa', () => {
  const highConfidenceLowScore = doc({ id: 'a', content: 'Contenido.', confidence: 'high' });
  const answer = assembleAnswer(
    retrievalResult([retrieved(highConfidenceLowScore, 0.13)], { coverage: 'partial', retrievalConfidence: 0.13 }),
  );
  assert.equal(answer.editorialConfidence, 'high');
  assert.equal(answer.retrievalConfidence, 0.13);
});

// --- Fuentes y fecha editorial ---

test('editorialDate es la fecha más reciente entre TODAS las fuentes citadas, no solo las fundidas en el texto', () => {
  const older = doc({ id: 'a', content: 'Antiguo.', date: '2026-01-01' });
  const newer = doc({ id: 'b', content: 'Reciente.', date: '2026-07-26' });
  const answer = assembleAnswer(
    retrievalResult([retrieved(older, 0.9), retrieved(newer, 0.5)], { coverage: 'full' }),
  );
  assert.equal(answer.editorialDate, '2026-07-26');
});

test('un compañero de razonamiento fundido en el texto SIEMPRE aparece entre las fuentes, aunque puntúe más bajo que otros candidatos (regresión real, ver evaluación con el proveedor de espacio vectorial)', () => {
  const item = doc({
    id: 'knowledge:build:test:item:core:0',
    type: 'build-item',
    content: 'Razón del objeto.',
    sourceEntityId: 'build:test',
  });
  const companion = doc({
    id: 'knowledge:build:test:editorial-take',
    type: 'build-editorial-take',
    content: 'Veredicto de la build.',
    sourceEntityId: 'build:test',
  });
  // Cinco candidatos con puntuación más alta que el compañero, para forzarlo fuera de un top-5 ingenuo.
  const fillers = Array.from({ length: 5 }, (_, index) =>
    doc({ id: `filler-${index}`, content: `Relleno ${index}.` }),
  );
  const documents = [
    retrieved(item, 0.9),
    ...fillers.map((filler) => retrieved(filler, 0.8)),
    retrieved(companion, 0.1),
  ];
  const answer = assembleAnswer(retrievalResult(documents, { coverage: 'full' }));
  assert.match(answer.answer ?? '', /Veredicto de la build\./);
  assert.ok(answer.sources.some((s) => s.documentId === companion.id));
});

test('ninguna fuente citada aparece si no fue recuperada, y nunca hay duplicados', () => {
  const a = doc({ id: 'a', content: 'A.' });
  const answer = assembleAnswer(retrievalResult([retrieved(a, 0.9)], { coverage: 'full' }));
  assert.deepEqual(
    answer.sources.map((s) => s.documentId),
    ['a'],
  );
  assert.equal(new Set(answer.sources.map((s) => s.documentId)).size, answer.sources.length);
});

// --- Relacionados (Fase 5) ---

test('relatedLinks nunca incluye un id que no resuelva a una entidad real y navegable del Content Graph', () => {
  const unknown = doc({ id: 'a', sourceEntityId: 'champion:no-existe-jamas', relatedEntityIds: ['concept:no-existe-jamas'] });
  const answer = assembleAnswer(retrievalResult([retrieved(unknown, 0.9)], { coverage: 'full' }));
  assert.deepEqual(answer.relatedLinks, []);
});

test('relatedLinks resuelve entidades reales del Content Graph cuando la fuente es un campeón curado real', () => {
  const lucianDoc = doc({ id: 'knowledge:champion:lucian:identity', sourceEntityId: 'champion:lucian' });
  const answer = assembleAnswer(retrievalResult([retrieved(lucianDoc, 0.9)], { coverage: 'full' }));
  assert.ok(answer.relatedLinks.length > 0);
  for (const link of answer.relatedLinks) {
    assert.ok(link.href.length > 0);
    assert.ok(link.title.length > 0);
  }
});
