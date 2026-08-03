import type { RetrievalProvider } from '../../knowledge-retrieval';
import { assembleAnswer } from '../assemble';
import { findAnswersMixingPatches, findAnswersWithUnsupportedText } from '../invariants';
import type { AnswerResult } from '../types';
import type { AnswerCaseEvaluation, AnswerEvaluationCase, AnswerEvaluationSummary } from './types';

/**
 * Runner de evaluación de RESPUESTAS (Fase 7 del encargo) — puro y
 * determinista: recibe un `RetrievalProvider` y un conjunto de casos,
 * ensambla la respuesta real con `assembleAnswer` y mide contra la
 * expectativa. No genera ninguna respuesta nueva — solo mide la que el
 * motor ya produjo.
 */

const REJECTION_STATUSES = new Set([
  'insufficient-information',
  'out-of-scope',
  'empty-question',
  'internal-error',
]);

const evaluateCase = (
  provider: RetrievalProvider,
  evaluationCase: AnswerEvaluationCase,
): { evaluation: AnswerCaseEvaluation; answer: AnswerResult } => {
  const retrievalResult = provider.retrieve({ text: evaluationCase.question, limit: 10 });
  const answer = assembleAnswer(retrievalResult);
  const sourceIds = new Set(answer.sources.map((source) => source.documentId));

  const missingRequiredSources = evaluationCase.minimumSourceIds.filter((id) => !sourceIds.has(id));
  const forbiddenSourceHits = evaluationCase.forbiddenSourceIds.filter((id) => sourceIds.has(id));
  const hasUnsupportedText = findAnswersWithUnsupportedText([answer]).length > 0;

  return {
    evaluation: {
      caseId: evaluationCase.id,
      question: evaluationCase.question,
      statusMatch: answer.status === evaluationCase.expectedStatus,
      coverageMatch: answer.coverage === evaluationCase.expectedCoverage,
      editorialConfidenceMatch:
        evaluationCase.expectedEditorialConfidence === undefined ||
        answer.editorialConfidence === evaluationCase.expectedEditorialConfidence,
      missingRequiredSources,
      forbiddenSourceHits,
      hasUnsupportedText,
      actualStatus: answer.status,
    },
    answer,
  };
};

export const runAnswerEvaluation = (
  provider: RetrievalProvider,
  cases: readonly AnswerEvaluationCase[],
): AnswerEvaluationSummary => {
  const results = cases.map((evaluationCase) => evaluateCase(provider, evaluationCase));
  const evaluations = results.map((result) => result.evaluation);
  const answers = results.map((result) => result.answer);

  const sufficientCases = cases.filter((c) => c.expectedStatus === 'sufficient');
  const partialCases = cases.filter((c) => c.expectedStatus === 'partial');
  const rejectionCases = cases.filter((c) => REJECTION_STATUSES.has(c.expectedStatus));

  const correctFor = (subset: readonly AnswerEvaluationCase[]): number =>
    subset.filter((c) => {
      const evaluation = evaluations.find((e) => e.caseId === c.id);
      return evaluation?.statusMatch === true;
    }).length;

  const validCitationChecks = evaluations.filter(
    (evaluation) => evaluation.missingRequiredSources.length === 0 && evaluation.forbiddenSourceHits.length === 0,
  ).length;

  return {
    providerName: provider.name,
    caseCount: cases.length,
    correctStatusCount: evaluations.filter((e) => e.statusMatch).length,
    correctSufficientCount: correctFor(sufficientCases),
    sufficientCaseCount: sufficientCases.length,
    correctPartialCount: correctFor(partialCases),
    partialCaseCount: partialCases.length,
    correctRejectionCount: correctFor(rejectionCases),
    rejectionCaseCount: rejectionCases.length,
    validCitationCount: validCitationChecks,
    totalCitationChecks: cases.length,
    forbiddenSourceHitCount: evaluations.reduce((sum, e) => sum + e.forbiddenSourceHits.length, 0),
    patchMixingViolationCount: findAnswersMixingPatches(answers).length,
    unsupportedTextCount: findAnswersWithUnsupportedText(answers).length,
    cases: evaluations,
  };
};
