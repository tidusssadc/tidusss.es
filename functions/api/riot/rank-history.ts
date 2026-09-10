import type { RiotEnvironment } from '../../../src/config/riot';
import { riotDefaults } from '../../../src/config/riot';
import { resolveSelfAccountPuuid } from '../../../src/lib/riot';
import {
  D1RankSnapshotRepository,
  buildRankEvolution,
  unavailableRankEvolution,
  type D1Database,
  type RankEvolutionSummary,
} from '../../../src/lib/rank-history';

interface Env extends RiotEnvironment {
  DB?: D1Database;
}

interface PagesContext {
  request: Request;
  env: Env;
}

export type RankHistoryPublicResponse =
  | { ok: true; data: RankEvolutionSummary }
  | { ok: false; error: { code: string; message: string } };

/** Cuántos snapshots recientes trae el gráfico — suficiente para una evolución real sin cargar todo el histórico en cada visita. */
const RECENT_LIMIT = 200;

/**
 * `GET /api/riot/rank-history` — solo lectura (encargo §33: "NO endpoint
 * público que permita insertar snapshots arbitrarios"). Nunca acepta
 * PUUID del cliente: siempre resuelve la cuenta configurada del propio
 * servidor, igual que el resto de `/api/riot/*`.
 */
export const onRequest = async ({ request, env }: PagesContext) => {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'GET', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }
  if (!env.DB) {
    const body: RankHistoryPublicResponse = { ok: true, data: unavailableRankEvolution() };
    return Response.json(body, {
      headers: {
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'public, s-maxage=300',
      },
    });
  }
  try {
    const puuid = await resolveSelfAccountPuuid(env);
    if (!puuid) {
      const body: RankHistoryPublicResponse = { ok: true, data: unavailableRankEvolution() };
      return Response.json(body, {
        headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'public, s-maxage=60' },
      });
    }
    const repository = new D1RankSnapshotRepository(env.DB);
    const [recentDescending, firstObservedAt] = await Promise.all([
      repository.listRecent(puuid, riotDefaults.queueType, RECENT_LIMIT),
      repository.getFirstObservedAt(puuid, riotDefaults.queueType),
    ]);
    const data = buildRankEvolution(recentDescending, firstObservedAt);
    const body: RankHistoryPublicResponse = { ok: true, data };
    return Response.json(body, {
      headers: {
        'X-Robots-Tag': 'noindex, nofollow',
        // El histórico crece lentamente (política de heartbeat de 6h) —
        // un s-maxage corto no aporta nada aquí, pero tampoco hace falta
        // uno largo: es barato de calcular (una única lectura D1).
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=900',
      },
    });
  } catch (error) {
    console.warn({
      scope: 'rank-history',
      event: 'read-failed',
      message: error instanceof Error ? error.message : String(error),
    });
    // Storage caído no es un 500 público (encargo §32) — el histórico se
    // reporta como no disponible ahora mismo, nunca rompe la página.
    const body: RankHistoryPublicResponse = { ok: true, data: unavailableRankEvolution() };
    return Response.json(body, {
      headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'public, s-maxage=30' },
    });
  }
};
