import {
  RiotApiError,
  type RiotErrorCode,
  type RiotRequestPhase,
} from './errors';

export interface RiotDiagnosticEvent {
  event: 'request' | 'response' | 'failure';
  phase: RiotRequestPhase;
  endpoint: string;
  attempt: number;
  status?: number;
  code?: RiotErrorCode;
  failureType?: 'timeout' | 'network-or-runtime';
}

export type RiotDiagnosticLogger = (event: RiotDiagnosticEvent) => void;

interface RiotRequestMetadata {
  phase: Exclude<RiotRequestPhase, 'configuration'>;
  endpoint: string;
}

interface RiotClientOptions {
  apiKey: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
  diagnostics?: RiotDiagnosticLogger;
}

const errorFromStatus = (
  status: number,
  phase: RiotRequestPhase,
  retryAfter?: string | null,
) => {
  if (status === 401 || status === 403)
    return new RiotApiError('RIOT_API_KEY_REJECTED', status, undefined, phase);
  if (status === 404)
    return new RiotApiError('RIOT_ACCOUNT_NOT_FOUND', status, undefined, phase);
  if (status === 429)
    return new RiotApiError(
      'RIOT_RATE_LIMITED',
      status,
      Number(retryAfter || 0) || undefined,
      phase,
    );
  if (status >= 500)
    return new RiotApiError(
      'RIOT_TEMPORARILY_UNAVAILABLE',
      status,
      undefined,
      phase,
    );
  return new RiotApiError('RIOT_INVALID_RESPONSE', status, undefined, phase);
};

export const createRiotClient = ({
  apiKey,
  timeoutMs = 6000,
  fetcher = fetch,
  diagnostics,
}: RiotClientOptions) => ({
  async get<T>(
    url: string,
    metadata: RiotRequestMetadata,
    retry = true,
  ): Promise<T> {
    const attempt = retry ? 1 : 2;
    diagnostics?.({ event: 'request', ...metadata, attempt });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(url, {
        headers: { 'X-Riot-Token': apiKey, Accept: 'application/json' },
        signal: controller.signal,
      });
      diagnostics?.({
        event: 'response',
        ...metadata,
        attempt,
        status: response.status,
      });
      if (!response.ok) {
        if (retry && response.status >= 500)
          return this.get<T>(url, metadata, false);
        throw errorFromStatus(
          response.status,
          metadata.phase,
          response.headers.get('Retry-After'),
        );
      }
      return (await response.json()) as T;
    } catch (error) {
      const normalized =
        error instanceof RiotApiError
          ? error
          : new RiotApiError(
              'RIOT_TEMPORARILY_UNAVAILABLE',
              503,
              undefined,
              metadata.phase,
            );
      diagnostics?.({
        event: 'failure',
        ...metadata,
        attempt,
        status: normalized.status,
        code: normalized.code,
        ...(error instanceof RiotApiError
          ? {}
          : {
              failureType:
                error instanceof DOMException && error.name === 'AbortError'
                  ? ('timeout' as const)
                  : ('network-or-runtime' as const),
            }),
      });
      throw normalized;
    } finally {
      clearTimeout(timer);
    }
  },
});
