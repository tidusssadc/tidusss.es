import { knowledgeDocuments } from '../../src/domain/knowledge-index';
import { assembleAnswer } from '../../src/domain/knowledge-answering';
import { toPublicAnswer } from '../../src/domain/knowledge-answering/public';
import { createLocalProvider } from '../../src/domain/knowledge-retrieval';
import type { PreguntaApiResponse } from '../../src/types/pregunta';

/**
 * `POST /api/pregunta` — el único endpoint de "Pregunta a Tidusss" v1.
 * Ejecuta EXACTAMENTE: normalización → recuperación local → ensamblaje
 * determinista → validación de forma → serialización pública. Nunca
 * ejecuta conocimiento en el navegador, nunca envía el Índice de
 * Conocimiento completo, nunca usa Claude/OpenAI/Vectorize/D1 — el motor
 * oficial de esta v1 es 100% determinista (`docs/knowledge-answering.md`).
 */

interface PagesContext {
  request: Request;
}

const MAX_QUESTION_LENGTH = 250;
const MAX_BODY_BYTES = 4096; // una pregunta real nunca se acerca a este tamaño; solo protege contra payloads absurdos.
const apiHeaders = {
  'X-Robots-Tag': 'noindex, nofollow',
  'Cache-Control': 'private, no-store',
} as const;

/** Construido una sola vez por isolate — el índice y el proveedor son puros y no cambian entre peticiones. */
const localProvider = createLocalProvider(knowledgeDocuments);

const errorResponse = (
  status: number,
  code: string,
  message: string,
): Response =>
  Response.json(
    { ok: false, error: { code, message } } satisfies PreguntaApiResponse,
    { status, headers: apiHeaders },
  );

const logSafe = (event: string, fields: Record<string, unknown>): void => {
  // Nunca se registra la pregunta completa ni el texto de la respuesta — solo
  // metadatos agregados (encargo, "no registrar preguntas completas").
  console.info({ scope: 'pregunta-endpoint', event, ...fields });
};

export const onRequest = async ({ request }: PagesContext): Promise<Response> => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { ...apiHeaders, Allow: 'POST' },
    });
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return errorResponse(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'La petición debe enviarse como application/json.',
    );
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > MAX_BODY_BYTES) {
    return errorResponse(413, 'PAYLOAD_TOO_LARGE', 'La petición es demasiado grande.');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, 'INVALID_BODY', 'El cuerpo de la petición no es JSON válido.');
  }

  const question =
    body && typeof body === 'object' && 'question' in body
      ? (body as { question: unknown }).question
      : undefined;

  if (typeof question !== 'string') {
    return errorResponse(
      400,
      'INVALID_BODY',
      'Falta el campo "question" (debe ser una cadena de texto).',
    );
  }

  // Normalización: solo se recorta espacio en los extremos aquí — la
  // normalización léxica real (sinónimos, minúsculas, tokenización) vive en
  // el dominio de Recuperación, que ya es la única fuente de verdad para eso.
  const normalizedQuestion = question.trim();

  if (normalizedQuestion.length === 0) {
    return errorResponse(400, 'EMPTY_QUESTION', 'La pregunta está vacía.');
  }

  if (normalizedQuestion.length > MAX_QUESTION_LENGTH) {
    return errorResponse(
      400,
      'QUESTION_TOO_LONG',
      `La pregunta supera el límite de ${MAX_QUESTION_LENGTH} caracteres.`,
    );
  }

  try {
    const retrievalResult = localProvider.retrieve({ text: normalizedQuestion, limit: 10 });
    const answer = assembleAnswer(retrievalResult);
    const publicAnswer = toPublicAnswer(answer);

    logSafe('answered', {
      status: publicAnswer.status,
      questionLength: normalizedQuestion.length,
      sourceCount: publicAnswer.sources.length,
    });

    return Response.json(
      { ok: true, data: publicAnswer } satisfies PreguntaApiResponse,
      { headers: apiHeaders },
    );
  } catch (error) {
    // Nunca se devuelve el mensaje/stack real al cliente — solo un código
    // normalizado. El motor es puro y determinista, así que esto no debería
    // ocurrir nunca en la práctica; existe como red de seguridad defensiva.
    logSafe('internal-error', {
      questionLength: normalizedQuestion.length,
      errorName: error instanceof Error ? error.name : 'unknown',
    });
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      'No he podido consultar el conocimiento publicado en este momento. Inténtalo de nuevo en unos segundos.',
    );
  }
};
