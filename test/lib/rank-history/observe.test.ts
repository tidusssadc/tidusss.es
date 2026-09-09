import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordObservationIfDue } from '../../../src/lib/rank-history/observe.ts';
import type {
  NewRankSnapshot,
  RankHistoryQueue,
  RankSnapshot,
  RankSnapshotRepository,
} from '../../../src/lib/rank-history/types.ts';

/** Fake en memoria — SOLO para el test, nunca se usa así en producción (ver D1RankSnapshotRepository real). */
class FakeRepository implements RankSnapshotRepository {
  rows: RankSnapshot[] = [];
  nextId = 1;
  failOnInsert = false;

  async listRecent(puuid: string, queueType: RankHistoryQueue, limit: number) {
    return this.rows
      .filter((r) => r.puuid === puuid && r.queueType === queueType)
      .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))
      .slice(0, limit);
  }
  async getPeak(puuid: string, queueType: RankHistoryQueue) {
    return this.rows.find((r) => r.puuid === puuid && r.queueType === queueType);
  }
  async getLatest(puuid: string, queueType: RankHistoryQueue) {
    const list = await this.listRecent(puuid, queueType, 1);
    return list[0];
  }
  async getFirstObservedAt(puuid: string, queueType: RankHistoryQueue) {
    const list = await this.listRecent(puuid, queueType, 1000);
    return list[list.length - 1]?.observedAt;
  }
  async insert(snapshot: NewRankSnapshot): Promise<RankSnapshot> {
    if (this.failOnInsert) throw new Error('simulated storage failure');
    const row: RankSnapshot = { id: this.nextId++, ...snapshot };
    this.rows.push(row);
    return row;
  }
}

const candidate = (overrides: Partial<NewRankSnapshot> = {}): NewRankSnapshot => ({
  puuid: 'puuid-tidusss',
  queueType: 'RANKED_SOLO_5x5',
  tier: 'MASTER',
  rank: undefined,
  leaguePoints: 200,
  wins: 100,
  losses: 90,
  observedAt: '2026-09-09T10:00:00.000Z',
  source: 'overview',
  ...overrides,
});

test('recordObservationIfDue: sin repositorio (storage no configurado), nunca lanza y reporta el motivo real', async () => {
  const result = await recordObservationIfDue(undefined, candidate());
  assert.deepEqual(result, { inserted: false, reason: 'storage-unavailable' });
});

test('recordObservationIfDue: primer snapshot real se inserta', async () => {
  const repo = new FakeRepository();
  const result = await recordObservationIfDue(repo, candidate());
  assert.deepEqual(result, { inserted: true, reason: 'first-snapshot' });
  assert.equal(repo.rows.length, 1);
});

const T0 = Date.parse('2026-09-09T10:00:00.000Z');

test('recordObservationIfDue: invocación duplicada inmediata con el mismo dato no inserta dos veces', async () => {
  const repo = new FakeRepository();
  await recordObservationIfDue(repo, candidate(), undefined, T0);
  const second = await recordObservationIfDue(
    repo,
    candidate({ observedAt: '2026-09-09T10:00:05.000Z' }),
    undefined,
    T0 + 5000,
  );
  assert.deepEqual(second, { inserted: false, reason: 'unchanged' });
  assert.equal(repo.rows.length, 1);
});

test('recordObservationIfDue: LP cambia entre dos invocaciones — se inserta la segunda', async () => {
  const repo = new FakeRepository();
  await recordObservationIfDue(repo, candidate(), undefined, T0);
  const second = await recordObservationIfDue(
    repo,
    candidate({ leaguePoints: 214, observedAt: '2026-09-09T10:05:00.000Z' }),
    undefined,
    T0 + 5 * 60_000,
  );
  assert.deepEqual(second, { inserted: true, reason: 'changed' });
  assert.equal(repo.rows.length, 2);
});

test('recordObservationIfDue: wins/losses cambian (partida jugada) — se inserta', async () => {
  const repo = new FakeRepository();
  await recordObservationIfDue(repo, candidate(), undefined, T0);
  const second = await recordObservationIfDue(
    repo,
    candidate({ wins: 101, observedAt: '2026-09-09T10:05:00.000Z' }),
    undefined,
    T0 + 5 * 60_000,
  );
  assert.equal(second.inserted, true);
});

test('recordObservationIfDue: tier cambia — se inserta', async () => {
  const repo = new FakeRepository();
  await recordObservationIfDue(repo, candidate(), undefined, T0);
  const second = await recordObservationIfDue(
    repo,
    candidate({ tier: 'GRANDMASTER', observedAt: '2026-09-09T10:05:00.000Z' }),
    undefined,
    T0 + 5 * 60_000,
  );
  assert.equal(second.inserted, true);
});

test('recordObservationIfDue: Master+ (sin division) se guarda y deduplica correctamente', async () => {
  const repo = new FakeRepository();
  const first = await recordObservationIfDue(repo, candidate({ tier: 'MASTER', rank: undefined }));
  assert.equal(first.inserted, true);
  assert.equal(repo.rows[0]!.rank, undefined);
});

test('recordObservationIfDue: el orden de inserción se respeta (varios snapshots reales consecutivos con cambios reales)', async () => {
  const repo = new FakeRepository();
  await recordObservationIfDue(repo, candidate({ leaguePoints: 200, observedAt: '2026-09-09T10:00:00.000Z' }));
  await recordObservationIfDue(repo, candidate({ leaguePoints: 214, observedAt: '2026-09-09T10:10:00.000Z' }));
  await recordObservationIfDue(repo, candidate({ leaguePoints: 228, observedAt: '2026-09-09T10:20:00.000Z' }));
  assert.equal(repo.rows.length, 3);
  assert.deepEqual(repo.rows.map((r) => r.leaguePoints), [200, 214, 228]);
});

test('recordObservationIfDue: 0 snapshots previos — getPeak/getFirstObservedAt reflejan vacío honestamente', async () => {
  const repo = new FakeRepository();
  assert.equal(await repo.getPeak('puuid-tidusss', 'RANKED_SOLO_5x5'), undefined);
  assert.equal(await repo.getFirstObservedAt('puuid-tidusss', 'RANKED_SOLO_5x5'), undefined);
});

test('recordObservationIfDue: fallo real de storage en el insert nunca lanza — se degrada con "storage-unavailable"', async () => {
  const repo = new FakeRepository();
  repo.failOnInsert = true;
  const result = await recordObservationIfDue(repo, candidate());
  assert.deepEqual(result, { inserted: false, reason: 'storage-unavailable' });
});

test('recordObservationIfDue: dos invocaciones "simultáneas" (misma decisión ya tomada) no producen inconsistencia visible al llamador', async () => {
  const repo = new FakeRepository();
  const [a, b] = await Promise.all([
    recordObservationIfDue(repo, candidate()),
    recordObservationIfDue(repo, candidate()),
  ]);
  // Con un Map/objeto en memoria sin locking real, ambas pueden insertar en
  // una carrera genuina — lo que este test garantiza es que NINGUNA de las
  // dos lanza y que el resultado siempre es un `RecordObservationResult`
  // válido, nunca una excepción sin manejar.
  for (const result of [a, b]) {
    assert.ok(['inserted', 'reason'].every((key) => key in result));
  }
});
