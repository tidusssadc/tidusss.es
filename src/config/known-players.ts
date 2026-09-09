import type { KnownPlayerIdentity } from '../lib/riot/live-types';

/**
 * Registro curado de identidades conocidas (PRO/streamer) para "Partida en
 * curso". NUNCA se identifica a alguien por parecido de nombre — cada
 * entrada exige verificación humana antes de añadirse aquí, mismo
 * principio que `config/video-content-links.ts` (`source: 'verified-manual'`)
 * y `config/match-video-links.ts` para el resto del sitio.
 *
 * Vacío hoy a propósito: no existe ninguna identidad ya verificada en el
 * proyecto que se pueda reutilizar (la única referencia externa que se
 * manejó en una fase anterior — una captura de una partida de un jugador
 * de Karmine Corp usada solo como contexto para validar una build — fue
 * explícitamente excluida de publicarse: nombres/equipos de esa fuente no
 * están confirmados por Tidusss ni pensados para mostrarse en el sitio).
 * `getPlayerFixtures`/tests demuestran el sistema con datos sintéticos.
 *
 * CÓMO AÑADIR UNA CUENTA VERIFICADA MÁS ADELANTE:
 * 1. Confirma el PUUID real de la cuenta (vía account-v1 por Riot ID, o
 *    porque la propia persona lo confirma) — el PUUID es la clave de
 *    coincidencia preferida y estable incluso si cambia de Riot ID.
 * 2. Añade una entrada aquí con `puuid` (preferido) y, si quieres, también
 *    `riotIds` como registro adicional — nunca únicamente `riotIds` si el
 *    PUUID ya se conoce, precisamente para no depender de que el nombre
 *    no cambie.
 * 3. Marca `source` con de dónde viene la verificación (p. ej. "confirmado
 *    por el propio jugador", "cuenta oficial del equipo") y `lastVerifiedAt`
 *    con la fecha ISO de esa verificación — nunca se asume vigente sin
 *    fecha.
 */
export const knownPlayerIdentities: readonly KnownPlayerIdentity[] = [];

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
    const byPuuid = registry.find((identity) => identity.puuid === puuid);
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
