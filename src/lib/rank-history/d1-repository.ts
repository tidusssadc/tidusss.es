import type { D1Database } from './d1-types';
import type {
  NewRankSnapshot,
  RankHistoryQueue,
  RankSnapshot,
  RankSnapshotRepository,
} from './types';
import { highestRank } from './rank-order';

interface Row {
  id: number;
  puuid: string;
  queue_type: string;
  tier: string | null;
  rank: string | null;
  league_points: number | null;
  wins: number;
  losses: number;
  observed_at: string;
  source: string;
}

const fromRow = (row: Row): RankSnapshot => ({
  id: row.id,
  puuid: row.puuid,
  queueType: row.queue_type as RankHistoryQueue,
  tier: row.tier ?? undefined,
  rank: row.rank ?? undefined,
  leaguePoints: row.league_points ?? undefined,
  wins: row.wins,
  losses: row.losses,
  observedAt: row.observed_at,
  source: row.source as RankSnapshot['source'],
});

/**
 * Adaptador real sobre D1 (encargo §30/§31) — el único fichero que sabe
 * que la tabla se llama `rank_snapshots` o que las columnas están en
 * snake_case. Todo lo demás (dominio, orquestación, UI) solo conoce
 * `RankSnapshotRepository`. Ver `migrations/0001_rank_snapshots.sql`
 * para el schema real que este adaptador asume.
 */
export class D1RankSnapshotRepository implements RankSnapshotRepository {
  // Sin "parameter properties" a propósito: el modo strip-only del test
  // runner de Node no las soporta (mismo motivo ya documentado en
  // `RiotApiError`, src/lib/riot/errors.ts).
  private readonly db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async listRecent(
    puuid: string,
    queueType: RankHistoryQueue,
    limit: number,
  ): Promise<RankSnapshot[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM rank_snapshots WHERE puuid = ? AND queue_type = ? ORDER BY observed_at DESC LIMIT ?`,
      )
      .bind(puuid, queueType, limit)
      .all<Row>();
    return (result.results ?? []).map(fromRow);
  }

  async getPeak(
    puuid: string,
    queueType: RankHistoryQueue,
  ): Promise<RankSnapshot | undefined> {
    // El orden de rango real (tier→division→LP) no es una columna SQL
    // simple de ordenar — se trae todo el histórico de esta cuenta (nunca
    // más de unos pocos miles de filas con la política de heartbeat de
    // 6h) y se calcula el máximo real en memoria con `rank-order.ts`,
    // nunca un `ORDER BY league_points` que ignoraría el tier.
    const result = await this.db
      .prepare(
        `SELECT * FROM rank_snapshots WHERE puuid = ? AND queue_type = ?`,
      )
      .bind(puuid, queueType)
      .all<Row>();
    const snapshots = (result.results ?? []).map(fromRow);
    return highestRank(snapshots);
  }

  async getLatest(
    puuid: string,
    queueType: RankHistoryQueue,
  ): Promise<RankSnapshot | undefined> {
    const row = await this.db
      .prepare(
        `SELECT * FROM rank_snapshots WHERE puuid = ? AND queue_type = ? ORDER BY observed_at DESC LIMIT 1`,
      )
      .bind(puuid, queueType)
      .first<Row>();
    return row ? fromRow(row) : undefined;
  }

  async getFirstObservedAt(
    puuid: string,
    queueType: RankHistoryQueue,
  ): Promise<string | undefined> {
    const row = await this.db
      .prepare(
        `SELECT observed_at FROM rank_snapshots WHERE puuid = ? AND queue_type = ? ORDER BY observed_at ASC LIMIT 1`,
      )
      .bind(puuid, queueType)
      .first<{ observed_at: string }>();
    return row?.observed_at;
  }

  async insert(snapshot: NewRankSnapshot): Promise<RankSnapshot> {
    const result = await this.db
      .prepare(
        `INSERT INTO rank_snapshots (puuid, queue_type, tier, rank, league_points, wins, losses, observed_at, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        snapshot.puuid,
        snapshot.queueType,
        snapshot.tier ?? null,
        snapshot.rank ?? null,
        snapshot.leaguePoints ?? null,
        snapshot.wins,
        snapshot.losses,
        snapshot.observedAt,
        snapshot.source,
      )
      .run();
    const id = result.meta?.last_row_id;
    if (id === undefined)
      throw new Error('D1RankSnapshotRepository.insert: no last_row_id returned');
    return { id, ...snapshot };
  }
}
