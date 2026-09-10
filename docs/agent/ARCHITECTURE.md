# ARCHITECTURE — tidusss.es

Arquitectura **real, hoy**. Detalle de implementación de sistemas concretos en
`docs/PLATFORM_BIBLE.md` §3, `docs/riot-api.md`, `docs/content-graph.md`,
`docs/league-laboratory.md`, `docs/operations/rank-history.md`. Verificado 2026-09-10 (`10575c4`).

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | **Astro 7**, `output: 'static'`, **sin adaptador** |
| Estilos | **Tailwind 4** (vía `@tailwindcss/vite`) para layout/spacing en el markup + `src/styles/global.css` artesanal (~6k líneas) para la piel visual. **Un solo archivo de estilos.** |
| Lenguaje | **TypeScript** estricto (`astro/tsconfigs/strict`) |
| Lint | ESLint + `typescript-eslint` + `eslint-plugin-astro` |
| Runtime dinámico | **Cloudflare Pages Functions** — archivos sueltos en `functions/api/**`, sin adaptador Astro |
| Hosting | **Cloudflare Pages**, integración Git con `github.com/tidusssadc/tidusss.es`. Build `npm run build` → `dist/`. Proyecto: `tidusss-es`. |
| Tests | `node --test` sobre `test/**/*.test.ts` (loader TS en `scripts/testing/register-ts-loader.mjs`). Sin framework de test. |
| UI cliente | **Ningún framework** (no React/Vue/Svelte). Interactividad = `<script>` TS vanilla + APIs del navegador. |

**No hay `wrangler.toml`.** Variables, secretos y bindings se configuran en el **Dashboard de
Cloudflare Pages**. `wrangler` se usa solo puntualmente vía `npx` (no es dependencia).

---

## Fronteras (quién puede hablar con quién)

```
Navegador (.astro + <script> vanilla)
   │  fetch GET/POST a /api/*
   ▼
functions/api/**            ← ÚNICO lugar que lee context.env (secretos)
   │                          normaliza a { ok, data | error }, fija Cache-Control
   ▼
src/services/*  ·  src/lib/*      efectos controlados: fetch a APIs externas,
   │                               caché en memoria por isolate (TTL + stale + de-dupe)
   ▼
APIs externas: Riot, Data Dragon, YouTube (Data API + RSS), Twitch Helix
```

- **`src/domain/*`** — lógica pura. **No importa Astro, DOM, `fetch` ni red.** Recibe datos ya
  resueltos, devuelve decisiones. (`content-graph`, `home-state`, `league-laboratory`,
  `knowledge-*`, `goals`, `search-index`.)
- **`src/lib/*`** — lógica con efectos controlados (`riot/*`, `rank-history/*`, `activity`, `time`, `soul-engine`).
- **`src/components/*`** — presentación. Orquesta, no contiene lógica de negocio real.
- **DTO crudo de un proveedor ≠ modelo de dominio.** Nunca se pasa un `RiotMatchDto` a un componente; se normaliza primero (`src/lib/riot/normalize.ts`).
- **El PUUID / summoner ID / cabeceras crudas nunca cruzan al cliente.** El modelo público es `RiotOverview` (`src/lib/riot/types.ts`).

---

## Dominios bajo `src/`

```
components/   UI de presentación (Astro). Subcarpetas: live/ (=/competitivo), laboratory/, riot/ (⚠ huérfano), search/
config/       constantes tipadas: platforms, goals, rank-assets, riot, known-players(.generated), *-video-links
data/         contenido editorial tipado: site, content, environments, references, updates
domain/       lógica pura (ver arriba)
layouts/      BaseLayout único (SEO, meta, Environment, SoulEngine)
lib/          negocio con efectos: riot/, rank-history/, activity, time, soul-engine, *-video-links
pages/        rutas del sitio (ver CURRENT_STATE)
services/     adaptadores a APIs externas reutilizables desde Functions: youtube, youtube-stats, twitch
styles/       global.css (único)
types/        contratos HTTP públicos: content, platforms, pregunta
```

---

## Familia Riot (`src/lib/riot/`)

| Módulo | Rol |
|---|---|
| `client.ts` | fetch con timeout + 1 reintento en 5xx. Sin throttle propio. |
| `cache.ts` | `cached(key, ttl, stale, loader)` — TTL + stale-while-revalidate + de-dupe de promesas en vuelo. **Memoria por isolate. No global, no persistente.** `peekCached` = lectura sin disparar loader. |
| `normalize.ts` | DTO Riot → `RecentMatch` / `RankedSummary` / `MatchParticipant`. Aquí se resuelve `MatchParticipant.identity` (Encuentros PRO/STREAMER, resolutor inyectado). |
| `analytics.ts` / `performance.ts` | agregados (rendimiento por campeón, sesión de hoy, ventanas, patrones). Operan sobre partidas ya normalizadas — **0 llamadas Riot extra**. |
| `datadragon.ts` | versión + URLs de assets (CDN, no cuenta contra el rate limit de la API key). |
| `live*.ts` | "Partida en curso" (Spectator-V5), con el mismo Identity Registry. |
| `timeline*.ts` | Match Timeline (Match-V5 Timeline). On-demand. |
| `index.ts` | orquestadores: `getRiotOverview` (perfil completo), `getRiotRankObservation` (**ligero**: solo cuenta + rango), `getMatchTimeline`, `resolveSelfAccount(Puuid)`. |

