# Integración con Riot Games API

## Arquitectura

La portada sigue siendo estática. Los datos dinámicos se obtienen mediante la
Cloudflare Pages Function `/api/riot/overview`, limitada internamente a
`Tidusss#FFX`. El navegador nunca llama directamente a Riot y el endpoint no
acepta parámetros de cuenta.

`src/lib/riot` contiene el cliente, caché, errores, normalización, Data Dragon y
analítica. La interfaz solo recibe el modelo público `RiotOverview`; PUUID,
summoner ID, cabeceras y respuestas crudas no salen del servidor.

## Endpoints y rutas

- `europe`: `ACCOUNT-V1 /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}`.
- `euw1`: `SUMMONER-V4 /lol/summoner/v4/summoners/by-puuid/{puuid}`.
- `euw1`: `LEAGUE-V4 /lol/league/v4/entries/by-puuid/{puuid}`.
- `europe`: `MATCH-V5 /lol/match/v5/matches/by-puuid/{puuid}/ids`.
- `europe`: `MATCH-V5 /lol/match/v5/matches/{matchId}`.
- Data Dragon: versión, icono de perfil, campeones y objetos.

La resolución parte siempre del Riot ID y utiliza PUUID donde existe un endpoint
vigente. No se utiliza el endpoint obsoleto basado en `summonerName`.

## Variables de entorno

```dotenv
RIOT_API_KEY=
RIOT_GAME_NAME=Tidusss
RIOT_TAG_LINE=FFX
RIOT_PLATFORM_ROUTE=euw1
RIOT_REGIONAL_ROUTE=europe
```

`RIOT_API_KEY` no tiene valor por defecto y nunca debe llevar los prefijos
`PUBLIC_` o `VITE_`.

## Obtener y utilizar una clave

La clave se obtiene iniciando sesión en el
[Riot Developer Portal](https://developer.riotgames.com/). Las claves de
desarrollo caducan cada 24 horas y solo sirven para desarrollo y prototipos. Una
clave personal es para uso privado o de alcance reducido. Riot prohíbe mantener
un producto público con una clave personal o de desarrollo; para publicar la
web debe registrarse el producto y obtener una clave de producción aprobada.

Consulta antes de publicar:

- [Documentación del portal](https://developer.riotgames.com/docs/portal)
- [Política de League of Legends](https://developer.riotgames.com/docs/lol)
- [Políticas generales](https://developer.riotgames.com/policies/general)
- [Términos de la API](https://developer.riotgames.com/terms)

## Prueba local

1. Copia `.env.example` a `.env`.
2. Añade una clave de desarrollo vigente a `RIOT_API_KEY`.
3. Ejecuta `npm run dev`.
4. La página estática puede generar datos iniciales durante el build. La Pages
   Function se prueba localmente con Wrangler/Pages, ya que `astro dev` no
   ejecuta el directorio `functions/`.
5. Consulta `GET /api/riot/overview`. No se aceptan query params.

Respuesta correcta:

```json
{ "ok": true, "data": { "source": "Riot Games API" } }
```

Los errores utilizan `{ "ok": false, "error": { "code", "message" } }` y no
incluyen detalles internos.

## Caché

- Cuenta y PUUID: 24 horas.
- Perfil: 6 horas.
- Rango y LP: 10 minutos.
- IDs recientes: 5 minutos.
- Partida terminada: 24 horas, reutilizable hasta 7 días como stale.
- Versión de Data Dragon: 6 horas.
- Resumen HTTP de Cloudflare: 5 minutos; revalidación 1 hora; stale 24 horas.
- 404: 15 minutos en el borde.
- Errores temporales y 429: 60 segundos en el borde.

La caché en memoria evita solicitudes duplicadas dentro de una misma instancia
y comparte promesas en curso. En serverless no es persistente ni global. Para
producción con tráfico debe migrarse la interfaz de `cache.ts` a Cloudflare KV o
Cache API, conservando las mismas claves y TTL.

## Coste aproximado por actualización fría

Una actualización solicita:

- 1 cuenta.
- 1 perfil.
- 1 clasificación.
- 1 lista de IDs.
- Hasta 15 detalles de partida.
- 1 versión de Data Dragon cuando su caché vence.

Total máximo inicial: 19 solicitudes a Riot y 1 a Data Dragon. Las siguientes
actualizaciones suelen requerir solo rango e IDs; los detalles de partidas ya
terminadas se reutilizan.

## Cálculos y colas

El resumen reciente usa como máximo 10 partidas con `queueId=420` encontradas
entre los 15 IDs más recientes. No mezcla Flex, Normal, ARAM ni otros modos.

- Winrate de temporada: `wins / (wins + losses)` de `LEAGUE-V4`.
- Winrate reciente: victorias dentro de la muestra visible de Solo Queue.
- KDA: `(kills + assists) / max(1, deaths)`.
- CS: `totalMinionsKilled + neutralMinionsKilled`.
- CS/min: CS dividido por la duración real en minutos.
- Lucian reciente: solo partidas de Lucian dentro de esa misma muestra.
- Campeón más jugado: mayor número de apariciones en la muestra.

Si no hay partidas, clasificación o Lucian reciente, el modelo deja el dato
ausente y la interfaz muestra un estado explícito; nunca sustituye datos
desconocidos por cero.

## Errores

El cliente contempla 400, 401, 403, 404, 429, 5xx, timeout y JSON inválido. Solo
realiza un reintento para 5xx. En 429 conserva `Retry-After` para la respuesta
interna y no inicia bucles. Si existe una entrada stale válida, se devuelve con
`stale: true` y su fecha real.

## Cloudflare Pages

Configura `RIOT_API_KEY` como secreto privado del proyecto y el resto como
variables normales. No añadas la clave al repositorio, a `.dev.vars` versionado
ni a variables públicas. El proyecto debe publicarse por HTTPS.

Antes de producción quedan pendientes:

1. Registrar el producto en Riot Developer Portal.
2. Obtener la clave apropiada para consumo público.
3. Revisar de nuevo políticas, términos y boilerplate legal vigente.
4. Añadir las páginas públicas de privacidad y términos que Riot solicite.
5. Migrar la caché en memoria a KV o Cache API si el tráfico lo requiere.
6. Validar la cuenta real y los límites con la clave aprobada.
