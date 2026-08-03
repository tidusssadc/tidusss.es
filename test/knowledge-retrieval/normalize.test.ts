import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeText, tokenize, uniqueTokens } from '../../src/domain/knowledge-retrieval/normalize.ts';

test('normalizeText es determinista, en minúsculas y sin diacríticos', () => {
  assert.equal(normalizeText('¿Cuándo me hago Navori?'), 'cuando me hago navori');
  assert.equal(normalizeText('¿Cuándo me hago Navori?'), normalizeText('¿Cuándo me hago Navori?'));
});

test('tokenize elimina palabras vacías en español y tokens de un solo carácter', () => {
  assert.deepEqual(tokenize('¿Es mejor Filo Infinito o Navori?'), [
    'mejor',
    'filo',
    'infinito',
    'navori',
  ]);
});

test('tokenize es determinista', () => {
  const text = '¿Por qué Lucian sufre en late?';
  assert.deepEqual(tokenize(text), tokenize(text));
});

test('uniqueTokens elimina duplicados conservando el resto de la señal', () => {
  const tokens = uniqueTokens('Lucian, Lucian, siempre Lucian');
  assert.deepEqual([...tokens].sort(), ['lucian', 'siempre']);
});
