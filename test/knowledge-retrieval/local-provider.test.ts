import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalProvider } from '../../src/domain/knowledge-retrieval/local-provider.ts';
import type { KnowledgeDocument } from '../../src/domain/knowledge-index/types.ts';

/**
 * Corpus sintético con DOS campeones reales del catálogo (Lucian y Jinx) —
 * el corpus real de hoy solo tiene contenido curado de Lucian, así que el
 * guardrail "nunca mezclar campeones" no se puede probar contra datos
 * reales todavía. Se prueba aquí contra un corpus sintético que sí
 * reproduce la situación (dos campeones con contenido propio), igual que
 * `test/content-graph/registry.test.ts` prueba invariantes con grafos
 * sintéticos.
 */
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

const lucianStrength = doc({
  id: 'knowledge:champion:lucian:strength:0',
  type: 'champion-strength',
  title: 'Fortaleza de Lucian',
  content: 'Ventana de daño explosiva con el combo pasivo',
  confidence: 'high',
});

const lucianFilo = doc({
  id: 'knowledge:build:lucian-solid:item:core:1',
  type: 'build-item',
  title: 'Filo Infinito en la build de Lucian',
  content: 'La opción generalmente más sólida como segundo objeto.',
  sourceEntityId: 'build:lucian-solid',
  patchId: 'patch:26-14',
  confidence: 'high',
});

const lucianNavori = doc({
  id: 'knowledge:build:lucian-personal:item:core:1',
  type: 'build-item',
  title: 'Navori en la build de Lucian',
  content: 'A Tidusss le encanta jugar Navori de segundo objeto.',
  sourceEntityId: 'build:lucian-personal',
  patchId: 'patch:26-14',
  confidence: 'medium',
});

const jinxStrength = doc({
  id: 'knowledge:champion:jinx:strength:0',
  type: 'champion-strength',
  title: 'Fortaleza de Jinx',
  content: 'Daño sostenido a largo alcance una vez desatada.',
  sourceEntityId: 'champion:jinx',
  relatedEntityIds: ['champion:jinx'],
  confidence: 'high',
});

const syntheticCorpus: KnowledgeDocument[] = [lucianStrength, lucianFilo, lucianNavori, jinxStrength];

test('createLocalProvider es determinista: la misma pregunta produce el mismo resultado', () => {
  const provider = createLocalProvider(syntheticCorpus);
  const first = provider.retrieve({ text: 'Navori' });
  const second = provider.retrieve({ text: 'Navori' });
  assert.deepEqual(first, second);
});

test('el orden de los resultados no depende del orden del corpus de entrada', () => {
  const providerA = createLocalProvider(syntheticCorpus);
  const providerB = createLocalProvider([...syntheticCorpus].reverse());
  const resultA = providerA.retrieve({ text: '¿Qué fortalezas tiene Lucian?' });
  const resultB = providerB.retrieve({ text: '¿Qué fortalezas tiene Lucian?' });
  assert.deepEqual(
    resultA.documents.map((d) => d.document.id),
    resultB.documents.map((d) => d.document.id),
  );
});

test('limit aplica un top-k real sobre los resultados ya ordenados', () => {
  // "Lucian" a secas no basta (guardrail: reconocer solo el nombre del campeón no es señal de contenido
  // real, ver local-provider.ts) — se usa una pregunta con señal de contenido genuina para probar el límite.
  const provider = createLocalProvider(syntheticCorpus);
  const unlimited = provider.retrieve({ text: '¿Qué fortalezas tiene Lucian?' });
  const limited = provider.retrieve({ text: '¿Qué fortalezas tiene Lucian?', limit: 1 });
  assert.equal(limited.documents.length, 1);
  assert.equal(limited.documents[0]?.document.id, unlimited.documents[0]?.document.id);
});

test('un filtro explícito de campeón restringe los resultados aunque el texto no lo mencione', () => {
  const provider = createLocalProvider(syntheticCorpus);
  const result = provider.retrieve({
    text: 'fortaleza',
    filters: { championId: 'champion:jinx' },
  });
  assert.ok(result.documents.length > 0);
  for (const retrieved of result.documents) {
    assert.deepEqual([...retrieved.document.relatedEntityIds], ['champion:jinx']);
  }
});

test('guardrail: preguntar por Lucian nunca devuelve contenido de Jinx, y viceversa', () => {
  const provider = createLocalProvider(syntheticCorpus);
  const lucianResult = provider.retrieve({ text: '¿Qué fortalezas tiene Lucian?' });
  assert.ok(lucianResult.documents.length > 0);
  assert.ok(lucianResult.documents.every((d) => d.document.sourceEntityId !== 'champion:jinx'));

  const jinxResult = provider.retrieve({ text: '¿Qué fortalezas tiene Jinx?' });
  assert.ok(jinxResult.documents.length > 0);
  assert.ok(jinxResult.documents.every((d) => d.document.sourceEntityId === 'champion:jinx'));
});

test('cada objeto gana su propia pregunta, independientemente de cuál tenga mayor confianza editorial', () => {
  const provider = createLocalProvider(syntheticCorpus);
  const filoResult = provider.retrieve({ text: '¿Cuándo me hago Filo Infinito?' });
  const navoriResult = provider.retrieve({ text: '¿Cuándo me hago Navori?' });
  // Filo Infinito (confidence: 'high') y Navori (confidence: 'medium') deben ganar cada uno su propia
  // pregunta — la confianza editorial (más alta en Filo Infinito) nunca debe filtrarse a la puntuación
  // de recuperación ni decidir qué documento "gana".
  assert.equal(filoResult.documents[0]?.document.id, lucianFilo.id);
  assert.equal(navoriResult.documents[0]?.document.id, lucianNavori.id);
});

test('la puntuación de recuperación ignora por completo el campo `confidence`: dos documentos con texto idéntico y confianza distinta puntúan exactamente igual', () => {
  const highConfidenceTwin = doc({
    id: 'knowledge:champion:lucian:twin:high',
    title: 'Gemelo de prueba',
    content: 'Texto idéntico usado solo para aislar el efecto de confidence.',
    confidence: 'high',
  });
  const lowConfidenceTwin = doc({
    id: 'knowledge:champion:lucian:twin:low',
    title: 'Gemelo de prueba',
    content: 'Texto idéntico usado solo para aislar el efecto de confidence.',
    confidence: 'low',
  });
  const provider = createLocalProvider([highConfidenceTwin, lowConfidenceTwin]);
  const result = provider.retrieve({ text: 'gemelo de prueba' });
  const highScore = result.documents.find((d) => d.document.id === highConfidenceTwin.id)?.score;
  const lowScore = result.documents.find((d) => d.document.id === lowConfidenceTwin.id)?.score;
  assert.equal(highScore, lowScore);
});

test('una pregunta vacía se rechaza sin puntuar nada', () => {
  const provider = createLocalProvider(syntheticCorpus);
  const result = provider.retrieve({ text: '' });
  assert.deepEqual(result.documents, []);
  assert.equal(result.coverage, 'none');
  assert.equal(result.insufficientInformation, true);
});

test('una pregunta fuera de alcance (sin ningún término del corpus) se rechaza', () => {
  const provider = createLocalProvider(syntheticCorpus);
  const result = provider.retrieve({ text: '¿Quién ganó el campeonato mundial de fútbol?' });
  assert.equal(result.insufficientInformation, true);
  assert.equal(result.coverage, 'none');
});
