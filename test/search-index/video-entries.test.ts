import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchIndex } from '../../src/domain/search-index/build.ts';
import { searchEntries } from '../../src/domain/search-index/rank.ts';
import { videoContentLinks } from '../../src/config/video-content-links.ts';
import { championCatalog } from '../../src/data/league-laboratory/catalog/champions.generated.ts';
import { leagueLaboratoryConcepts } from '../../src/data/league-laboratory/concepts.ts';
import { adcLabChampions } from '../../src/data/league-laboratory/champions.ts';
import { resolveChampionEditorialStatus } from '../../src/domain/league-laboratory/registry.ts';
import type { YouTubeVideo } from '../../src/types/content.ts';

/**
 * Vídeos curados en el buscador (MVP de "biblioteca"). Usa los 17
 * `VideoContentLink` REALES (`config/video-content-links.ts` — los 10
 * originales más los 7 validados manualmente por Tidusss en la fase
 * "curación manual + Aprende ADC") — la única parte simulada es la
 * metadata que normalmente vendría de la API real de YouTube
 * (título/duración), porque los tests nunca deben tocar red ni necesitar
 * `YOUTUBE_API_KEY`. Las relaciones (campeón/support/rival/concepto) son
 * las mismas que ya usa la producción.
 */
const mockVideo = (id: string): YouTubeVideo => ({
  id,
  title: `Vídeo de prueba ${id}`,
  url: `https://www.youtube.com/watch?v=${id}`,
  thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  publishedAt: '2026-01-01T00:00:00Z',
  durationSeconds: 900,
  durationLabel: '15:00',
  isShort: false,
  contentType: 'video',
});

const allMockVideos = videoContentLinks.map((link) => mockVideo(link.youtubeVideoId));
const indexWithVideos = buildSearchIndex({ videos: allMockVideos });
const videoResultsFor = (query: string) =>
  searchEntries(indexWithVideos, query).filter((match) => match.entry.category === 'video');

test('buildSearchIndex sin el parámetro videos sigue funcionando sin red (los 480 tests existentes ya lo prueban) y no genera ninguna entrada de vídeo', () => {
  const index = buildSearchIndex();
  assert.equal(index.filter((entry) => entry.category === 'video').length, 0);
});

test('con los vídeos resueltos, hay exactamente una entrada de vídeo por cada VideoContentLink real', () => {
  const videoEntries = indexWithVideos.filter((entry) => entry.category === 'video');
  assert.equal(videoEntries.length, videoContentLinks.length);
});

test('un VideoContentLink cuyo id no llega en `videos` no genera ninguna entrada (sin dato real, no aparece — nunca un resultado roto)', () => {
  const index = buildSearchIndex({ videos: [mockVideo('O_lk-TLvO6c')] });
  assert.equal(index.filter((entry) => entry.category === 'video').length, 1);
});

test('el vídeo de Lucian + Milio expone "Lucian" y "Milio" como keywords humanas, nunca los ids internos', () => {
  const entry = indexWithVideos.find((e) => e.id === 'video:O_lk-TLvO6c');
  assert.ok(entry);
  assert.ok(entry!.keywords.includes('Lucian'));
  assert.ok(entry!.keywords.includes('Milio'));
  assert.ok(!entry!.keywords.some((k) => k.startsWith('champion:')));
});

test('"draven" encuentra el vídeo donde Draven es rival, vía la relación real (no aparece en el título simulado)', () => {
  const results = videoResultsFor('draven');
  assert.equal(results.length, 1);
  assert.equal(results[0]?.entry.id, 'video:pUHbcSLgKKk');
});

test('"snowball" encuentra los 4 vídeos reales con concept:snowball confirmado', () => {
  assert.equal(videoResultsFor('snowball').length, 4);
});

test('"lucian milio" (AND) devuelve solo vídeos con ambas relaciones — nunca uno que solo tenga a Lucian', () => {
  const results = videoResultsFor('lucian milio');
  const ids = results.map((match) => match.entry.id).sort();
  assert.deepEqual(
    ids,
    ['video:O_lk-TLvO6c', 'video:pUHbcSLgKKk', 'video:__Mml-XvyAg'].sort(),
  );
});

test('"lucian nami" (AND) devuelve los 3 vídeos reales con ambas relaciones (Nami como rival o como aliada)', () => {
  const results = videoResultsFor('lucian nami');
  const ids = results.map((match) => match.entry.id).sort();
  assert.deepEqual(
    ids,
    ['video:O_lk-TLvO6c', 'video:mI2IcjtILQg', 'video:N918ahYrxos'].sort(),
  );
});

test('"lucian draven" (AND) devuelve exactamente el vídeo real del matchup', () => {
  const results = videoResultsFor('lucian draven');
  assert.equal(results.length, 1);
  assert.equal(results[0]?.entry.id, 'video:pUHbcSLgKKk');
});

test('"lucian nautilus" (AND) devuelve los DOS vídeos reales donde Nautilus es rival — honesto con los datos, nunca forzado a un único resultado', () => {
  const results = videoResultsFor('lucian nautilus');
  const ids = results.map((match) => match.entry.id).sort();
  assert.deepEqual(ids, ['video:0euHsNWgxoo', 'video:pUHbcSLgKKk'].sort());
});

