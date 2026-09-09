import type { CandidateIssue, IdentityCandidate } from './types.ts';

/**
 * Dominios permitidos para `streamUrl` — mismo criterio que ya usan las
 * redes reales del sitio (`src/config/platforms.ts`: YouTube, Twitch),
 * más Kick por ser la otra plataforma de streaming que de verdad se ve en
 * la práctica. Nunca se genera una URL por nickname (§7) — esto solo
 * valida una URL que el candidato YA trae.
 */
const ALLOWED_STREAM_HOSTS = new Set([
  'twitch.tv',
  'www.twitch.tv',
  'youtube.com',
  'www.youtube.com',
  'kick.com',
  'www.kick.com',
]);

export const isValidStreamUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ALLOWED_STREAM_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
};

/** "GameName#TAG" → partes, o `undefined` si no tiene la forma mínima válida. Nunca acepta un nombre o un tag vacíos. */
export const splitRiotId = (
  riotId: string,
): { gameName: string; tagLine: string } | undefined => {
  const hashIndex = riotId.indexOf('#');
  if (hashIndex <= 0 || hashIndex === riotId.length - 1) return undefined;
  const gameName = riotId.slice(0, hashIndex).trim();
  const tagLine = riotId.slice(hashIndex + 1).trim();
  if (!gameName || !tagLine) return undefined;
  return { gameName, tagLine };
};

export interface ParsedCandidates {
  candidates: IdentityCandidate[];
  errors: CandidateIssue[];
}

const asOptionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

/**
 * Valida SOLO estructura — nunca red, nunca Riot. Un candidato inválido se
 * reporta y se descarta; nunca detiene la validación del resto del lote
 * (mismo principio de "el fallo de uno no bloquea a los demás" que rige
 * todo el proyecto Riot).
 */
export const parseCandidates = (raw: unknown): ParsedCandidates => {
  if (!Array.isArray(raw)) {
    throw new Error('El fichero de candidatos debe ser un array JSON.');
  }
  const errors: CandidateIssue[] = [];
  const candidates: IdentityCandidate[] = [];

  raw.forEach((entry, index) => {
    const label = `candidato #${index + 1}`;
    if (!entry || typeof entry !== 'object') {
      errors.push({
        candidate: { displayName: '', riotId: '' },
        reason: `${label}: no es un objeto`,
      });
      return;
    }
    const value = entry as Record<string, unknown>;
    const displayName = asOptionalString(value.displayName) ?? '';
    const riotId = asOptionalString(value.riotId) ?? '';
    const isProRaw = value.isPro;
    const isStreamerRaw = value.isStreamer;
    if (isProRaw !== undefined && typeof isProRaw !== 'boolean') {
      errors.push({
        candidate: { displayName, riotId },
        reason: `${label} (${displayName || 'sin nombre'}): isPro debe ser booleano`,
      });
      return;
    }
    if (isStreamerRaw !== undefined && typeof isStreamerRaw !== 'boolean') {
      errors.push({
        candidate: { displayName, riotId },
        reason: `${label} (${displayName || 'sin nombre'}): isStreamer debe ser booleano`,
      });
      return;
    }
    const candidate: IdentityCandidate = {
      displayName,
      riotId,
      region: asOptionalString(value.region),
      isPro: isProRaw === true,
      isStreamer: isStreamerRaw === true,
      team: asOptionalString(value.team),
      role: asOptionalString(value.role),
      streamUrl: asOptionalString(value.streamUrl),
      source: asOptionalString(value.source),
    };
    if (!displayName) {
      errors.push({ candidate, reason: `${label}: displayName vacío o ausente` });
      return;
    }
    if (!splitRiotId(riotId)) {
      errors.push({
        candidate,
        reason: `${label} (${displayName}): riotId inválido "${riotId}" — se espera "GameName#TAG"`,
      });
      return;
    }
    if (!candidate.isPro && !candidate.isStreamer) {
      errors.push({
        candidate,
        reason: `${label} (${displayName}): no marca isPro ni isStreamer — no identifica nada, se descarta`,
      });
      return;
    }
    if (candidate.streamUrl && !isValidStreamUrl(candidate.streamUrl)) {
      errors.push({
        candidate,
        reason: `${label} (${displayName}): streamUrl inválida o de un dominio no permitido: "${candidate.streamUrl}"`,
      });
      return;
    }
    candidates.push(candidate);
  });

  return { candidates, errors };
};
