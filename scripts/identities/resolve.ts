import type { KnownPlayerIdentity } from '../../src/lib/riot/live-types.ts';
import { splitRiotId } from './validate.ts';
import type {
  AccountResolver,
  CandidateIssue,
  IdentityCandidate,
  IdentityConflict,
  ResolvedRiotAccount,
  VerifyBatchResult,
} from './types.ts';

const normalizeKey = (value: string) => value.trim().toLowerCase();
const canonicalRiotId = (account: ResolvedRiotAccount) => `${account.gameName}#${account.tagLine}`;

interface ResolvedCandidate {
  candidate: IdentityCandidate;
  account: ResolvedRiotAccount;
}

/**
 * Resuelve cada candidato contra Riot Account-V1 (vía el `resolveAccount`
 * inyectado — en tests, un mock sin red). Un fallo en uno se reporta y el
 * lote SIGUE con el resto (§15: "batch continúa después de un error").
 */
export const resolveCandidates = async (
  candidates: readonly IdentityCandidate[],
  resolveAccount: AccountResolver,
): Promise<{ resolved: ResolvedCandidate[]; errors: CandidateIssue[] }> => {
  const resolved: ResolvedCandidate[] = [];
  const errors: CandidateIssue[] = [];
  for (const candidate of candidates) {
    const parts = splitRiotId(candidate.riotId);
    if (!parts) {
      errors.push({ candidate, reason: `riotId inválido: "${candidate.riotId}"` });
      continue;
    }
    try {
      const account = await resolveAccount(parts.gameName, parts.tagLine);
      if (!account.puuid) {
        errors.push({
          candidate,
          reason: `Riot devolvió una cuenta sin PUUID para "${candidate.riotId}"`,
        });
        continue;
      }
      resolved.push({ candidate, account });
    } catch (error) {
      errors.push({
        candidate,
        reason: `Riot Account-V1 no pudo resolver "${candidate.riotId}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }
  return { resolved, errors };
};

interface CandidateGroup {
  displayName: string;
  entries: ResolvedCandidate[];
}

/**
 * Varias filas con el mismo `displayName` (normalizado) del MISMO lote son,
 * a propósito, la misma persona con varias cuentas (§5) — es el propio
 * fichero de candidatos, preparado a mano por un humano, el que decide
 * esto; nunca se infiere por parecido de nombre entre lotes o contra el
 * registro ya existente (eso sigue exigiendo PUUID/Riot ID exacto, ver
 * `mergeWithExisting`).
 */
const groupByDisplayName = (resolved: ResolvedCandidate[]): CandidateGroup[] => {
  const groups = new Map<string, CandidateGroup>();
  for (const entry of resolved) {
    const key = normalizeKey(entry.candidate.displayName);
    const group = groups.get(key);
    if (group) group.entries.push(entry);
    else groups.set(key, { displayName: entry.candidate.displayName, entries: [entry] });
  }
  return [...groups.values()];
};

type ConsistentField = 'team' | 'role' | 'streamUrl' | 'source';

/** Si el grupo trae más de un valor NO vacío distinto para este campo, es un conflicto real de datos — nunca se decide solo cuál vale (§9). */
const consistentValue = (
  group: CandidateGroup,
  field: ConsistentField,
): { value?: string; conflict: boolean } => {
  const values = [...new Set(group.entries.map((entry) => entry.candidate[field]).filter((value): value is string => Boolean(value)))];
  if (values.length > 1) return { conflict: true };
  return { value: values[0], conflict: false };
};

export interface BuiltIdentity {
  identity: KnownPlayerIdentity;
  accounts: number;
}

/**
 * Construye UNA identidad por grupo (persona), con todos sus PUUIDs/Riot
 * IDs — nunca una identidad por cuenta (§5). `isPro`/`isStreamer` se
 * combinan con OR entre las filas del grupo (una persona puede tener una
 * cuenta marcada como PRO y otra como STREAMER sin que eso sea un
 * conflicto — al final es la MISMA persona). `team`/`role`/`streamUrl`/
 * `source` sí deben ser consistentes entre filas del mismo grupo: si no lo
 * son, es un conflicto real y el grupo entero se excluye y se reporta.
 */
export const buildIdentities = (
  groups: CandidateGroup[],
  verifiedAt: string,
): { identities: BuiltIdentity[]; conflicts: IdentityConflict[] } => {
  const identities: BuiltIdentity[] = [];
  const conflicts: IdentityConflict[] = [];

  for (const group of groups) {
    const fields = (['team', 'role', 'streamUrl', 'source'] as const).map(
      (field) => [field, consistentValue(group, field)] as const,
    );
    const inconsistent = fields.filter(([, result]) => result.conflict).map(([field]) => field);
    if (inconsistent.length) {
      conflicts.push({
        reason: 'candidatos-inconsistentes',
        detail: `"${group.displayName}": ${inconsistent.join(', ')} tienen valores distintos entre sus filas del mismo lote — no se decide automáticamente cuál vale.`,
      });
      continue;
    }
    const [, team] = fields[0];
    const [, role] = fields[1];
    const [, streamUrl] = fields[2];
    const [, source] = fields[3];
    identities.push({
      accounts: group.entries.length,
      identity: {
        displayName: group.displayName,
        puuids: [...new Set(group.entries.map((entry) => entry.account.puuid))],
        riotIds: [...new Set(group.entries.map((entry) => canonicalRiotId(entry.account)))],
        isPro: group.entries.some((entry) => entry.candidate.isPro === true),
        isStreamer: group.entries.some((entry) => entry.candidate.isStreamer === true),
        team: team.value,
        role: role.value,
        streamUrl: streamUrl.value,
        source: source.value,
        lastVerifiedAt: verifiedAt,
      },
    });
  }
  return { identities, conflicts };
};

/**
 * Un mismo PUUID no puede pertenecer a dos personas distintas dentro del
 * mismo lote — si ocurre, AMBAS identidades se excluyen y se reporta
 * (§9: "duplicate PUUID associated con dos personas diferentes").
 */
export const detectCrossIdentityPuuidConflicts = (
  identities: readonly BuiltIdentity[],
): { kept: BuiltIdentity[]; conflicts: IdentityConflict[] } => {
  const ownerByPuuid = new Map<string, string>();
  const conflictedNames = new Set<string>();
  const conflicts: IdentityConflict[] = [];
  for (const { identity } of identities) {
    for (const puuid of identity.puuids ?? []) {
      const owner = ownerByPuuid.get(puuid);
      if (owner && owner !== identity.displayName) {
        conflicts.push({
          reason: 'puuid-duplicado-entre-personas',
          detail: `PUUID ${puuid} aparece tanto en "${owner}" como en "${identity.displayName}" — no se puede resolver automáticamente cuál es la persona correcta.`,
        });
        conflictedNames.add(owner);
        conflictedNames.add(identity.displayName);
      } else {
        ownerByPuuid.set(puuid, identity.displayName);
      }
    }
  }
  const kept = identities.filter(({ identity }) => !conflictedNames.has(identity.displayName));
  return { kept, conflicts };
};

/**
 * Fusiona una identidad recién verificada con una ya existente del
 * registro. Nunca sobrescribe a ciegas: une PUUIDs/Riot IDs, nunca degrada
 * `isPro`/`isStreamer` de true a false, y si `team`/`role`/`streamUrl`/
 * `source` existentes difieren de los nuevos, se reporta como conflicto y
 * se CONSERVA el valor existente (§6/§9).
 */
export const mergeIdentity = (
  existing: KnownPlayerIdentity,
  incoming: KnownPlayerIdentity,
): { merged: KnownPlayerIdentity; conflicts: IdentityConflict[] } => {
  const conflicts: IdentityConflict[] = [];
  const mergeField = (field: 'team' | 'role' | 'streamUrl' | 'source') => {
    const existingValue = existing[field];
    const incomingValue = incoming[field];
    if (!incomingValue) return existingValue;
    if (!existingValue) return incomingValue;
    if (existingValue !== incomingValue) {
      conflicts.push({
        reason: 'conflicto-al-fusionar',
        detail: `"${existing.displayName}": ${field} existente ("${existingValue}") difiere del nuevo ("${incomingValue}") — se conserva el existente.`,
      });
      return existingValue;
    }
    return existingValue;
  };
  return {
    merged: {
      ...existing,
      puuids: [...new Set([...(existing.puuids ?? []), ...(incoming.puuids ?? [])])],
      riotIds: [...new Set([...(existing.riotIds ?? []), ...(incoming.riotIds ?? [])])],
      isPro: existing.isPro || incoming.isPro,
      isStreamer: existing.isStreamer || incoming.isStreamer,
      team: mergeField('team'),
      role: mergeField('role'),
      streamUrl: mergeField('streamUrl'),
      source: existing.source ?? incoming.source,
      lastVerifiedAt: incoming.lastVerifiedAt ?? existing.lastVerifiedAt,
    },
    conflicts,
  };
};

const findExistingMatch = (
  registry: readonly KnownPlayerIdentity[],
  identity: KnownPlayerIdentity,
): KnownPlayerIdentity | undefined =>
  registry.find(
    (existing) =>
      identity.puuids?.some((puuid) => existing.puuids?.includes(puuid)) ||
      identity.riotIds?.some((riotId) =>
        existing.riotIds?.some((known) => normalizeKey(known) === normalizeKey(riotId)),
      ),
  );

/** Aplica cada identidad nueva sobre el registro existente — nueva identidad si no hay match, fusión segura si sí lo hay (§6). */
export const mergeWithExisting = (
  existingRegistry: readonly KnownPlayerIdentity[],
  incomingIdentities: readonly KnownPlayerIdentity[],
): { registry: KnownPlayerIdentity[]; conflicts: IdentityConflict[] } => {
  let registry = [...existingRegistry];
  const conflicts: IdentityConflict[] = [];
  for (const incoming of incomingIdentities) {
    const existingMatch = findExistingMatch(registry, incoming);
    if (!existingMatch) {
      registry = [...registry, incoming];
      continue;
    }
    const { merged, conflicts: mergeConflicts } = mergeIdentity(existingMatch, incoming);
    conflicts.push(...mergeConflicts);
    registry = registry.map((entry) => (entry === existingMatch ? merged : entry));
  }
  return { registry, conflicts };
};

/**
 * Punto de entrada único de la lógica pura (sin CLI, sin filesystem) — el
 * `resolveAccount` inyectado es lo único que toca red, y en tests siempre
 * es un mock. Nunca lanza por un candidato individual malo: cada fallo se
 * reporta en `errors`/`conflicts`, el resto del lote sigue.
 */
export const verifyBatch = async (
  candidates: readonly IdentityCandidate[],
  existingRegistry: readonly KnownPlayerIdentity[],
  resolveAccount: AccountResolver,
  verifiedAt: string,
): Promise<VerifyBatchResult> => {
  const { resolved, errors } = await resolveCandidates(candidates, resolveAccount);
  const groups = groupByDisplayName(resolved);
  const { identities: built, conflicts: groupConflicts } = buildIdentities(groups, verifiedAt);
  const { kept, conflicts: puuidConflicts } = detectCrossIdentityPuuidConflicts(built);
  const { registry: mergedRegistry, conflicts: mergeConflicts } = mergeWithExisting(
    existingRegistry,
    kept.map((entry) => entry.identity),
  );
  const puuidsResolved = new Set(resolved.map((entry) => entry.account.puuid)).size;
  const pros = kept.filter((entry) => entry.identity.isPro && !entry.identity.isStreamer).length;
  const streamers = kept.filter((entry) => entry.identity.isStreamer && !entry.identity.isPro).length;
  const proAndStreamer = kept.filter((entry) => entry.identity.isPro && entry.identity.isStreamer).length;
  const multiAccountIdentities = kept.filter((entry) => entry.accounts > 1).length;

  return {
    candidatesTotal: candidates.length,
    verifiedIdentities: kept.length,
    accountsResolved: resolved.length,
    puuidsResolved,
    pros,
    streamers,
    proAndStreamer,
    multiAccountIdentities,
    errors,
    conflicts: [...groupConflicts, ...puuidConflicts, ...mergeConflicts],
    mergedRegistry,
  };
};
