import type { AnswerResult } from './types';

/**
 * Invariantes del motor de respuesta — funciones puras, reciben datos y
 * devuelven violaciones, nunca lanzan. Mismo patrón que
 * `content-graph/invariants.ts` y `knowledge-index/invariants.ts`.
 */

const ANSWERED_STATUSES = new Set(['sufficient', 'partial']);
const REJECTED_STATUSES = new Set([
  'insufficient-information',
  'out-of-scope',
  'empty-question',
  'internal-error',
]);

/** Toda respuesta con estado "respondido" debe tener texto y al menos una fuente; toda respuesta rechazada, ninguna. */
export const findAnswersWithInconsistentShape = (
  answers: readonly AnswerResult[],
): AnswerResult[] =>
  answers.filter((answer) => {
    if (ANSWERED_STATUSES.has(answer.status)) {
      return !answer.answer || answer.answer.trim().length === 0 || answer.sources.length === 0;
    }
    if (REJECTED_STATUSES.has(answer.status)) {
      return answer.answer !== undefined || answer.sources.length > 0 || answer.rejectionReasons.length === 0;
    }
    return false;
  });

/**
 * "Ausencia de afirmaciones no respaldadas" (encargo, Fase 6): el texto de
 * la respuesta debe estar compuesto ÚNICAMENTE por fragmentos verbatim de
 * las fuentes citadas — nunca una frase que no exista, literalmente, en
 * `sources[].excerpt`.
 */
export const findAnswersWithUnsupportedText = (
  answers: readonly AnswerResult[],
): AnswerResult[] =>
  answers.filter((answer) => {
    if (!answer.answer) return false;
    const supportedText = answer.sources.map((source) => source.excerpt).join(' ');
    const sentences = answer.answer.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
    return sentences.some((sentence) => !supportedText.includes(sentence));
  });

/** Ninguna fuente citada puede repetirse. */
export const findAnswersWithDuplicateSources = (
  answers: readonly AnswerResult[],
): AnswerResult[] =>
  answers.filter((answer) => {
    const ids = answer.sources.map((source) => source.documentId);
    return new Set(ids).size !== ids.length;
  });

/**
 * "No mezclar parches distintos" (encargo, Fase 3): si la respuesta declara
 * un `patchId`, ninguna fuente citada puede declarar un `patchId` distinto.
 */
export const findAnswersMixingPatches = (
  answers: readonly AnswerResult[],
): AnswerResult[] =>
  answers.filter((answer) => {
    if (!answer.patchId) return false;
    return answer.sources.some((source) => source.patchId && source.patchId !== answer.patchId);
  });

/** Ningún enlace relacionado puede carecer de `href` o de `title` reales. */
export const findAnswersWithInvalidRelatedLinks = (
  answers: readonly AnswerResult[],
): AnswerResult[] =>
  answers.filter((answer) =>
    answer.relatedLinks.some((link) => link.href.trim().length === 0 || link.title.trim().length === 0),
  );

export const validateAnswers = (answers: readonly AnswerResult[]): string[] => {
  const violations: string[] = [];
  for (const answer of findAnswersWithInconsistentShape(answers)) {
    violations.push(`Forma inconsistente para el estado "${answer.status}": ${answer.query}`);
  }
  for (const answer of findAnswersWithUnsupportedText(answers)) {
    violations.push(`Texto no respaldado por las fuentes citadas: ${answer.query}`);
  }
  for (const answer of findAnswersWithDuplicateSources(answers)) {
    violations.push(`Fuentes duplicadas: ${answer.query}`);
  }
  for (const answer of findAnswersMixingPatches(answers)) {
    violations.push(`Mezcla de parches distintos: ${answer.query}`);
  }
  for (const answer of findAnswersWithInvalidRelatedLinks(answers)) {
    violations.push(`Enlace relacionado inválido: ${answer.query}`);
  }
  return violations;
};
