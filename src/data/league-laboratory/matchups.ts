import type { Matchup } from '../../domain/league-laboratory';

/**
 * Matchups editoriales, presentados como tarjetas (no como tabla) en la
 * página del campeón — ver Fase 5, PLATFORM_BIBLE.md. Vacío hoy a
 * propósito: todavía no existe ningún matchup real analizado por Tidusss.
 * "Matchups fáciles" y "Matchups difíciles" se derivan automáticamente de
 * `difficulty` ('easy' | 'even' | 'hard') en cuanto existan entradas reales
 * — no son dos listas mantenidas a mano.
 *
 * Forma de una entrada real:
 *
 * ```ts
 * export const lucianVsDraven: Matchup = {
 *   id: 'matchup:lucian-vs-draven',
 *   championId: 'champion:lucian',
 *   opponentChampionId: 'champion:draven', // debe existir en el catálogo
 *   role: 'BOTTOM',
 *   patchId: patch1514.id,
 *   difficulty: 'hard',
 *   earlyGameNote: '...',
 *   midGameNote: '...',
 *   lateGameNote: '...',
 *   tips: ['Consejo rápido y accionable.'],
 *   videoUrl: undefined, // solo si existe un vídeo real verificado
 *   matchHref: undefined, // solo si existe una partida real verificada
 *   editorialTake: { verdict: '...', reasoning: '...', confidence: 'medium' },
 *   relatedConceptIds: ['concept:trading', 'concept:spacing'],
 * };
 * ```
 */
export const leagueLaboratoryMatchups: Matchup[] = [];
