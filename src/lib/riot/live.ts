import { getRiotConfig, type RiotEnvironment } from '../../config/riot';
import { findKnownPlayerIdentity, knownPlayerIdentities } from '../../config/known-players';
import { getRiotOverview, resolveSelfAccount } from './index';
import { cached } from './cache';
import { createRiotClient, type RiotDiagnosticLogger } from './client';
import { dataDragonUrls, getDataDragonVersion } from './datadragon';
import { RiotApiError } from './errors';
import { normalizeRanked } from './normalize';
import { normalizeLiveGame, type LiveNormalizeContext } from './live-normalize';
import type {
  RiotAccountDto,
  RiotCurrentGameInfoDto,
  RiotLeagueEntryDto,
} from './types';
import type {
  KnownPlayerIdentity,
  LiveGameResult,
  LiveParticipantRanked,
  LiveParticipantRecentForm,
} from './live-types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const encode = encodeURIComponent;

/** Forma mínima de `runesReforged.json` (Data Dragon) que este módulo necesita — no es una respuesta de Riot API, solo del CDN estático. */
interface RuneStyleDto {
  slots?: Array<{
    runes?: Array<{ id?: number; name?: string; icon?: string }>;
  }>;
}

/**
 * `champion.json` de Data Dragon (mismo CDN oficial que ya usa el resto
 * del sitio) es la única fuente que mapea el `championId` NUMÉRICO que da
 * spectator-v5 a la clave (`id`) que Data Dragon espera para resolver un
 * icono — Match-V5 da el nombre directamente y por eso `normalize.ts`
 * nunca necesitó esto; spectator-v5 no. No se toca el catálogo de
 * campeones de la web (`champions.generated.ts`, ADC/`league-laboratory`)
 * para esto — sería una fuente nueva y un acoplamiento a la arquitectura
 * ADC que esta fase debe dejar intacta. Cache larga: la relación
 * id↔clave de un campeón no cambia entre parches salvo un campeón nuevo.
 */
const getChampionNameById = async (
  version: string,
): Promise<ReadonlyMap<number, string>> => {
  const result = await cached(
    `riot:live:champion-map:${version}`,
    6 * HOUR,
    24 * HOUR,
    async () => {
      const response = await fetch(
        `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`,
      );
      if (!response.ok) return {} as Record<string, { key?: string }>;
      const payload = (await response.json()) as {
        data?: Record<string, { key?: string }>;
      };
      return payload.data ?? {};
    },
  );
  const map = new Map<number, string>();
  for (const [name, entry] of Object.entries(result.value)) {
    const numericId = entry.key ? Number(entry.key) : undefined;
    if (numericId !== undefined && Number.isFinite(numericId)) map.set(numericId, name);
  }
  return map;
};

/**
 * `runesReforged.json` de Data Dragon (mismo CDN oficial, sin clave y sin
 * límite de Riot que `champion.json`) — la única fuente que mapea el id
 * de una runa exacta (keystone incluida) a su nombre/icono. Aplana los 5
 * árboles × sus slots en un único `Map<id, {name, imageUrl}>`: para
 * resolver una keystone concreta no importa a qué árbol pertenece, solo
 * su id (que ya viene en `perks.perkIds[0]` de spectator-v5). Cache larga:
 * igual que el catálogo de campeones, esto no cambia entre partidas.
 */
const getKeystoneById = async (
  version: string,
): Promise<ReadonlyMap<number, { name: string; imageUrl: string }>> => {
  const result = await cached(
    `riot:live:runes-reforged:${version}`,
    6 * HOUR,
    24 * HOUR,
    async () => {
      const response = await fetch(
        `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/runesReforged.json`,
      );
      if (!response.ok) return [] as RuneStyleDto[];
      return (await response.json()) as RuneStyleDto[];
    },
  );
  const map = new Map<number, { name: string; imageUrl: string }>();
  for (const style of result.value) {
    for (const slot of style.slots ?? []) {
      for (const rune of slot.runes ?? []) {
        if (rune.id === undefined || !rune.name || !rune.icon) continue;
        map.set(rune.id, {
          name: rune.name,
          imageUrl: `https://ddragon.leagueoflegends.com/cdn/img/${rune.icon}`,
        });
      }
    }
  }
  return map;
};

/**
 * Riot ID real (`GameName#TAG`) por PUUID — spectator-v5 ya NO lo da
 * (`summonerName` está deprecado y suele venir vacío); se resuelve aparte
 * contra account-v1, igual que ya hace `getRiotOverview` para Tidusss.
 * Cache larga (24h): un Riot ID no cambia dentro de una misma partida ni,
 * en la práctica, con frecuencia.
 */
