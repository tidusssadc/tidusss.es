# CURRENT_STATE — tidusss.es

> **El documento más importante para un agente.** Responde en < 2 min: qué existe, qué está
> cerrado, qué está en progreso, qué está bloqueado, cuál es el HEAD esperado, qué falta de
> infraestructura, qué NO tocar.
>
> **Last verified commit:** `10575c4` (rama `night-shift/2026-09-09`)
> **Last verified date:** 2026-09-10
> **`main`:** `c6c29d9` — la Night Shift de 2026-09-09 **no está mergeada**.
>
> No guardes aquí datos que cambian a diario (LP actual, última partida, nº de subs, nº exacto
> de tests). Si un número lo necesitas, verifícalo en el repo.

---

## Git / ramas

| | |
|---|---|
| Rama de trabajo actual | `night-shift/2026-09-09` @ `10575c4` (pusheada a `origin`, **sin merge**) |
| `main` | `c6c29d9` — "Page Design Rework" de /competitivo |
| Contenido de la rama vs `main` | histórico de rango (código), Encuentros PRO/STREAMER, hardening de coste Riot, setup de D1 + scheduler (inertes), y este sistema de docs/agent |
| Regla | nunca mergear ni `push --force` sin instrucción explícita del product owner |

---

## Rutas públicas (CURRENT)

Navbar (2 áreas, definido en `src/data/site.ts`):
- **ADCs** ▾ → `/campeones` · `/tier-list` · `/academia` · `/pregunta`
- **Competitivo** → `/competitivo`

Otras rutas reales, enlazadas desde Home/contenido pero **no** en el navbar primario:
`/` · `/buscar` · `/actividad` · `/actualizaciones` · `/comunidad` · `/explorar` · `/herramientas` · `/roadmap` · `/404` · `/campeones/[slug]` (~170, `noindex` salvo Lucian).

Endpoints (`functions/api/`): `riot/overview` · `riot/live` · `riot/matches/[matchId]/timeline` · `riot/rank-history` · `riot/rank-snapshot-cron` · `pregunta` · `twitch/status` · `youtube` · `youtube/channel-stats`.

---

## Estado por área

### CLOSED — no tocar salvo bug crítico de build/runtime

| Área | Nota |
|---|---|
| **Home** (`/`, `src/pages/index.astro` + `src/components/*`) | portada editorial reactiva. Cerrada. |
| **Navbar global** (`src/components/Navbar.astro`, `src/data/site.ts#navigation`) | 2 áreas, decidido a conciencia. Test guardián: `test/site-navigation.test.ts`. |
| **Tier List** (`/tier-list`) | The Official Tidusss ADC Tier List, 25 ADC. |
| **`/campeones`** + `/campeones/[slug]` | Explorador de Campeones. Catálogo generado desde Data Dragon (`scripts/sync-champion-catalog.mjs`), separado de la curación editorial. |
| **Contenido editorial de Lucian** | guía completa (parche real). La más profunda del sitio. |
| **Jhin / Jinx** | contenido draft / reference. No ampliar sin tarea explícita. |
| **Academia** (`/academia`, "Aprende ADC") | activa. |
| **Pregunta** (`/pregunta`, `POST /api/pregunta`) | sistema de conocimiento **determinista** (Índice → Recuperación → Motor de Respuesta). Sin LLM en producción. |
| **Search** (`/buscar`, `src/domain/search-index`) | índice de búsqueda del sitio. |
| **Content Graph de YouTube** (`src/domain/content-graph`, `src/config/*-video-links.ts`) | relaciones vídeo↔partida/campeón, todas verificadas a mano. El dataset no se re-scrapea. |
| **Identity Registry — dataset** (`src/config/known-players.generated.ts`) | 168 identidades PRO/STREAMER EUW verificadas a mano (varias con multi-cuenta). **Cerrado**: no re-scrapear, no perseguir 100% de cobertura. La *lógica* de matching (`findKnownPlayerIdentity`, `src/config/known-players.ts`) sí se puede extender. |
| **Sitemap** | generado. |

### ACTIVE / IN PRODUCTION

| Área | Estado |
|---|---|
| **/competitivo** (`src/components/live/LiveDashboard.astro`) | 5 secciones: `01 Ahora` · `02 Rendimiento` · `03 Campeones` · `04 Patrones` · `05 Historial`. Fetch propio por bloque a `/api/riot/overview`. |
| **Match History** (`05 Historial`, `src/components/live/matches/`) | 10 partidas iniciales. Fila densa + detalle expandible (patrón `<template>` + `render.ts`, cero hidratación). 3 niveles de profundidad: fila / expandido / timeline. |
| **Match Timeline** (`functions/api/riot/matches/[matchId]/timeline.ts`, `MatchTimelinePanel.astro`) | **on-demand** — 0 llamadas en la carga normal. 30 días de caché. Sin agregación. |
| **PRO/STREAMER Encounters** (`src/lib/riot/normalize.ts` → `MatchParticipant.identity`, badge en `MatchExpanded`) | V1. Matching por PUUID exacto contra el Identity Registry existente, colapsando multi-cuenta. +0 llamadas Riot (usa el PUUID que Riot ya trae en cada partida). Sin narrativa inventada. |
| **Riot integration** (`src/lib/riot/*`, `functions/api/riot/{overview,live}.ts`) | Account-V1 (24h) + Summoner-V4 (6h) + League-V4 (10min) + Match-V5 ids (5min) + Match-V5 detalle (24h/7d) + Data Dragon. Caché en memoria por isolate. |
| **Home**: `CompetitiveCredential`, `LiveTeaser`, `HomeTodayModule`, `ActivityCenterCta` | widgets que consumen `/api/riot/overview`. |

