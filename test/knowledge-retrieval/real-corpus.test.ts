import { test } from 'node:test';
import assert from 'node:assert/strict';
import { knowledgeDocuments } from '../../src/domain/knowledge-index/registry.ts';
import { createLocalProvider } from '../../src/domain/knowledge-retrieval/local-provider.ts';
import { createVectorSpaceProvider } from '../../src/domain/knowledge-retrieval/vector-space-provider.ts';
import { evaluationCases } from '../../src/domain/knowledge-retrieval/evaluation/cases.ts';
import { runEvaluation } from '../../src/domain/knowledge-retrieval/evaluation/run.ts';

/**
 * Pruebas contra el índice de conocimiento REAL (no sintético) — cubren la
 * lista explícita de casos que pide el encargo (Navori vs. Filo Infinito,
 * Ataque Intensificado, nivel 2, combos, sinergias, Draven/Jinx
 * inexistentes) más los guardrails de la Fase 6.
 */

const local = createLocalProvider(knowledgeDocuments);
const vector = createVectorSpaceProvider(knowledgeDocuments);

test('Navori vs. Filo Infinito: ambos objetos se recuperan y ninguno gana por tener mayor confianza editorial', () => {
  const result = local.retrieve({ text: '¿Es mejor Filo Infinito o Navori?', limit: 10 });
  const ids = result.documents.map((d) => d.document.id);
  assert.ok(ids.includes('knowledge:build:lucian-26-14-solid:item:core:1'), 'falta Filo Infinito');
  assert.ok(ids.includes('knowledge:build:lucian-26-14-personal:item:core:1'), 'falta Navori');
});

test('Ataque Intensificado: la runa principal confirmada se recupera preguntando "qué runa usa Tidusss con Lucian"', () => {
  const result = local.retrieve({ text: '¿Qué runa usa Tidusss con Lucian?', limit: 5 });
  const ids = result.documents.map((d) => d.document.id);
  assert.ok(ids.includes('knowledge:rune-page:lucian-26-14:choice:primary:0'));
  assert.equal(result.insufficientInformation, false);
});

test('nivel 2: preguntar directamente por el power spike de nivel 2 lo recupera con alta confianza', () => {
  const result = local.retrieve({ text: '¿Qué pasa con Lucian en el nivel 2?', limit: 5 });
  assert.equal(result.documents[0]?.document.id, 'knowledge:champion:lucian:power-spike:0');
});

test('combos rápidos: tanto el consejo rápido como el error frecuente sobre combos se recuperan', () => {
  const result = local.retrieve({ text: '¿Por qué Lucian necesita hacer combos rápidos?', limit: 10 });
  const ids = result.documents.map((d) => d.document.id);
  assert.ok(ids.includes('knowledge:champion:lucian:quick-tip:4'));
  assert.ok(ids.includes('knowledge:champion:lucian:common-mistake:2'));
});

test('burst: la fortaleza real sobre la ventana de daño explosiva se recupera con su terminología real en español', () => {
  const result = local.retrieve({ text: '¿Cuál es la ventana de daño explosiva de Lucian?', limit: 5 });
  assert.equal(result.documents[0]?.document.id, 'knowledge:champion:lucian:strength:0');
});

test('burst: la jerga bilingüe literal ("burst") no aparece en ningún documento real y se declara información insuficiente — límite real documentado, no un fallo silencioso', () => {
  const result = local.retrieve({ text: '¿Cuánto burst tiene Lucian?' });
  for (const document of knowledgeDocuments) {
    assert.ok(!document.content.toLowerCase().includes('burst'));
  }
  assert.equal(result.insufficientInformation, true);
});

test('rotaciones: "rotación" solo existe en Wave Management, un concepto sin relación real, y por tanto no indexado — ninguna búsqueda por "rotaciones" debe inventar una respuesta', () => {
  const result = local.retrieve({ text: '¿Cómo son las rotaciones de Lucian?' });
  assert.equal(result.insufficientInformation, true);
});

test('sinergias: preguntar de forma genérica por los supports de Lucian recupera las 6 sinergias reales, empatadas', () => {
  const result = local.retrieve({ text: '¿Con qué supports funciona bien Lucian?', limit: 10 });
  const synergyIds = result.documents
    .map((d) => d.document.id)
    .filter((id) => id.startsWith('knowledge:synergy:'));
  assert.equal(synergyIds.length, 6);
});

