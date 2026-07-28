import type { Synergy } from '../../domain/league-laboratory';
import { patch2614 } from './patches';

/**
 * Sinergias recomendadas directamente por Tidusss para el parche 26.14 —
 * ver Fase 5/6, PLATFORM_BIBLE.md. Deliberadamente sin clasificación
 * numérica ni tiers (no hay fuente para eso) y sin explicaciones extensas
 * individuales por pareja: solo lo que el encargo respalda, con una
 * descripción prudente y general. Ampliar cada una con análisis propio es
 * trabajo futuro, no algo que rellenar ahora con una suposición.
 */
const recommendedSynergyTake = {
  verdict: 'Sinergia recomendada por Tidusss para Lucian en el parche 26.14.',
  reasoning:
    'Recomendada directamente por Tidusss; el análisis detallado de esta pareja todavía está pendiente.',
  confidence: 'medium' as const,
  lastReviewedPatch: patch2614.id,
};

export const lucianMilioSynergy: Synergy = {
  id: 'synergy:lucian-milio',
  championIds: ['champion:lucian', 'champion:milio'],
  type: 'lane-duo',
  roles: ['BOTTOM', 'UTILITY'],
  patchId: patch2614.id,
  editorialTake: recommendedSynergyTake,
};

export const lucianNamiSynergy: Synergy = {
  id: 'synergy:lucian-nami',
  championIds: ['champion:lucian', 'champion:nami'],
  type: 'lane-duo',
  roles: ['BOTTOM', 'UTILITY'],
  patchId: patch2614.id,
  editorialTake: recommendedSynergyTake,
};

export const lucianYuumiSynergy: Synergy = {
  id: 'synergy:lucian-yuumi',
  championIds: ['champion:lucian', 'champion:yuumi'],
  type: 'lane-duo',
  roles: ['BOTTOM', 'UTILITY'],
  patchId: patch2614.id,
  editorialTake: recommendedSynergyTake,
};

export const lucianBraumSynergy: Synergy = {
  id: 'synergy:lucian-braum',
  championIds: ['champion:lucian', 'champion:braum'],
  type: 'lane-duo',
  roles: ['BOTTOM', 'UTILITY'],
  patchId: patch2614.id,
  editorialTake: recommendedSynergyTake,
};

export const lucianNautilusSynergy: Synergy = {
  id: 'synergy:lucian-nautilus',
  championIds: ['champion:lucian', 'champion:nautilus'],
  type: 'lane-duo',
  roles: ['BOTTOM', 'UTILITY'],
  patchId: patch2614.id,
  editorialTake: recommendedSynergyTake,
};

export const lucianPykeSynergy: Synergy = {
  id: 'synergy:lucian-pyke',
  championIds: ['champion:lucian', 'champion:pyke'],
  type: 'lane-duo',
  roles: ['BOTTOM', 'UTILITY'],
  patchId: patch2614.id,
  editorialTake: recommendedSynergyTake,
};

export const leagueLaboratorySynergies: Synergy[] = [
  lucianMilioSynergy,
  lucianNamiSynergy,
  lucianYuumiSynergy,
  lucianBraumSynergy,
  lucianNautilusSynergy,
  lucianPykeSynergy,
];
