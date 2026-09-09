import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { D1RankSnapshotRepository } from '../../../src/lib/rank-history/d1-repository.ts';
import type { D1Database, D1PreparedStatement, D1Result } from '../../../src/lib/rank-history/d1-types.ts';

/**
 * D1 real (SQLite) emulado en memoria SOLO para probar que
 * `D1RankSnapshotRepository` construye el SQL correcto y traduce filas
 * correctamente — nunca se usa un fake así como "persistencia" en
 * producción (esa es siempre `D1Database` real de Cloudflare, ver
 * migrations/0001_rank_snapshots.sql para el schema real que este fake
 * reproduce a mano).
 */
interface StoredRow {
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

class FakeD1 implements D1Database {
  rows: StoredRow[] = [];
  nextId = 1;

  prepare(query: string): D1PreparedStatement {
    let bound: unknown[] = [];
    const statement: D1PreparedStatement = {
      bind: (...values: unknown[]) => {
        bound = values;
        return statement;
      },
      first: async <T>(): Promise<T | null> => {
        const result = await statement.all<T>();
        return result.results?.[0] ?? null;
      },
      run: async <T>(): Promise<D1Result<T>> => {
        if (query.startsWith('INSERT')) {
          const [puuid, queueType, tier, rank, lp, wins, losses, observedAt, source] = bound as [
            string, string, string | null, string | null, number | null, number, number, string, string,
          ];
          const row: StoredRow = {
            id: this.nextId++,
            puuid,
            queue_type: queueType,
            tier,
            rank,
            league_points: lp,
            wins,
            losses,
            observed_at: observedAt,
            source,
          };
          this.rows.push(row);
          return { success: true, meta: { last_row_id: row.id } } as D1Result<T>;
        }
        throw new Error(`FakeD1: unsupported run() query: ${query}`);
      },
      all: async <T>(): Promise<D1Result<T>> => {
        if (query.includes('ORDER BY observed_at DESC LIMIT 1')) {
          const [puuid, queueType] = bound as [string, string];
          const matches = this.rows
            .filter((r) => r.puuid === puuid && r.queue_type === queueType)
            .sort((a, b) => b.observed_at.localeCompare(a.observed_at));
          return { success: true, results: matches.slice(0, 1) as unknown as T[] };
        }
        if (query.includes('ORDER BY observed_at ASC LIMIT 1')) {
          const [puuid, queueType] = bound as [string, string];
          const matches = this.rows
            .filter((r) => r.puuid === puuid && r.queue_type === queueType)
            .sort((a, b) => a.observed_at.localeCompare(b.observed_at));
          return { success: true, results: matches.slice(0, 1) as unknown as T[] };
        }
        if (query.includes('ORDER BY observed_at DESC LIMIT ?')) {
          const [puuid, queueType, limit] = bound as [string, string, number];
          const matches = this.rows
            .filter((r) => r.puuid === puuid && r.queue_type === queueType)
            .sort((a, b) => b.observed_at.localeCompare(a.observed_at));
          return { success: true, results: matches.slice(0, limit) as unknown as T[] };
        }
        if (query.startsWith('SELECT * FROM rank_snapshots WHERE puuid = ? AND queue_type = ?')) {
          const [puuid, queueType] = bound as [string, string];
          const matches = this.rows.filter((r) => r.puuid === puuid && r.queue_type === queueType);
          return { success: true, results: matches as unknown as T[] };
        }
        throw new Error(`FakeD1: unsupported all() query: ${query}`);
      },
    };
    return statement;
  }
}

let db: FakeD1;
let repo: D1RankSnapshotRepository;

beforeEach(() => {
  db = new FakeD1();
  repo = new D1RankSnapshotRepository(db);
});

test('insert: guarda y devuelve el snapshot con id real asignado', async () => {
  const saved = await repo.insert({
    puuid: 'puuid-tidusss',
    queueType: 'RANKED_SOLO_5x5',
    tier: 'MASTER',
    rank: undefined,
    leaguePoints: 245,
    wins: 120,
    losses: 98,
    observedAt: '2026-09-09T10:00:00.000Z',
    source: 'overview',
  });
  assert.equal(saved.id, 1);
  assert.equal(saved.tier, 'MASTER');
});

test('getLatest: 0 snapshots devuelve undefined honesto, no lanza', async () => {
  assert.equal(await repo.getLatest('puuid-x', 'RANKED_SOLO_5x5'), undefined);
});

test('getLatest: devuelve el más reciente real por timestamp', async () => {
  await repo.insert({ puuid: 'p', queueType: 'RANKED_SOLO_5x5', tier: 'GOLD', rank: 'II', leaguePoints: 10, wins: 1, losses: 0, observedAt: '2026-09-01T00:00:00.000Z', source: 'overview' });
  await repo.insert({ puuid: 'p', queueType: 'RANKED_SOLO_5x5', tier: 'GOLD', rank: 'I', leaguePoints: 50, wins: 3, losses: 1, observedAt: '2026-09-05T00:00:00.000Z', source: 'overview' });
  const latest = await repo.getLatest('p', 'RANKED_SOLO_5x5');
  assert.equal(latest!.rank, 'I');
});

test('listRecent: respeta el límite y el orden descendente', async () => {
  for (let i = 0; i < 5; i += 1) {
    await repo.insert({ puuid: 'p', queueType: 'RANKED_SOLO_5x5', tier: 'GOLD', rank: 'II', leaguePoints: i * 10, wins: i, losses: 0, observedAt: `2026-09-0${i + 1}T00:00:00.000Z`, source: 'overview' });
  }
  const recent = await repo.listRecent('p', 'RANKED_SOLO_5x5', 3);
  assert.equal(recent.length, 3);
  assert.deepEqual(recent.map((r) => r.leaguePoints), [40, 30, 20]);
});

test('getFirstObservedAt: devuelve el timestamp del snapshot más antiguo real', async () => {
  await repo.insert({ puuid: 'p', queueType: 'RANKED_SOLO_5x5', tier: 'GOLD', rank: 'II', leaguePoints: 0, wins: 0, losses: 0, observedAt: '2026-09-05T00:00:00.000Z', source: 'overview' });
  await repo.insert({ puuid: 'p', queueType: 'RANKED_SOLO_5x5', tier: 'GOLD', rank: 'III', leaguePoints: 0, wins: 0, losses: 0, observedAt: '2026-09-01T00:00:00.000Z', source: 'overview' });
  assert.equal(await repo.getFirstObservedAt('p', 'RANKED_SOLO_5x5'), '2026-09-01T00:00:00.000Z');
});

test('getPeak: Master+ (sin division) se guarda con rank=undefined y se traduce correctamente de vuelta', async () => {
  const saved = await repo.insert({ puuid: 'p', queueType: 'RANKED_SOLO_5x5', tier: 'MASTER', rank: undefined, leaguePoints: 100, wins: 1, losses: 0, observedAt: '2026-09-01T00:00:00.000Z', source: 'overview' });
  assert.equal(saved.rank, undefined);
  const peak = await repo.getPeak('p', 'RANKED_SOLO_5x5');
  assert.equal(peak!.rank, undefined);
  assert.equal(peak!.tier, 'MASTER');
});

test('getPeak: elige el rango real más alto, no el de mayor LP en bruto ni el más reciente', async () => {
  await repo.insert({ puuid: 'p', queueType: 'RANKED_SOLO_5x5', tier: 'GOLD', rank: 'I', leaguePoints: 95, wins: 5, losses: 2, observedAt: '2026-09-01T00:00:00.000Z', source: 'overview' });
  await repo.insert({ puuid: 'p', queueType: 'RANKED_SOLO_5x5', tier: 'PLATINUM', rank: 'IV', leaguePoints: 0, wins: 6, losses: 2, observedAt: '2026-09-02T00:00:00.000Z', source: 'overview' });
  await repo.insert({ puuid: 'p', queueType: 'RANKED_SOLO_5x5', tier: 'GOLD', rank: 'I', leaguePoints: 10, wins: 7, losses: 3, observedAt: '2026-09-03T00:00:00.000Z', source: 'overview' });
  const peak = await repo.getPeak('p', 'RANKED_SOLO_5x5');
  assert.equal(peak!.tier, 'PLATINUM');
});
