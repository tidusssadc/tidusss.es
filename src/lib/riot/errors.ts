export type RiotErrorCode =
  | 'RIOT_API_KEY_MISSING'
  | 'RIOT_API_KEY_REJECTED'
  | 'RIOT_ACCOUNT_NOT_FOUND'
  | 'RIOT_RATE_LIMITED'
  | 'RIOT_TEMPORARILY_UNAVAILABLE'
  | 'RIOT_INVALID_RESPONSE';

export type RiotRequestPhase =
  'configuration' | 'account' | 'summoner' | 'league' | 'matches';

/**
 * Sin "parameter properties" en el constructor a propósito (mismo
 * comportamiento, escrito de forma explícita): el modo strip-only del
 * test runner de Node no soporta esa sintaxis de TypeScript, y esta clase
 * es justo la que impedía probar sin red cualquier código que solo
 * necesitara `instanceof RiotApiError`/sus campos (p. ej. la
 * normalización de "Partida en curso" en `live.ts`).
 */
export class RiotApiError extends Error {
  readonly code: RiotErrorCode;
  readonly status: number;
  readonly retryAfterSeconds?: number;
  readonly phase?: RiotRequestPhase;

  constructor(
    code: RiotErrorCode,
    status: number,
    retryAfterSeconds?: number,
    phase?: RiotRequestPhase,
  ) {
    super(code);
    this.name = 'RiotApiError';
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
    this.phase = phase;
  }
}

export const publicRiotError = (error: unknown) => {
  const code =
    error instanceof RiotApiError ? error.code : 'RIOT_TEMPORARILY_UNAVAILABLE';
  const messages: Record<RiotErrorCode, string> = {
    RIOT_API_KEY_MISSING:
      'Los datos competitivos no están disponibles en este momento.',
    RIOT_API_KEY_REJECTED:
      'Los datos competitivos no están disponibles en este momento.',
    RIOT_ACCOUNT_NOT_FOUND: 'No se ha podido encontrar el perfil competitivo.',
    RIOT_RATE_LIMITED:
      'Los datos se están actualizando. Vuelve a intentarlo en unos minutos.',
    RIOT_TEMPORARILY_UNAVAILABLE:
      'Los datos competitivos no están disponibles en este momento.',
    RIOT_INVALID_RESPONSE:
      'Los datos competitivos no están disponibles en este momento.',
  };
  return { code, message: messages[code] };
};
