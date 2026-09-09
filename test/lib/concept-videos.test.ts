import { test } from 'node:test';
import assert from 'node:assert/strict';
import { videosForConcept } from '../../src/lib/concept-videos.ts';
import { videoContentLinks } from '../../src/config/video-content-links.ts';
import type { YouTubeVideo } from '../../src/types/content.ts';

/**
 * `videosForConcept` es la pieza mínima que conecta Aprende ADC con los
 * vídeos curados: lee la relación `conceptIds` YA validada en
 * `config/video-content-links.ts`, nunca crea una nueva. Sin red: recibe
 * los vídeos ya resueltos como segundo parámetro, así se prueba contra un
 * array sintético en vez del real de YouTube.
 */
const mockVideo = (id: string, publishedAt = '2026-01-01T00:00:00Z'): YouTubeVideo => ({
  id,
  title: `Vídeo de prueba ${id}`,
  url: `https://www.youtube.com/watch?v=${id}`,
  thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  publishedAt,
  durationSeconds: 900,
  durationLabel: '15:00',
  isShort: false,
  contentType: 'video',
});

// Los 4 videoIds reales con concept:snowball confirmado en
// config/video-content-links.ts.
const snowballVideoIds = videoContentLinks
  .filter((link) => link.conceptIds?.includes('concept:snowball'))
  .map((link) => link.youtubeVideoId);

test('Snowball resuelve exactamente sus 4 vídeos reales y validados', () => {
  assert.equal(snowballVideoIds.length, 4);
  const videos = snowballVideoIds.map((id) => mockVideo(id));
  const result = videosForConcept('concept:snowball', videos);
  assert.equal(result.length, 4);
  assert.deepEqual(
    result.map((video) => video.id).sort(),
    [...snowballVideoIds].sort(),
  );
});

test('un concepto sin ningún vídeo curado resuelve a un array vacío, nunca a un hueco relleno', () => {
  const videos = snowballVideoIds.map((id) => mockVideo(id));
  const result = videosForConcept('concept:tempo', videos);
  assert.deepEqual(result, []);
});

test('un vídeo curado para un concepto pero que no llega resuelto (sin dato real) no genera ninguna entrada', () => {
  const result = videosForConcept('concept:snowball', [mockVideo(snowballVideoIds[0]!)]);
  assert.equal(result.length, 1);
});

// --- Qué conceptos tienen vídeos hoy: documenta el estado real, para que
// un cambio futuro en video-content-links.ts se note aquí si cambia el
// conjunto (Spacing, Power Spike, Trading, Tempo y Wave Management no
// tienen ningún vídeo con `conceptIds` todavía — solo Snowball). ---

test('de los 6 conceptos actuales, solo Snowball tiene algún vídeo curado con conceptIds', () => {
  const conceptIdsInUse = new Set(
    videoContentLinks.flatMap((link) => link.conceptIds ?? []),
  );
  assert.deepEqual([...conceptIdsInUse], ['concept:snowball']);
});

test('los vídeos se devuelven ordenados por fecha de publicación, más recientes primero', () => {
  const [a, b, c, d] = snowballVideoIds;
  const videos = [
    mockVideo(a!, '2026-01-01T00:00:00Z'),
    mockVideo(b!, '2026-03-01T00:00:00Z'),
    mockVideo(c!, '2026-02-01T00:00:00Z'),
    mockVideo(d!, '2026-04-01T00:00:00Z'),
  ];
  const result = videosForConcept('concept:snowball', videos);
  assert.deepEqual(
    result.map((video) => video.id),
    [d, b, c, a],
  );
});
