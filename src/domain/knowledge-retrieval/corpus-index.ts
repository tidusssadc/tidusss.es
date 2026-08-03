import {
  championCatalog,
  leagueLaboratoryPatches,
} from '../../data/league-laboratory';
import type { KnowledgeDocument, KnowledgeDocumentType } from '../knowledge-index';
import type { LabChampionId, PatchId } from '../league-laboratory';
import { normalizeText } from './normalize';

/**
 * Estructuras auxiliares, construidas una sola vez a partir de datos reales
 * (nunca inventadas), que ambos proveedores de recuperación usan para
 * reconocer entidades mencionadas en el texto de una pregunta:
 *
 * - nombres de campeón: se reconocen contra el catálogo COMPLETO (~170),
 *   no solo los campeones curados. Esto es deliberado: permite distinguir
 *   "Draven no existe" (nunca ocurre, el catálogo es real y completo) de
 *   "Draven existe pero el Laboratorio no tiene contenido editorial sobre
 *   él todavía" (el caso real de Draven/Jinx) — dos respuestas distintas
 *   para dos preguntas distintas, en vez de un genérico "no te entiendo".
 * - parches: reconocidos contra `leagueLaboratoryPatches` real.
 */

const championNameIndex: ReadonlyMap<string, LabChampionId> = new Map(
  championCatalog.map((entry) => [normalizeText(entry.name), entry.id]),
);

const patchLabelIndex: ReadonlyMap<string, PatchId> = new Map(
  leagueLaboratoryPatches.map((patch) => [normalizeText(patch.label), patch.id]),
);

/** Busca, dentro del texto ya normalizado de una pregunta, el nombre de campeón reconocido más largo (evita que "Lucian" gane sobre un nombre compuesto si algún día lo hay). */
export const findMentionedChampionId = (
  normalizedQueryText: string,
): LabChampionId | undefined => {
  const queryTokens = new Set(normalizedQueryText.split(' '));
  let bestMatch: { id: LabChampionId; length: number } | undefined;
  for (const [name, id] of championNameIndex) {
    if (!queryTokens.has(name) && !normalizedQueryText.includes(name)) continue;
    if (!bestMatch || name.length > bestMatch.length) {
      bestMatch = { id, length: name.length };
    }
  }
  return bestMatch?.id;
};

/** Reconoce un parche mencionado (p. ej. "26.14" o "15.14") en el texto ya normalizado. */
export const findMentionedPatchId = (
  normalizedQueryText: string,
): PatchId | undefined => {
  for (const [label, id] of patchLabelIndex) {
    if (normalizedQueryText.includes(label)) return id;
  }
  return undefined;
};

/**
 * Nombre real de una entidad relacionada, para dos usos:
 * 1. Retirar el nombre del propio campeón filtrado de la puntuación por
 *    términos (evita contar dos veces la misma señal: una vez como
 *    `champion-match` y otra como coincidencia de título/contenido
 *    trivial, presente en prácticamente todos los documentos del corpus).
 * 2. Reconocer si la pregunta nombra explícitamente a OTRA entidad
 *    relacionada (un socio de sinergia, un concepto) — nunca al revés
 *    (nunca se premia un documento solo porque su título ya trae dos
 *    nombres, si la pregunta no mencionó el segundo).
 *
 * Para campeones se resuelve contra el catálogo real (cualquiera de los
 * ~170, curado o no). Para conceptos se resuelve contra el título real de
 * su propio documento en el corpus — nunca se deriva del id con
 * capitalización artificial.
 */
export const resolveEntityDisplayName = (
  entityId: string,
  corpus: readonly KnowledgeDocument[],
): string | undefined => {
  if (entityId.startsWith('champion:')) {
    return championCatalog.find((entry) => entry.id === entityId)?.name;
  }
  if (entityId.startsWith('concept:')) {
    return corpus.find((document) => document.sourceEntityId === entityId && document.type === 'concept')
      ?.title;
  }
  return undefined;
};

/**
 * Diccionario pequeño y explícito de palabra clave -> tipo(s) de documento.
 * No es un intento de cubrir cada pregunta posible: es la señal de
 * "etiqueta/campo" mínima que pide el encargo (Fase 2), aplicada como un
 * pequeño empujón adicional en la puntuación, nunca como el único criterio
 * de recuperación.
 *
 * Las palabras clave están escritas en su FORMA CANÓNICA post-sinónimos
 * (`synonyms.ts`): `tokenize()` ya convierte "runas"→"runa",
 * "objetos"→"build", "spike"/"pico"→"poder", etc. antes de que este
 * diccionario compare nada, así que escribir aquí la variante original
 * ("runas", "spike") nunca coincidiría con el token real ya canonicalizado.
 *
 * Nota deliberada sobre "fuerte": tras la mejora léxica de Fase 1,
 * "fuerte" canonicaliza a "poder" (agrupado con "power spike"), no a
 * "fortaleza" — una pregunta temporal como "¿cuándo es fuerte Lucian?"
 * ahora apunta a `champion-power-spike`, no a `champion-strength`. Las
 * fortalezas del campeón siguen encontrándose por su propia palabra,
 * "fortaleza"/"fortalezas", que no participa en ese grupo de sinónimos.
 */
export const TYPE_KEYWORDS: ReadonlyArray<{
  readonly keywords: readonly string[];
  readonly types: readonly KnowledgeDocumentType[];
}> = [
  { keywords: ['runa'], types: ['rune-choice', 'rune-editorial-take'] },
  { keywords: ['build', 'item', 'items'], types: ['build-item', 'build-editorial-take'] },
  { keywords: ['sinergia', 'soporte', 'apoyo'], types: ['synergy'] },
  { keywords: ['tier', 'clasificacion', 'ranking'], types: ['tier-list-entry'] },
  { keywords: ['historial', 'cambio', 'cambios', 'parche'], types: ['champion-editorial-history'] },
  { keywords: ['error', 'errores', 'fallo', 'fallos'], types: ['champion-common-mistake'] },
  { keywords: ['consejo', 'consejos', 'tip', 'tips'], types: ['champion-quick-tip'] },
  { keywords: ['fortaleza', 'fortalezas'], types: ['champion-strength'] },
  { keywords: ['debilidad', 'debilidades', 'debil', 'sufre'], types: ['champion-weakness'] },
  { keywords: ['poder', 'nivel'], types: ['champion-power-spike'] },
  { keywords: ['concepto', 'conceptos'], types: ['concept'] },
];
