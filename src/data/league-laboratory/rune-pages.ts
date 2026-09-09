import type { RunePage } from '../../domain/league-laboratory';
import { patch2614, patch2617 } from './patches';

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

/**
 * Jhin, parche 26.17 — DOS páginas de runas alternativas, no una con una
 * elección "correcta". El propio dominio ya soporta esto sin cambios: cada
 * campeón puede tener varias entradas en `leagueLaboratoryRunePages`
 * (`ChampionKnowledge.runePages: readonly RunePage[]`), y la página de
 * campeón ya recorre todas las que existan. Reutilizado tal cual —
 * ninguna generalización de modelo fue necesaria para esto.
 *
 * Ninguna runa menor se completa aquí: la referencia visual no permite
 * confirmarlas de forma inequívoca en esta fase (ver informe de entrega).
 * Solo la runa principal (keystone) de cada configuración está confirmada.
 * `editorialTake` de cada una describe honestamente que son alternativas
 * SIN un criterio de selección publicado — nunca se inventa cuándo elegir
 * una u otra.
 */
export const jhinRunesA26_17: RunePage = {
  id: 'rune-page:jhin-26-17-a',
  title: 'Runas — Jhin ADC, opción A: Pies Veloces (parche 26.17)',
  championId: 'champion:jhin',
  role: 'BOTTOM',
  patchId: patch2617.id,
  primaryRunes: [{ name: 'Pies Veloces' }],
  secondaryRunes: [],
  statShards: [],
  editorialTake: {
    verdict:
      'Una de las dos configuraciones de runas de referencia para Jhin en el parche 26.17, con Pies Veloces como runa principal.',
    reasoning:
      'Configuración validada por Tidusss, alternativa a la Configuración B (Toque de Muerte Ígnea) — todavía sin un criterio de selección publicado entre las dos, y sin el resto del árbol de runas (rama secundaria, fragmentos de estadística) confirmado.',
    confidence: 'low',
    lastReviewedPatch: patch2617.id,
  },
};

export const jhinRunesB26_17: RunePage = {
  id: 'rune-page:jhin-26-17-b',
  title: 'Runas — Jhin ADC, opción B: Toque de Muerte Ígnea (parche 26.17)',
  championId: 'champion:jhin',
  role: 'BOTTOM',
  patchId: patch2617.id,
  primaryRunes: [{ name: 'Toque de Muerte Ígnea' }],
  secondaryRunes: [],
  statShards: [],
  editorialTake: {
    verdict:
      'La segunda de las dos configuraciones de runas de referencia para Jhin en el parche 26.17, con Toque de Muerte Ígnea como runa principal.',
    reasoning:
      'Configuración validada por Tidusss, alternativa a la Configuración A (Pies Veloces) — todavía sin un criterio de selección publicado entre las dos, y sin el resto del árbol de runas confirmado.',
    confidence: 'low',
    lastReviewedPatch: patch2617.id,
  },
};

export const leagueLaboratoryRunePages: RunePage[] = [
  lucianRunes26_14,
  jhinRunesA26_17,
  jhinRunesB26_17,
];
