import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchIndex } from '../../src/domain/search-index/build.ts';
import { searchEntries } from '../../src/domain/search-index/rank.ts';
import { videoContentLinks } from '../../src/config/video-content-links.ts';
import type { YouTubeVideo } from '../../src/types/content.ts';

/**
 * Vídeos curados en el buscador (MVP de "biblioteca"). Usa los 10
 * `VideoContentLink` REALES (`config/video-content-links.ts`) — la única
 * parte simulada es la metadata que normalmente vendría de la API real de
 * YouTube (título/duración), porque los tests nunca deben tocar red ni
 * necesitar `YOUTUBE_API_KEY`. Las relaciones (campeón/support/rival/
 * concepto) son las mismas que ya usa la producción.
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
  assert.deepEqual(ids, ['video:O_lk-TLvO6c', 'video:pUHbcSLgKKk'].sort());
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

test('consultas reales por campeón/support/rival/concepto — recuento exacto sobre el dataset curado actual', () => {
  const expected: Record<string, number> = {
    lucian: 5,
    jhin: 2,
    ashe: 1,
    sivir: 1,
    twitch: 1,
    milio: 2,
    janna: 1,
    bard: 1,
    neeko: 1,
    draven: 1,
    nautilus: 2,
    "kai'sa": 1,
    kaisa: 1,
    vayne: 1,
    rell: 1,
    ezreal: 1,
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
