import { decideSnapshot } from './dedupe';
import type {
  NewRankSnapshot,
  RankSnapshotRepository,
  RecordObservationResult,
} from './types';

export interface ObservationDiagnosticEvent {
  event: 'recorded' | 'skipped' | 'error';
  reason: RecordObservationResult['reason'];
  puuid?: string;
}
export type ObservationDiagnosticLogger = (
  event: ObservationDiagnosticEvent,
) => void;

/**
 * Punto de entrada único para intentar registrar una observación —
 * nunca lanza (encargo §32: el histórico es un efecto secundario, jamás
 * debe romper `/api/riot/overview` ni ningún otro flujo real). Aplica la
 * política de deduplicación de `dedupe.ts` antes de escribir.
 */
export const recordObservationIfDue = async (
  repository: RankSnapshotRepository | undefined,
  candidate: NewRankSnapshot,
  diagnostics?: ObservationDiagnosticLogger,
  /** Inyectable solo para tests deterministas — en producción siempre el reloj real. */
  now: number = Date.now(),
): Promise<RecordObservationResult> => {
  if (!repository) {
    diagnostics?.({ event: 'skipped', reason: 'storage-unavailable' });
    return { inserted: false, reason: 'storage-unavailable' };
  }
  try {
    const latest = await repository.getLatest(
      candidate.puuid,
      candidate.queueType,
    );
    const decision = decideSnapshot(latest, candidate, now);
    if (!decision.shouldInsert) {
      diagnostics?.({
        event: 'skipped',
        reason: decision.reason,
        puuid: candidate.puuid,
      });
      return { inserted: false, reason: decision.reason };
    }
    await repository.insert(candidate);
    diagnostics?.({
      event: 'recorded',
      reason: decision.reason,
      puuid: candidate.puuid,
    });
    return { inserted: true, reason: decision.reason };
  } catch (error) {
    diagnostics?.({
      event: 'error',
      reason: 'storage-unavailable',
      puuid: candidate.puuid,
    });
    console.warn({
      scope: 'rank-history',
      event: 'observation-failed',
      message: error instanceof Error ? error.message : String(error),
    });
    return { inserted: false, reason: 'storage-unavailable' };
  }
};
