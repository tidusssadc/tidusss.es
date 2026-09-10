import type { RiotEnvironment } from '../../../src/config/riot';
import { riotDefaults } from '../../../src/config/riot';
import {
  getRiotRankObservation,
  publicRiotError,
  RiotApiError,
  type RiotDiagnosticEvent,
} from '../../../src/lib/riot';
import {
  D1RankSnapshotRepository,
  recordObservationIfDue,
  type D1Database,
} from '../../../src/lib/rank-history';

interface Env extends RiotEnvironment {
  DB?: D1Database;
  /** Secreto compartido — nunca se acepta una escritura sin él (encargo §14/§33/§34). */
  RANK_SNAPSHOT_CRON_SECRET?: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

const logDiagnostic = (diagnostic: RiotDiagnosticEvent) => {
  const payload = { scope: 'rank-snapshot-cron', ...diagnostic };
  if (diagnostic.event === 'failure') console.warn(payload);
  else console.info(payload);
};

/**
 * `POST /api/riot/rank-snapshot-cron` — vía principal de observación del
 * histórico de rango (encargo cierre §12/§13/§19), para que crezca aunque
 * nadie visite tidusss.es. Diseñado para un disparador EXTERNO (workflow
 * programado de GitHub Actions, o un Cron Trigger de un Worker aparte) —
 * nunca se activa solo. Requiere `RANK_SNAPSHOT_CRON_SECRET` exacto en
 * `Authorization: Bearer {secreto}`; sin él, 401 inmediato sin tocar Riot
 * ni D1.
 *
 * NUNCA acepta PUUID/cola/datos del body — siempre observa la única
 * cuenta configurada del servidor (`Tidusss#FFX`), nunca es un proxy de
 * escritura arbitraria (encargo §15/§33/§34).
 *
 * COSTE RIOT (encargo cierre §18/§19 — punto crítico): usa
 * `getRiotRankObservation`, el camino LIGERO — ACCOUNT-V1 (caché 24h) +
 * LEAGUE-V4 (caché 10min) y NADA MÁS. Nunca SUMMONER-V4, nunca MATCH-V5
 * (ni ids ni detalle), nunca Match Timeline, nunca Data Dragon. En
 * caliente (el cron corre cada ~30min, la caché de ranked dura 10min):
 * como mucho 1 llamada real a LEAGUE-V4, y normalmente 0 a ACCOUNT-V1.
 * Ver el test de aislamiento en `test/api/rank-snapshot-cron.test.ts`.
 */
export const onRequest = async ({ request, env }: PagesContext) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'POST', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }
  const secret = env.RANK_SNAPSHOT_CRON_SECRET?.trim();
  const provided = request.headers
    .get('Authorization')
    ?.replace(/^Bearer\s+/i, '')
    .trim();
  if (!secret || !provided || provided !== secret) {
    return Response.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authorized.' } },
      { status: 401, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    );
  }
  if (!env.DB) {
    return Response.json(
      {
        ok: false,
        error: { code: 'STORAGE_NOT_CONFIGURED', message: 'No D1 binding.' },
      },
      { status: 503, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    );
  }
  try {
    const observation = await getRiotRankObservation(env, logDiagnostic);
    const { ranked, puuid, observedAt } = observation;

    if (!ranked.available) {
      return Response.json(
        {
          ok: true,
          data: {
            observed: { available: false },
            recorded: false,
            reason: 'no-rank-data',
            observedAt,
          },
        },
        { headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
      );
    }

    const repository = new D1RankSnapshotRepository(env.DB);
    const result = await recordObservationIfDue(repository, {
      puuid,
      queueType: riotDefaults.queueType,
      tier: ranked.tier,
      rank: ranked.rank,
      leaguePoints: ranked.leaguePoints,
      wins: ranked.wins ?? 0,
      losses: ranked.losses ?? 0,
      observedAt,
      source: 'cron',
    });

    // Diagnóstico mínimo útil (encargo §28): qué se observó, si se
    // guardó y por qué. NUNCA el PUUID, el secreto ni la API key.
    return Response.json(
      {
        ok: true,
        data: {
          observed: {
            available: true,
            tier: ranked.tier ?? null,
            rank: ranked.rank ?? null,
            leaguePoints: ranked.leaguePoints ?? null,
            wins: ranked.wins ?? 0,
            losses: ranked.losses ?? 0,
            stale: observation.rankedStale,
          },
          recorded: result.inserted,
          reason: result.reason,
          observedAt,
        },
      },
      { headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    );
  } catch (error) {
    const publicError = publicRiotError(error);
    const status = error instanceof RiotApiError ? error.status : 503;
    return Response.json(
      { ok: false, error: publicError },
      { status, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    );
  }
};
