import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSearchText,
  slugifyChampionKey,
} from '../../src/domain/league-laboratory/normalize.ts';

/**
 * Casos reales exigidos: la búsqueda del Centro de Campeones debe encontrar
 * estos campeones tecleando la versión sin tildes/apóstrofes/puntuación.
 */
const REAL_SEARCH_CASES: readonly [name: string, query: string][] = [
  ["Kai'Sa", 'kaisa'],
  ["Kog'Maw", 'kogmaw'],
  ["Rek'Sai", 'reksai'],
  ["Cho'Gath", 'chogath'],
  ["Bel'Veth", 'belveth'],
  ['Dr. Mundo', 'dr mundo'],
  ['Jarvan IV', 'jarvan'],
  ['Miss Fortune', 'miss fortune'],
];

for (const [name, query] of REAL_SEARCH_CASES) {
  test(`normalizeSearchText: "${name}" se encuentra buscando "${query}"`, () => {
    assert.ok(normalizeSearchText(name).includes(normalizeSearchText(query)));
  });
}

test('normalizeSearchText es insensible a mayúsculas', () => {
  assert.equal(normalizeSearchText('LUCIAN'), normalizeSearchText('lucian'));
});

test('normalizeSearchText colapsa espacios múltiples', () => {
  assert.equal(
    normalizeSearchText('Miss   Fortune'),
    normalizeSearchText('Miss Fortune'),
  );
});

test('slugifyChampionKey: transiciones minúscula-mayúscula reales de Data Dragon', () => {
  assert.equal(slugifyChampionKey('AurelionSol'), 'aurelion-sol');
  assert.equal(slugifyChampionKey('JarvanIV'), 'jarvan-iv');
  assert.equal(slugifyChampionKey('DrMundo'), 'dr-mundo');
  assert.equal(slugifyChampionKey('MissFortune'), 'miss-fortune');
});

test('slugifyChampionKey: siglas seguidas de palabra ("KSante")', () => {
  assert.equal(slugifyChampionKey('KSante'), 'k-sante');
});

test('slugifyChampionKey: clave ya en minúsculas no cambia de forma', () => {
  assert.equal(slugifyChampionKey('lucian'), 'lucian');
});
