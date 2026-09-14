# CURRENT_STATE — tidusss.es

> **El documento más importante para un agente.** Responde en < 2 min: qué existe, qué está
> cerrado, qué está en progreso, qué está bloqueado, cuál es el HEAD esperado, qué falta de
> infraestructura, qué NO tocar.
>
> **Last verified commit:** `ee273d2` (`design/competitive-signature`) · Preview de esa rama verificado y documentado
> **Last verified date:** 2026-09-14
> **`main`:** `99e86a2` — la Night Shift de 2026-09-09 **ya está mergeada** (merge `99e86a2`).
>
> No guardes aquí datos que cambian a diario (LP actual, última partida, nº de subs, nº exacto
> de tests). Si un número lo necesitas, verifícalo en el repo.

---

## Git / ramas

| | |
|---|---|
| `main` | `99e86a2` — merge de `night-shift/2026-09-09` (histórico de rango, Encuentros PRO/STREAMER, hardening de coste Riot, D1 + scheduler, docs/agent) sobre el Page Design Rework de /competitivo |
| `design/competitive-v3` | `734ea8f` — rediseño visual V3 de /competitivo + modo de fixture QA para el preview. **Sin merge.** |
| `design/competitive-v4-control-room` | `5e1d2d5` — V4 "SoloQ Control Room": arquitectura de producto (command bar, sesión de hoy, evolución LP, historial con filtros). **Sin merge.** |
| `design/competitive-ultimate` | `adcbeee` — Art Direction Ultimate ("Tidusss Competitive Editorial"): dirección visual reconstruida sobre la arquitectura de V4. **Sin merge.** |
| Rama de trabajo actual | `design/competitive-signature` — Signature Pass completo ("make it obscenely good") sobre Ultimate: fusión del hero en una franja continua + command bar de dos estados, "¿Voy mejor o peor?" como gráfico de pendiente TODAS→20→10→5, Match History con matchup como un clúster + LP emparejado con el resultado + insignia de vídeo editorial + tag "ÚLTIMA", Match Expanded reconstruido en torno al duelo Tidusss vs ADC rival (con "tu build" y el aviso de support aliado acompañándolo, no cajas sueltas), Timeline como "Match Flow" (marca @10, extremos con valor, hover con tooltip, momentos clave en cinta horizontal), Evolución LP con marcadores de transición/sesión, LIVE SUMMARY derivada en Partida en curso, reorden real de mobile (Historial antes que Forma/Rendimiento). Misma dirección, mismos datos — 0 llamadas Riot nuevas. **Sin merge.** |
| Preview real de `design/competitive-signature` | `https://design-competitive-signature.tidusss-es.pages.dev` (verificado con `curl` — 200 en `/`, `/competitivo/` y las tres URLs de QA; HTML estático contiene `match-row-matchup`, confirma que es el build más reciente, no uno cacheado — el gráfico de Timeline es 100% client-side bajo demanda, nunca aparece en el HTML estático, así que no es un marcador verificable por `curl`). 28 caracteres tras slugificar → justo en el límite de Cloudflare Pages y **no** se trunca. Deployment por hash de cada push: `wrangler pages deployment list --project-name tidusss-es`. |
| Preview real de `design/competitive-ultimate` | `https://design-competitive-ultimate.tidusss-es.pages.dev` (verificado con `curl` — 200, HTML idéntico al deployment por hash). 27 caracteres tras slugificar → **no** se trunca (el límite de Cloudflare Pages es 28; ver fila de abajo, `v4-control-room` sí lo sufrió). |
| Preview real de `design/competitive-v4-control-room` | `https://design-competitive-v4-contro.tidusss-es.pages.dev` — alias TRUNCADO a 28 caracteres (el slug completo, `design-competitive-v4-control-room`, son 34). Verifica siempre con `curl` antes de dar por bueno un alias de rama; no lo derives de memoria. |
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
| **/competitivo** (`src/components/live/LiveDashboard.astro`) | En `main`: 5 secciones apiladas (`01 Ahora` … `05 Historial`). En `design/competitive-signature`: command bar de dos estados (mínimo mientras el hero es visible, completo cuando sale del viewport, sin duplicar dato) + **hero panel fusionado** (franja continua crest→LP→pico/sesión→session run→cuenta, luego Sesión de hoy / Evolución LP en un body de 2 columnas) + grid asimétrico (forma por campeón / rendimiento) + historial. Fetch propio por bloque a `/api/riot/overview`, sin llamadas Riot nuevas. |
| **Match History** (`src/components/live/matches/`) | Fila densa + detalle expandible (patrón `<template>` + `render.ts`, cero hidratación). 3 niveles: fila / expandido / timeline. En `main` 10 partidas fijas; en `design/competitive-signature`, 10 iniciales + "cargar anteriores" hasta 20 (todas ya en el payload, +0 llamadas Riot) + filtros client-side (resultado / campeón). Fila: matchup (mi portrait + VS + rival) como un solo clúster al inicio — visible también en mobile, ya no se oculta —, LP emparejado con el resultado ("VICTORIA +18 LP"), insignia de vídeo editorial (píldora, no un punto diminuto), tag "ÚLTIMA" permanente en la primera fila (solo bajo filtros por defecto). Match Expanded: el centro es el duelo Tidusss vs ADC rival (KDA/CS/oro/daño/objetos, barras espejadas, solo magnitud — nunca "ganó línea"), acompañado de "tu build" (runas/hechizos/participación/visión, ya no duplica CS/daño/oro) y el aviso del support aliado; el resto de los 10 jugadores pasa a un bloque compacto y secundario debajo. |
| **"¿Voy mejor o peor?"** (`PerformanceProfile.astro`) | Gráfico de pendiente por métrica (WR/KDA/CSM/DPM): TODAS→20→10→5, valor real en cada punto, delta vs. la base. Reemplaza los 4 sparklines casi paralelos de Ultimate. |
| **Rank History (histórico de rango)** (`src/lib/rank-history/`, `functions/api/riot/rank-history.ts` + `rank-snapshot-cron.ts`, `RankEvolution.astro`, `migrations/0001_rank_snapshots.sql`) | **D1 `tidusss-competitive` aprovisionada en Production**, binding `DB` configurado. Primer snapshot real observado: `MASTER 554 LP`, 2026-09-10. El histórico **empieza ahí** — nada anterior se reconstruye. `rank-history` sirve `available:true` con los snapshots reales; sin `DB` (p. ej. preview) sigue degradando a `available:false`. Evolución con marcador de transición de tier, punto actual destacado y delta día a día en el tooltip. |
| **Match Timeline / "Match Flow"** (`functions/api/riot/matches/[matchId]/timeline.ts`, `MatchTimelinePanel.astro`, `timeline-render.ts`) | **on-demand** — 0 llamadas en la carga normal. 30 días de caché. Sin agregación. Gráfico Oro/CS con marca @10, extremos de línea con valor rotulado, hover con crosshair + tooltip; "momentos clave" como cinta horizontal compacta (antes lista vertical de hasta 15rem), paleta migrada a los tokens victoria/derrota/azul/oro ya establecidos en el resto de la página. |
| **PRO/STREAMER Encounters** (`src/lib/riot/normalize.ts` → `MatchParticipant.identity`, badge en `MatchExpanded`) | V1. Matching por PUUID exacto contra el Identity Registry existente, colapsando multi-cuenta. +0 llamadas Riot (usa el PUUID que Riot ya trae en cada partida). Sin narrativa inventada. |
| **Riot integration** (`src/lib/riot/*`, `functions/api/riot/{overview,live}.ts`) | Account-V1 (24h) + Summoner-V4 (6h) + League-V4 (10min) + Match-V5 ids (5min) + Match-V5 detalle (24h/7d) + Data Dragon. Caché en memoria por isolate. |
| **Home**: `CompetitiveCredential`, `LiveTeaser`, `HomeTodayModule`, `ActivityCenterCta` | widgets que consumen `/api/riot/overview`. |

