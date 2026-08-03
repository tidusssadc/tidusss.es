import type { AnswerGenerator, GenerationInput, GenerationResult } from './types';

/**
 * Generador determinista local — implementación OFICIAL y fallback (Fase
 * 3 del encargo). Conserva la respuesta ya ensamblada tal cual, sin
 * tocarla: no reformula nada, porque no lo necesita para cumplir su
 * función — la web nunca depende exclusivamente de un proveedor externo.
 *
 * Sin red, sin secretos, 100% síncrono por dentro (envuelto en una
 * `Promise` solo para cumplir la misma interfaz que un proveedor real).
 * Su salida siempre pasa la validación de Fase 5 por construcción: nunca
 * inventa un id de fuente, nunca cambia el texto, nunca excede ningún
 * límite.
 */
export const createLocalDeterministicGenerator = (): AnswerGenerator => ({
  name: 'local-deterministic',
  generate(input: GenerationInput): Promise<GenerationResult> {
    return Promise.resolve({
      text: input.deterministicAnswer,
      usedSourceIds: [...input.allowedDocumentIds],
      warnings: [],
      provider: 'local-deterministic',
      modelVersion: 'v1',
      status: 'generated',
    });
  },
});
