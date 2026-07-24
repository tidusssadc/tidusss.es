import { test } from 'node:test';
import assert from 'node:assert/strict';
import { championCatalog } from '../../src/data/league-laboratory/catalog/champions.generated.ts';

/**
 * "Blindaje" del catálogo: estas propiedades deben cumplirse para los ~173
 * campeones reales generados desde Data Dragon, no para casos inventados.
 * Si Riot añade campeones nuevos y se regenera el catálogo, estos tests
 * deben seguir pasando sin cambios.
 */

test('el catálogo tiene un tamaño realista (Riot ronda los 170+ campeones)', () => {
  assert.ok(
    championCatalog.length >= 170,
    `esperaba >= 170 campeones, hay ${championCatalog.length}`,
  );
});

test('todos los slugs son únicos', () => {
  const slugs = championCatalog.map((entry) => entry.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test('todos los ids son únicos', () => {
  const ids = championCatalog.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('ningún slug está vacío y todos usan solo minúsculas/dígitos/guiones', () => {
  const validSlug = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  for (const entry of championCatalog) {
    assert.ok(entry.slug.length > 0, `slug vacío para ${entry.name}`);
    assert.match(
      entry.slug,
      validSlug,
      `slug "${entry.slug}" (${entry.name}) usa caracteres no válidos para una URL`,
    );
  }
});

test('el id sigue siempre el formato champion:<slug>', () => {
  for (const entry of championCatalog) {
    assert.equal(entry.id, `champion:${entry.slug}`);
  }
});

test('la generación de slugs es determinista y estable en una segunda pasada', async () => {
  const { slugifyChampionKey } =
    await import('../../src/domain/league-laboratory/normalize.ts');
  for (const entry of championCatalog) {
    assert.equal(slugifyChampionKey(entry.dataDragonKey), entry.slug);
  }
});

/**
 * Contrato público ya indexado: la URL de Lucian es
 * https://tidusss.es/campeones/lucian — no puede cambiar sin una estrategia
 * de migración explícita (ver PLATFORM_BIBLE.md).
 */
test('la URL de Lucian permanece exactamente /campeones/lucian', () => {
  const lucian = championCatalog.find(
    (entry) => entry.id === 'champion:lucian',
  );
  assert.ok(lucian, 'Lucian debe existir en el catálogo generado');
  assert.equal(lucian?.slug, 'lucian');
});

/**
 * Casos reales con apóstrofes, espacios, puntos y mayúsculas internas —
 * tomados del catálogo real de Data Dragon, no inventados.
 */
const REAL_TRICKY_CASES: readonly [
  dataDragonKey: string,
  expectedSlug: string,
][] = [
  ['Kaisa', 'kaisa'],
  ['KogMaw', 'kog-maw'],
  ['RekSai', 'rek-sai'],
  ['Chogath', 'chogath'],
  ['Belveth', 'belveth'],
  ['DrMundo', 'dr-mundo'],
  ['JarvanIV', 'jarvan-iv'],
  ['MissFortune', 'miss-fortune'],
  ['AurelionSol', 'aurelion-sol'],
  ['KSante', 'k-sante'],
];

for (const [dataDragonKey, expectedSlug] of REAL_TRICKY_CASES) {
  test(`resuelve correctamente el caso real "${dataDragonKey}" -> "${expectedSlug}"`, () => {
    const entry = championCatalog.find(
      (candidate) => candidate.dataDragonKey === dataDragonKey,
    );
    assert.ok(
      entry,
      `"${dataDragonKey}" debe existir en el catálogo real generado`,
    );
    assert.equal(entry?.slug, expectedSlug);
  });
}

test('ningún campo factual obligatorio está vacío', () => {
  for (const entry of championCatalog) {
    assert.ok(entry.name.length > 0, `name vacío en ${entry.id}`);
    assert.ok(entry.title.length > 0, `title vacío en ${entry.id}`);
    assert.ok(
      entry.dataDragonKey.length > 0,
      `dataDragonKey vacío en ${entry.id}`,
    );
    assert.ok(entry.tags.length > 0, `tags vacío en ${entry.id}`);
    assert.ok(
      entry.riotDifficulty >= 0 && entry.riotDifficulty <= 10,
      `riotDifficulty fuera de rango en ${entry.id}: ${entry.riotDifficulty}`,
    );
  }
});