test('consultas reales por campeón/support/rival/concepto — recuento exacto sobre el dataset curado actual (17 vídeos)', () => {
  const expected: Record<string, number> = {
    lucian: 11,
    jhin: 2,
    ashe: 1,
    sivir: 1,
    twitch: 1,
    milio: 3,
    janna: 1,
    bard: 1,
    neeko: 1,
    draven: 1,
    nautilus: 2,
    "kai'sa": 1,
    kaisa: 1,
    // Vayne aparece en 2 vídeos por keyword: 1 como rival (mI2IcjtILQg,
    // preexistente) + 1 como su propio campeón jugado (VSaYyIBNk2o,
    // validado en esta fase) — distinto del recuento "1" por
    // `championIds` de la sección de distribución más abajo.
    vayne: 2,
    rell: 1,
    ezreal: 1,
    // Nami aparece en 3 vídeos: rival en O_lk-TLvO6c (preexistente), aliada
    // en mI2IcjtILQg (preexistente) y aliada en N918ahYrxos (validado en
    // esta fase).
    nami: 3,
    snowball: 4,
  };
  for (const [query, count] of Object.entries(expected)) {
    assert.equal(
      videoResultsFor(query).length,
      count,
      `"${query}" debería encontrar ${count} vídeo(s)`,
    );
  }
});

// --- Distribución por ADC (championIds) tras la curación manual —
// baseline explícito de la fase "curación manual + Aprende ADC" ---

test('hay exactamente 17 vídeos curados en total, sin videoId duplicado', () => {
  assert.equal(videoContentLinks.length, 17);
  const ids = videoContentLinks.map((link) => link.youtubeVideoId);
  assert.equal(ids.length, new Set(ids).size);
});

test('toda relación de campeón (championIds/allySupportIds/enemyChampionIds) apunta a un campeón real del catálogo', () => {
  const catalogIds = new Set(championCatalog.map((entry) => entry.id));
  for (const link of videoContentLinks) {
    for (const id of [
      ...(link.championIds ?? []),
      ...(link.allySupportIds ?? []),
      ...(link.enemyChampionIds ?? []),
    ]) {
      assert.ok(catalogIds.has(id), `${id} en ${link.youtubeVideoId} no existe en el catálogo real`);
    }
  }
});

test('toda relación de concepto (conceptIds) apunta a un concepto real de Aprende ADC', () => {
  const conceptIds = new Set(leagueLaboratoryConcepts.map((concept) => concept.id));
  for (const link of videoContentLinks) {
    for (const id of link.conceptIds ?? []) {
      assert.ok(conceptIds.has(id), `${id} en ${link.youtubeVideoId} no existe en leagueLaboratoryConcepts`);
    }
  }
});

test('Vayne no adquiere estado editorial por tener un vídeo curado: sigue sin LabChampion, sigue siendo "pending"', () => {
  const vayneLabChampion = adcLabChampions.find((champion) => champion.id === 'champion:vayne');
  assert.equal(vayneLabChampion, undefined);
  assert.equal(resolveChampionEditorialStatus(vayneLabChampion), 'pending');
});

test('distribución por ADC (championIds): Lucian 11, Jhin 2, Ashe 1, Sivir 1, Twitch 1, Vayne 1', () => {
  const countFor = (championId: string) =>
    videoContentLinks.filter((link) => link.championIds?.includes(championId as never)).length;
  assert.equal(countFor('champion:lucian'), 11);
  assert.equal(countFor('champion:jhin'), 2);
  assert.equal(countFor('champion:ashe'), 1);
  assert.equal(countFor('champion:sivir'), 1);
  assert.equal(countFor('champion:twitch'), 1);
  assert.equal(countFor('champion:vayne'), 1);
});

// --- "OTP Lucian" es metadata histórica real del título de YouTube
// (3Zgrl-HbZt4) — puede mostrarse tal cual en `entry.title`, pero nunca
// como keyword editorial: `videoEntries()` solo deriva keywords de los
// NOMBRES de campeón/concepto de las relaciones curadas, nunca del texto
// del título — estructuralmente no hay ningún campo en `VideoContentLink`
// para "keywords" manuales. ---

test('"OTP" no aparece como keyword editorial en ningún vídeo — solo puede aparecer, si acaso, dentro del título real de YouTube', () => {
  for (const entry of indexWithVideos.filter((e) => e.category === 'video')) {
    assert.ok(
      !entry.keywords.some((keyword) => keyword.toLowerCase().includes('otp')),
      `"OTP" apareció como keyword en ${entry.id}`,
    );
  }
});

test('el vídeo con título histórico real "OTP Lucian" se indexa con ese título tal cual, pero sin "otp" en sus keywords', () => {
  const otpTitle = '🔥 Así juega un OTP Lucian en Master | SoloQ Gameplay';
  const index = buildSearchIndex({
    videos: [{ ...mockVideo('3Zgrl-HbZt4'), title: otpTitle }],
  });
  const entry = index.find((e) => e.id === 'video:3Zgrl-HbZt4');
  assert.ok(entry);
  assert.equal(entry!.title, otpTitle);
  assert.ok(entry!.keywords.includes('Lucian'));
  assert.ok(!entry!.keywords.some((keyword) => keyword.toLowerCase().includes('otp')));
});
