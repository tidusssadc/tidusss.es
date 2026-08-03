import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDocuments,
  championIdentityDocuments,
  championProfileTraitDocuments,
  championUnderstandingDocuments,
  conceptDocuments,
  editorialHistoryDocuments,
  runePageDocuments,
  synergyDocuments,
  tierListEntryDocuments,
} from '../../src/domain/knowledge-index/builders.ts';
import { lucian, kaisa } from '../../src/data/league-laboratory/champions.ts';
import { championCatalog } from '../../src/data/league-laboratory/catalog/champions.generated.ts';
import {
  lucianPersonalBuild26_14,
  lucianSolidBuild26_14,
} from '../../src/data/league-laboratory/builds.ts';
import { lucianRunes26_14 } from '../../src/data/league-laboratory/rune-pages.ts';
import { lucianMilioSynergy } from '../../src/data/league-laboratory/synergies.ts';
import { spacing } from '../../src/data/league-laboratory/concepts.ts';
import { officialAdcTierList } from '../../src/data/league-laboratory/official-adc-tier-list.ts';
import type { ReviewedTierListEntry } from '../../src/domain/league-laboratory/types.ts';

const lucianCatalogEntry = championCatalog.find((entry) => entry.id === lucian.id);
if (!lucianCatalogEntry) {
  throw new Error('champion:lucian debe existir en el catálogo generado para este test');
}
const url = `/campeones/${lucianCatalogEntry.slug}`;

// --- Determinismo y no-mutación (mismo patrón que domain/content-graph) ---

test('championIdentityDocuments es determinista y no muta el LabChampion ni el catálogo de origen', () => {
  const labClone = structuredClone(lucian);
  const catalogClone = structuredClone(lucianCatalogEntry);
  const first = championIdentityDocuments(lucian, lucianCatalogEntry, url);
  const second = championIdentityDocuments(lucian, lucianCatalogEntry, url);
  assert.deepEqual(first, second);
  assert.deepEqual(lucian, labClone);
  assert.deepEqual(lucianCatalogEntry, catalogClone);
});

test('championUnderstandingDocuments es determinista y no muta el LabChampion de origen', () => {
  const clone = structuredClone(lucian);
  const first = championUnderstandingDocuments(lucian, lucianCatalogEntry.name, url);
  const second = championUnderstandingDocuments(lucian, lucianCatalogEntry.name, url);
  assert.deepEqual(first, second);
  assert.deepEqual(lucian, clone);
});

test('championProfileTraitDocuments es determinista y no muta el LabChampion de origen', () => {
  const clone = structuredClone(lucian);
  const first = championProfileTraitDocuments(lucian, lucianCatalogEntry.name, url);
  const second = championProfileTraitDocuments(lucian, lucianCatalogEntry.name, url);
  assert.deepEqual(first, second);
  assert.deepEqual(lucian, clone);
});

test('editorialHistoryDocuments es determinista y no muta el LabChampion de origen', () => {
  const clone = structuredClone(lucian);
  const first = editorialHistoryDocuments(lucian, lucianCatalogEntry.name, url);
  const second = editorialHistoryDocuments(lucian, lucianCatalogEntry.name, url);
  assert.deepEqual(first, second);
  assert.deepEqual(lucian, clone);
});

test('buildDocuments es determinista y no muta la Build de origen', () => {
  const clone = structuredClone(lucianSolidBuild26_14);
  const first = buildDocuments(lucianSolidBuild26_14, 'Lucian', `${url}#build-heading`);
  const second = buildDocuments(lucianSolidBuild26_14, 'Lucian', `${url}#build-heading`);
  assert.deepEqual(first, second);
  assert.deepEqual(lucianSolidBuild26_14, clone);
});

test('runePageDocuments es determinista y no muta la RunePage de origen', () => {
  const clone = structuredClone(lucianRunes26_14);
  const first = runePageDocuments(lucianRunes26_14, 'Lucian', `${url}#runas-heading`);
  const second = runePageDocuments(lucianRunes26_14, 'Lucian', `${url}#runas-heading`);
  assert.deepEqual(first, second);
  assert.deepEqual(lucianRunes26_14, clone);
});

