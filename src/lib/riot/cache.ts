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

/**
 * Lee la caché de memoria SIN disparar el `loader` en un miss — a
 * diferencia de `cached()`, nunca hace una llamada de red nueva. Pensada
 * para enriquecimiento "si ya está caliente, genial; si no, se omite" en
 * una ruta que no puede permitirse esperar una descarga completa (p. ej.
 * la forma reciente de Tidusss dentro de "Partida en curso" — ver
 * `live.ts`, `resolveSelfRecentFormFromCache`). Deliberadamente ignora
 * `staleUntil`: un partido ya jugado no cambia con el tiempo, así que un
 * valor "caducado" aquí sigue siendo un dato real y útil, nunca inventado
 * — solo `cached()` necesita esa distinción para decidir si refrescar.
 */
export const peekCached = <T>(key: string): T | undefined =>
  (memoryCache.get(key) as CacheEntry<T> | undefined)?.value;

export const clearRiotMemoryCache = () => {
  memoryCache.clear();
  inFlight.clear();
};
