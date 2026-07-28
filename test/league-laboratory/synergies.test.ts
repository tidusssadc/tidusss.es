import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leagueLaboratorySynergies } from '../../src/data/league-laboratory/synergies.ts';
import { championCatalog } from '../../src/data/league-laboratory/catalog/champions.generated.ts';

const EXPECTED_PARTNERS = [
  'champion:milio',
  'champion:nami',
  'champion:yuumi',
  'champion:braum',
  'champion:nautilus',
  'champion:pyke',
];

test('existen las 6 sinergias confirmadas por Tidusss, ni más ni menos', () => {
  assert.equal(leagueLaboratorySynergies.length, 6);
});

test('cada sinergia empareja a Lucian con exactamente uno de los 6 socios confirmados', () => {
  const partners = leagueLaboratorySynergies.map((synergy) =>
    synergy.championIds.find((id) => id !== 'champion:lucian'),
  );
  assert.deepEqual(new Set(partners), new Set(EXPECTED_PARTNERS));
  for (const synergy of leagueLaboratorySynergies) {
    assert.ok(synergy.championIds.includes('champion:lucian'));
    assert.equal(synergy.championIds.length, 2);
  }
});

test('todos los socios de sinergia existen de verdad en el catálogo real', () => {
  const catalogIds = new Set<string>(championCatalog.map((entry) => entry.id));
  for (const id of EXPECTED_PARTNERS) {
    assert.ok(catalogIds.has(id), `${id} no existe en el catálogo real`);
  }
});

test('ninguna sinergia declara un tier o clasificación numérica no respaldada', () => {
  for (const synergy of leagueLaboratorySynergies) {
    assert.equal(
      (synergy as unknown as Record<string, unknown>).tier,
      undefined,
    );
  }
});
