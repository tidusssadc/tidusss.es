import { RiotApiError } from './errors';

interface RiotClientOptions {
  apiKey: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

const errorFromStatus = (status: number, retryAfter?: string | null) => {
  if (status === 401 || status === 403)
    return new RiotApiError('RIOT_API_KEY_REJECTED', status);
  if (status === 404) return new RiotApiError('RIOT_ACCOUNT_NOT_FOUND', status);
  if (status === 429)
    return new RiotApiError(
      'RIOT_RATE_LIMITED',
      status,
      Number(retryAfter || 0) || undefined,
    );
  if (status >= 500)
    return new RiotApiError('RIOT_TEMPORARILY_UNAVAILABLE', status);
  return new RiotApiError('RIOT_INVALID_RESPONSE', status);
};

export const createRiotClient = ({
  apiKey,
  timeoutMs = 6000,
  fetcher = fetch,
}: RiotClientOptions) => ({
  async get<T>(url: string, retry = true): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(url, {
        headers: { 'X-Riot-Token': apiKey, Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        if (retry && response.status >= 500) return this.get<T>(url, false);
        throw errorFromStatus(
          response.status,
          response.headers.get('Retry-After'),
        );
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof RiotApiError) throw error;
      throw new RiotApiError('RIOT_TEMPORARILY_UNAVAILABLE', 503);
    } finally {
      clearTimeout(timer);
    }
  },
});
