import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVectorSpaceProvider } from '../../src/domain/knowledge-retrieval/vector-space-provider.ts';
import type { KnowledgeDocument } from '../../src/domain/knowledge-index/types.ts';

const doc = (overrides: Partial<KnowledgeDocument> = {}): KnowledgeDocument => ({
  id: 'knowledge:champion:lucian:identity',
  type: 'champion-identity',
  title: 'Identidad de Lucian',
  content: 'Contenido real de prueba sobre Lucian.',
  url: '/campeones/lucian',
  source: 'editorial',
  language: 'es',
  sourceEntityId: 'champion:lucian',
  relatedEntityIds: ['champion:lucian'],
  ...overrides,
});

test('createVectorSpaceProvider es determinista', () => {
  const corpus = [doc({ id: 'a' }), doc({ id: 'b', content: 'Otro contenido distinto sobre combos.' })];
  const provider = createVectorSpaceProvider(corpus);
  const first = provider.retrieve({ text: 'combos de Lucian' });
  const second = provider.retrieve({ text: 'combos de Lucian' });
  assert.deepEqual(first, second);
});

test('el orden de los resultados no depende del orden del corpus de entrada', () => {
  const corpus = [
    doc({ id: 'a', title: 'Runas de Lucian', content: 'Ataque Intensificado siempre.' }),
    doc({ id: 'b', title: 'Build de Lucian', content: 'Filo Infinito segundo objeto.' }),
    doc({ id: 'c', title: 'Sinergia de Lucian', content: 'Funciona bien con Milio en línea.' }),
  ];
  const providerA = createVectorSpaceProvider(corpus);
  const providerB = createVectorSpaceProvider([...corpus].reverse());
  const resultA = providerA.retrieve({ text: '¿Qué runa usa Lucian?' });
  const resultB = providerB.retrieve({ text: '¿Qué runa usa Lucian?' });
  assert.deepEqual(
    resultA.documents.map((d) => d.document.id),
    resultB.documents.map((d) => d.document.id),
  );
});

test('limit aplica un top-k real', () => {
  // Un tercer documento sin "combos" evita el caso degenerado de TF-IDF en el que un término presente
  // en el 100% del corpus obtiene idf=0 y queda completamente descartado (ver el test de IDF más abajo).
  const corpus = [
    doc({ id: 'a', content: 'combos combos combos' }),
    doc({ id: 'b', content: 'combos una vez' }),
    doc({ id: 'neutral', content: 'runas y objetos, sin relación con el término buscado' }),
  ];
  const provider = createVectorSpaceProvider(corpus);
  const limited = provider.retrieve({ text: 'combos', limit: 1 });
  assert.equal(limited.documents.length, 1);
});

test('un término presente en casi todos los documentos pesa menos (IDF) que un término distintivo de un único documento', () => {
  const commonTerm = 'lucian';
  const corpus = [
    doc({ id: 'common-1', content: `${commonTerm} juega agresivo` }),
    doc({ id: 'common-2', content: `${commonTerm} tiene combos` }),
    doc({ id: 'common-3', content: `${commonTerm} usa runas` }),
    doc({ id: 'distinctive', content: `${commonTerm} navori segundo objeto` }),
  ];
  const provider = createVectorSpaceProvider(corpus);
  const result = provider.retrieve({ text: 'navori' });
  // "navori" solo aparece en un documento: debe ganar con claridad, aunque "lucian" (presente en los 4) también coincida en la pregunta implícitamente vía el propio corpus.
  assert.equal(result.documents[0]?.document.id, 'distinctive');
});

test('un filtro explícito de campeón sigue aplicándose sobre el experimento de espacio vectorial', () => {
  const corpus = [
    doc({ id: 'lucian-doc', content: 'contenido real sobre combos', relatedEntityIds: ['champion:lucian'] }),
    doc({
      id: 'jinx-doc',
      content: 'contenido real sobre combos',
      sourceEntityId: 'champion:jinx',
      relatedEntityIds: ['champion:jinx'],
    }),
    doc({ id: 'neutral', content: 'runas y objetos, sin relación con la pregunta' }),
  ];
  const provider = createVectorSpaceProvider(corpus);
  const result = provider.retrieve({ text: 'contenido', filters: { championId: 'champion:jinx' } });
  assert.ok(result.documents.length > 0);
  assert.ok(result.documents.every((d) => d.document.sourceEntityId === 'champion:jinx'));
});

test('una pregunta vacía se rechaza sin puntuar nada', () => {
  const provider = createVectorSpaceProvider([doc()]);
  const result = provider.retrieve({ text: '' });
  assert.deepEqual(result.documents, []);
  assert.equal(result.insufficientInformation, true);
});
