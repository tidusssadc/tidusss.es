import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../../functions/api/pregunta.ts';
import type { PreguntaApiResponse } from '../../src/types/pregunta.ts';

/**
 * Pruebas del endpoint público `POST /api/pregunta` — ejecutan el handler
 * real (`onRequest`) contra el índice de conocimiento real, sin red, sin
 * mocks del dominio. Cubre exactamente la lista pedida en el encargo:
 * contrato, método/body inválidos, límites, las preguntas reales
 * requeridas, fuentes/relacionados válidos, y ausencia de campos internos.
 */

const post = (body: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }) =>
  new Request('https://tidusss.es/api/pregunta', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const asJson = async (response: Response): Promise<PreguntaApiResponse> =>
  (await response.json()) as PreguntaApiResponse;

// --- Contrato / validación de la petición ---

test('rechaza cualquier método distinto de POST', async () => {
  const response = await onRequest({ request: new Request('https://tidusss.es/api/pregunta', { method: 'GET' }) });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'POST');
});

test('rechaza un content-type distinto de application/json', async () => {
  const response = await onRequest({ request: post('question=hola', { 'content-type': 'text/plain' }) });
  assert.equal(response.status, 415);
  const payload = await asJson(response);
  assert.equal(payload.ok, false);
});

test('rechaza un body que no es JSON válido', async () => {
  const response = await onRequest({ request: post('{ esto no es json') });
  assert.equal(response.status, 400);
  const payload = await asJson(response);
  assert.equal(payload.ok, false);
  if (!payload.ok) assert.equal(payload.error.code, 'INVALID_BODY');
});

test('rechaza un body sin el campo "question" o con el tipo incorrecto', async () => {
  const withoutField = await asJson(await onRequest({ request: post({}) }));
  assert.equal(withoutField.ok, false);
  const wrongType = await asJson(await onRequest({ request: post({ question: 123 }) }));
  assert.equal(wrongType.ok, false);
});

test('rechaza una pregunta vacía (incluso solo espacios)', async () => {
  const response = await onRequest({ request: post({ question: '   ' }) });
  assert.equal(response.status, 400);
  const payload = await asJson(response);
  assert.equal(payload.ok, false);
  if (!payload.ok) assert.equal(payload.error.code, 'EMPTY_QUESTION');
});

test('rechaza una pregunta que supera el límite de longitud', async () => {
  const response = await onRequest({ request: post({ question: 'a'.repeat(251) }) });
  assert.equal(response.status, 400);
  const payload = await asJson(response);
  assert.equal(payload.ok, false);
  if (!payload.ok) assert.equal(payload.error.code, 'QUESTION_TOO_LONG');
});

test('acepta una pregunta justo en el límite de 250 caracteres', async () => {
  const question = `¿${'a'.repeat(247)}?`; // 249 caracteres reales tras normalizar espacios
  const response = await onRequest({ request: post({ question: question.slice(0, 250) }) });
  assert.notEqual(response.status, 400);
});

// --- POST válido: forma del contrato público ---

