export type RiotErrorCode =
  | 'RIOT_API_KEY_MISSING'
  | 'RIOT_API_KEY_REJECTED'
  | 'RIOT_ACCOUNT_NOT_FOUND'
  | 'RIOT_RATE_LIMITED'
  | 'RIOT_TEMPORARILY_UNAVAILABLE'
  | 'RIOT_INVALID_RESPONSE';

export class RiotApiError extends Error {
  constructor(
    public readonly code: RiotErrorCode,
    public readonly status: number,
    public readonly retryAfterSeconds?: number,
  ) {
    super(code);
    this.name = 'RiotApiError';
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
