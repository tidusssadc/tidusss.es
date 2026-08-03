import type { GenerationInput, GenerationResult } from './types';

/**
 * Validación de salida (Fase 5 del encargo) — se ejecuta en servidor
 * contra CUALQUIER resultado de generación, incluido el del generador
 * determinista (que siempre la pasa, por construcción). Ningún resultado
 * de generación llega al usuario sin pasar por aquí primero.
 *
 * Nota de diseño: muchas de las cosas que el encargo pide impedir
 * ("cambiar confianza", "cambiar parche", "cambiar cobertura") ya son
 * estructuralmente imposibles — `GenerationResult` (`types.ts`) no tiene
 * ni un campo `confidence`/`coverage`/`patchId` donde un proveedor pudiera
 * escribir un valor nuevo. Esta validación cubre lo que SÍ es posible de
 * violar dentro de la superficie real del contrato: qué fuentes dice haber
 * usado, y qué texto libre devuelve.
 */

const MAX_GENERATED_TEXT_LENGTH = 1200;

/** Cualquier cosa con forma de URL o de ruta interna — Claude nunca recibe URLs, así que nunca debería producir ninguna. */
const URL_LIKE_PATTERN = /https?:\/\/\S+|\/campeones\/\S+|\/tier-list\S*|\/live\/?\S*/i;

/** Frases que solo pueden aparecer si el prompt del sistema o las instrucciones internas se filtraron al texto. */
const PROMPT_LEAK_MARKERS = [
  'system prompt',
  'prompt del sistema',
  'las instrucciones que me diste',
  'mis instrucciones son',
  'como modelo de lenguaje',
  'como asistente de ia',
];

/** Frases que inflan la confianza percibida más allá de lo que el criterio editorial real respalda. */
const CONFIDENCE_INFLATION_MARKERS = [
  'confianza muy alta',
  'confianza altisima',
  'totalmente seguro',
  'absolutamente seguro',
  'sin ninguna duda',
  'garantizado al 100',
];

const normalizeForScan = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export interface GenerationValidation {
  readonly valid: boolean;
  readonly violations: readonly string[];
}

export const validateGenerationResult = (
  result: GenerationResult,
  input: GenerationInput,
): GenerationValidation => {
  const violations: string[] = [];

  if (result.status !== 'generated') {
    // Un resultado que ya se declara a sí mismo como no generado (fallback/no aplicable/sin configurar)
    // no tiene texto que validar — su propio estado ya es la señal correcta.
    return { valid: true, violations: [] };
  }

  const allowedIds = new Set(input.allowedDocumentIds);

  const unknownSourceIds = result.usedSourceIds.filter((id) => !allowedIds.has(id));
  if (unknownSourceIds.length > 0) {
    violations.push(`Cita fuentes fuera de la lista permitida: ${unknownSourceIds.join(', ')}`);
  }

  if (input.allowedDocumentIds.length > 0 && result.usedSourceIds.length === 0) {
    violations.push('Descarta todas las fuentes permitidas mientras declara haber generado una respuesta.');
  }

  const text = result.text ?? '';
  if (text.trim().length === 0) {
    violations.push('Texto vacío en un resultado marcado como generado.');
  }

  if (text.length > MAX_GENERATED_TEXT_LENGTH) {
    violations.push(`Texto excesivamente largo (${text.length} caracteres, máximo ${MAX_GENERATED_TEXT_LENGTH}).`);
  }

  if (URL_LIKE_PATTERN.test(text)) {
    violations.push('El texto contiene un enlace o ruta — los enlaces solo pueden venir de `sources`/`relatedLinks`.');
  }

  const normalizedText = normalizeForScan(text);
  for (const marker of PROMPT_LEAK_MARKERS) {
    if (normalizedText.includes(marker)) {
      violations.push(`Posible filtración de instrucciones internas: "${marker}".`);
    }
  }

  const realConfidenceIsHigh = input.editorialConfidence === 'high';
  if (!realConfidenceIsHigh) {
    for (const marker of CONFIDENCE_INFLATION_MARKERS) {
      if (normalizedText.includes(marker)) {
        violations.push(`El texto infla la confianza más allá de la real ("${input.editorialConfidence ?? 'ninguna'}"): "${marker}".`);
      }
    }
  }

  return { valid: violations.length === 0, violations };
};
