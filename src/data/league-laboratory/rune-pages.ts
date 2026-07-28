import type { RunePage } from '../../domain/league-laboratory';
import { patch2614 } from './patches';

/**
 * Páginas de runas editoriales — ver Fase 5/6, PLATFORM_BIBLE.md. Solo se
 * completa el dato confirmado por Tidusss para el parche 26.14 (la runa
 * principal); el árbol secundario y los fragmentos de estadística quedan
 * "Pendiente de análisis" a propósito, tal como exige el encargo — no se
 * rellenan con una suposición genérica.
 */
export const lucianRunes26_14: RunePage = {
  id: 'rune-page:lucian-26-14',
  title: 'Runas — Lucian ADC (parche 26.14)',
  championId: 'champion:lucian',
  role: 'BOTTOM',
  patchId: patch2614.id,
  primaryRunes: [
    {
      name: 'Ataque Intensificado',
      reasoning:
        'Tidusss utiliza siempre Ataque Intensificado como runa principal con Lucian en esta configuración.',
    },
  ],
  secondaryRunes: [],
  statShards: [],
  editorialTake: {
    verdict:
      'Runa principal confirmada: Ataque Intensificado, la elección fija de Tidusss con Lucian en el parche 26.14.',
    reasoning:
      'El árbol secundario y los fragmentos de estadística todavía no se han confirmado, así que se dejan pendientes de análisis en vez de completarse con una suposición.',
    confidence: 'high',
    lastReviewedPatch: patch2614.id,
  },
};

export const leagueLaboratoryRunePages: RunePage[] = [lucianRunes26_14];