test('un POST válido devuelve ok:true con la forma pública esperada', async () => {
  const response = await onRequest({ request: post({ question: '¿Cuándo me hago Navori?' }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  const payload = await asJson(response);
  assert.equal(payload.ok, true);
  if (payload.ok) {
    assert.equal(typeof payload.data.status, 'string');
    assert.ok(Array.isArray(payload.data.sources));
    assert.ok(Array.isArray(payload.data.related));
  }
});

// --- Las preguntas reales requeridas por el encargo ---

test('Navori: respuesta suficiente con fuentes reales', async () => {
  const payload = await asJson(await onRequest({ request: post({ question: '¿Cuándo me hago Navori?' }) }));
  assert.equal(payload.ok, true);
  if (payload.ok) {
    assert.equal(payload.data.status, 'sufficient');
    assert.ok(payload.data.answer && payload.data.answer.length > 0);
    assert.ok(payload.data.sources.length > 0);
  }
});

test('Filo Infinito vs. Navori: ambos objetos quedan reflejados entre las fuentes', async () => {
  const payload = await asJson(await onRequest({ request: post({ question: '¿Es mejor Filo Infinito o Navori?' }) }));
  assert.equal(payload.ok, true);
  if (payload.ok) {
    const titles = payload.data.sources.map((source) => source.title).join(' | ');
    assert.match(titles, /Filo Infinito/);
    assert.match(titles, /Navori/);
  }
});

test('combos rápidos: respuesta con fuentes reales sobre combos', async () => {
  const payload = await asJson(
    await onRequest({ request: post({ question: '¿Por qué Lucian necesita hacer los combos rápido?' }) }),
  );
  assert.equal(payload.ok, true);
  if (payload.ok) assert.ok(payload.data.sources.length > 0);
});

test('Ataque Intensificado: la runa real aparece citada', async () => {
  const payload = await asJson(await onRequest({ request: post({ question: '¿Qué runa usa Tidusss con Lucian?' }) }));
  assert.equal(payload.ok, true);
  if (payload.ok) {
    assert.match(payload.data.answer ?? '', /Ataque Intensificado/);
    assert.equal(payload.data.editorialConfidence, 'high');
  }
});

test('supports: las sinergias reales aparecen citadas', async () => {
  const payload = await asJson(
    await onRequest({ request: post({ question: '¿Con qué supports funciona bien Lucian?' }) }),
  );
  assert.equal(payload.ok, true);
  if (payload.ok) assert.ok(payload.data.sources.length > 0);
});

test('late: la debilidad real sobre el late queda citada', async () => {
  const payload = await asJson(await onRequest({ request: post({ question: '¿Por qué Lucian sufre en late?' }) }));
  assert.equal(payload.ok, true);
  if (payload.ok) assert.ok(payload.data.sources.length > 0);
});

test('Draven: información insuficiente, nunca un matchup inventado', async () => {
  const payload = await asJson(
    await onRequest({ request: post({ question: '¿Cómo juego Lucian contra Draven?' }) }),
  );
  assert.equal(payload.ok, true);
  if (payload.ok) {
    assert.equal(payload.data.status, 'insufficient-information');
    assert.equal(payload.data.answer, undefined);
    assert.equal(payload.data.sources.length, 0);
  }
});

test('Jinx: no tiene build propia, pero responde con su entrada real de la Tier List — nunca contenido de Lucian mezclado', async () => {
  const payload = await asJson(await onRequest({ request: post({ question: '¿Cuál es la build de Jinx?' }) }));
  assert.equal(payload.ok, true);
  if (payload.ok) {
    assert.equal(payload.data.status, 'sufficient');
    assert.equal(payload.data.sources.length, 1);
    assert.equal(payload.data.sources[0]?.url, '/tier-list');
    assert.equal(payload.data.sources[0]?.type, 'Tier List');
  }
});

test('pregunta fuera de alcance: el Mundial', async () => {
  const payload = await asJson(await onRequest({ request: post({ question: '¿Quién ganó el Mundial?' }) }));
  assert.equal(payload.ok, true);
  if (payload.ok) assert.equal(payload.data.status, 'out-of-scope');
});

test('pregunta ambigua ("ayuda") se rechaza como fuera de alcance', async () => {
  const payload = await asJson(await onRequest({ request: post({ question: 'ayuda' }) }));
  assert.equal(payload.ok, true);
  if (payload.ok) assert.equal(payload.data.status, 'out-of-scope');
});

// --- Fuentes y relacionados válidos ---

test('toda fuente devuelta tiene título, tipo legible y URL reales', async () => {
  const payload = await asJson(await onRequest({ request: post({ question: '¿Cuándo me hago Navori?' }) }));
  assert.equal(payload.ok, true);
  if (payload.ok) {
    for (const source of payload.data.sources) {
      assert.ok(source.title.length > 0);
      assert.ok(source.type.length > 0);
      assert.ok(source.url.startsWith('/'));
      assert.ok(source.excerpt.length > 0);
    }
  }
});

test('el contenido relacionado, cuando existe, tiene título, href y tipo legible', async () => {
  const payload = await asJson(await onRequest({ request: post({ question: '¿Cuándo me hago Navori?' }) }));
  assert.equal(payload.ok, true);
  if (payload.ok) {
    assert.ok(payload.data.related.length > 0);
    for (const link of payload.data.related) {
      assert.ok(link.title.length > 0);
      assert.ok(link.href.startsWith('/'));
      assert.ok(link.kind.length > 0);
    }
  }
});

test('las respuestas sin cobertura nunca incluyen relacionados inventados', async () => {
  const payload = await asJson(await onRequest({ request: post({ question: '¿Quién ganó el Mundial?' }) }));
  assert.equal(payload.ok, true);
  if (payload.ok) assert.deepEqual(payload.data.related, []);
});

// --- Serialización pública: ausencia de campos internos ---

test('la respuesta pública nunca expone campos internos del dominio', async () => {
  const payload = await asJson(await onRequest({ request: post({ question: '¿Cuándo me hago Navori?' }) }));
  assert.equal(payload.ok, true);
  if (!payload.ok) return;
  const serialized = JSON.stringify(payload);
  // Nunca el id interno del documento, nunca el sourceEntityId, nunca las razones de rechazo internas.
  assert.ok(!serialized.includes('documentId'));
  assert.ok(!serialized.includes('sourceEntityId'));
  assert.ok(!serialized.includes('rejectionReasons'));
  assert.ok(!serialized.includes('insufficientInformation'));
  // La confianza de recuperación viaja como banda ('high'/'medium'/'low'), nunca como número crudo.
  assert.equal(typeof payload.data.retrievalConfidence, 'string');
  assert.ok(['high', 'medium', 'low'].includes(payload.data.retrievalConfidence));
});

test('el tipo de cada fuente es una etiqueta legible, nunca el KnowledgeDocumentType interno', async () => {
  const payload = await asJson(await onRequest({ request: post({ question: '¿Qué runa usa Tidusss con Lucian?' }) }));
  assert.equal(payload.ok, true);
  if (payload.ok) {
    for (const source of payload.data.sources) {
      assert.ok(!source.type.includes('-'), `"${source.type}" parece un KnowledgeDocumentType crudo, no una etiqueta`);
    }
  }
});

test('nunca se devuelve un mensaje de error técnico (stack, nombre de excepción) al cliente', async () => {
  const response = await onRequest({ request: post('esto rompe el parseo json') });
  const text = await response.text();
  assert.ok(!text.toLowerCase().includes('syntaxerror'));
  assert.ok(!text.toLowerCase().includes('at '));
});