test('synergyDocuments es determinista y no muta la Synergy de origen', () => {
  const clone = structuredClone(lucianMilioSynergy);
  const first = synergyDocuments(lucianMilioSynergy, ['Lucian', 'Milio'], `${url}#sinergias-heading`);
  const second = synergyDocuments(lucianMilioSynergy, ['Lucian', 'Milio'], `${url}#sinergias-heading`);
  assert.deepEqual(first, second);
  assert.deepEqual(lucianMilioSynergy, clone);
});

test('conceptDocuments es determinista y no muta el Concept de origen', () => {
  const clone = structuredClone(spacing);
  const first = conceptDocuments(spacing, [lucian.id], `${url}#concepts-heading`);
  const second = conceptDocuments(spacing, [lucian.id], `${url}#concepts-heading`);
  assert.deepEqual(first, second);
  assert.deepEqual(spacing, clone);
});

// --- Exclusión de drafts / contenido pendiente ---

test('championUnderstandingDocuments y championProfileTraitDocuments no generan nada para un campeón sin perfil (draft)', () => {
  assert.deepEqual(championUnderstandingDocuments(kaisa, 'Kai\'Sa', '/campeones/kaisa'), []);
  assert.deepEqual(championProfileTraitDocuments(kaisa, 'Kai\'Sa', '/campeones/kaisa'), []);
});

test('runePageDocuments no genera ningún documento para las ramas vacías (pendientes de análisis)', () => {
  const documents = runePageDocuments(lucianRunes26_14, 'Lucian', `${url}#runas-heading`);
  const secondaryOrShard = documents.filter(
    (document) => document.id.includes(':secondary:') || document.id.includes(':shard:'),
  );
  assert.deepEqual(secondaryOrShard, []);
});

// --- Contenido no vacío, fuentes resolubles ---

test('ningún documento generado tiene contenido o título vacío', () => {
  const documents = [
    ...championIdentityDocuments(lucian, lucianCatalogEntry, url),
    ...championUnderstandingDocuments(lucian, lucianCatalogEntry.name, url),
    ...championProfileTraitDocuments(lucian, lucianCatalogEntry.name, url),
    ...editorialHistoryDocuments(lucian, lucianCatalogEntry.name, url),
    ...buildDocuments(lucianSolidBuild26_14, 'Lucian', `${url}#build-heading`),
    ...runePageDocuments(lucianRunes26_14, 'Lucian', `${url}#runas-heading`),
    ...synergyDocuments(lucianMilioSynergy, ['Lucian', 'Milio'], `${url}#sinergias-heading`),
    ...conceptDocuments(spacing, [lucian.id], `${url}#concepts-heading`),
  ];
  for (const document of documents) {
    assert.ok(document.content.trim().length > 0, `${document.id} tiene contenido vacío`);
    assert.ok(document.title.trim().length > 0, `${document.id} tiene título vacío`);
    assert.ok(document.sourceEntityId.trim().length > 0, `${document.id} no resuelve a ninguna fuente`);
  }
});

// --- Separación de parches ---

test('los documentos de la build de Lucian llevan el patchId real de esa build (26.14)', () => {
  const documents = buildDocuments(lucianSolidBuild26_14, 'Lucian', `${url}#build-heading`);
  for (const document of documents) {
    assert.equal(document.patchId, lucianSolidBuild26_14.patchId);
  }
});

test('un documento de historial editorial sin patchId real no inventa uno', () => {
  const documents = editorialHistoryDocuments(lucian, lucianCatalogEntry.name, url);
  const withoutPatch = documents.filter((document) => !document.patchId);
  assert.ok(withoutPatch.length > 0, 'debe existir al menos una entrada real sin parche asociado');
  for (const document of withoutPatch) {
    assert.equal(document.patchId, undefined);
  }
});

// --- Generación de documentos específicos pedidos en el encargo ---

