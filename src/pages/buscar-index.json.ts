import type { APIRoute } from 'astro';
import { buildSearchIndex } from '../domain/search-index';

/**
 * Índice público de búsqueda, generado en build time como un archivo
 * estático más (igual que `sitemap.xml`) — nunca en el cliente, nunca en
 * cada petición. No hay red ni servicio externo: es el mismo array que
 * `buildSearchIndex()` calcula desde los datos ya existentes del sitio.
 */
export const prerender = true;

export const GET: APIRoute = () =>
  new Response(JSON.stringify(buildSearchIndex()), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=600',
    },
  });
