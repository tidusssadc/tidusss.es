import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * `src/pages/404.astro` no exporta funciones puras — es una página, no un
 * módulo de dominio — así que este test lee su código fuente directamente,
 * a diferencia del resto de la suite. Es un contrato deliberadamente
 * mínimo: los 4 enlaces reales que el encargo exige (Inicio, Explorar,
 * Lucian, Pregunta) y el campo de búsqueda deben seguir presentes, para que
 * un cambio futuro no los borre por accidente sin que ningún test lo note.
 */
const source = readFileSync(
  fileURLToPath(new URL('../../src/pages/404.astro', import.meta.url)),
  'utf8',
);

test('la página 404 enlaza a Inicio', () => {
  assert.match(source, /href="\/"/);
});

test('la página 404 enlaza a Explorar', () => {
  assert.match(source, /href="\/explorar"/);
});

test('la página 404 enlaza a la guía de Lucian', () => {
  assert.match(source, /href="\/campeones\/lucian"/);
});

test('la página 404 enlaza a Pregunta a Tidusss', () => {
  assert.match(source, /href="\/pregunta"/);
});

test('la página 404 ofrece un campo de búsqueda real, no solo enlaces', () => {
  assert.match(source, /data-not-found-search/);
});

test('la página 404 se marca noindex — nunca se indexa una ruta rota', () => {
  assert.match(source, /noindex/);
});