test('se genera un documento para la build sólida de Lucian (Filo Infinito como segundo objeto)', () => {
  const documents = buildDocuments(lucianSolidBuild26_14, 'Lucian', `${url}#build-heading`);
  assert.ok(
    documents.some((document) => document.title.includes('Filo Infinito')),
    'debe existir un documento sobre Filo Infinito en la build sólida',
  );
});

test('se genera un documento para Navori en la ruta personal de Lucian, incluyendo el riesgo documentado', () => {
  const documents = buildDocuments(lucianPersonalBuild26_14, 'Lucian', `${url}#build-heading`);
  const navori = documents.find((document) => document.title.includes('Navori'));
  assert.ok(navori, 'debe existir un documento sobre Navori');
  assert.match(navori!.content, /preferencia personal/i);
});

test('se genera un documento para Ataque Intensificado en las runas de Lucian', () => {
  const documents = runePageDocuments(lucianRunes26_14, 'Lucian', `${url}#runas-heading`);
  const rune = documents.find((document) => document.title.includes('Ataque Intensificado'));
  assert.ok(rune, 'debe existir un documento sobre Ataque Intensificado');
  assert.match(rune!.content, /Tidusss utiliza siempre/i);
});

test('se genera un documento sobre el power spike de nivel 2', () => {
  const documents = championProfileTraitDocuments(lucian, lucianCatalogEntry.name, url);
  const levelTwo = documents.find(
    (document) => document.type === 'champion-power-spike' && /nivel 2/i.test(document.content),
  );
  assert.ok(levelTwo, 'debe existir un documento sobre el power spike de nivel 2');
});

test('se genera un documento sobre el burst del combo pasivo (fortaleza real)', () => {
  const documents = championProfileTraitDocuments(lucian, lucianCatalogEntry.name, url);
  const burst = documents.find(
    (document) => document.type === 'champion-strength' && /explosiva/i.test(document.content),
  );
  assert.ok(burst, 'debe existir un documento sobre la ventana de daño explosiva (burst)');
});

test('se generan documentos sobre la ejecución de combos (error frecuente y consejo rápido)', () => {
  const documents = championProfileTraitDocuments(lucian, lucianCatalogEntry.name, url);
  const comboMistake = documents.find(
    (document) => document.type === 'champion-common-mistake' && /combo/i.test(document.content),
  );
  const comboTip = documents.find(
    (document) => document.type === 'champion-quick-tip' && /combo/i.test(document.content),
  );
  assert.ok(comboMistake, 'debe existir un error frecuente sobre la ejecución de combos');
  assert.ok(comboTip, 'debe existir un consejo rápido sobre no ralentizar los combos');
});

test('se genera un documento para la sinergia con Milio', () => {
  const documents = synergyDocuments(lucianMilioSynergy, ['Lucian', 'Milio'], `${url}#sinergias-heading`);
  assert.equal(documents.length, 1);
  assert.equal(documents[0]?.title, 'Sinergia: Lucian + Milio');
  assert.ok(documents[0]?.relatedEntityIds.includes(lucian.id));
  assert.ok(documents[0]?.relatedEntityIds.includes('champion:milio'));
});

test('se genera un documento por cada entrada real del historial editorial de Lucian', () => {
  const documents = editorialHistoryDocuments(lucian, lucianCatalogEntry.name, url);
  assert.equal(documents.length, lucian.editorialHistory?.length ?? 0);
  assert.equal(documents.length, 4);
});

test('se genera un documento para la entrada revisada de Lucian en la Tier List, nunca para las placeholder', () => {
  const reviewedEntry = officialAdcTierList.entries.find(
    (entry): entry is ReviewedTierListEntry => entry.reviewStatus === 'reviewed',
  );
  assert.ok(reviewedEntry, 'debe existir una entrada revisada real');
  const documents = tierListEntryDocuments(
    officialAdcTierList,
    reviewedEntry!,
    lucianCatalogEntry.name,
    '/tier-list',
  );
  assert.equal(documents.length, 1);
  assert.match(documents[0]!.title, /tier S/);
});
