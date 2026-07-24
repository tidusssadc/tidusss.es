import type { TierList, TierListEntry } from '../../domain/league-laboratory';
import { ezreal, jinx, kaisa, lucian } from './champions';
import { patch1514 } from './patches';

const lucianEntry: TierListEntry = {
  championId: lucian.id,
  reviewStatus: 'reviewed',
  tier: 'S',
  trend: 'stable',
  editorialTake: {
    verdict:
      'Lucian es la referencia de esta Tier List: la especialidad competitiva de Tidusss en Solo Queue.',
    reasoning:
      'Todo el canal gira en torno a este campeón: las partidas comentadas, el análisis y la credencial competitiva de Tidusss se construyen jugando Lucian en ADC. Por eso encabeza esta primera versión con la confianza más alta.',
    confidence: 'high',
    lastReviewedPatch: patch1514.id,
  },
  strengths: [
    'Ventana de daño explosiva con el combo pasivo',
    'Movilidad para reposicionarse dentro de la pelea',
    'Presión de línea alta cuando el trade se ejecuta bien',
  ],
  weaknesses: [
    'Los objetos y las runas exigen precisión de ejecución',
    'Vulnerable si pierde la ventana de daño inicial',
  ],
};

const placeholderEntry = (
  championId: TierListEntry['championId'],
): TierListEntry => ({
  championId,
  reviewStatus: 'placeholder',
  editorialTake: {
    verdict: 'Placeholder editorial — pendiente de revisión por Tidusss.',
    reasoning:
      'Esta entrada es un borrador de demostración del sistema. Tidusss todavía no ha publicado un veredicto real sobre este campeón para el parche actual.',
    confidence: 'low',
  },
});

export const officialAdcTierList: TierList = {
  id: 'tier-list:official-adc',
  title: 'Tier List Oficial ADC · Tidusss',
  patchId: patch1514.id,
  role: 'BOTTOM',
  queue: 'solo-duo',
  methodologyNote:
    'Esta clasificación refleja el criterio personal de Tidusss como jugador Master ADC en EUW: prioriza lo que funciona en su propia experiencia de Solo Queue, no un promedio estadístico de win rate. Los campeones marcados como borrador todavía no tienen una valoración publicada.',
  status: 'published',
  publishedAt: '2026-07-24',
  entries: [
    lucianEntry,
    placeholderEntry(kaisa.id),
    placeholderEntry(jinx.id),
    placeholderEntry(ezreal.id),
  ],
};