### Coste Riot (por familia de endpoint)

| Endpoint Riot | Caché fresh / stale | Lo usa |
|---|---|---|
| **ACCOUNT-V1** `/accounts/by-riot-id/{name}/{tag}` | 24 h / 24 h | clave `riot:account:*`, compartida por **todo** `/api/riot/*` |
| **SUMMONER-V4** `/summoners/by-puuid/{puuid}` | 6 h / 12 h | `getRiotOverview`, `getRiotLiveGame` |
| **LEAGUE-V4** `/entries/by-puuid/{puuid}` | 10 min / 6 h | `getRiotOverview`, **`getRiotRankObservation`** (clave `riot:ranked:{puuid}`, compartida) |
| **MATCH-V5 ids** `/matches/by-puuid/{puuid}/ids` | 5 min / 1 h | `getRiotOverview` (`count=30`) |
| **MATCH-V5 detalle** `/matches/{matchId}` | 24 h / 7 d | `getRiotOverview` (hasta 30, en lotes de 10), **on-demand** para expandir una partida |
| **MATCH-V5 Timeline** `/matches/{matchId}/timeline` | 30 d | **solo** `GET /api/riot/matches/{id}/timeline`, on-demand, nunca en carga |
| Data Dragon (versión/assets) | 6 h | `getRiotOverview` (no cuenta contra la API key) |

Reglas de coste: `RULES.md` §RIOT. **`getRiotRankObservation` existe precisamente para que el
cron del histórico NO arrastre Match-V5** — hay tests de aislamiento que lo garantizan.

### Endpoints propios (`functions/api/`)

| Endpoint | Método | Riot que toca | Notas |
|---|---|---|---|
| `riot/overview` | GET | account+summoner+league+matches(30)+ddragon | perfil completo de /competitivo y Home. `waitUntil` → intenta un snapshot de rango si `env.DB`. |
| `riot/live` | GET | spectator + account | "Partida en curso". |
| `riot/matches/[matchId]/timeline` | GET | Match-V5 Timeline (1) | on-demand. Valida formato/scope del matchId antes de tocar Riot. |
| `riot/rank-history` | GET | account (24h) | **solo lee D1.** Degrada a `available:false` sin `DB`/PUUID/error. Nunca 500 público. |
| `riot/rank-snapshot-cron` | POST | **account + league (ligero)** | gateado por `RANK_SNAPSHOT_CRON_SECRET`. Nunca acepta PUUID/cola del body. |
| `pregunta` | POST | ninguno | motor de conocimiento determinista. |
| `twitch/status`, `youtube`, `youtube/channel-stats` | GET | Twitch Helix / YouTube | ver `docs/riot-api.md` no aplica; README para cuota YouTube. |

---

## Almacenamiento

| Qué | Estado |
|---|---|
| Caché Riot en memoria (`cache.ts`) | **en uso**. Por isolate. Migrar a KV/Cache API está anticipado en `docs/riot-api.md` pero **no** empezado ("si el tráfico lo requiere"). |
| **D1 `tidusss-competitive`** (histórico de rango) | **IMPLEMENTED IN CODE / NOT YET PROVISIONED.** `src/lib/rank-history/` + `migrations/0001_rank_snapshots.sql` listos. Sin binding `DB` → todo se degrada solo. Aprovisionamiento: `docs/operations/rank-history.md`. |
| KV / Durable Objects / Supabase | **no existen.** No asumas ninguno. |

`src/lib/rank-history/` sigue patrón dominio → repositorio → adaptador:
`types.ts` (dominio puro) → `d1-repository.ts` (**único** fichero que conoce nombres de
tabla/columnas) → endpoints HTTP (orquestación). El adaptador se valida contra un SQLite real
en test (`test/lib/rank-history/d1-repository.sqlite.test.ts`, `node:sqlite`, sin dependencia nueva).

---

## Content Graph e Identity Registry

- **Content Graph** (`src/domain/content-graph`) — grafo estático de entidades y relaciones
  **verificadas** del ecosistema (vídeo↔partida↔campeón↔objetivo…). Nunca relaciones por
  parecido de texto. Detalle: `docs/content-graph.md`.
- **Identity Registry** (`src/config/known-players.ts` + `.generated.ts`) — identidades
  PRO/STREAMER curadas a mano. `findKnownPlayerIdentity(puuid, riotId, registry)`: **PUUID
  exacto primero**, Riot ID exacto como fallback, nunca parcial. Multi-cuenta colapsa a una
  identidad. Lo reutilizan "Partida en curso" y Encuentros de Match History. El **dataset es
  cerrado** (no re-scrapear); la lógica de matching se puede extender.

---

## Convenciones que un cambio no puede romper en silencio

- Sin _path aliases_ (`@/...`) — rutas relativas.
- Sin segundo archivo de estilos.
- Sin framework de UI cliente.
- `tsconfig` estricto — no se relaja para "hacer pasar" algo.
- Mensajes de `console.*` en Functions con formato `{ scope, event/phase, ... }`, sin datos sensibles.
- Todo `fetch` en cliente con `.catch()` y ruta de UI degradada.
- Cambiar un tipo de dominio (`RiotOverview`, `ContentEntity`, …) **es** un cambio arquitectónico.

Cualquiera de estas cosas requiere una decisión explícita (ADR en `PLATFORM_BIBLE.md` §11), no
una PR silenciosa.
