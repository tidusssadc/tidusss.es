/**
 * Preguntas de ejemplo para "Pregunta a Tidusss" — reales y funcionales,
 * cada una ejecutada contra el motor real (`createLocalProvider` +
 * `assembleAnswer`, el mismo camino exacto que `/api/pregunta`) antes de
 * añadirla aquí, nunca solo contra la lista de evaluación. Se comparten
 * entre `/pregunta`, `/explorar` (las 3 primeras) y la rotación semanal de
 * Home (`HomeTodayModule`) para no mantener listas sueltas sin verificar.
 *
 * Amplitud deliberada, no solo Lucian: Lucian sigue siendo la cobertura
 * editorial más rica hoy (4 de 8), pero conceptos de Academia y otros
 * campeones vía la Tier List demuestran que la herramienta es de
 * conocimiento ADC, no un chatbot de un único campeón. Orden mezclado a
 * propósito — las 3 primeras (las que se ven en /explorar) ya muestran esa
 * variedad, no solo Lucian.
 */
export const PREGUNTA_GENERAL_SUGGESTIONS: readonly string[] = [
  '¿Cuándo empieza a ser fuerte Lucian?',
  '¿Qué es el snowball?',
  '¿Cuál es la build de Jinx?',
  '¿Cuándo me hago Navori?',
  '¿Qué runa usa Tidusss con Lucian?',
  '¿Con qué supports funciona bien Lucian?',
  '¿Qué es el spacing?',
  'Draven en la Tier List',
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
