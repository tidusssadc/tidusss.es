import type { Concept } from '../../domain/league-laboratory';

/**
 * La Biblioteca de Conceptos: ideas de juego transversales, no atadas a un
 * campeón ni a un parche. Un matchup o una build las referencia por id
 * (`relatedConceptIds`) y `getRelatedConceptsFor` (registry.ts) las resuelve
 * automáticamente — ningún campeón "sabe" qué conceptos le aplican, solo lo
 * que lo menciona.
 *
 * Definiciones objetivas de vocabulario ya establecido en League of
 * Legends, no opiniones editoriales de Tidusss — esas viven en
 * `editorialTake` de cada matchup/sinergia/build que referencia el concepto.
 */

export const spacing: Concept = {
  id: 'concept:spacing',
  title: 'Spacing',
  category: 'Fundamentos de combate',
  summary:
    'Mantener la distancia óptima respecto al rival: la justa para golpear con el propio kit sin quedar al alcance del suyo. Es especialmente crítico para campeones de rango con ventanas de daño cortas, donde un metro de más o de menos decide el trade.',
};

export const powerSpike: Concept = {
  id: 'concept:power-spike',
  title: 'Power Spike',
  category: 'Planificación de partida',
  summary:
    'El momento concreto de la partida —un nivel, un objeto, un hito de parche— en el que un campeón gana una ventaja de poder desproporcionada respecto al resto de la partida. Reconocer los propios power spikes (y los del rival) es lo que separa "jugar de forma agresiva" de "jugar de forma agresiva en el momento correcto".',
};

export const snowball: Concept = {
  id: 'concept:snowball',
  title: 'Snowball',
  category: 'Planificación de partida',
  summary:
    'Convertir una ventaja temprana —una kill, un objetivo, una oleada ganada— en una ventaja cada vez mayor, en vez de dejar que el rival la neutralice jugando de forma pasiva. Lo opuesto a desperdiciar una ventaja por exceso de cautela.',
};

export const trading: Concept = {
  id: 'concept:trading',
  title: 'Trading',
  category: 'Fundamentos de combate',
  summary:
    'El intercambio de daño entre dos campeones en línea. Ganar un trade no es infligir daño: es infligir más del que se recibe, normalmente aprovechando un cooldown enemigo caído, una posición favorable o un power spike propio.',
};

export const tempo: Concept = {
  id: 'concept:tempo',
  title: 'Tempo',
  category: 'Planificación de partida',
  summary:
    'El control del ritmo de la partida: quién decide cuándo se lucha, cuándo se hace recall o cuándo se rota a otra línea. Tener tempo es poder dictar la siguiente acción relevante antes de que el rival pueda reaccionar a ella.',
};

export const waveManagement: Concept = {
  id: 'concept:wave-management',
  title: 'Wave Management',
  category: 'Fundamentos de línea',
  summary:
    'La gestión deliberada de la oleada de minions —empujarla, congelarla o dejarla acumular— para maximizar el propio beneficio: farmear con seguridad, forzar un recall desperdiciado del rival o dejar la línea lista para una rotación o un gank.',
};

export const leagueLaboratoryConcepts: Concept[] = [
  spacing,
  powerSpike,
  snowball,
  trading,
  tempo,
  waveManagement,
];
