import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { cached, clearRiotMemoryCache, peekCached } from '../../../src/lib/riot/cache.ts';

beforeEach(() => {
  clearRiotMemoryCache();
});

// --- peekCached: lectura pura, nunca dispara red ---

test('peekCached devuelve undefined cuando la clave nunca se ha cacheado — sin llamar a ningún loader', () => {
  assert.equal(peekCached('clave-que-no-existe'), undefined);
});

test('peekCached devuelve el valor ya cacheado por cached(), sin volver a ejecutar el loader', async () => {
  let loaderCalls = 0;
  await cached('clave-real', 60_000, 60_000, async () => {
    loaderCalls += 1;
    return { valor: 42 };
  });
  assert.equal(loaderCalls, 1);
  const peeked = peekCached<{ valor: number }>('clave-real');
  assert.deepEqual(peeked, { valor: 42 });
  assert.equal(loaderCalls, 1, 'peekCached nunca debe disparar el loader');
});

test('peekCached sigue devolviendo el valor incluso pasado el TTL (staleUntil) — un dato ya cacheado sigue siendo real', async () => {
  const now = Date.now();
  await cached('clave-vieja', -1, -1, async () => 'valor-viejo');
  // ttl/stale negativos: la entrada queda inmediatamente "caducada" para
  // cached() (que sí distingue frescura), pero peekCached no mira eso.
  assert.ok(Date.now() >= now);
  assert.equal(peekCached<string>('clave-vieja'), 'valor-viejo');
});

test('clearRiotMemoryCache borra también lo que peekCached podía leer', async () => {
  await cached('clave-a-borrar', 60_000, 60_000, async () => 'valor');
  assert.equal(peekCached('clave-a-borrar'), 'valor');
  clearRiotMemoryCache();
  assert.equal(peekCached('clave-a-borrar'), undefined);
});
