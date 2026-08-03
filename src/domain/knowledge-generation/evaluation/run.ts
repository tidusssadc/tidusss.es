import { assembleAnswer } from '../../knowledge-answering';
import type { RetrievalProvider } from '../../knowledge-retrieval';
import { generateAnswer, resolveDisplayText } from '../orchestrate';
import type { GenerationCaseEvaluation, GenerationEvaluationCase, GenerationEvaluationSummary } from './types';

/**
 * Runner de evaluación del motor de generación (Fase 7) — puro salvo por
 * la llamada, siempre simulada, al generador de cada caso. Nunca llama a
 * una API externa real.
 */

const evaluateCase = (
  provider: RetrievalProvider,
  evaluationCase: GenerationEvaluationCase,
): Promise<GenerationCaseEvaluation> =>
  (async () => {
    const retrievalResult = provider.retrieve({ text: evaluationCase.question, limit: 10 });
    const answer = assembleAnswer(retrievalResult);
    const generator = evaluationCase.buildGenerator({
      allowedDocumentIds: answer.sources.map((source) => source.documentId),
    });
    const generation = await generateAnswer(answer, generator);
    const displayText = resolveDisplayText(answer, generation);

    return {
      caseId: evaluationCase.id,
      question: evaluationCase.question,
      statusMatch: generation.status === evaluationCase.expectedGenerationStatus,
      displayTextMatch: evaluationCase.expectDisplayTextIsDeterministic
        ? displayText === answer.answer
        : true,
      actualGenerationStatus: generation.status,
    };
  })();

export const runGenerationEvaluation = async (
  provider: RetrievalProvider,
  cases: readonly GenerationEvaluationCase[],
): Promise<GenerationEvaluationSummary> => {
  const evaluations = await Promise.all(cases.map((evaluationCase) => evaluateCase(provider, evaluationCase)));

  return {
    caseCount: cases.length,
    correctStatusCount: evaluations.filter((evaluation) => evaluation.statusMatch).length,
    correctDisplayTextCount: evaluations.filter((evaluation) => evaluation.displayTextMatch).length,
    cases: evaluations,
  };
};
