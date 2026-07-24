import type { KnowledgeScope, LabChampionId, Patch, PatchId, Role } from './types';

export const scopeMatchesChampion = (
  scope: KnowledgeScope,
  championId: LabChampionId,
) => scope.championId === undefined || scope.championId === championId;

export const scopeMatchesRole = (scope: KnowledgeScope, role: Role) =>
  scope.role === undefined || scope.role === role;

export const scopeMatchesPatch = (scope: KnowledgeScope, patchId: PatchId) =>
  scope.patchId === undefined || scope.patchId === patchId;

export const describeScope = (scope: KnowledgeScope) =>
  [scope.championId, scope.role, scope.patchId].filter(Boolean).join(' · ') ||
  'General';

export const isPatchAtOrAfter = (patch: Patch, reference: Patch) =>
  patch.sequence >= reference.sequence;

export const isPatchBefore = (patch: Patch, reference: Patch) =>
  patch.sequence < reference.sequence;

export const sortPatchesChronologically = (patches: readonly Patch[]) =>
  [...patches].sort((a, b) => a.sequence - b.sequence);

export const latestPatch = (patches: readonly Patch[]) =>
  sortPatchesChronologically(patches).at(-1);
