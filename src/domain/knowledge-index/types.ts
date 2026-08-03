import type { EditorialConfidence } from '../league-laboratory';

/**
 * El Índice de Conocimiento describe unidades editoriales recuperables y
 * citables — no relaciones entre entidades (eso es el Content Graph,
 * `domain/content-graph`). Este dominio no importa nada de allí, y el
 * Content Graph no importa nada de aquí: son dos responsabilidades
 * deliberadamente separadas que comparten el mismo dominio de origen
 * (`domain/league-laboratory`) sin conocerse entre sí.
 *
 * Ver `docs/knowledge-index.md` para la arquitectura completa.
 */

export type KnowledgeDocumentType =
  | 'champion-identity'
  | 'champion-understanding'
  | 'champion-editorial-take'
  | 'champion-strength'
  | 'champion-weakness'
  | 'champion-common-mistake'
  | 'champion-power-spike'
  | 'champion-quick-tip'
  | 'champion-editorial-history'
  | 'build-item'
  | 'build-editorial-take'
  | 'rune-choice'
  | 'rune-editorial-take'
  | 'synergy'
  | 'concept'
  | 'tier-list-entry';

/** Único valor hoy: todo el contenido indexado es criterio editorial de Tidusss, nunca dato de proveedor en vivo. */
export type KnowledgeSource = 'editorial';

/** Único valor hoy: todo el copy visible al usuario es español (PLATFORM_BIBLE.md §2.4). */
export type KnowledgeLanguage = 'es';

/**
 * Una unidad editorial recuperable y citable. Cada documento:
 * - tiene un `id` estable y determinista (nunca generado con `Math.random`/`Date.now`);
 * - conserva la trazabilidad exacta hacia la entidad real de origen (`sourceEntityId`);
 * - lleva una URL real, con ancla real cuando aplica — nunca inventada;
 * - hereda `confidence` del `EditorialTake` más cercano, cuando existe uno
 *   (los `Concept` no lo llevan: son definiciones objetivas, no un
 *   veredicto editorial, ver `builders.ts`).
 */
export interface KnowledgeDocument {
  readonly id: string;
  readonly type: KnowledgeDocumentType;
  readonly title: string;
  readonly content: string;
  readonly url: string;
  readonly source: KnowledgeSource;
  readonly language: KnowledgeLanguage;
  readonly sourceEntityId: string;
  readonly patchId?: string;
  readonly date?: string;
  readonly confidence?: EditorialConfidence;
  readonly relatedEntityIds: readonly string[];
}
