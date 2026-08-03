import type { PublicAnswer } from '../domain/knowledge-answering';

/** Contrato público de `POST /api/pregunta` — mismo patrón que `RiotPublicResponse`/`TwitchStatusResponse`. */
export type PreguntaApiResponse =
  | { ok: true; data: PublicAnswer }
  | { ok: false; error: { code: string; message: string } };
