import type { KnownPlayerIdentity } from '../lib/riot/live-types';
import { knownPlayerIdentities } from './known-players.generated';

/**
 * Registro curado de identidades conocidas (PRO/streamer) para "Partida en
 * curso". NUNCA se identifica a alguien por parecido de nombre — cada
 * entrada exige verificación humana antes de añadirse aquí, mismo
 * principio que `config/video-content-links.ts` (`source: 'verified-manual'`)
 * y `config/match-video-links.ts` para el resto del sitio.
 *
 * Los datos en sí viven en `known-players.generated.ts` (vacío hoy a
 * propósito) y se regeneran con `scripts/identities/verify-identities.ts`
 * — ese script resuelve cada PUUID contra Riot Account-V1, nunca confía en
 * un PUUID de una fuente externa (ver `scripts/identities/README.md`).
 * Este archivo solo re-exporta los datos y da la lógica de matching.
 */
export { knownPlayerIdentities };

const normalizeRiotId = (riotId: string) => riotId.trim().toLowerCase();

/**
 * PUUID exacto primero (estable, no cambia con el nombre); Riot ID exacto
 * como fallback SOLO cuando no hay PUUID que coincida — nunca al revés, y
 * nunca por coincidencia parcial. Si dos entradas coincidieran por error
 * (dataset mal curado), el PUUID exacto gana siempre sobre cualquier
 * coincidencia por Riot ID, incluida la de otra entrada.
 */
export const findKnownPlayerIdentity = (
  puuid: string | undefined,
  riotId: string | undefined,
  registry: readonly KnownPlayerIdentity[] = knownPlayerIdentities,
): KnownPlayerIdentity | undefined => {
  if (puuid) {
    const byPuuid = registry.find((identity) => identity.puuids?.includes(puuid));
    if (byPuuid) return byPuuid;
  }
  if (riotId) {
    const normalized = normalizeRiotId(riotId);
    return registry.find((identity) =>
      identity.riotIds?.some((known) => normalizeRiotId(known) === normalized),
    );
  }
  return undefined;
};
