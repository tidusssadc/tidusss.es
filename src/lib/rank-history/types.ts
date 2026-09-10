/**
 * Histórico de rango observado — Night Shift 2026-09-09, Fase B/C.
 *
 * REGLA ABSOLUTA: el histórico empieza cuando el sistema empieza a
 * observar. Nunca se reconstruye ni se estima nada anterior al primer
 * snapshot real guardado.
 */

/** Solo Solo/Duo por ahora (encargo §16, "Queue: Solo/Duo únicamente inicialmente"). */
export type RankHistoryQueue = 'RANKED_SOLO_5x5';

export type RankHistorySource = 'overview' | 'cron';

/** Un snapshot ya persistido (con id real). */
export interface RankSnapshot {
  id: number;
  /** PUUID real de Riot — identidad técnica, nunca el Riot ID (mutable). */
  puuid: string;
  queueType: RankHistoryQueue;
  /** Ausente = sin clasificar en el momento de la observación (dato real, nunca inventado). */
  tier?: string;
  /** I-IV — ausente en Master+ (no tiene division). */
  rank?: string;
  leaguePoints?: number;
  wins: number;
  losses: number;
  /** ISO 8601. */
  observedAt: string;
  source: RankHistorySource;
}

/** Lo mismo sin `id` — lo que se intenta guardar, antes de decidir si procede. */
export type NewRankSnapshot = Omit<RankSnapshot, 'id'>;

export interface RecordObservationResult {
  inserted: boolean;
  /** Motivo legible para logs/diagnóstico — nunca expuesto al cliente. */
  reason:
    | 'first-snapshot'
    | 'changed'
    | 'heartbeat-elapsed'
    | 'unchanged'
    // La política de dedupe decidió escribir, pero D1 ya tenía una fila
    // con el mismo (puuid, queue_type, observed_at) — otra invocación se
    // adelantó por milisegundos. Backstop de idempotencia (encargo §16),
    // nunca un error.
    | 'duplicate'
    | 'storage-unavailable'
    | 'no-rank-data';
}

/**
 * Repositorio — abstracción de almacenamiento (encargo §30, "separar
 * domain / repository / storage adapter"). La UI y la orquestación nunca
 * hablan con D1 directamente.
 */
export interface RankSnapshotRepository {
  /** Snapshots más recientes primero, como mucho `limit`. */
  listRecent(
    puuid: string,
    queueType: RankHistoryQueue,
    limit: number,
  ): Promise<RankSnapshot[]>;
  /** El snapshot con el rango más alto observado (ver `rank-order.ts`) — nunca "peak de season". */
  getPeak(
    puuid: string,
    queueType: RankHistoryQueue,
  ): Promise<RankSnapshot | undefined>;
  /** El snapshot más reciente guardado, para decidir deduplicación. */
  getLatest(
    puuid: string,
    queueType: RankHistoryQueue,
  ): Promise<RankSnapshot | undefined>;
  /** Timestamp del primer snapshot real — "seguimiento desde...". */
  getFirstObservedAt(
    puuid: string,
    queueType: RankHistoryQueue,
  ): Promise<string | undefined>;
  /**
   * Inserta el snapshot. Devuelve la fila persistida, o `null` si otra
   * invocación ya había escrito una con el mismo
   * (puuid, queue_type, observed_at) — backstop de idempotencia (encargo
   * §16), nunca lanza por ese caso.
   */
  insert(snapshot: NewRankSnapshot): Promise<RankSnapshot | null>;
}
