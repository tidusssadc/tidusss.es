import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchEntries } from '../../src/domain/search-index/rank.ts';
import { buildSearchIndex } from '../../src/domain/search-index/build.ts';
import type { SearchEntry } from '../../src/domain/search-index/types.ts';

const entry = (overrides: Partial<SearchEntry> = {}): SearchEntry => ({
  id: 'page:test',
  category: 'pagina',
  title: 'Entrada de prueba',
  description: 'Descripción de prueba.',
  href: '/test',
  keywords: [],
  ...overrides,
});

// --- Normalización: mayúsculas, tildes, apóstrofes ---

test('encuentra por título exacto insensible a mayúsculas', () => {
  const entries = [entry({ id: 'a', title: 'Lucian' })];
  const matches = searchEntries(entries, 'LUCIAN');
  assert.equal(matches.length, 1);
});

test('encuentra por título con tilde escribiendo sin tilde', () => {
  const entries = [entry({ id: 'a', title: 'Spacing y posición' })];
  const matches = searchEntries(entries, 'posicion');
  assert.equal(matches.length, 1);
});

test('"kaisa" encuentra un título "Kai\'Sa" (apóstrofe real, mismo sistema que el Centro de Campeones)', () => {
  const entries = [entry({ id: 'a', title: "Kai'Sa" })];
  const matches = searchEntries(entries, 'kaisa');
  assert.equal(matches.length, 1);
});

// --- Ranking: prioridad de coincidencia ---

test('un título exacto puntúa por encima de una coincidencia solo en la descripción', () => {
  const entries = [
    entry({ id: 'title-match', title: 'Navori', description: 'Un objeto real.' }),
    entry({
      id: 'description-match',
      title: 'Otra cosa',
      description: 'Menciona Navori de pasada.',
    }),
  ];
  const matches = searchEntries(entries, 'navori');
  assert.equal(matches[0]?.entry.id, 'title-match');
});

test('una coincidencia de keyword (alias real) puntúa por encima de una coincidencia solo en la descripción', () => {
  const entries = [
    entry({ id: 'keyword-match', title: 'Build de Lucian', keywords: ['navori'] }),
    entry({ id: 'description-match', title: 'Otra build', description: 'usa navori también' }),
  ];
  const matches = searchEntries(entries, 'navori');
  assert.equal(matches[0]?.entry.id, 'keyword-match');
});

test('una consulta de dos palabras exige que ambas coincidan — nunca aprueba una entrada que solo contiene una', () => {
  const entries = [
    entry({ id: 'both', title: 'Filo Infinito' }),
    entry({ id: 'one-only', title: 'Filo de acero' }),
  ];
  const matches = searchEntries(entries, 'filo infinito');
  assert.equal(matches.length, 1);
  assert.equal(matches[0]?.entry.id, 'both');
});

test('reutiliza los sinónimos ya validados: "support" encuentra contenido que dice "soporte"', () => {
  const entries = [
    entry({ id: 'a', title: 'Sinergias de Lucian', description: 'Funciona bien con este soporte.' }),
  ];
  const matches = searchEntries(entries, 'support');
  assert.equal(matches.length, 1);
});

// --- Resultados vacíos / consulta vacía ---

test('una consulta vacía no devuelve resultados (nunca "todo el índice" por defecto)', () => {
  const entries = [entry({ id: 'a' })];
  assert.deepEqual(searchEntries(entries, ''), []);
  assert.deepEqual(searchEntries(entries, '   '), []);
});

test('una consulta sin ninguna coincidencia real devuelve un array vacío — nunca resultados inventados', () => {
  const entries = [entry({ id: 'a', title: 'Lucian', description: 'ADC' })];
  const matches = searchEntries(entries, 'draven matchup inexistente');
  assert.deepEqual(matches, []);
});

// --- Límite ---

test('respeta el límite de resultados cuando se especifica', () => {
  const entries = Array.from({ length: 10 }, (_, index) =>
    entry({ id: `entry-${index}`, title: 'Lucian' }),
  );
  const matches = searchEntries(entries, 'lucian', { limit: 3 });
  assert.equal(matches.length, 3);
});

// --- Integración con el índice real ---

test('sobre el índice real, "lucian" prioriza la guía de Lucian por encima de páginas genéricas', () => {
  const index = buildSearchIndex();
  const matches = searchEntries(index, 'lucian', { limit: 5 });
  assert.ok(matches.length > 0);
  const top = matches[0]?.entry;
  assert.ok(top?.title.toLowerCase().includes('lucian'));
});

test('sobre el índice real, "spacing" encuentra el concepto real de Academia', () => {
  const index = buildSearchIndex();
  const matches = searchEntries(index, 'spacing');
  assert.ok(matches.some((match) => match.entry.category === 'academia'));
});

test('sobre el índice real, una consulta sin sentido no devuelve nada (nunca una coincidencia inventada)', () => {
  const index = buildSearchIndex();
  const matches = searchEntries(index, 'xyzxyzxyz-no-existe-en-ningun-documento');
  assert.deepEqual(matches, []);
});