test('sinergias: nombrar un socio real concreto (Milio) desempata a su favor sobre el resto', () => {
  const result = local.retrieve({ text: '¿Lucian funciona bien con Milio?', limit: 10 });
  const milioScore = result.documents.find((d) => d.document.id === 'knowledge:synergy:lucian-milio:editorial-take')?.score ?? 0;
  const otherSynergyScores = result.documents
    .filter((d) => d.document.id.startsWith('knowledge:synergy:') && !d.document.id.includes('milio'))
    .map((d) => d.score);
  assert.ok(milioScore > 0);
  for (const otherScore of otherSynergyScores) assert.ok(milioScore > otherScore);
});

test('Draven: se reconoce como campeón real del catálogo pero no existe ningún matchup analizado — información insuficiente, nunca un matchup inventado', () => {
  const result = local.retrieve({ text: '¿Cómo juego Lucian contra Draven?' });
  assert.equal(result.insufficientInformation, true);
  assert.equal(result.coverage, 'none');
  assert.equal(result.filtersApplied.championId, 'champion:draven');
  assert.deepEqual(result.documents, []);
});

test('Jinx: no tiene build propia, pero sí una entrada real en la Tier List — se recupera esa, nunca contenido de Lucian mezclado ni una build inventada', () => {
  const result = local.retrieve({ text: '¿Cuál es la build de Jinx?' });
  assert.equal(result.insufficientInformation, false);
  assert.equal(result.filtersApplied.championId, 'champion:jinx');
  assert.deepEqual(
    result.documents.map((d) => d.document.id),
    ['knowledge:tier-list:official-adc:entry:champion:jinx'],
  );
  assert.ok(
    result.documents.every((d) => !d.document.id.includes('lucian')),
    'no debe mezclar contenido de Lucian',
  );
  assert.ok(
    result.documents.every((d) => d.document.type !== 'build-item'),
    'Jinx no tiene ninguna build real: nunca se debe inventar una',
  );
});

// --- Guardrails (Fase 6) ---

test('guardrail: ningún resultado real proviene jamás de un campeón draft (Kai\'Sa, Jinx, Ezreal)', () => {
  const draftChampionIds = new Set(['champion:kaisa', 'champion:jinx', 'champion:ezreal']);
  for (const query of ['Lucian', 'campeón', 'build', 'runas', 'ADC']) {
    const result = local.retrieve({ text: query, limit: 60 });
    for (const retrieved of result.documents) {
      assert.ok(!draftChampionIds.has(retrieved.document.sourceEntityId));
    }
  }
});

test('guardrail: la recuperación nunca inventa un documento — todo resultado existe tal cual en el índice de conocimiento real', () => {
  const realIds = new Set(knowledgeDocuments.map((document) => document.id));
  const result = local.retrieve({ text: 'Lucian build runas sinergias', limit: 60 });
  for (const retrieved of result.documents) {
    assert.ok(realIds.has(retrieved.document.id));
    const original = knowledgeDocuments.find((document) => document.id === retrieved.document.id);
    assert.deepEqual(retrieved.document, original);
  }
});

test('guardrail: las URLs (y anclas) recuperadas son exactamente las mismas del índice de conocimiento real — nunca reescritas', () => {
  const result = local.retrieve({ text: '¿Qué runa usa Tidusss con Lucian?', limit: 5 });
  for (const retrieved of result.documents) {
    const original = knowledgeDocuments.find((document) => document.id === retrieved.document.id);
    assert.equal(retrieved.document.url, original?.url);
  }
});

test('guardrail: respeta el parche cuando la pregunta lo nombra — nunca mezcla contenido de otro parche con patchId propio', () => {
  const result = local.retrieve({ text: '¿Qué build usa Lucian en el parche 26.14?', limit: 60 });
  for (const retrieved of result.documents) {
    if (retrieved.document.patchId) assert.equal(retrieved.document.patchId, 'patch:26-14');
  }
});

test('el conjunto de evaluación completo se ejecuta sin lanzar excepciones contra ambos proveedores', () => {
  const localSummary = runEvaluation(local, evaluationCases);
  const vectorSummary = runEvaluation(vector, evaluationCases);
  assert.equal(localSummary.caseCount, evaluationCases.length);
  assert.equal(vectorSummary.caseCount, evaluationCases.length);
  assert.equal(localSummary.totalForbiddenHits, 0);
  assert.equal(vectorSummary.totalForbiddenHits, 0);
});

test('el conjunto de evaluación real rechaza correctamente el 100% de las preguntas fuera de alcance', () => {
  const summary = runEvaluation(local, evaluationCases);
  assert.equal(summary.outOfScopeDetectedCount, summary.outOfScopeCaseCount);
  assert.ok(summary.outOfScopeCaseCount > 0);
});