const resolveRiotIdByPuuid = async (
  client: ReturnType<typeof createRiotClient>,
  regionalBase: string,
  puuid: string,
): Promise<string | undefined> => {
  try {
    const result = await cached(`riot:account-by-puuid:${puuid}`, 24 * HOUR, 24 * HOUR, () =>
      client.get<RiotAccountDto>(
        `${regionalBase}/riot/account/v1/accounts/by-puuid/${encode(puuid)}`,
        { phase: 'account', endpoint: 'ACCOUNT-V1 /riot/account/v1/accounts/by-puuid/{puuid}' },
      ),
    );
    const { gameName, tagLine } = result.value;
    return gameName && tagLine ? `${gameName}#${tagLine}` : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Rango Solo/Duo por PUUID — mismo endpoint y mismo criterio de "sin
 * clasificación" (`normalizeRanked`) que ya usa `getRiotOverview` para
 * Tidusss, ahora reutilizado para cualquiera de los 10 participantes. Un
 * jugador sin partidas ranked da un array vacío real, no un error — nunca
 * bloquea al resto (§18: "no cascada de error si un jugador no tiene rank
 * Solo/Duo").
 */
const resolveRankedByPuuid = async (
  client: ReturnType<typeof createRiotClient>,
  platformBase: string,
  puuid: string,
): Promise<LiveParticipantRanked | undefined> => {
  try {
    const result = await cached(`riot:ranked:${puuid}`, 10 * MINUTE, 6 * HOUR, () =>
      client.get<RiotLeagueEntryDto[]>(
        `${platformBase}/lol/league/v4/entries/by-puuid/${encode(puuid)}`,
        { phase: 'league', endpoint: 'LEAGUE-V4 /lol/league/v4/entries/by-puuid/{puuid}' },
      ),
    );
    return normalizeRanked(result.value);
  } catch {
    return undefined;
  }
};

/**
 * Forma reciente — SOLO para Tidusss, reutilizando `getRiotOverview` (ya
 * cacheado agresivamente para el propio dashboard) en vez de una llamada
 * nueva. Enriquecer así a los otros 9 participantes multiplicaría las
 * llamadas a match-v5 (varias por jugador) muy por encima de lo razonable
 * para una vista que ya se refresca sola cada 30-60s — decisión
 * documentada en el informe de entrega, no un olvido.
 */
const resolveSelfRecentForm = async (
  environment: RiotEnvironment,
  diagnostics?: RiotDiagnosticLogger,
): Promise<LiveParticipantRecentForm | undefined> => {
  try {
    const overview = await getRiotOverview(environment, diagnostics);
    const sample = overview.recent.matches.slice(0, 5);
    if (sample.length === 0) return undefined;
    const wins = sample.filter((match) => match.win).length;
    const kdaValues = sample.map((match) => match.kda);
    return {
      sampleSize: sample.length,
      wins,
      losses: sample.length - wins,
      winRate: Math.round((wins / sample.length) * 100),
      averageKda: Number(
        (kdaValues.reduce((sum, value) => sum + value, 0) / kdaValues.length).toFixed(2),
      ),
    };
  } catch {
    return undefined;
  }
};

const identityFor =
  (registry: readonly KnownPlayerIdentity[]) =>
  (puuid: string | undefined, riotId: string | undefined) =>
    findKnownPlayerIdentity(puuid, riotId, registry);

/**
 * Punto de entrada único de "Partida en curso" — nunca lanza: cualquier
 * fallo se traduce a un `LiveGameResult` con estado explícito
 * (`not_in_game`/`unavailable`/`rate_limited`), igual que el resto del
 * sitio nunca deja que un fallo de Riot rompa la página. `spectator-v5`
 * respondiendo 404 significa literalmente "no está en partida" — nunca se
 * presenta como un error (§3 del encargo).
 */
export const getRiotLiveGame = async (
  environment: RiotEnvironment,
  diagnostics?: RiotDiagnosticLogger,
): Promise<LiveGameResult> => {
  const updatedAt = new Date().toISOString();
  const config = getRiotConfig(environment);
  if (!config.apiKey) return { status: 'unavailable', reason: 'RIOT_API_KEY_MISSING', updatedAt };

  const client = createRiotClient({ apiKey: config.apiKey, diagnostics });
  const regionalBase = `https://${config.regionalRoute}.api.riotgames.com`;
  const platformBase = `https://${config.platformRoute}.api.riotgames.com`;

  let selfPuuid: string;
  let selfRiotId: string;
  try {
    const account = await resolveSelfAccount(client, regionalBase, config);
    if (!account.value.puuid)
      return { status: 'unavailable', reason: 'RIOT_INVALID_RESPONSE', updatedAt };
    selfPuuid = account.value.puuid;
    selfRiotId = `${account.value.gameName || config.gameName}#${account.value.tagLine || config.tagLine}`;
  } catch (error) {
    if (error instanceof RiotApiError && error.code === 'RIOT_RATE_LIMITED')
      return { status: 'rate_limited', retryAfterSeconds: error.retryAfterSeconds, updatedAt };
    return {
      status: 'unavailable',
      reason: error instanceof RiotApiError ? error.code : 'RIOT_TEMPORARILY_UNAVAILABLE',
      updatedAt,
    };
  }

  let raw: RiotCurrentGameInfoDto;
  try {
    // Cache corta (45s) — y crucialmente, cachea TAMBIÉN el caso "no está
    // en partida" (404), no solo el caso con partida real: es el
    // resultado más frecuente con diferencia, así que si no se cachea
    // explícitamente, cada refresco de cada visitante golpearía
    // spectator-v5 sin ninguna protección real (§23, §14). `cached()` solo
    // guarda en caché el valor de RETORNO de su loader, nunca una
    // excepción — por eso el 404 se captura y se transforma en un valor
    // normal (`{ inGame: false }`) DENTRO del loader, en vez de dejarlo
    // salir como error. Un error real (rate limit, 5xx) sí se relanza sin
    // cachear: no queremos "recordar" una caída de Riot durante 45s
    // cuando el siguiente sondeo podría encontrarla ya recuperada.
    const spectator = await cached(
      `riot:live:active-game:${selfPuuid}`,
      45_000,
      60_000,
      async (): Promise<{ inGame: true; raw: RiotCurrentGameInfoDto } | { inGame: false }> => {
        try {
          const value = await client.get<RiotCurrentGameInfoDto>(
            `${platformBase}/lol/spectator/v5/active-games/by-summoner/${encode(selfPuuid)}`,
            { phase: 'league', endpoint: 'SPECTATOR-V5 /lol/spectator/v5/active-games/by-summoner/{puuid}' },
          );
          return { inGame: true, raw: value };
        } catch (error) {
          if (error instanceof RiotApiError && error.status === 404) return { inGame: false };
          throw error;
        }
      },
    );
    if (!spectator.value.inGame) return { status: 'not_in_game', updatedAt };
    raw = spectator.value.raw;
  } catch (error) {
    if (error instanceof RiotApiError && error.code === 'RIOT_RATE_LIMITED')
      return { status: 'rate_limited', retryAfterSeconds: error.retryAfterSeconds, updatedAt };
    return {
      status: 'unavailable',
      reason: error instanceof RiotApiError ? error.code : 'RIOT_TEMPORARILY_UNAVAILABLE',
      updatedAt,
    };
  }

  const participantPuuids = (raw.participants ?? [])
    .map((participant) => participant.puuid)
    .filter((puuid): puuid is string => Boolean(puuid));
  // El Riot ID de Tidusss ya se conoce (viene de `resolveSelfAccount`, arriba)
  // — pedirlo otra vez vía account-v1-by-puuid solo para él sería una
  // llamada Riot desperdiciada en cada partida nueva (§B/§17 del encargo:
  // minimizar llamadas). Los otros 9 sí lo necesitan.
  const otherParticipantPuuids = participantPuuids.filter((puuid) => puuid !== selfPuuid);

  // Todo lo de aquí abajo es enriquecimiento: si falla, la partida base
  // (equipos, campeones, hechizos, runas, baneos) sigue apareciendo igual
  // — nunca bloquea la vista (§18, orden de importancia 1-2 siempre
  // disponibles aunque 3-6 fallen parcial o totalmente).
  const [dataDragonVersion, riotIdEntries, rankedEntries, selfRecentForm] = await Promise.all([
    getDataDragonVersion(),
    Promise.allSettled(
      otherParticipantPuuids.map(async (puuid) => [puuid, await resolveRiotIdByPuuid(client, regionalBase, puuid)] as const),
    ),
    Promise.allSettled(
      participantPuuids.map(async (puuid) => [puuid, await resolveRankedByPuuid(client, platformBase, puuid)] as const),
    ),
    resolveSelfRecentForm(environment, diagnostics),
  ]);

  const riotIdByPuuid = new Map(
    riotIdEntries.flatMap((result) =>
      result.status === 'fulfilled' && result.value[1] ? [[result.value[0], result.value[1]] as const] : [],
    ),
  );
  riotIdByPuuid.set(selfPuuid, selfRiotId);
  const rankedByPuuid = new Map(
    rankedEntries.flatMap((result) =>
      result.status === 'fulfilled' && result.value[1] ? [[result.value[0], result.value[1]] as const] : [],
    ),
  );
  const [championNameById, keystoneById] = await Promise.all([
    getChampionNameById(dataDragonVersion),
    getKeystoneById(dataDragonVersion),
  ]);
  const urls = dataDragonUrls(dataDragonVersion);

  const ctx: LiveNormalizeContext = {
    selfPuuid,
    championNameById,
    championUrl: urls.champion,
    summonerSpellUrl: urls.summonerSpell,
    profileIconUrl: urls.profileIcon,
    keystoneById,
    riotIdByPuuid,
    rankedByPuuid,
    identityFor: identityFor(knownPlayerIdentities),
    selfRecentForm,
  };

  const game = normalizeLiveGame(raw, ctx);
  if (!game) return { status: 'not_in_game', updatedAt };
  return { status: 'in_game', game, updatedAt };
};
