import type { GenerationResult, GenerationStatus } from './types';

/**
 * Observabilidad segura (Fase 8 del encargo) — un `GenerationLogEntry` es
 * TODO lo que se registra sobre un intento de generación. Nunca contiene
 * claves, el prompt completo, el contenido íntegro de las fuentes, ni la
 * respuesta completa del proveedor — solo metadatos agregados, seguros de
 * escribir en cualquier log.
 */

const ERROR_CODE_PATTERNS: ReadonlyArray<{ readonly pattern: RegExp; readonly code: string }> = [
  { pattern: /fuera de la lista permitida/i, code: 'UNKNOWN_SOURCE_ID' },
  { pattern: /descarta todas las fuentes/i, code: 'ALL_SOURCES_DISCARDED' },
  { pattern: /texto vac[ií]o/i, code: 'EMPTY_TEXT' },
  { pattern: /excesivamente largo/i, code: 'TEXT_TOO_LONG' },
  { pattern: /enlace o ruta/i, code: 'INVENTED_URL' },
  { pattern: /filtraci[oó]n de instrucciones/i, code: 'PROMPT_LEAK' },
  { pattern: /infla la confianza/i, code: 'CONFIDENCE_INFLATION' },
  { pattern: /lanz[oó] una excepci[oó]n/i, code: 'PROVIDER_EXCEPTION' },
  { pattern: /no est[aá] configurado/i, code: 'PROVIDER_NOT_CONFIGURED' },
];

/** Convierte las advertencias reales (que pueden contener fragmentos de texto) en un código corto y seguro de registrar. */
const classifyErrorCode = (warnings: readonly string[]): string | undefined => {
  for (const warning of warnings) {
    const match = ERROR_CODE_PATTERNS.find(({ pattern }) => pattern.test(warning));
    if (match) return match.code;
  }
  return warnings.length > 0 ? 'GENERATION_FALLBACK' : undefined;
};

const OUTCOME_BY_STATUS: Record<GenerationStatus, GenerationLogEntry['outcome']> = {
  generated: 'success',
  'not-applicable': 'not-applicable',
  fallback: 'fallback',
  'provider-not-configured': 'provider-not-configured',
};

export interface GenerationLogEntry {
  readonly provider: string;
  readonly durationMs: number;
  readonly outcome: 'success' | 'fallback' | 'not-applicable' | 'provider-not-configured';
  readonly errorCode?: string;
  readonly documentCount: number;
  readonly status: GenerationStatus;
}

export const buildGenerationLogEntry = (
  generation: GenerationResult,
  documentCount: number,
  durationMs: number,
): GenerationLogEntry => ({
  provider: generation.provider,
  durationMs,
  outcome: OUTCOME_BY_STATUS[generation.status],
  errorCode: generation.status === 'fallback' || generation.status === 'provider-not-configured'
    ? classifyErrorCode(generation.warnings)
    : undefined,
  documentCount,
  status: generation.status,
});
