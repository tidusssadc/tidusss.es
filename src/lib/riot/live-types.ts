/**
 * Dominio normalizado de "Partida en curso" — la UI nunca ve una respuesta
 * cruda de Riot. `source` prepara el terreno para una fase futura (Live
 * Client Data API, sección 20 del encargo): hoy solo existe `'spectator'`,
 * pero el tipo ya admite que un `LiveParticipant` combine fuentes sin que
 * la UI ni el resto del dominio tengan que cambiar de forma.
 */
export type LiveGameSource = 'spectator' | 'live-client';

export type LiveGameStatus =
  | 'in_game'
  | 'not_in_game'
  | 'unavailable'
  | 'rate_limited';

/** Identidad curada de un jugador conocido (PRO/streamer) — nunca inferida por similitud de nombre. Ver `config/known-players.ts`. */
export interface KnownPlayerIdentity {
  /**
   * Preferido: match exacto por PUUID. Plural a propósito — una misma
   * persona puede tener varias cuentas verificadas (main, smurfs, cuentas
   * pasadas) y TODAS deben resolver a esta misma identidad, nunca una
   * identidad separada por cuenta (ver `scripts/identities/`, que es quien
   * puebla este campo — cada PUUID aquí viene siempre de Riot Account-V1,
   * nunca copiado de una fuente externa sin revalidar).
   */
  puuids?: readonly string[];
  /** Fallback controlado: Riot ID exacto ("GameName#TAG"), comparación insensible a mayúsculas. */
  riotIds?: readonly string[];
  displayName: string;
  isPro: boolean;
  isStreamer: boolean;
  team?: string;
  role?: string;
  streamUrl?: string;
  /** De dónde procede la verificación (p. ej. "equipo oficial", "confirmado por Tidusss") — nunca "similitud de nombre". */
  source?: string;
  /** Fecha ISO de la última vez que se confirmó que el dato sigue vigente. */
  lastVerifiedAt?: string;
}

export interface LiveRuneTree {
  styleId: number;
  name: string;
  imageUrl?: string;
}

export interface LiveSummonerSpell {
  id: number;
  name: string;
  imageUrl?: string;
}

/** Ausente = todavía no se ha intentado enriquecer o el enriquecimiento falló — nunca "sin clasificar" inventado. */
export interface LiveParticipantRanked {
  available: boolean;
  tier?: string;
  rank?: string;
  leaguePoints?: number;
  wins?: number;
  losses?: number;
  winRate?: number;
}

/**
 * Forma reciente — en V1 solo se calcula para Tidusss (reutilizando los
 * datos que `/api/riot/overview` ya resuelve y cachea), nunca para los
 * otros 9 participantes: enriquecer a los 10 con su historial reciente
 * multiplicaría las llamadas a match-v5 muy por encima de lo razonable
 * para una vista que se refresca cada 30-60s (ver informe de entrega,
 * "Recent-form implementada").
 */
export interface LiveParticipantRecentForm {
  sampleSize: number;
  wins: number;
  losses: number;
  winRate?: number;
  averageKda?: number;
}

export interface LiveParticipant {
  puuid: string;
  /** "GameName#TAG" cuando se pudo resolver; nunca inventado — placeholder explícito si no. */
  riotId: string;
  riotIdResolved: boolean;
  championId: number;
  /** Ausente si el id numérico no resolvió contra el catálogo Data Dragon de campeones (nunca adivinado). */
  championName?: string;
  championImageUrl?: string;
  teamId: number;
  summonerSpells: readonly LiveSummonerSpell[];
  primaryRuneTree?: LiveRuneTree;
  secondaryRuneTree?: LiveRuneTree;
  profileIconId?: number;
  profileIconUrl?: string;
  /** true solo para la cuenta configurada de Tidusss (comparación por PUUID). */
  isSelf: boolean;
  identity?: KnownPlayerIdentity;
  ranked?: LiveParticipantRanked;
  recentForm?: LiveParticipantRecentForm;
}

export interface LiveGameTeam {
  teamId: number;
  participants: readonly LiveParticipant[];
}

export interface LiveGameBan {
  championId: number;
  championName?: string;
  championImageUrl?: string;
  teamId: number;
  pickTurn: number;
}

export interface LiveGame {
  gameId: number;
  gameMode: string;
  gameType: string;
  queueId: number;
  queueLabel: string;
  mapId: number;
  mapName?: string;
  /** ISO. Puede ser undefined si Riot devuelve 0 (partida en fase de selección, todavía sin reloj). */
  gameStartedAt?: string;
  gameLengthSeconds: number;
  platformId: string;
  participants: readonly LiveParticipant[];
  teams: readonly LiveGameTeam[];
  bannedChampions: readonly LiveGameBan[];
  source: LiveGameSource;
}

export type LiveGameResult =
  | { status: 'in_game'; game: LiveGame; updatedAt: string }
  | { status: 'not_in_game'; updatedAt: string }
  | { status: 'unavailable'; reason: string; updatedAt: string }
  | { status: 'rate_limited'; retryAfterSeconds?: number; updatedAt: string };
