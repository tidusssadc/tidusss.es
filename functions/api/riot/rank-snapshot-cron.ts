import type { RiotEnvironment } from '../../../src/config/riot';
import { riotDefaults } from '../../../src/config/riot';
import {
  getRiotOverview,
  publicRiotError,
  RiotApiError,
  resolveSelfAccountPuuid,
  type RiotDiagnosticEvent,
} from '../../../src/lib/riot';
import {
  D1RankSnapshotRepository,
  recordObservationIfDue,
  type D1Database,
} from '../../../src/lib/rank-history';

interface Env extends RiotEnvironment {
  DB?: D1Database;
  /** Secreto compartido — nunca se acepta una escritura sin él (encargo §33/§34). */
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
 * `POST /api/riot/rank-snapshot-cron` — vía secundaria de observación
 * (encargo §19/§20/§21), para que el histórico crezca aunque nadie
 * visite la web. Diseñado para ser llamado por un disparador externo
 * (Cloudflare Cron Trigger de un Worker aparte, o un servicio de cron
 * externo) — NO se activa solo. Requiere `RANK_SNAPSHOT_CRON_SECRET`
 * exacto en `Authorization: Bearer {secreto}`; sin él, 401 inmediato,
 * sin tocar Riot ni D1. Nunca acepta PUUID/datos del body — siempre
 * resuelve la única cuenta configurada del servidor (nunca un proxy de
 * escritura arbitraria, encargo §33/§34).
 *
 * Coste Riot: reutiliza exactamente `getRiotOverview` (la misma
 * orquestación cacheada que `/api/riot/overview`) — nunca duplica
 * lógica Riot (encargo §29). En frío: la misma llamada real que ya
 * documenta `docs/riot-api.md` para overview. En caliente (el cron
 * corre más a menudo que el TTL de la caché de ranked, 10 min): 0
 * llamadas Riot nuevas, solo lectura de caché de memoria del isolate
 * que lo ejecute — nunca se afirma que esa caché esté garantizada
 * compartida entre invocaciones (encargo §11).
 */
export const onRequest = async ({ request, env }: PagesContext) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'POST', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }
  const secret = env.RANK_SNAPSHOT_CRON_SECRET?.trim();
  const provided = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!secret || !provided || provided !== secret) {
    return Response.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authorized.' } },
      { status: 401, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    );
  }
  if (!env.DB) {
    return Response.json(
      { ok: false, error: { code: 'STORAGE_NOT_CONFIGURED', message: 'No D1 binding.' } },
      { status: 503, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    );
  }
  try {
    const data = await getRiotOverview(env, logDiagnostic);
    if (!data.ranked.available) {
      return Response.json(
        { ok: true, data: { recorded: false, reason: 'no-rank-data' } },
        { headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
      );
    }
    const puuid = await resolveSelfAccountPuuid(env, logDiagnostic);
    if (!puuid) {
      return Response.json(
        { ok: false, error: { code: 'ACCOUNT_UNRESOLVED', message: 'Could not resolve account.' } },
        { status: 503, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
      );
    }
    const repository = new D1RankSnapshotRepository(env.DB);
    const result = await recordObservationIfDue(repository, {
      puuid,
      queueType: riotDefaults.queueType,
      tier: data.ranked.tier,
      rank: data.ranked.rank,
      leaguePoints: data.ranked.leaguePoints,
      wins: data.ranked.wins ?? 0,
      losses: data.ranked.losses ?? 0,
      observedAt: data.updatedAt,
      source: 'cron',
    });
    return Response.json(
      { ok: true, data: result },
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