### IN PROGRESS / BLOCKED

| Cosa | Estado | Bloqueo |
|---|---|---|
| **Snapshot scheduler** | `.github/workflows/rank-snapshot.yml` en `main`. | Operativo en cuanto `RANK_SNAPSHOT_CRON_SECRET` esté en Cloudflare + GitHub. Hasta entonces `POST /api/riot/rank-snapshot-cron` sigue protegido y el histórico solo crece con las visitas reales a `/api/riot/overview` (`waitUntil` → snapshot si hay `DB`). |

### DORMANT — código/tipos preparados, sin consumidor real

- `src/components/riot/*` (5 archivos: `CompetitiveStatus`, `RankedSummary`, `MatchRow`, `RiotSkeleton`, `RiotUnavailable`) — **huérfanos** (primera generación del dashboard competitivo, nunca eliminados; sin importadores). No construir sobre ellos; candidatos a borrado en una tarea de limpieza dedicada.
- `src/domain/league-laboratory` — dominio completo; solo Tier List y `/campeones` tienen UI real. `Build`/`RunePage`/`Matchup`/`Synergy`/`MetaState` con datos solo para Lucian.
- `src/domain/knowledge-{index,retrieval,answering,generation}` — construidos y testeados; el único consumidor público es `/pregunta` (motor determinista). Sin embeddings/Vectorize/Claude en producción.
- Environment Engine: ambientes `match`, `about`, `youtube`, `twitch` definidos sin ruta que los consuma.
- Home State Engine: estados `new-patch`, `new-record`, `goal-achieved`, `milestone` preparados, sin fuente de datos real.

