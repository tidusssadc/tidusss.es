import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchIndex } from '../../src/domain/search-index/build.ts';
import { SEARCH_CATEGORY_LABEL } from '../../src/domain/search-index/types.ts';
import { championCatalog } from '../../src/data/league-laboratory/index.ts';
import { siteUpdates } from '../../src/data/updates.ts';

const index = buildSearchIndex();

// --- Índice público: forma y ausencia de datos internos ---

const ALLOWED_KEYS = new Set([
  'id',
  'category',
  'title',
  'description',
  'href',
  'keywords',
  'patchLabel',
  'editorialStatus',
]);

test('buildSearchIndex produce un índice real, no vacío', () => {
  assert.ok(index.length > 0);
});

test('cada entrada solo expone los campos públicos declarados — nunca EditorialTake, confidence u otro dato interno', () => {
  for (const entry of index) {
    for (const key of Object.keys(entry)) {
      assert.ok(
        ALLOWED_KEYS.has(key),
        `campo inesperado "${key}" en la entrada ${entry.id} — posible fuga de dato interno`,
      );
    }
  }
});

test('cada entrada tiene id, título, descripción y href reales (nunca vacíos)', () => {
  for (const entry of index) {
    assert.ok(entry.id.trim().length > 0, `id vacío en categoría ${entry.category}`);
    assert.ok(entry.title.trim().length > 0, `título vacío en ${entry.id}`);
    assert.ok(entry.description.trim().length > 0, `descripción vacía en ${entry.id}`);
    assert.ok(entry.href.trim().length > 0, `href vacío en ${entry.id}`);
  }
});

test('cada categoría de entrada usa una etiqueta declarada en SEARCH_CATEGORY_LABEL', () => {
  for (const entry of index) {
    assert.ok(entry.category in SEARCH_CATEGORY_LABEL, `categoría desconocida: ${entry.category}`);
  }
});

test('los ids del índice son únicos — nunca dos entradas con el mismo id', () => {
  const seen = new Set<string>();
  for (const entry of index) {
    assert.ok(!seen.has(entry.id), `id duplicado: ${entry.id}`);
    seen.add(entry.id);
  }
});

// --- Estabilidad de enlaces ---

test('todos los href son rutas relativas reales del sitio (empiezan por "/"), nunca una URL externa ni un placeholder', () => {
  for (const entry of index) {
    assert.ok(
      entry.href.startsWith('/'),
      `href no relativo en ${entry.id}: "${entry.href}"`,
    );
    assert.ok(!entry.href.includes('//', 1), `href con doble barra en ${entry.id}: "${entry.href}"`);
    assert.ok(!entry.href.includes(' '), `href con espacio sin codificar en ${entry.id}: "${entry.href}"`);
  }
});

// --- Cobertura real por categoría ---

test('hay exactamente una entrada de campeón por cada campeón real del catálogo', () => {
  const championEntries = index.filter((entry) => entry.category === 'campeon');
  assert.equal(championEntries.length, championCatalog.length);
});

test('cada entrada de campeón resuelve a una página /campeones/<slug> real', () => {
  const championEntries = index.filter((entry) => entry.category === 'campeon');
  for (const entry of championEntries) {
    assert.match(entry.href, /^\/campeones\/[a-z0-9-]+$/);
  }
});

test('hay exactamente una entrada de actualización por cada entrada real de siteUpdates', () => {
  const updateEntries = index.filter((entry) => entry.category === 'actualizacion');
  assert.equal(updateEntries.length, siteUpdates.length);
});

test('no hay categorías vacías: toda categoría con al menos una entrada aparece en el índice, ninguna se declara sin datos', () => {
  const present = new Set(index.map((entry) => entry.category));
  assert.ok(present.has('campeon'));
  assert.ok(present.has('pagina'));
  assert.ok(present.has('actualizacion'));
  assert.ok(present.has('pregunta'));
});

test('las preguntas sugeridas del índice están deduplicadas — nunca la misma pregunta dos veces', () => {
  const questions = index
    .filter((entry) => entry.category === 'pregunta')
    .map((entry) => entry.title);
  assert.equal(questions.length, new Set(questions).size);
});

test('las herramientas "próximamente" (sin href real) nunca entran en el índice', () => {
  const toolEntries = index.filter((entry) => entry.category === 'herramienta');
  for (const entry of toolEntries) {
    assert.ok(entry.href.startsWith('/'));
  }
  // Las 3 herramientas "en camino" de /herramientas no tienen href — si el
  // índice las incluyera, producirían un resultado de búsqueda roto.
  const titles = toolEntries.map((entry) => entry.title);
  assert.ok(!titles.includes('Calculadora de daño'));
  assert.ok(!titles.includes('Build Planner'));
  assert.ok(!titles.includes('Comparador de campeones'));
});
