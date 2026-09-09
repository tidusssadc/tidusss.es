# Importador de identidades conocidas (PRO / STREAMER)

Herramienta OFFLINE, de ejecución manual, para poblar
`src/config/known-players.generated.ts` (el registro que usa "Partida en
curso" para mostrar los badges PRO/STREAMER). Nunca se ejecuta en
producción ni en build — el runtime del sitio sigue siendo: `PUUID de
LiveGame → lookup local en el registro → badge`, sin ninguna llamada
externa nueva.

Ningún PUUID se acepta nunca de una fuente externa (LoLPros, DeepLoL o
cualquier otra) sin revalidarlo: este script siempre lo resuelve de nuevo
contra **Riot Account-V1**, en este mismo proceso.

## Formato del fichero de candidatos

Un array JSON. Cada fila es **una cuenta**, no necesariamente una persona
— varias filas con el mismo `displayName` (insensible a mayúsculas) se
tratan como la misma persona con varias cuentas.

```json
[
  {
    "displayName": "Player",
    "riotId": "GameName#TAG",
    "region": "EUW",
    "isPro": true,
    "isStreamer": false,
    "team": "XXX",
    "role": "ADC",
    "streamUrl": null,
    "source": "manual-public-verification"
  }
]
```

- `displayName` y `riotId` son obligatorios.
- Al menos uno de `isPro`/`isStreamer` debe ser `true`.
- `streamUrl`, si se da, debe ser `https://` y de un dominio permitido
  (Twitch, YouTube o Kick) — nunca se genera una URL a partir del nombre.
- `region` es solo informativa (el proyecto ya está fijado a una única
  región vía `.env`).

## Cómo añadir un batch

1. Prepara el fichero de candidatos (JSON, formato de arriba).
2. Ejecuta en modo dry-run:
   ```bash
   npm run identities:verify -- --input=ruta/candidatos.json --dry-run
   ```
3. Revisa el resumen — sobre todo **Errores** y **Conflictos**. Un
   conflicto nunca se resuelve solo: corrige el fichero de candidatos y
   repite el paso 2 hasta que salga limpio (o decide conscientemente que
   ese candidato se queda fuera).
4. Ejecuta sin `--dry-run` para escribir de verdad
   `src/config/known-players.generated.ts`:
   ```bash
   npm run identities:verify -- --input=ruta/candidatos.json
   ```
5. `npm test` (los tests de `known-players.ts`/LiveGame siguen validando
   el registro resultante).
6. Commit del `.ts` regenerado, como cualquier otro cambio de datos.

## Qué hace el script

1. Lee y valida la estructura de los candidatos (nunca red en este paso).
2. Resuelve cada `riotId` contra Riot Account-V1 → PUUID real.
3. Agrupa por `displayName` → una identidad por persona, con todos sus
   PUUIDs/Riot IDs.
4. Detecta y reporta (sin resolver solo) conflictos: datos inconsistentes
   dentro del mismo grupo, o un PUUID que aparece bajo dos personas
   distintas.
5. Fusiona con el registro ya existente — solo por PUUID o Riot ID
   coincidente, nunca por el nombre a secas; nunca degrada `isPro`/
   `isStreamer` de `true` a `false`; un `team`/`role`/`streamUrl`/`source`
   existente que difiera del nuevo se reporta como conflicto y se conserva
   el existente.
6. Con `--dry-run`, se queda ahí — no escribe nada. Sin `--dry-run`,
   regenera `known-players.generated.ts`.

Un error de Riot en un candidato (cuenta no encontrada, rate limit, etc.)
nunca detiene el resto del lote — se reporta y se sigue con los demás.
