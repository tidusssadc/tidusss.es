/**
 * Sistema de objetivos dinámicos — un objetivo nunca se edita a mano: se
 * calcula a partir de un valor real (YouTube, Riot, o el propio catálogo
 * editorial) contra una cadena de hitos ascendentes ya definida. Cuando el
 * valor real supera un hito, ese hito pasa a "completado" y el siguiente de
 * la cadena se activa solo — sin tocar código ni contenido a mano.
 */

export type GoalCategory =
  | 'youtube-subscribers'
  | 'youtube-videos'
  | 'competitive-lp'
  | 'editorial-champions'
  | 'editorial-concepts'
  | 'editorial-matchups';

export type GoalSource = 'youtube' | 'riot' | 'editorial';

/**
 * Estados internos del motor. Nunca se muestran literalmente al usuario —
 * cada uno se traduce a una etiqueta editorial real en la capa de
 * presentación (p. ej. `no-data` → "No he podido consultar este dato ahora
 * mismo", nunca la palabra "no-data").
 */
export type GoalStatus =
  | 'active'
  | 'upcoming'
  | 'completed'
  | 'paused'
  | 'no-data'
  | 'unavailable';

export interface GoalMilestone {
  /** Estable entre reconstrucciones — nunca se genera a partir del target, para que un hito ya alcanzado conserve su identidad aunque cambie de posición en la cadena. */
  readonly id: string;
  readonly category: GoalCategory;
  readonly title: string;
  readonly description?: string;
  readonly target: number;
  readonly unit: string;
  readonly source: GoalSource;
  /** A dónde lleva "ver más" — casi siempre /comunidad o /competitivo. */
  readonly href: string;
  /** Posición ascendente dentro de su cadena — nunca se infiere del valor de `target` por si dos cadenas comparten número. */
  readonly order: number;
  /** Anula el cálculo de prioridad automático cuando existe un motivo editorial real para destacar este objetivo por encima de los demás. */
  readonly editorialPriority?: number;
  /** Objetivo real pero sin seguimiento automático activo hoy (p. ej. "Partner de Twitch": no hay ninguna métrica que lo mida) — nunca se calcula progreso para él, se muestra tal cual como pausado. */
  readonly paused?: boolean;
  /** Solo se rellena cuando la fecha de consecución es un dato real ya conocido (p. ej. historial editorial) — nunca se inventa para YouTube/Riot sin persistencia. */
  readonly achievedAt?: string;
}

export interface GoalChainDefinition {
  readonly category: GoalCategory;
  readonly title: string;
  readonly source: GoalSource;
  readonly href: string;
  /** Ascendente por `target` — el motor no reordena, así que el orden de definición ya es el orden real de la cadena. */
  readonly milestones: readonly GoalMilestone[];
}

export interface ResolvedGoal {
  readonly id: string;
  readonly category: GoalCategory;
  readonly title: string;
  readonly description?: string;
  /** `undefined` cuando la fuente real no ha respondido todavía o ha fallado — nunca 0 como valor por defecto engañoso. */
  readonly current?: number;
  readonly target: number;
  readonly unit: string;
  /** 0–100, redondeado a un decimal. `undefined` cuando `current` no existe. */
  readonly progress?: number;
  readonly status: GoalStatus;
  readonly source: GoalSource;
  readonly href: string;
  readonly achievedAt?: string;
  readonly editorialPriority?: number;
  readonly nextMilestone?: { readonly id: string; readonly title: string; readonly target: number };
}
