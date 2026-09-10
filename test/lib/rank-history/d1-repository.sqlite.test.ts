import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { D1RankSnapshotRepository } from '../../../src/lib/rank-history/d1-repository.ts';
import type {
  D1Database,
  D1PreparedStatement,
  D1Result,
} from '../../../src/lib/rank-history/d1-types.ts';
import type { NewRankSnapshot } from '../../../src/lib/rank-history/types.ts';

/**
 * `D1RankSnapshotRepository` contra un SQLite REAL (`node:sqlite`, módulo
 * integrado de Node — sin dependencia nueva) con el schema REAL de
 * `migrations/0001_rank_snapshots.sql` aplicado tal cual. Valida lo que
 * un mock que compara strings de SQL no puede: que el SQL parsea en
 * SQLite, que `AUTOINCREMENT`/`last_row_id` funcionan, que el orden por
 * `observed_at TEXT` es cronológico, que la restricción `UNIQUE` hace de
 * backstop de idempotencia, y que `INSERT OR IGNORE` devuelve `changes:0`
 * en colisión (encargo cierre §9/§16).
 */

const MIGRATION_SQL = readFileSync(
  fileURLToPath(new URL('../../../migrations/0001_rank_snapshots.sql', import.meta.url)),
  'utf8',
);

/** Adaptador mínimo: expone la superficie `D1Database` sobre un `DatabaseSync` real. Solo para tests. */
class SqliteD1 implements D1Database {
  readonly sqlite: DatabaseSync;
  constructor() {
    this.sqlite = new DatabaseSync(':memory:');
    this.sqlite.exec(MIGRATION_SQL);
  }
  prepare(query: string): D1PreparedStatement {
    const sqlite = this.sqlite;
    let bound: unknown[] = [];
    const normalize = (values: unknown[]) =>
      values.map((v) => (v === undefined ? null : v)) as never[];
    const statement: D1PreparedStatement = {
      bind: (...values: unknown[]) => {
        bound = values;
        return statement;
      },
      first: async <T>() => {
        const row = sqlite.prepare(query).get(...normalize(bound));
        return (row ?? null) as T | null;
      },
      run: async <T>(): Promise<D1Result<T>> => {
        const info = sqlite.prepare(query).run(...normalize(bound));
        return {
          success: true,
          meta: {
            changes: Number(info.changes),
            last_row_id: Number(info.lastInsertRowid),
          },
        };
      },
      all: async <T>(): Promise<D1Result<T>> => {
        const rows = sqlite.prepare(query).all(...normalize(bound));
        return { success: true, results: rows as T[] };
      },
    };
    return statement;
  }
}

const snap = (over: Partial<NewRankSnapshot> = {}): NewRankSnapshot => ({
  puuid: 'puuid-tidusss',
  queueType: 'RANKED_SOLO_5x5',
  tier: 'DIAMOND',
  rank: 'II',
  leaguePoints: 40,
  wins: 100,
  losses: 90,
  observedAt: '2026-09-09T10:00:00.000Z',
  source: 'cron',
  ...over,
});

let db: SqliteD1;
let repo: D1RankSnapshotRepository;

beforeEach(() => {
  db = new SqliteD1();
  repo = new D1RankSnapshotRepository(db);
});

test('el SQL de la migración real parsea y crea la tabla en SQLite', () => {
  const cols = db.sqlite
    .prepare(`SELECT name FROM pragma_table_info('rank_snapshots')`)
    .all()
    .map((r) => (r as { name: string }).name);
  assert.deepEqual(cols, [
    'id',
    'puuid',
    'queue_type',
    'tier',
    'rank',
    'league_points',
    'wins',
    'losses',
    'observed_at',
    'source',
  ]);
});

test('insert: persiste y devuelve la fila con id real autoincremental', async () => {
  const a = await repo.insert(snap({ observedAt: '2026-09-09T10:00:00.000Z' }));
  const b = await repo.insert(snap({ observedAt: '2026-09-09T11:00:00.000Z' }));
  assert.equal(a!.id, 1);
  assert.equal(b!.id, 2);
});

