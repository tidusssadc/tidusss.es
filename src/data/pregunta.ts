/**
 * Preguntas de ejemplo para "Pregunta a Tidusss" — reales y funcionales
 * (cada una recupera contenido editorial real hoy, verificado contra
 * `domain/knowledge-answering/evaluation/cases.ts`). Se comparten entre
 * `/pregunta`, el bloque de Home y el bloque contextual de la guía de
 * Lucian para no mantener tres listas sueltas.
 */
export const PREGUNTA_GENERAL_SUGGESTIONS: readonly string[] = [
  '¿Cuándo me hago Navori?',
  '¿Es mejor Filo Infinito o Navori?',
  '¿Por qué Lucian necesita hacer los combos rápido?',
  '¿Cuándo empieza a ser fuerte Lucian?',
  '¿Qué runa usa Tidusss con Lucian?',
  '¿Con qué supports funciona bien Lucian?',
  '¿Por qué Lucian sufre en late?',
  '¿Qué errores cometen los jugadores de Lucian?',
];

/**
 * Tres preguntas cortas para el bloque de Home — elegidas por AMPLITUD, no
 * solo por tema: una de Lucian, una de un concepto general de ADC y una de
 * otro campeón, para que el bloque no lea como una herramienta exclusiva de
 * Lucian. Las tres están verificadas contra
 * `domain/knowledge-answering/evaluation/cases.ts` (estado real del motor,
 * nunca supuesto).
 */
export const PREGUNTA_HOME_SUGGESTIONS: readonly string[] = [
  '¿Cuándo empieza a ser fuerte Lucian?',
  '¿Cómo debo jugar los intercambios?',
  '¿Cuál es la build de Jinx?',
];

/** Preguntas contextuales para la guía de Lucian — sobre las secciones que esa página ya muestra (build, runas, sinergias, debilidades). */
export const PREGUNTA_LUCIAN_SUGGESTIONS: readonly string[] = [
  '¿Por qué recomiendas Filo Infinito?',
  '¿Cuándo prefieres Navori?',
  '¿Cómo debo jugar las rotaciones?',
  '¿Por qué Lucian pierde fuerza en late?',
];

export const PREGUNTA_MAX_QUESTION_LENGTH = 250;
