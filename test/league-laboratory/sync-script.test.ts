import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertUniqueSlugs,
  buildCatalogEntry,
  sortCatalogEntries,
} from '../../scripts/sync-champion-catalog.mjs';

/**
 * Estos tests prueban la transformación PURA del generador (sin red): dado
 * un fragmento de `champion.json` de Data Dragon ya descargado, el
 * resultado debe ser siempre el mismo. La descarga en sí (fetch a Data
 * Dragon) no se prueba aquí — no tiene sentido convertir un test unitario en
 * una dependencia de red; ver "Determinismo" en docs/league-laboratory.md.
 */

const RAW_KAISA = {
  id: 'Kaisa',
  name: "Kai'Sa",
  title: 'La Hija del Vacío',
  tags: ['Marksman', 'Mage'],
  info: { difficulty: 6 },
};

const RAW_JARVAN = {
  id: 'JarvanIV',
  name: 'Jarvan IV',
  title: 'El Ejemplo de Demacia',
  tags: ['Fighter', 'Tank'],
  info: { difficulty: 5 },
};

test('buildCatalogEntry es determinista: misma entrada, misma salida', () => {
  const first = buildCatalogEntry(RAW_KAISA);
  const second = buildCatalogEntry(RAW_KAISA);
  assert.deepEqual(first, second);
  assert.equal(first.slug, 'kaisa');
  assert.equal(first.id, 'champion:kaisa');
  assert.equal(first.dataDragonKey, 'Kaisa');
});

test('buildCatalogEntry no inventa ni pierde campos factuales', () => {
  const entry = buildCatalogEntry(RAW_JARVAN);
  assert.equal(entry.name, 'Jarvan IV');
  assert.equal(entry.title, 'El Ejemplo de Demacia');
  assert.deepEqual(entry.tags, ['Fighter', 'Tank']);
  assert.equal(entry.riotDifficulty, 5);
  assert.equal(entry.slug, 'jarvan-iv');
});

test('sortCatalogEntries ordena por nombre en español de forma estable y determinista', () => {
  const entries = [RAW_JARVAN, RAW_KAISA].map(buildCatalogEntry);
  const sortedOnce = sortCatalogEntries(entries);
  const sortedTwice = sortCatalogEntries(sortedOnce);
  assert.deepEqual(sortedOnce, sortedTwice);
  assert.equal(sortedOnce[0]?.name, 'Jarvan IV');
});

test('assertUniqueSlugs no lanza con slugs únicos', () => {
  const entries = [RAW_JARVAN, RAW_KAISA].map(buildCatalogEntry);
  assert.doesNotThrow(() => assertUniqueSlugs(entries));
});

test('assertUniqueSlugs lanza ante un slug duplicado (regresión de colisión)', () => {
  const duplicated = [
    buildCatalogEntry(RAW_KAISA),
    buildCatalogEntry({ ...RAW_KAISA, name: 'Otro nombre' }),
  ];
  assert.throws(() => assertUniqueSlugs(duplicated), /Slug duplicado/);
});