test('insert: Master+ se guarda con rank NULL y vuelve como undefined', async () => {
  const saved = await repo.insert(snap({ tier: 'MASTER', rank: undefined, leaguePoints: 245 }));
  assert.equal(saved!.rank, undefined);
  const latest = await repo.getLatest('puuid-tidusss', 'RANKED_SOLO_5x5');
  assert.equal(latest!.tier, 'MASTER');
  assert.equal(latest!.rank, undefined);
  assert.equal(latest!.leaguePoints, 245);
});

test('getLatest / getFirstObservedAt: orden cronológico real sobre observed_at TEXT', async () => {
  await repo.insert(snap({ observedAt: '2026-09-05T00:00:00.000Z', leaguePoints: 10 }));
  await repo.insert(snap({ observedAt: '2026-09-01T00:00:00.000Z', leaguePoints: 5 }));
  await repo.insert(snap({ observedAt: '2026-09-09T00:00:00.000Z', leaguePoints: 40 }));
  const latest = await repo.getLatest('puuid-tidusss', 'RANKED_SOLO_5x5');
  assert.equal(latest!.leaguePoints, 40);
  assert.equal(
    await repo.getFirstObservedAt('puuid-tidusss', 'RANKED_SOLO_5x5'),
    '2026-09-01T00:00:00.000Z',
  );
});

test('listRecent: respeta límite y orden descendente por tiempo', async () => {
  for (let i = 1; i <= 5; i += 1) {
    await repo.insert(snap({ observedAt: `2026-09-0${i}T00:00:00.000Z`, leaguePoints: i * 10 }));
  }
  const recent = await repo.listRecent('puuid-tidusss', 'RANKED_SOLO_5x5', 3);
  assert.deepEqual(recent.map((r) => r.leaguePoints), [50, 40, 30]);
});

test('getPeak: rango real más alto (tier→division→LP), nunca el de más LP en bruto', async () => {
  await repo.insert(snap({ observedAt: '2026-09-01T00:00:00.000Z', tier: 'GOLD', rank: 'I', leaguePoints: 95 }));
  await repo.insert(snap({ observedAt: '2026-09-02T00:00:00.000Z', tier: 'PLATINUM', rank: 'IV', leaguePoints: 0 }));
  await repo.insert(snap({ observedAt: '2026-09-03T00:00:00.000Z', tier: 'GOLD', rank: 'I', leaguePoints: 20 }));
  const peak = await repo.getPeak('puuid-tidusss', 'RANKED_SOLO_5x5');
  assert.equal(peak!.tier, 'PLATINUM');
});

test('idempotencia: un segundo insert con el mismo (puuid, queue, observed_at) devuelve null y NO duplica fila', async () => {
  const first = await repo.insert(snap({ observedAt: '2026-09-09T10:00:00.000Z' }));
  const second = await repo.insert(
    snap({ observedAt: '2026-09-09T10:00:00.000Z', leaguePoints: 999 }),
  );
  assert.ok(first);
  assert.equal(second, null);
  const rows = db.sqlite.prepare('SELECT COUNT(*) AS n FROM rank_snapshots').get() as { n: number };
  assert.equal(rows.n, 1);
  // La fila que quedó es la primera (LP 40), la segunda se ignoró entera.
  const latest = await repo.getLatest('puuid-tidusss', 'RANKED_SOLO_5x5');
  assert.equal(latest!.leaguePoints, 40);
});

test('un mismo estado en instantes distintos SÍ se guarda dos veces (prueba de heartbeat, no colisión)', async () => {
  await repo.insert(snap({ observedAt: '2026-09-09T10:00:00.000Z' }));
  const second = await repo.insert(snap({ observedAt: '2026-09-09T16:00:00.000Z' }));
  assert.ok(second);
  const rows = db.sqlite.prepare('SELECT COUNT(*) AS n FROM rank_snapshots').get() as { n: number };
  assert.equal(rows.n, 2);
});

test('cuentas/colas distintas nunca se mezclan', async () => {
  await repo.insert(snap({ puuid: 'a', observedAt: '2026-09-09T10:00:00.000Z' }));
  await repo.insert(snap({ puuid: 'b', observedAt: '2026-09-09T10:00:00.000Z' }));
  const a = await repo.listRecent('a', 'RANKED_SOLO_5x5', 10);
  const b = await repo.listRecent('b', 'RANKED_SOLO_5x5', 10);
  assert.equal(a.length, 1);
  assert.equal(b.length, 1);
  assert.equal(a[0]!.puuid, 'a');
});
