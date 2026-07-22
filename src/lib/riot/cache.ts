interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  staleUntil: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

export interface CacheResult<T> {
  value: T;
  stale: boolean;
}

export const cached = async <T>(
  key: string,
  ttlMs: number,
  staleMs: number,
  loader: () => Promise<T>,
): Promise<CacheResult<T>> => {
  const now = Date.now();
  const existing = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > now)
    return { value: existing.value, stale: false };

  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) return { value: await pending, stale: false };

  const promise = loader();
  inFlight.set(key, promise);
  try {
    const value = await promise;
    memoryCache.set(key, {
      value,
      expiresAt: now + ttlMs,
      staleUntil: now + ttlMs + staleMs,
    });
    return { value, stale: false };
  } catch (error) {
    if (existing && existing.staleUntil > now)
      return { value: existing.value, stale: true };
    throw error;
  } finally {
    inFlight.delete(key);
  }
};

export const clearRiotMemoryCache = () => {
  memoryCache.clear();
  inFlight.clear();
};
