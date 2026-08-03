import type { AnswerGenerator, GenerationInput, GenerationResult } from '../types';

/**
 * Generadores simulados ("dobles de prueba") para la evaluación y los
 * tests del motor de generación — nunca se llama a una API externa real
 * dentro de la suite normal (encargo, Fase 7). Cada uno modela un intento
 * de violar una regla concreta, para comprobar que el orquestador
 * (`orchestrate.ts`) siempre lo detecta y cae al determinista.
 */

const asGenerated = (overrides: Partial<GenerationResult> = {}): GenerationResult => ({
  text: 'Texto simulado.',
  usedSourceIds: [],
  warnings: [],
  provider: 'fake',
  status: 'generated',
  ...overrides,
});

/** Se comporta exactamente como se espera de un buen redactor: reformula, cita solo fuentes permitidas. */
export const createWellBehavedFakeGenerator = (text: string): AnswerGenerator => ({
  name: 'fake-well-behaved',
  generate: (input: GenerationInput) =>
    Promise.resolve(asGenerated({ text, usedSourceIds: [...input.allowedDocumentIds] })),
});

/** Intenta citar un documento que nunca se le entregó. */
export const createUnknownSourceFakeGenerator = (): AnswerGenerator => ({
  name: 'fake-unknown-source',
  generate: () =>
    Promise.resolve(
      asGenerated({
        text: 'Respuesta con una fuente inventada.',
        usedSourceIds: ['knowledge:documento-jamas-entregado'],
      }),
    ),
});

/** "Quita las fuentes": declara éxito pero no cita ninguna fuente permitida. */
export const createDropsAllSourcesFakeGenerator = (): AnswerGenerator => ({
  name: 'fake-drops-sources',
  generate: () => Promise.resolve(asGenerated({ text: 'Respuesta sin ninguna fuente.', usedSourceIds: [] })),
});

/** "Di que la confianza es muy alta": intenta inflar la confianza en el propio texto. */
export const createConfidenceInflationFakeGenerator = (): AnswerGenerator => ({
  name: 'fake-confidence-inflation',
  generate: (input: GenerationInput) =>
    Promise.resolve(
      asGenerated({
        text: 'Puedes confiar al 100%: esto tiene confianza muy alta, totalmente seguro.',
        usedSourceIds: [...input.allowedDocumentIds],
      }),
    ),
});

/** Intenta inventar un enlace/URL dentro del texto libre. */
export const createInventedUrlFakeGenerator = (): AnswerGenerator => ({
  name: 'fake-invented-url',
  generate: (input: GenerationInput) =>
    Promise.resolve(
      asGenerated({
        text: 'Consulta más detalles en https://no-es-un-dominio-real.example/guia-secreta.',
        usedSourceIds: [...input.allowedDocumentIds],
      }),
    ),
});

/** Intenta filtrar instrucciones internas del sistema. */
export const createPromptLeakFakeGenerator = (): AnswerGenerator => ({
  name: 'fake-prompt-leak',
  generate: (input: GenerationInput) =>
    Promise.resolve(
      asGenerated({
        text: 'Como modelo de lenguaje, mis instrucciones son citar solo estas fuentes.',
        usedSourceIds: [...input.allowedDocumentIds],
      }),
    ),
});

/** Devuelve un texto vacío mientras declara éxito. */
export const createEmptyTextFakeGenerator = (): AnswerGenerator => ({
  name: 'fake-empty-text',
  generate: (input: GenerationInput) =>
    Promise.resolve(asGenerated({ text: '   ', usedSourceIds: [...input.allowedDocumentIds] })),
});

/** Devuelve un texto absurdamente largo. */
export const createTooLongTextFakeGenerator = (): AnswerGenerator => ({
  name: 'fake-too-long',
  generate: (input: GenerationInput) =>
    Promise.resolve(
      asGenerated({ text: 'Relleno. '.repeat(300), usedSourceIds: [...input.allowedDocumentIds] }),
    ),
});

/** Lanza una excepción, como fallaría una llamada de red real caída. */
export const createThrowingFakeGenerator = (): AnswerGenerator => ({
  name: 'fake-throwing',
  generate: (): Promise<GenerationResult> => {
    throw new Error('Fallo de red simulado.');
  },
});
