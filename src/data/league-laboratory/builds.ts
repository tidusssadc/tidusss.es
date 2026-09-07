import type { Build, BuildItemChoice } from '../../domain/league-laboratory';
import { patch2614 } from './patches';

/**
 * Builds editoriales — un bloque explica siempre el "por qué", nunca solo
 * el "qué" (ver Fase 5/6, PLATFORM_BIBLE.md). Todo el contenido de este
 * archivo corresponde al parche 26.14 y viene exclusivamente del criterio
 * de Tidusss aportado directamente — no se ha consultado ninguna fuente
 * externa ni se ha extrapolado a otros parches.
 */

/**
 * Las botas no se presentan como universalmente superiores una a otra: la
 * elección depende de la partida y del estilo de juego buscado. Se
 * comparten entre las dos rutas de Lucian porque la decisión de botas es
 * independiente de si el segundo objeto es Filo Infinito o Navori.
 */
const lucianBoots26_14: BuildItemChoice[] = [
  {
    name: 'Botas de Acero Revestidas (Tabis)',
    itemId: 3047,
    reasoning:
      'Úsalas especialmente cuando el equipo rival tiene mucho daño físico, varios campeones AD o asesinos físicos.',
  },
  {
    name: 'Botas Jonias de la Lucidez',
    itemId: 3158,
    reasoning:
      'Elígelas cuando busques más reducción de enfriamiento, lanzar habilidades con mayor frecuencia o un estilo de juego más orientado a spamear habilidades.',
  },
];

const lucianSkillOrder26_14 = ['Q', 'E'];
const lucianSkillOrderReasoning26_14 =
  'Q es la prioridad principal; E es la segunda habilidad que Tidusss maximiza. El orden completo con W todavía no está confirmado.';

const lucianSituationalItems26_14: BuildItemChoice[] = [
  {
    name: 'Últimas Palabras de Lord Dominik',
    itemId: 3036,
    reasoning: 'Contra varios tanques o mucha armadura en el equipo rival.',
  },
  {
    name: 'Recordatorio Letal',
    itemId: 3033,
    reasoning: 'Contra composiciones con mucha curación.',
  },
];

export const lucianSolidBuild26_14: Build = {
  id: 'build:lucian-26-14-solid',
  title: 'Ruta más sólida — Lucian ADC (parche 26.14)',
  championId: 'champion:lucian',
  role: 'BOTTOM',
  patchId: patch2614.id,
  variant: 'primary',
  startingItems: [
    {
      name: 'Brillo',
      itemId: 3057,
      reasoning:
        'Tidusss intenta priorizarlo en el primer back cuando la economía de la partida lo permite, de camino a Segador de Esencia. No siempre es posible comprarlo — depende de cómo vaya la partida.',
    },
  ],
  boots: lucianBoots26_14,
  coreItems: [
    {
      name: 'Segador de Esencia',
      itemId: 3508,
      timing: 'Primer objeto',
      reasoning:
        'Es siempre el primer objeto de la build actual de Tidusss con Lucian en el parche 26.14.',
    },
    {
      name: 'Filo Infinito',
      itemId: 3031,
      timing: 'Segundo objeto',
      reasoning:
        'La opción generalmente más sólida como segundo objeto: ordena mejor la progresión de la build cuando el tercer objeto tiene que aportar penetración de armadura o reducción de curaciones — con esta ruta, Lucian no llega a tres objetos sin él.',
    },
  ],
  situationalItems: lucianSituationalItems26_14,
  skillOrder: lucianSkillOrder26_14,
  skillOrderReasoning: lucianSkillOrderReasoning26_14,
  editorialTake: {
    verdict:
      'La ruta más ordenada para Lucian en el parche 26.14: Segador de Esencia, Filo Infinito y penetración o reducción de curación según la partida.',
    reasoning:
      'Filo Infinito como segundo objeto evita el problema de progresión que puede darse si el tercer objeto necesario es penetración de armadura o reducción de curación: con esta ruta, Lucian nunca llega a tres objetos sin él.',
    confidence: 'high',
    lastReviewedPatch: patch2614.id,
  },
};

/**
 * "No te digo solo qué comprar. Te explico por qué y qué problema puede
 * generar cada decisión." Esta ruta es exactamente ese caso: la preferencia
 * personal de Tidusss, con su riesgo explicado sin suavizarlo.
 */
export const lucianPersonalBuild26_14: Build = {
  id: 'build:lucian-26-14-personal',
  title: 'Ruta personal de Tidusss — Lucian ADC (parche 26.14)',
  championId: 'champion:lucian',
  role: 'BOTTOM',
  patchId: patch2614.id,
  variant: 'situational',
  situationalContext:
    'Preferencia personal de Tidusss: le encanta jugar Navori de segundo objeto, aunque reconoce que en muchas partidas Filo Infinito es la opción más sólida.',
  startingItems: [
    {
      name: 'Brillo',
      itemId: 3057,
      reasoning:
        'Tidusss intenta priorizarlo en el primer back cuando la economía de la partida lo permite, de camino a Segador de Esencia — igual que en la ruta más sólida.',
    },
  ],
  boots: lucianBoots26_14,
  coreItems: [
    {
      name: 'Segador de Esencia',
      itemId: 3508,
      timing: 'Primer objeto',
      reasoning:
        'Es siempre el primer objeto de la build actual de Tidusss con Lucian, igual que en la ruta más sólida.',
    },
    {
      name: 'Navori',
      itemId: 6675,
      timing: 'Segundo objeto',
      reasoning:
        'A Tidusss le encanta jugar Navori de segundo objeto — es su preferencia personal en el parche 26.14, no una regla universal.',
      cons: [
        'Puede complicar la progresión de la build si el tercer objeto tiene que ser penetración de armadura o reducción de curación: en ese escenario, Lucian llega a tres objetos sin Filo Infinito, retrasando uno de sus picos de daño más importantes.',
      ],
    },
  ],
  situationalItems: lucianSituationalItems26_14,
  skillOrder: lucianSkillOrder26_14,
  skillOrderReasoning: lucianSkillOrderReasoning26_14,
  editorialTake: {
    verdict:
      'A Tidusss le encanta jugar Navori de segundo objeto — pero es su preferencia personal, no la ruta más ordenada.',
    reasoning:
      'Elegir Navori de segundo puede complicar la progresión de la build si el tercer objeto tiene que ser penetración de armadura o reducción de curación: en ese escenario, Lucian puede llegar a tres objetos sin Filo Infinito, lo que retrasa uno de sus picos de daño más importantes. En muchas partidas, Filo Infinito ordena mejor la build.',
    confidence: 'medium',
    lastReviewedPatch: patch2614.id,
  },
};

export const leagueLaboratoryBuilds: Build[] = [
  lucianSolidBuild26_14,
  lucianPersonalBuild26_14,
];
