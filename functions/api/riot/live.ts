import type { RiotEnvironment } from '../../../src/config/riot';
import { getRiotLiveGame } from '../../../src/lib/riot/live';
import type { LiveGameResult } from '../../../src/lib/riot/live-types';

interface PagesContext {
  request: Request;
  env: RiotEnvironment;
}

/**
 * Estado de "Partida en curso" — servidor propio, nunca datos crudos de
 * Riot al cliente (§19 del encargo: la API key nunca sale de aquí). El
 * `status` siempre está presente y nunca es un 404 genérico (§3/§22):
 * `not_in_game` es un 200 real, no un error.
 *
 * Cache de edge (Cloudflare): `s-maxage=45` — muchos visitantes a la vez
 * comparten una única respuesta cacheada en el borde en vez de disparar
 * su propia llamada a Riot cada uno (§23, "el objetivo es: muchos
 * visitantes → una respuesta cacheada → pocas llamadas Riot"). El propio
 * `getRiotLiveGame` ya cachea en memoria por debajo con la misma
 * ventana — esta cabecera es la protección real y compartida entre
 * visitantes, no solo la del proceso.
 */
export const onRequest = async ({ request, env }: PagesContext) => {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'GET', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }

  const logDiagnostic = (diagnostic: unknown) => {
    console.info({ scope: 'riot-live', ...(diagnostic as object) });
  };

  const result: LiveGameResult = await getRiotLiveGame(env, logDiagnostic);

  const status =
    result.status === 'rate_limited' ? 429 : result.status === 'unavailable' ? 503 : 200;
  // not_in_game puede cambiar en cualquier momento (Tidusss puede entrar en
  // cola ya mismo) → cache corta; in_game/unavailable comparten la misma
  // ventana que ya protege el enriquecimiento por debajo.
  const cacheControl =
    result.status === 'in_game'
      ? 'public, max-age=15, s-maxage=45, stale-while-revalidate=60'
      : result.status === 'not_in_game'
        ? 'public, max-age=10, s-maxage=30, stale-while-revalidate=30'
        : 'public, s-maxage=15';

  const headers: Record<string, string> = {
    'X-Robots-Tag': 'noindex, nofollow',
    'Cache-Control': cacheControl,
  };
  if (result.status === 'rate_limited' && result.retryAfterSeconds)
    headers['Retry-After'] = String(result.retryAfterSeconds);

  return Response.json(result, { status, headers });
};
