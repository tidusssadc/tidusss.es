import type { KnownPlayerIdentity } from '../../src/lib/riot/live-types.ts';

/**
 * Una fila del fichero de candidatos = UNA CUENTA, no necesariamente una
 * persona. Varias filas con el mismo `displayName` (normalizado, sin
 * distinguir mayúsculas) se tratan como la misma persona con varias
 * cuentas — ver `groupByDisplayName` en `resolve.ts` y el README de esta
 * carpeta. Deliberadamente NO lleva `puuid`: el PUUID solo puede venir de
 * Riot Account-V1, nunca de una fuente externa (§1/§4 del encargo).
 */
export interface IdentityCandidate {
  displayName: string;
  riotId: string;
  /** Informativa únicamente — no se usa para elegir el endpoint de Riot (el proyecto ya está fijado a una única región vía `.env`). */
  region?: string;
  isPro?: boolean;
  isStreamer?: boolean;
  team?: string;
  role?: string;
  streamUrl?: string | null;
  source?: string;
}

export interface ResolvedRiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

/** Inyectado — en producción llama a Riot Account-V1 real; en tests, un mock sin red. */
export type AccountResolver = (
  gameName: string,
  tagLine: string,
) => Promise<ResolvedRiotAccount>;

export interface CandidateIssue {
  candidate: IdentityCandidate;
  reason: string;
}

/** Algo que el importador detectó pero deliberadamente NO decidió por su cuenta (§9: "conflictos no triviales: no resolverlos automáticamente, reportar"). */
export interface IdentityConflict {
  reason: string;
  detail: string;
}

export interface VerifyBatchResult {
  candidatesTotal: number;
  verifiedIdentities: number;
  accountsResolved: number;
  puuidsResolved: number;
  pros: number;
  streamers: number;
  proAndStreamer: number;
  multiAccountIdentities: number;
  errors: CandidateIssue[];
  conflicts: IdentityConflict[];
  /** Registro completo resultante (existente + este batch, ya fusionado) — lo que se escribiría en `known-players.generated.ts` si no es `--dry-run`. */
  mergedRegistry: readonly KnownPlayerIdentity[];
}
