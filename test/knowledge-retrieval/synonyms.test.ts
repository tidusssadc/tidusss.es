import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalizeToken } from '../../src/domain/knowledge-retrieval/synonyms.ts';
import { tokenize } from '../../src/domain/knowledge-retrieval/normalize.ts';

test('canonicalizeToken es determinista y pura', () => {
  assert.equal(canonicalizeToken('intercambios'), canonicalizeToken('intercambios'));
});

test('canonicalizeToken normaliza cada grupo de sinónimos justificado por el corpus', () => {
  assert.equal(canonicalizeToken('intercambios'), 'intercambio');
  assert.equal(canonicalizeToken('trading'), 'intercambio');
  assert.equal(canonicalizeToken('tradear'), 'intercambio');
  assert.equal(canonicalizeToken('fuerte'), 'poder');
  assert.equal(canonicalizeToken('spike'), 'poder');
  assert.equal(canonicalizeToken('pico'), 'poder');
  assert.equal(canonicalizeToken('cd'), 'enfriamiento');
  assert.equal(canonicalizeToken('cooldown'), 'enfriamiento');
  assert.equal(canonicalizeToken('autoataque'), 'basico');
  assert.equal(canonicalizeToken('aa'), 'basico');
  assert.equal(canonicalizeToken('support'), 'soporte');
  assert.equal(canonicalizeToken('tardio'), 'late');
  assert.equal(canonicalizeToken('early'), 'temprana');
  assert.equal(canonicalizeToken('objetos'), 'build');
  assert.equal(canonicalizeToken('runas'), 'runa');
  assert.equal(canonicalizeToken('sinergias'), 'sinergia');
});

test('canonicalizeToken no altera un token que no pertenece a ningún grupo', () => {
  assert.equal(canonicalizeToken('lucian'), 'lucian');
  assert.equal(canonicalizeToken('combos'), 'combos');
});

test('tokenize aplica la canonicalización de sinónimos de extremo a extremo', () => {
  assert.deepEqual(tokenize('¿Cómo debo jugar los intercambios?'), ['debo', 'jugar', 'intercambio']);
  assert.deepEqual(tokenize('¿Cuándo es fuerte Lucian?'), ['poder', 'lucian']);
});

test('la forma canónica del corpus real y la de una variante de la pregunta coinciden tras tokenize', () => {
  // "El intercambio de daño..." (concept:trading, contenido real) frente a "intercambios" (pregunta).
  const corpusToken = tokenize('El intercambio de daño entre dos campeones.');
  const queryToken = tokenize('¿Cómo juego los intercambios?');
  assert.ok(corpusToken.includes('intercambio'));
  assert.ok(queryToken.includes('intercambio'));
});
