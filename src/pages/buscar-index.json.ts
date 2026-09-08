import type { APIRoute } from 'astro';
import { buildSearchIndex } from '../domain/search-index';
import { resolvedVideoContent } from '../lib/resolved-video-content';

/**
 * Índice público de búsqueda, generado en build time como un archivo
 * estático más (igual que `sitemap.xml`) — nunca en el cliente, nunca en
 * cada petición. `buildSearchIndex()` en sí sigue sin red (los tests la
 * llaman sin argumentos); este es el único punto que le pasa los vídeos
 * curados ya resueltos una vez contra la API real de YouTube
 * (`resolvedVideoContent`, del MVP de vídeos conectados) — nunca una
 * segunda llamada propia.
 */
export const prerender = true;

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(buildSearchIndex({ videos: resolvedVideoContent })),
    {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=600',
      },
    },
  );