### IN PROGRESS / BLOCKED

| Cosa | Estado | Bloqueo |
|---|---|---|
| **Rank History (histórico de rango)** | Código **completo** (`src/lib/rank-history/`, `functions/api/riot/rank-history.ts` + `rank-snapshot-cron.ts`, `src/components/live/RankEvolution.astro`, `migrations/0001_rank_snapshots.sql`). Tests verdes. | **D1 no aprovisionado.** Sin binding `DB` → `rank-history` responde `available:false` y `RankEvolution` no se renderiza. Nada roto, nada inventado. |
| **Snapshot scheduler** | `.github/workflows/rank-snapshot.yml` en la rama. | **Inerte**: los workflows `schedule` solo corren desde `main`. Se activa al mergear + configurar `RANK_SNAPSHOT_CRON_SECRET` (Cloudflare + GitHub) + primer snapshot manual. |
| **Merge de `night-shift/2026-09-09` a `main`** | pendiente de revisión del product owner | decisión humana |

### DORMANT — código/tipos preparados, sin consumidor real

- `src/components/riot/*` (5 archivos: `CompetitiveStatus`, `RankedSummary`, `MatchRow`, `RiotSkeleton`, `RiotUnavailable`) — **huérfanos** (primera generación del dashboard competitivo, nunca eliminados; sin importadores). No construir sobre ellos; candidatos a borrado en una tarea de limpieza dedicada.
- `src/domain/league-laboratory` — dominio completo; solo Tier List y `/campeones` tienen UI real. `Build`/`RunePage`/`Matchup`/`Synergy`/`MetaState` con datos solo para Lucian.
- `src/domain/knowledge-{index,retrieval,answering,generation}` — construidos y testeados; el único consumidor público es `/pregunta` (motor determinista). Sin embeddings/Vectorize/Claude en producción.
- Environment Engine: ambientes `match`, `about`, `youtube`, `twitch` definidos sin ruta que los consuma.
- Home State Engine: estados `new-patch`, `new-record`, `goal-achieved`, `milestone` preparados, sin fuente de datos real.

### PLANNED — roadmap, NO es funcionalidad actual

`/roadmap` (página pública) y `docs/PLATFORM_BIBLE.md` §6 describen capítulos futuros (Knowledge Graph, Library, más herramientas del Laboratorio, Career, Creator Platform). Nada de eso está construido. No lo presentes como existente. No lo empieces sin una tarea explícita.

---

## Infraestructura que falta

| Pieza | Estado | Para qué |
|---|---|---|
| **D1 `tidusss-competitive`** | no creada | histórico de rango |
| Binding `DB` en Cloudflare Pages | no configurado | idem |
| `RANK_SNAPSHOT_CRON_SECRET` (Cloudflare + GitHub Secret) | no configurado | proteger `POST /api/riot/rank-snapshot-cron` |
| Scheduler activo | inerte hasta merge a `main` | observación sin visitas |

Runbook con pasos exactos: **`docs/operations/rank-history.md`**.
Persistencia de propósito general (KV/Cache API para `src/lib/riot/cache.ts`): anticipada en `docs/riot-api.md`, **no** empezada, "si el tráfico lo requiere".

---

## Deploy (real, hoy)

Cloudflare Pages con integración Git a `github.com/tidusssadc/tidusss.es`. Build `npm run build` → `dist/`. `functions/` = Pages Functions (auto-detectadas). **Sin `wrangler.toml`.** Variables/secretos/bindings se configuran en el **Dashboard de Cloudflare** (proyecto `tidusss-es`). `wrangler` solo puntual vía `npx`, no es dependencia.

---

## Commits recientes relevantes (rama night-shift)

| Commit | Qué |
|---|---|
| `10575c4` | setup D1 producción + scheduler (docs + workflow, inertes) |
| `3fcd626` | hardening: camino ligero Riot para el cron (§18 — antes arrastraba `getRiotOverview` entero) + idempotencia (`UNIQUE` + `INSERT OR IGNORE`) |
| `e6a25e7` | fix overflow de grid en Match History; skip resolver PUUID sin D1 |
| `b086ca3` | Encuentros PRO/STREAMER V1 |
| `f5181b9` | UI de evolución de rango (`RankEvolution`) |
| `032f17e` | arquitectura + V1 de persistencia de rango |
| `c6c29d9` | **(= `main`)** Page Design Rework de /competitivo |

Journal detallado de la Night Shift: `docs/night-shift/2026-09-09.md`.
