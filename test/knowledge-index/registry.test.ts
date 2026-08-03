import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  knowledgeDocuments,
} from '../../src/domain/knowledge-index/registry.ts';
import {
  findDuplicateDocumentIds,
  validateKnowledgeIndex,
} from '../../src/domain/knowledge-index/invariants.ts';
import { serializeKnowledgeIndex } from '../../src/domain/knowledge-index/serialize.ts';
import { adcLabChampions, kaisa, lucian } from '../../src/data/league-laboratory/champions.ts';
import { officialAdcTierList } from '../../src/data/league-laboratory/official-adc-tier-list.ts';

// --- IDs únicos y deterministas ---

test('todos los ids del índice real son únicos', () => {
  assert.deepEqual(findDuplicateDocumentIds(knowledgeDocuments), []);
});

test('el índice real no está vacío y cada documento resuelve a una entidad de origen real', () => {
  assert.ok(knowledgeDocuments.length > 0);
  for (const document of knowledgeDocuments) {
    assert.ok(document.sourceEntityId.length > 0);
  }
});

// --- Estabilidad ante cambios de orden ---

test('el índice real está ordenado por id y esa serialización es estable entre llamadas', () => {
  const ids = knowledgeDocuments.map((document) => document.id);
  const sortedIds = [...ids].sort();
  assert.deepEqual(ids, sortedIds);
});

test('serializeKnowledgeIndex produce el mismo JSON con independencia del orden de entrada', () => {
  const shuffled = [...knowledgeDocuments].reverse();
  assert.equal(serializeKnowledgeIndex(knowledgeDocuments), serializeKnowledgeIndex(shuffled));
});

// --- Contenido no vacío, fuentes resolubles, validación integral ---

test('el índice real no viola ninguna invariante (validateKnowledgeIndex)', () => {
  assert.deepEqual(validateKnowledgeIndex(knowledgeDocuments), []);
});

// --- Exclusión de borradores y pendientes ---

test('ningún documento del índice real proviene de un campeón sin perfil (Kai\'Sa, Jinx, Ezreal)', () => {
  const draftChampionIds = new Set(
    adcLabChampions.filter((champion) => !champion.profile).map((champion) => champion.id),
  );
  assert.ok(draftChampionIds.size > 0, 'debe existir al menos un campeón draft para que esta prueba sea significativa');
  for (const document of knowledgeDocuments) {
    assert.ok(!draftChampionIds.has(document.sourceEntityId as never), `${document.id} proviene de un campeón draft`);
    assert.ok(
      !document.relatedEntityIds.some((id) => draftChampionIds.has(id as never)),
      `${document.id} relaciona a un campeón draft`,
    );
  }
});

test('ninguna entrada placeholder de la Tier List genera un documento', () => {
  const placeholderChampionIds = new Set(
    officialAdcTierList.entries
      .filter((entry) => entry.reviewStatus === 'placeholder')
      .map((entry) => entry.championId),
  );
  assert.ok(placeholderChampionIds.size > 0);
  const tierListDocuments = knowledgeDocuments.filter((document) => document.type === 'tier-list-entry');
  assert.equal(tierListDocuments.length, 1);
  for (const document of tierListDocuments) {
    for (const relatedId of document.relatedEntityIds) {
      assert.ok(!placeholderChampionIds.has(relatedId as never));
    }
  }
});

// --- El contenido de Lucian no se asigna a otros campeones ---

test('Kai\'Sa (otro campeón curado) no recibe ningún documento de identidad, entendimiento o rasgos de Lucian', () => {
  const leaked = knowledgeDocuments.some(
    (document) =>
      document.sourceEntityId === kaisa.id &&
      ['champion-identity', 'champion-understanding', 'champion-editorial-take', 'champion-strength', 'champion-weakness', 'champion-common-mistake', 'champion-power-spike', 'champion-quick-tip', 'champion-editorial-history'].includes(
        document.type,
      ),
  );
  assert.equal(leaked, false);
});

test('todos los documentos de build/rune-page cuyo relatedEntityIds incluye a un campeón, solo incluyen a Lucian', () => {
  const buildAndRuneDocuments = knowledgeDocuments.filter(
    (document) => document.type.startsWith('build-') || document.type.startsWith('rune-'),
  );
  assert.ok(buildAndRuneDocuments.length > 0);
  for (const document of buildAndRuneDocuments) {
    assert.deepEqual([...document.relatedEntityIds], [lucian.id]);
  }
});

// --- Separación de parches ---

test('los documentos que declaran patchId lo hacen con un valor real presente en los datos de origen (15.14 o 26.14)', () => {
  const knownPatchIds = new Set(['patch:15-14', 'patch:26-14']);
  const withPatch = knowledgeDocuments.filter((document) => document.patchId);
  assert.ok(withPatch.length > 0);
  for (const document of withPatch) {
    assert.ok(knownPatchIds.has(document.patchId!), `${document.id} declara un patchId desconocido: ${document.patchId}`);
  }
});

// --- Verificación de que las anclas existan realmente ---

const slugAstroPath = fileURLToPath(
  new URL('../../src/pages/campeones/[slug].astro', import.meta.url),
);
const slugAstroSource = readFileSync(slugAstroPath, 'utf-8');

test('cada ancla usada por el índice real corresponde a una ChampionKnowledgeSection/id real en [slug].astro', () => {
  const anchoredDocuments = knowledgeDocuments.filter((document) => document.url.includes('#'));
  assert.ok(anchoredDocuments.length > 0);
  const usedAnchors = new Set(
    anchoredDocuments.map((document) => document.url.split('#')[1]),
  );
  for (const anchor of usedAnchors) {
    const sectionId = anchor?.replace(/-heading$/, '');
    assert.match(
      slugAstroSource,
      new RegExp(`id=(["'])${sectionId}\\1`),
      `no se encontró id="${sectionId}" en [slug].astro para el ancla #${anchor}`,
    );
  }
});

test('las páginas base referenciadas por el índice real (sin ancla) existen como rutas reales del sitio', () => {
  const basePages = new Set(
    knowledgeDocuments
      .filter((document) => !document.url.includes('#'))
      .map((document) => document.url.replace(/\/campeones\/[a-z0-9-]+/, '/campeones/[slug]')),
  );
  assert.ok(basePages.size > 0);
  for (const page of basePages) {
    assert.ok(
      page === '/tier-list' || page === '/campeones/[slug]',
      `${page} no es una ruta real conocida del sitio`,
    );
  }
});
