import type { AnswerResult } from '../knowledge-answering';
import { createLocalDeterministicGenerator } from './local-generator';
import { validateGenerationResult } from './validate';
import type { AnswerGenerator, GenerationInput, GenerationResult } from './types';

/**
 * Orquestador (Fases 3, 5 y 6 del encargo) — el único punto por el que
 * pasa cualquier intento de reformular una respuesta. Decide si tiene
 * sentido invocar a un generador, valida su salida, y garantiza que el
 * texto final mostrado nunca depende exclusivamente de un proveedor
 * externo: si algo falla, se cae al generador determinista, siempre.
 */

/**
 * Instrucciones de tono FIJAS, decididas por el sistema — nunca derivadas
 * de la pregunta del usuario ni de ningún dato externo (`docs/pregunta-a-tidusss.md`
 * §6.3: tono editorial, tercera persona, nunca conversacional-genérico).
 */
const TONE_INSTRUCTIONS =
  'Tono directo y cercano de Tidusss, en tercera persona editorial ("Tidusss recomienda..."), nunca en primera persona de asistente. Frases cortas, sin relleno conversacional tipo chatbot ("¡Claro! Aquí tienes...", "Espero que esto ayude"). Nunca pedir disculpas por no saber algo.';

const buildGenerationInput = (answer: AnswerResult): GenerationInput => ({
  query: answer.query,
  deterministicAnswer: answer.answer ?? '',
  status: answer.status,
  editorialConfidence: answer.editorialConfidence,
  retrievalConfidence: answer.retrievalConfidence,
  coverage: answer.coverage,
  allowedDocumentIds: answer.sources.map((source) => source.documentId),
  sources: answer.sources,
  patchId: answer.patchId,
  editorialDate: answer.editorialDate,
  toneInstructions: TONE_INSTRUCTIONS,
});

const NOT_APPLICABLE_RESULT: GenerationResult = {
  text: undefined,
  usedSourceIds: [],
  warnings: [],
  provider: 'none',
  status: 'not-applicable',
};

/**
 * Punto de entrada único. `generator` es el proveedor a intentar primero
 * (Claude, o el propio determinista si no se quiere intentar generación
 * real); `localGenerator` es SIEMPRE el determinista, usado como red de
 * seguridad — nunca se omite, incluso si `generator` ya es local.
 */
export const generateAnswer = async (
  answer: AnswerResult,
  generator: AnswerGenerator,
  localGenerator: AnswerGenerator = createLocalDeterministicGenerator(),
): Promise<GenerationResult> => {
  if (answer.status !== 'sufficient' && answer.status !== 'partial') {
    return NOT_APPLICABLE_RESULT;
  }

  const input = buildGenerationInput(answer);

  let candidate: GenerationResult;
  try {
    candidate = await generator.generate(input);
  } catch {
    const local = await localGenerator.generate(input);
    return {
      ...local,
      warnings: [...local.warnings, 'El proveedor de generación lanzó una excepción inesperada.'],
      status: 'fallback',
    };
  }

  if (candidate.status === 'provider-not-configured') {
    const local = await localGenerator.generate(input);
    return { ...local, warnings: [...candidate.warnings, ...local.warnings], status: 'provider-not-configured' };
  }

  if (candidate.status !== 'generated') {
    const local = await localGenerator.generate(input);
    return { ...local, warnings: [...candidate.warnings, ...local.warnings], status: 'fallback' };
  }

  const validation = validateGenerationResult(candidate, input);
  if (!validation.valid) {
    const local = await localGenerator.generate(input);
    return {
      ...local,
      warnings: [...local.warnings, ...validation.violations],
      status: 'fallback',
    };
  }

  return candidate;
};

/** El texto final a mostrar — siempre el de la generación cuando existe, nunca inventado si no. */
export const resolveDisplayText = (answer: AnswerResult, generation: GenerationResult): string | undefined =>
  generation.text ?? answer.answer;
