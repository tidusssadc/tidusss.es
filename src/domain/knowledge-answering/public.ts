import { leagueLaboratoryPatches } from '../../data/league-laboratory';
import type { EditorialConfidence } from '../league-laboratory';
import type { RetrievalCoverage } from '../knowledge-retrieval';
import type { KnowledgeDocumentType } from '../knowledge-index';
import type { AnswerResult, AnswerStatus } from './types';

/**
 * DTO público de `/api/pregunta` — deliberadamente SEPARADO de
 * `AnswerResult` (el contrato interno del dominio). Nunca se envía al
 * cliente el `AnswerResult` tal cual: `rejectionReasons` es un detalle de
 * implementación (la página ya muestra un texto fijo y editado por
 * estado, no la frase interna), y ni `type`/`kind` internos ni la
 * puntuación cruda de recuperación cruzan la red sin traducir.
 *
 * `retrievalConfidence` se expone como una banda (`'high'|'medium'|'low'`),
 * nunca como el número crudo — "no mostrar tecnicismos como retrieval
 * score" (encargo). La UI pública solo muestra dos conceptos de todos
 * modos (confianza editorial y cobertura, ver `docs/knowledge-answering.md`
 * §12); la banda de recuperación viaja en el contrato por si un futuro
 * consumidor la necesita, pero la página de `/pregunta` no la renderiza.
 */

export interface PublicSource {
  readonly title: string;
  /** Etiqueta legible en español — nunca el `KnowledgeDocumentType` interno. */
  readonly type: string;
  readonly patchId?: string;
  readonly editorialDate?: string;
  readonly url: string;
  readonly excerpt: string;
}

export interface PublicRelatedLink {
  readonly title: string;
  readonly href: string;
  /** Etiqueta legible en español — nunca el `ContentEntityKind` interno. */
  readonly kind: string;
}

export interface PublicAnswer {
  readonly status: AnswerStatus;
  readonly answer?: string;
  readonly editorialConfidence?: EditorialConfidence;
  readonly retrievalConfidence: 'high' | 'medium' | 'low';
  readonly coverage: RetrievalCoverage;
  readonly patchId?: string;
  readonly editorialDate?: string;
  readonly sources: readonly PublicSource[];
  readonly related: readonly PublicRelatedLink[];
}

const SOURCE_TYPE_LABELS: Record<KnowledgeDocumentType, string> = {
  'champion-identity': 'Identidad del campeón',
  'champion-understanding': 'Entendiendo al campeón',
  'champion-editorial-take': 'Veredicto editorial',
  'champion-strength': 'Fortaleza',
  'champion-weakness': 'Debilidad',
  'champion-common-mistake': 'Error frecuente',
  'champion-power-spike': 'Power spike',
  'champion-quick-tip': 'Consejo rápido',
  'champion-editorial-history': 'Historial editorial',
  'build-item': 'Build',
  'build-editorial-take': 'Build',
  'rune-choice': 'Runas',
  'rune-editorial-take': 'Runas',
  synergy: 'Sinergia',
  concept: 'Concepto',
  'tier-list-entry': 'Tier List',
};

/**
 * Cubre todos los `ContentEntityKind` reales, aunque hoy solo un puñado
 * sean alcanzables desde el contenido de Lucian — un `Record` exhaustivo
 * es más barato de mantener que una lista parcial que TypeScript no
 * verifica.
 */
const RELATED_KIND_LABELS: Record<string, string> = {
  champion: 'Campeón',
  build: 'Build',
  'rune-page': 'Runas',
  synergy: 'Sinergia',
  concept: 'Concepto',
  'editorial-log': 'Historial editorial',
  'tier-list': 'Tier List',
  guide: 'Guía',
  matchup: 'Matchup',
  video: 'Vídeo',
  match: 'Partida',
  patch: 'Parche',
  moment: 'Momento',
  tool: 'Herramienta',
  library: 'Biblioteca',
  goal: 'Objetivo',
  achievement: 'Logro',
  game: 'Juego',
  reference: 'Referencia',
  'creator-project': 'Proyecto',
  channel: 'Canal',
};

const patchLabelById: ReadonlyMap<string, string> = new Map(
  leagueLaboratoryPatches.map((patch) => [patch.id, patch.label]),
);
const patchLabel = (patchId: string | undefined): string | undefined =>
  patchId ? (patchLabelById.get(patchId) ?? patchId) : undefined;

const RETRIEVAL_CONFIDENCE_HIGH = 0.55;
const RETRIEVAL_CONFIDENCE_MEDIUM = 0.3;

const retrievalConfidenceBand = (score: number): 'high' | 'medium' | 'low' => {
  if (score >= RETRIEVAL_CONFIDENCE_HIGH) return 'high';
  if (score >= RETRIEVAL_CONFIDENCE_MEDIUM) return 'medium';
  return 'low';
};

export const toPublicAnswer = (answer: AnswerResult): PublicAnswer => ({
  status: answer.status,
  answer: answer.answer,
  editorialConfidence: answer.editorialConfidence,
  retrievalConfidence: retrievalConfidenceBand(answer.retrievalConfidence),
  coverage: answer.coverage,
  patchId: patchLabel(answer.patchId),
  editorialDate: answer.editorialDate,
  sources: answer.sources.map((source) => ({
    title: source.title,
    type: SOURCE_TYPE_LABELS[source.type],
    patchId: patchLabel(source.patchId),
    editorialDate: source.editorialDate,
    url: source.url,
    excerpt: source.excerpt,
  })),
  related: answer.relatedLinks.map((link) => ({
    title: link.title,
    href: link.href,
    kind: RELATED_KIND_LABELS[link.kind] ?? link.kind,
  })),
});