### PLANNED — roadmap, NO es funcionalidad actual

`/roadmap` (página pública) y `docs/PLATFORM_BIBLE.md` §6 describen capítulos futuros (Knowledge Graph, Library, más herramientas del Laboratorio, Career, Creator Platform). Nada de eso está construido. No lo presentes como existente. No lo empieces sin una tarea explícita.

---

## Infraestructura

| Pieza | Estado | Para qué |
|---|---|---|
| **D1 `tidusss-competitive`** + binding `DB` (Cloudflare Pages, Production) | **aprovisionada.** Primer snapshot real: `MASTER 554 LP`, 2026-09-10. | histórico de rango |
| `RANK_SNAPSHOT_CRON_SECRET` (Cloudflare + GitHub Secret) | **pendiente** | proteger `POST /api/riot/rank-snapshot-cron` y activar el cron de observación sin visitas |

Con `DB` ya configurada, `/api/riot/overview` (`waitUntil`) escribe un snapshot cuando cambia el rango
o pasa la ventana de heartbeat, así que el histórico ya crece con el tráfico real aunque el cron aún
no esté activo. **El histórico empieza en el primer snapshot real (2026-09-10) — nunca se reconstruye
hacia atrás.** Runbook: **`docs/operations/rank-history.md`**.
Persistencia de propósito general (KV/Cache API para `src/lib/riot/cache.ts`): anticipada en `docs/riot-api.md`, **no** empezada, "si el tráfico lo requiere".

---

## Deploy (real, hoy)

Cloudflare Pages con integración Git a `github.com/tidusssadc/tidusss.es`. Build `npm run build` → `dist/`. `functions/` = Pages Functions (auto-detectadas). **Sin `wrangler.toml`.** Variables/secretos/bindings se configuran en el **Dashboard de Cloudflare** (proyecto `tidusss-es`). `wrangler` solo puntual vía `npx`, no es dependencia.

---

## Commits recientes relevantes

| Commit | Qué |
|---|---|
| `ee273d2` | `design/competitive-signature` — Match History/Match Expanded 2ª pasada/Match Flow Timeline/mobile |
| `design/competitive-signature` | Signature Pass de /competitivo (rama, sin merge) — pulido sobre la dirección ya validada de Ultimate, misma arquitectura y mismos datos |
| `design/competitive-ultimate` | Art Direction Ultimate de /competitivo (rama, sin merge) — dirección visual sobre la arquitectura de V4, sin datos ni endpoints Riot nuevos |
| `5e1d2d5` | `design/competitive-v4-control-room` — V4 "SoloQ Control Room", arquitectura de producto |
| `734ea8f` | `design/competitive-v3` — modo de fixture QA para el preview de Cloudflare |
| `5982202` | `design/competitive-v3` — rediseño visual V3 de /competitivo |
| `99e86a2` | **(= `main`)** merge de `night-shift/2026-09-09` |
| `06987c0` | sistema de docs para agentes (`CLAUDE.md`, `docs/agent/`, `tasks/`, plantillas PR/issue) — sin cambio de producto |
| `10575c4` | setup D1 producción + scheduler (docs + workflow, inertes) |
| `3fcd626` | hardening: camino ligero Riot para el cron (§18 — antes arrastraba `getRiotOverview` entero) + idempotencia (`UNIQUE` + `INSERT OR IGNORE`) |
| `e6a25e7` | fix overflow de grid en Match History; skip resolver PUUID sin D1 |
| `b086ca3` | Encuentros PRO/STREAMER V1 |
| `f5181b9` | UI de evolución de rango (`RankEvolution`) |
| `032f17e` | arquitectura + V1 de persistencia de rango |
| `c6c29d9` | **(= `main`)** Page Design Rework de /competitivo |

Journal detallado de la Night Shift: `docs/night-shift/2026-09-09.md`.
