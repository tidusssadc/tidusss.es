/**
 * Normalización léxica ligera: sinónimos editoriales, jerga bilingüe de LoL
 * y variantes de número/idioma frecuentes — aplicada como un paso más de
 * `tokenize()` (`normalize.ts`), nunca como un lematizador genérico de
 * español. Cada grupo existe porque se verificó una de estas dos cosas
 * ANTES de añadirlo (nunca se adivinó):
 *
 * 1. el propio corpus real (`src/data/league-laboratory`) usa más de una
 *    forma para la misma idea (p. ej. "build" en los títulos, "objeto" en
 *    el contenido; "enfriamiento" en `builds.ts`, "cooldown" en
 *    `concepts.ts`); o
 * 2. la evaluación de recuperación (`evaluation/cases.ts`) detectó un fallo
 *    real de recall por esta discrepancia exacta ("intercambios" vs.
 *    "intercambio"/"trading"; "fuerte" vs. "power spike"/"nivel").
 *
 * Deliberadamente NO es un diccionario exhaustivo de jerga de LoL: cada
 * grupo se justifica en el comentario que lo acompaña, con la cita textual
 * del corpus o del caso de evaluación que lo motivó.
 */

const SYNONYM_GROUPS: ReadonlyArray<readonly [canonical: string, variants: readonly string[]]> = [
  // "El intercambio de daño..." (concepts.ts, concept:trading) — fallo real detectado:
  // la pregunta "¿Cómo debo jugar los intercambios?" (plural) nunca encontraba el
  // concepto real (singular) sin esta normalización.
  ['intercambio', ['intercambios', 'tradear', 'trading', 'trade', 'trades']],
  // "una ventaja de poder desproporcionada" (concepts.ts, concept:power-spike) —
  // fallo real detectado: "¿Cuándo empieza a ser fuerte Lucian?" no encontraba el
  // power spike real porque "fuerte" solo estaba asociado a `champion-strength`.
  ['poder', ['fuerte', 'pico', 'spike', 'spikes']],
  // "reducción de enfriamiento" (builds.ts) y "un cooldown enemigo caído"
  // (concepts.ts) — el propio corpus ya usa ambas formas en documentos distintos.
  ['enfriamiento', ['cd', 'cooldown']],
  // "ataques básicos" (champions.ts, common-mistake) — jerga bilingüe habitual
  // del juego para el mismo concepto.
  ['basico', ['basicos', 'autoataque', 'auto', 'aa']],
  // Pregunta real del conjunto de evaluación: "¿Con qué supports funciona bien
  // Lucian?" — variante inglesa habitual de "soporte".
  ['soporte', ['support', 'supports', 'soportes']],
  // "...antes de que los ADC de mayor escalado lleguen al late" (champions.ts,
  // quick-tip) y "...si la partida se alarga demasiado" (weakness) — "late" ya
  // es vocabulario real del corpus; se añade la variante en español.
  ['late', ['tardio', 'tardia']],
  // "Genera presión y ventaja en las fases temprana y media" (champions.ts,
  // strength) — variante inglesa habitual de "temprana".
  ['temprana', ['early', 'temprano']],
  // "build" (omnipresente en títulos) y "objeto"/"objetos" (omnipresente en el
  // contenido) son, en el propio corpus, la misma idea con dos palabras distintas.
  ['build', ['objeto', 'objetos']],
  // "runa" (contenido de `rune-page:lucian-26-14:editorial-take`) y "runas"
  // (títulos, ancla `#runas-heading`) — mismo caso que "intercambio"/"intercambios".
  ['runa', ['runas']],
  // "Sinergia: Lucian + X" (título, singular) y el ancla real `#sinergias-heading`
  // (plural) — mismo caso de número gramatical.
  ['sinergia', ['sinergias']],
];

const CANONICAL_FORM_BY_VARIANT: ReadonlyMap<string, string> = new Map(
  SYNONYM_GROUPS.flatMap(([canonical, variants]) =>
    variants.map((variant): readonly [string, string] => [variant, canonical]),
  ),
);

/** Devuelve la forma canónica de un token ya normalizado, o el propio token si no pertenece a ningún grupo. */
export const canonicalizeToken = (token: string): string =>
  CANONICAL_FORM_BY_VARIANT.get(token) ?? token;
