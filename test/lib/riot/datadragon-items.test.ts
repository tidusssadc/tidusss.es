import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getDataDragonItems } from '../../../src/lib/riot/datadragon.ts';
import { clearRiotMemoryCache } from '../../../src/lib/riot/cache.ts';

/**
 * `getDataDragonItems` — CDN estático de Data Dragon, sin clave ni rate
 * limit de Riot (mismo criterio que el resto de este módulo). Nunca
 * contra la red real: `globalThis.fetch` sustituido.
 */

const jsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

beforeEach(() => {
  clearRiotMemoryCache();
});

test('getDataDragonItems: construye un índice real con nombre, coste, into y tags', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return jsonResponse(200, {
      data: {
        '3031': { name: 'Filo Infinito', gold: { total: 3400, purchasable: true }, into: [], tags: ['Damage'] },
        '1001': { name: 'Botas', gold: { total: 300, purchasable: true }, into: ['3006'], tags: ['Boots'] },
      },
    });
  }) as unknown as typeof fetch;
  try {
    const index = await getDataDragonItems('15.14.1');
    assert.deepEqual(index['3031'], { name: 'Filo Infinito', goldTotal: 3400, purchasable: true, buildsInto: [], tags: ['Damage'] });
    assert.deepEqual(index['1001'], { name: 'Botas', goldTotal: 300, purchasable: true, buildsInto: ['3006'], tags: ['Boots'] });
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test('getDataDragonItems: una respuesta fallida del CDN produce un índice vacío, nunca lanza', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => jsonResponse(503, {})) as unknown as typeof fetch;
  try {
    const index = await getDataDragonItems('15.14.1');
    assert.deepEqual(index, {});
  } finally {
    globalThis.fetch = original;
  }
});

test('getDataDragonItems: un objeto sin nombre real se omite del índice en vez de entrar con un nombre vacío', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    jsonResponse(200, { data: { '9999': { gold: { total: 100 } } } })) as unknown as typeof fetch;
  try {
    const index = await getDataDragonItems('15.14.1');
    assert.equal(index['9999'], undefined);
  } finally {
    globalThis.fetch = original;
  }
});

test('getDataDragonItems: cachea por versión — una segunda llamada con la misma versión no vuelve a pedir la red', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return jsonResponse(200, { data: { '3031': { name: 'Filo Infinito', gold: { total: 3400, purchasable: true }, into: [], tags: [] } } });
  }) as unknown as typeof fetch;
  try {
    await getDataDragonItems('15.14.1');
    await getDataDragonItems('15.14.1');
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});
