import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveChampionEditorialStatus } from '../../src/domain/league-laboratory/registry.ts';
import {
  ezreal,
  jinx,
  kaisa,
  lucian,
} from '../../src/data/league-laboratory/champions.ts';

test('un campeón con perfil editorial (Lucian) resuelve a "reviewed"', () => {
  assert.equal(resolveChampionEditorialStatus(lucian), 'reviewed');
});

test('un campeón curado pero sin perfil (Kai\'Sa, Jinx, Ezreal) resuelve a "draft"', () => {
  assert.equal(resolveChampionEditorialStatus(kaisa), 'draft');
  assert.equal(resolveChampionEditorialStatus(jinx), 'draft');
  assert.equal(resolveChampionEditorialStatus(ezreal), 'draft');
});

test('un campeón sin ningún LabChampion resuelve a "pending"', () => {
  assert.equal(resolveChampionEditorialStatus(undefined), 'pending');
});
