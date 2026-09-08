import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getVideoForMatch,
  validateMatchVideoLinks,
} from '../src/lib/match-video-links.ts';
import type { MatchVideoLink } from '../src/config/match-video-links.ts';
import type { YouTubeVideo } from '../src/types/content.ts';

const video = (id: string, overrides: Partial<YouTubeVideo> = {}): YouTubeVideo => ({
  id,
  title: `Vídeo ${id}`,
  url: `https://youtu.be/${id}`,
  thumbnailUrl: `https://img.example/${id}.jpg`,
  publishedAt: '2024-01-01T00:00:00.000Z',
  durationSeconds: 1800,
  durationLabel: '30:00',
  isShort: false,
  contentType: 'video',
  ...overrides,
});

const link = (overrides: Partial<MatchVideoLink> = {}): MatchVideoLink => ({
  matchId: 'EUW1_1234567890',
  youtubeVideoId: 'abcdefghijk',
  source: 'manual',
  confidence: 'verified',
  ...overrides,
});

// Reproduce exactamente la mezcla que LiveDashboard.astro hace en
// `renderMatches()`: pool "reciente" (simula los últimos 12 de
// /api/youtube) + pool resuelto en build time desde matchVideoLinks
// (simula resolved-match-video-content.ts), deduplicados por id — sin red,
// sin Astro, solo la misma lógica pura.
const mergeVideoPools = (
  recent: readonly YouTubeVideo[],
  resolved: readonly YouTubeVideo[],
): YouTubeVideo[] => [...new Map([...recent, ...resolved].map((v) => [v.id, v])).values()];

// --- A) matchId verificado + vídeo presente entre "recientes" → resuelve ---

test('un matchId verificado cuyo vídeo está entre los recientes se resuelve', () => {
  const recentVideo = video('recent0001a');
  const links: MatchVideoLink[] = [
    link({ matchId: 'EUW1_1111111111', youtubeVideoId: 'recent0001a' }),
  ];
  const resolved = getVideoForMatch('EUW1_1111111111', [recentVideo], links);
  assert.equal(resolved?.id, 'recent0001a');
});

// --- B) matchId verificado + vídeo NO entre los últimos 12 pero resoluble
// por la nueva vía (resolved-match-video-content) → resuelve ---

test('un matchId verificado cuyo vídeo ya no está entre los últimos 12 se resuelve vía el pool resuelto en build time', () => {
  const oldVideo = video('oldvideo001');
  const links: MatchVideoLink[] = [
    link({ matchId: 'EUW1_2222222222', youtubeVideoId: 'oldvideo001' }),
  ];
  // "recientes" no lo incluye (ya salió de los últimos 12 subidos);
  // "resolved" sí, porque resolved-match-video-content.ts lo pide por id
  // explícito, no por recencia.
  const recent: YouTubeVideo[] = [video('otronuevo01'), video('otronuevo02')];
  const resolvedFromBuild: YouTubeVideo[] = [oldVideo];
  const pool = mergeVideoPools(recent, resolvedFromBuild);
  const resolved = getVideoForMatch('EUW1_2222222222', pool, links);
  assert.equal(resolved?.id, 'oldvideo001');
});

// --- C) matchId sin asociación → no muestra vídeo ---

test('un matchId sin ninguna asociación en matchVideoLinks no resuelve ningún vídeo', () => {
  const pool = mergeVideoPools([video('cualquiera1')], [video('cualquiera2')]);
  const resolved = getVideoForMatch('EUW1_3333333333', pool, []);
  assert.equal(resolved, null);
});

// --- D) asociación no válida / no resoluble → fallback seguro (null, no
// excepción, nada que rompa MatchCard) ---

test('una asociación cuyo vídeo no aparece en ningún pool resuelve a null de forma segura', () => {
  const links: MatchVideoLink[] = [
    link({ matchId: 'EUW1_4444444444', youtubeVideoId: 'noexiste001' }),
  ];
  const pool = mergeVideoPools([video('otro0000001')], []);
  const resolved = getVideoForMatch('EUW1_4444444444', pool, links);
  assert.equal(resolved, null);
});

test('validateMatchVideoLinks marca VIDEO_NOT_FOUND cuando el vídeo no está resuelto en ningún pool, sin lanzar', () => {
  const links: MatchVideoLink[] = [
    link({ matchId: 'EUW1_5555555555', youtubeVideoId: 'noexiste002' }),
  ];
  const pool = mergeVideoPools([video('otro0000002')], []);
  const issues = validateMatchVideoLinks(links, pool);
  assert.equal(
    issues.some((issue) => issue.reason === 'VIDEO_NOT_FOUND'),
    true,
  );
});

// --- E) solo confidence: 'verified' produce relación ---

test('un link con confidence distinto de verified no produce ninguna relación', () => {
  const linksNoVerified = [
    { ...link({ matchId: 'EUW1_6666666666', youtubeVideoId: 'candidato01' }), confidence: 'pending' as unknown as 'verified' },
  ];
  const pool = mergeVideoPools([video('candidato01')], []);
  const resolved = getVideoForMatch('EUW1_6666666666', pool, linksNoVerified);
  assert.equal(resolved, null);
});

test('con matchVideoLinks vacío (estado real hoy) ninguna partida resuelve vídeo', () => {
  const pool = mergeVideoPools([video('recientazo1')], []);
  const resolved = getVideoForMatch('EUW1_7777777777', pool, []);
  assert.equal(resolved, null);
});
