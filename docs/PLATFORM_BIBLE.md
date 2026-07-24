# PLATFORM BIBLE — tidusss.es

> **Estado:** v1.5 · Auditoría completa del código en la rama `main`, commit `4bcbee7` (24 jul. 2026), con cambios de trabajo posteriores sin commitear documentados aquí. Historial: diseño de dominio de **The League Laboratory** (§5.13, §6 Capítulo III, ADR-004) → **The Official Tidusss ADC Tier List** en `/tier-list` (ADR-005) → refactor del registro a fábrica pura (ADR-006) → **Explorador de Campeones** con 4 campeones curados (ADR-007) → separación Catálogo/Editorial y escalado real a **173 campeones** generados desde Data Dragon (ADR-008, ADR-009) → blindaje del catálogo con pruebas automatizadas nativas (ADR-010) → **Centro de Campeones** en `/campeones` (ADR-011). Ver [`docs/league-laboratory.md`](league-laboratory.md) §12-§15 para el detalle completo.
> **Naturaleza de este documento:** es la fuente de verdad del producto. No es un README ni una guía de instalación — eso sigue viviendo en [`README.md`](../README.md). Este documento describe **qué es** tidusss.es, **por qué** está construido como está, y **qué reglas** debe respetar cualquier trabajo futuro.
> **Vive y muta.** Cada decisión arquitectónica relevante, cada capítulo de roadmap que se cierre, cada convención nueva, se añade aquí. No se reescribe la historia: se amplía. La sección 11 (Decisiones arquitectónicas) es un log append-only.
> **Relación con la documentación existente:** `docs/content-graph.md`, `docs/environment-engine.md`, `docs/home-state-engine.md` y `docs/riot-api.md` **no se duplican aquí**. Este documento los referencia, los sitúa dentro del panorama completo y añade el contexto de producto que a ellos no les corresponde. Cuando haya conflicto, esos documentos técnicos ganan en detalle de implementación; este documento gana en intención y prioridad.
> **Metodología de esta auditoría:** todo lo descrito aquí proviene de leer el código fuente completo (`src/`, `functions/`, `docs/`, configuración de build) el 24 de julio de 2026. Donde una afirmación no puede sostenerse en código leído, se marca explícitamente como **[No verificable en código / decisión de producto pendiente]**. No se ha inventado ninguna funcionalidad, métrica de negocio o intención no documentada.

---

## Índice

1. [Visión del producto](#1-visión-del-producto)
2. [Filosofía](#2-filosofía)
3. [Arquitectura](#3-arquitectura)
4. [Design System](#4-design-system)
5. [Sistemas existentes](#5-sistemas-existentes)
6. [Roadmap](#6-roadmap)
7. [Convenciones](#7-convenciones)
8. [Principios de rendimiento](#8-principios-de-rendimiento)
9. [SEO](#9-seo)
10. [Accesibilidad](#10-accesibilidad)
11. [Decisiones arquitectónicas (ADR log)](#11-decisiones-arquitectónicas-adr-log)

---

## 1. Visión del producto

### Qué es tidusss.es

Es la plataforma personal de **Tidusss** (Jesús), creador de contenido español de League of Legends, jugador **Master ADC** en EUW especializado en **Lucian**. No es un portfolio estático: es un **ecosistema conectado** entre tres superficies —la web propia, YouTube y Twitch— más una capa de datos competitivos en tiempo real extraída directamente de la Riot Games API.

El producto tiene dos superficies hoy:

- **`/` (Home):** portada editorial. Presenta la marca, la credencial competitiva, las plataformas (Twitch/YouTube) y la trayectoria. Es principalmente estática, pero **reacciona** a señales reales (directo activo, vídeo nuevo, objetivo cercano) sin dejar de ser una portada "de marca".
- **`/live` (Live):** centro de control. Todo lo que en Home se insinúa, aquí se despliega: rango, LP, partidas recientes con detalle completo, objetivos con progreso, actividad reciente unificada, estado de Twitch, estadísticas de YouTube.

El hilo conductor editorial, literal en el código (`src/components/BrandManifesto.astro`):

> _"Juego para competir. Reviso para entender. Publico para compartirlo."_

### Qué pretende ser

- Un lugar donde el **rango y las partidas no son una vitrina de vanidad**, sino la materia prima del contenido: cada partida es algo que se revisa, se explica y se convierte en vídeo.
- Un ecosistema donde **web, YouTube, Twitch y Riot dejan de ser silos** y empiezan a conectarse mediante relaciones explícitas y verificadas (ver §5.1 Content Graph).
- Una marca con **personalidad propia**, no una plantilla de creador de contenido genérica: el Soul Engine (§5.9) y las referencias a Final Fantasy X (el propio alias "Tidusss" lo evoca) son parte deliberada de la identidad, no decoración accidental.
- Una base técnica que **crece por capítulos** (ver §6) sin que cada capítulo nuevo obligue a reescribir el anterior — el Content Graph y el Home State Engine existen precisamente para que así sea.

### Qué nunca debe ser

- **Un CMS.** El Content Graph registra entidades y relaciones _reales y verificadas_; nunca debe convertirse en una capa de contenido editable dinámicamente que sustituya la naturaleza estática del sitio. Esto está escrito explícitamente como riesgo a evitar en `docs/content-graph.md`.
- **Una fuente de datos inventados.** Ningún sistema debe rellenar huecos de datos con ceros, estimaciones o relaciones inferidas por coincidencia de texto. Cuando un dato no existe (LP delta, Lucian reciente, relación vídeo↔partida), la interfaz debe decirlo explícitamente. Esto es un principio verificado repetidamente en el código (`lpDeltaEstimated: true` como _type_, no como valor calculado; `matchVideoLinks` vacío por defecto; `RiotOverview.state` incluye `'no-recent-matches'` en vez de forzar un `0%`).
- **Una SPA con framework de UI.** No hay React, Vue, Svelte ni señales de que deba haberlas. La interactividad vive en Astro + TypeScript vanilla sobre APIs del navegador. Introducir un framework de componentes reactivo sería un cambio de arquitectura, no una funcionalidad — debe pasar por una ADR (§11), no por una PR silenciosa.
- **Una plataforma que exponga datos de cuenta de terceros.** El endpoint Riot está deliberadamente cerrado a `Tidusss#FFX`; no acepta parámetros de cuenta y nunca debe aceptarlos sin una decisión de producto explícita (implicaría exponer un buscador público de invocadores, algo completamente fuera del alcance actual).
- **Un sitio con estética "gaming" genérica.** El Environment Engine documenta explícitamente que Twitch e YouTube tienen ambientes propios que evitan depender del rojo/púrpura de marca de esas plataformas. La identidad visual es editorial y oscura, no neón.

---

## 2. Filosofía

### 2.1 Principios de diseño

- **Editorial, no "dashboard de esports".** Tipografía Inter, negro-azulado profundo (`#060913`), acentos dorado (`#d6b56b`) y azul (`#278cff`) — nunca la paleta genérica de gaming (verde neón, púrpura Twitch como color dominante). El púrpura de Twitch (`#9146ff`) aparece **solo** en contexto de Twitch, nunca como acento general.
- **Geometría afilada, no burbujas.** Radios de borde de 2px en botones y paneles; círculos solo para avatares/indicadores puntuales; nada de `border-radius` grande tipo "card de app móvil". Es una decisión estética consistente en las ~750 reglas de `global.css`.
- **El fondo nunca compite con el contenido.** El Environment Engine (§5.2) es explícitamente decorativo: nunca comunica información y siempre se renderiza detrás del contenido (`z-index: 0`, `pointer-events: none`, `aria-hidden="true"`).
- **La marca tiene textura, no solo un logotipo.** El Soul Engine (§5.9), los easter eggs (Konami, "tidus" tecleado) y las referencias a Final Fantasy X son parte del principio de diseño: una marca de creador de contenido se construye con detalles que solo una comunidad fiel descubre.

### 2.2 Principios de UX

- **Todo dato dinámico se anuncia como lo que es.** Skeletons explícitos (`.data-skeleton`, `.showcase-skeleton`, `.riot-skeleton`) mientras se carga; estados de error legibles y en español, nunca un hueco en blanco o un `undefined` filtrado a la interfaz.
- **Degradación nunca es fallo total.** Cada integración (Riot, YouTube, Twitch) tiene una ruta de fallback: caché _stale_ servida con aviso, texto de "no disponible ahora mismo" en vez de romper el módulo, y el resto del centro Live sigue funcionando aunque un proveedor caiga (`Promise.allSettled` en `LiveDashboard.astro`).
- **La portada sugiere, Live confirma.** El Home State Engine (§5.3) traduce señales en un contexto editorial breve y un único CTA; el detalle completo vive siempre en `/live`. Home nunca debe convertirse en una réplica de Live.
- **Todo movimiento es opcional.** `prefers-reduced-motion: reduce` se respeta en absolutamente todos los sistemas con animación (Environment, Soul Engine, contadores animados, reveals de scroll). No es una función accesoria: es una condición de guarda repetida en cada script.

### 2.3 Principios técnicos

- **El dominio no conoce el framework.** `src/domain/*` no importa nada de Astro, DOM ni fetch. Recibe señales y datos ya resueltos, y devuelve decisiones (qué estado mostrar, qué entidad conectar). Esto es lo que permite que `docs/home-state-engine.md` diga literalmente: _"El motor no conoce endpoints, respuestas HTTP ni componentes concretos."_
- **Los secretos no salen del servidor.** Ninguna clave (`RIOT_API_KEY`, `TWITCH_CLIENT_SECRET`, `YOUTUBE_API_KEY`) se lee fuera de `functions/api/*`. El build estático nunca las necesita. Verificado: `.env` está en `.gitignore`, no está trackeado en git, y `env.d.ts`/`config/riot.ts` no exponen valores por defecto para la clave de Riot.
- **Caché con intención, no como parche.** Cada integración caché por capas (memoria de proceso + `stale-while-revalidate` + cabeceras de borde de Cloudflare) con TTLs explícitamente distintos por tipo de dato (cuenta 24h, rango 10min, partida terminada 24h/7d stale — ver `docs/riot-api.md`). No hay una caché genérica de "todo 5 minutos".
- **No inferir lo que no se puede verificar.** Repetido como principio explícito en tres sistemas distintos: Content Graph (no relaciones por texto parecido), match-video-links (solo asociación manual verificada), analítica de Riot (LP delta sin snapshot previo se deja `undefined`, nunca `0`).

### 2.4 Principios editoriales

- **Español para todo lo visible al usuario; inglés para el código.** Sin excepciones detectadas. Los identificadores de dominio (`ContentEntityKind`, `HomeStateId`) están en inglés; todo el copy, mensajes de error públicos y la documentación en `docs/` están en español.
- **El error público nunca expone detalle interno.** Los mensajes de error de Riot/YouTube/Twitch que llegan al usuario están reescritos a un catálogo cerrado de frases en español (`publicRiotError`, mensajes fijos en las Functions); el código interno (`RIOT_RATE_LIMITED`, etc.) nunca se muestra tal cual.
- **Las credenciales/reconocimientos llevan siempre matiz.** `recognition.disclaimer` dice explícitamente que los puestos en rankings externos varían con el tiempo. La honestidad editorial es parte de la identidad, no un aviso legal añadido de mala gana.

---

## 3. Arquitectura

### 3.1 Stack

| Capa                       | Tecnología                  | Versión (`package.json`)                                      |
| -------------------------- | --------------------------- | ------------------------------------------------------------- |
| Framework                  | Astro                       | `^7.1.3`, output `static`                                     |
| Estilos                    | Tailwind CSS                | `^4.3.3` (vía `@tailwindcss/vite`, CSS-first `@theme`)        |
| Lenguaje                   | TypeScript                  | `^6.0.3`, `astro/tsconfigs/strict`                            |
| Lint                       | ESLint                      | `^10.7.0` + `typescript-eslint` + `eslint-plugin-astro`       |
| Formato                    | Prettier                    | `^3.9.6` + `prettier-plugin-astro`                            |
| Runtime de datos dinámicos | Cloudflare Pages Functions  | sin adaptador Astro — funciones sueltas en `functions/api/**` |
| Hosting                    | Cloudflare Pages            | build `npm run build`, salida `dist/`                         |
| Node                       | ≥22.12 (README pide 24 LTS) | —                                                             |

No hay framework de componentes de UI del lado del cliente (React/Vue/Svelte/Solid). La interactividad es TypeScript vanilla dentro de `<script>` en archivos `.astro`, usando APIs nativas del navegador.

### 3.2 Dominios (carpetas de primer nivel bajo `src/`)

```
src/
├── components/    UI de presentación (Astro). No contiene lógica de negocio real, solo orquesta.
├── config/        Constantes tipadas: goals, platforms, rank-assets, riot defaults, match-video-links (datos).
├── data/          Contenido editorial tipado: site, content, environments, references.
├── domain/        Lógica de dominio pura, sin dependencias de Astro/DOM/fetch. content-graph + home-state + league-laboratory.
├── layouts/        BaseLayout único (SEO, meta, Environment, SoulEngine, slot).
├── lib/           Lógica de negocio con efectos controlados: riot/*, activity, time, soul-engine, match-video-links.
├── pages/         Rutas: index.astro (/), live.astro (/live).
├── services/      Adaptadores a APIs externas reutilizables desde Functions: youtube.ts, youtube-stats.ts, twitch.ts.
├── styles/        global.css — único archivo de estilos, ~5.7k líneas.
└── types/         Contratos públicos de respuesta HTTP: content.ts, platforms.ts.

functions/api/     Cloudflare Pages Functions. Único lugar que lee context.env (secretos).
├── riot/overview.ts
├── twitch/status.ts
├── youtube.ts
└── youtube/channel-stats.ts
```

### 3.3 Capas y flujo de datos

```
┌─────────────────────────────────────────────────────────────────┐
│  Navegador                                                        │
│  Astro components (.astro) ── <script> vanilla TS ── fetch(...)  │
└───────────────────────────────┬───────────────────────────────────┘
                                 │ GET /api/riot/overview
                                 │ GET /api/twitch/status
                                 │ GET /api/youtube
                                 │ GET /api/youtube/channel-stats
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  Cloudflare Pages Functions (functions/api/**)                    │
│  - lee context.env (secretos)                                     │
│  - orquesta src/services y src/lib                                │
│  - normaliza errores → { ok, data | error }                       │
│  - fija Cache-Control / stale-while-revalidate / Retry-After      │
└───────────────────────────────┬───────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  src/services (youtube.ts, youtube-stats.ts, twitch.ts)           │
│  src/lib/riot/* (client, cache, normalize, analytics, datadragon)  │
│  - fetch a APIs externas reales (Riot, YouTube Data API/RSS,      │
│    Twitch Helix, Data Dragon)                                     │
│  - caché en memoria por proceso (TTL + stale-while-revalidate +   │
│    de-dupe de peticiones en curso)                                │
└─────────────────────────────────────────────────────────────────┘

En el navegador, tras recibir datos:
  componente ──publishHomeSignal()──▶ domain/home-state (signals + engine)
                                            │
                                            ▼
                            HomeStateEngine.astro actualiza el
                            contexto del Hero y emite
                            `tidusss:home-state-changed`
                                            │
                                            ▼
                              SoulEngine.astro escucha el evento
                              y puede disparar un "Moment"
```

### 3.4 Servicios y adaptadores

- **`src/services/twitch.ts`**: OAuth `client_credentials` con caché de token en memoria de módulo (no persistente entre invocaciones frías), consulta Helix `streams`.
- **`src/services/youtube.ts`**: dos caminos — RSS público sin clave (`youtubeProvider.getLatest`, usado como _fallback_ estático) y Data API v3 con clave (`channels.list` → `playlistItems.list` → `videos.list`, usado por las Functions para duración/Shorts/estadísticas).
- **`src/services/youtube-stats.ts`**: deriva progreso hacia el siguiente hito de suscriptores (`config/goals.ts`) a partir de `getYouTubeChannel`.
- **`src/lib/riot/*`**: el adaptador más elaborado. `client.ts` (fetch con timeout + 1 reintento en 5xx), `cache.ts` (TTL + stale + de-dupe de _in-flight promises_), `normalize.ts` (DTO Riot crudo → modelos de dominio `RecentMatch`/`RankedSummary`), `analytics.ts` (agregados: rendimiento por campeón, resumen de sesión de hoy, racha), `datadragon.ts` (versión + URLs de assets), `errors.ts` (catálogo cerrado de errores + mensajes públicos), `index.ts` (`getRiotOverview`, el orquestador).

### 3.5 Modelos de dominio clave

- **`ContentEntity` / `ContentRelation`** (`domain/content-graph/types.ts`): el vocabulario común de todo lo que existe o existirá en el ecosistema (vídeo, partida, campeón, objetivo, logro, tier-list, guía, build, matchup, patch, tool, game, creator-project, moment, reference, library). Ya hay tipos reservados para entidades que **todavía no existen** (`tier-list`, `build`, `guide`, `matchup`, `patch`, `tool`, `game`) — es la costura preparada para los capítulos III (League Laboratory) y VI (Knowledge Graph) del roadmap.
- **`RiotOverview`** (`lib/riot/types.ts`): el modelo público que cruza la frontera servidor→cliente para todo lo competitivo. Nunca contiene PUUID, summoner ID ni cabeceras crudas.
- **`HomeState` / `HomeSignal`** (`domain/home-state/types.ts`): el vocabulario de "qué está pasando ahora" en la portada.
- **`BrandReference` / `MomentType`** (`data/references.ts`): el vocabulario del Soul Engine — cada "Moment" tiene rareza, condición de disparo y prioridad.

---

## 4. Design System

> **No existe un archivo de tokens de Tailwind separado.** El `@theme` de `src/styles/global.css` solo define la familia tipográfica (`--font-sans: Inter, ...`). Todo lo demás —color, radios, sombras, animaciones— es **CSS artesanal** en `@layer components` y reglas sueltas, no utilidades generadas por Tailwind con tokens propios. Tailwind se usa en el _markup_ para layout/spacing/tipografía (`grid`, `gap-10`, `text-5xl`, `sm:px-8`), pero la "piel" visual bespoke vive en `global.css`.

### 4.1 Tipografía

- Familia única: **Inter** (con fallback a `ui-sans-serif`/`system-ui`). No hay una segunda tipografía de acento ni serif — la jerarquía se construye con peso, tamaño y `letter-spacing` negativo en titulares (`tracking-[-0.06em]` en el H1 del Hero).
- Los "eyebrows" (`.eyebrow`) son la firma tipográfica repetida: `0.7rem`, `font-weight: 800`, `letter-spacing: 0.24em`, mayúsculas, precedidos por una línea dorada de 1.7rem.

### 4.2 Paleta

| Rol                          | Color                             | Uso                                                             |
| ---------------------------- | --------------------------------- | --------------------------------------------------------------- |
| Fondo base                   | `#060913`                         | `:root`, `.environment-base`, prácticamente todo el lienzo      |
| Texto principal              | `#cbd5e1`                         | Cuerpo de texto sobre fondo oscuro                              |
| Acento primario (CTA/dorado) | `#d6b56b` (hover `#edcf8d`)       | Botón primario, eyebrows, valores destacados, LP/rango          |
| Acento secundario (azul)     | `#278cff` / `#4ba3ff` / `#93c5fd` | Focus ring, glow, detalles interactivos, partículas             |
| Estado de derrota            | `#c48b94` / `#d0a0a7` / `#70434c` | Tarjetas de partida perdida, estados negativos                  |
| Marca de Twitch              | `#9146ff`                         | Solo en contexto explícito de Twitch, nunca como acento general |
| Neutros                      | familia `#69768c` → `#0a101d`     | Texto secundario, bordes, superficies elevadas                  |

**Regla de uso:** el dorado es el color de "esto importa / actúa aquí" (CTA, LP, credenciales). El azul es el color de "esto es interactivo / esto brilla". Nunca deben intercambiarse los roles.

### 4.3 Espaciados

No hay una escala de espaciado propia declarada; se usa la escala por defecto de Tailwind (`gap-10`, `px-5`, `py-16`, etc.) más una utilidad propia recurrente: `.section-shell { padding-block: clamp(5rem, 10vw, 8.5rem); }` — el ritmo vertical entre secciones de la Home es _fluido_ (clamp), no un valor fijo.

### 4.4 Bordes y radios

- **2px** es el radio estándar para botones, paneles y tarjetas (`button-primary`, `button-secondary`, la mayoría de superficies elevadas).
- **50%** solo para elementos circulares reales: partículas, indicadores de directo, avatares.
- **999px / 99px** (pill) reservado para insignias pequeñas puntuales.
- No existe un radio "grande" tipo tarjeta redondeada de app — es una decisión estética consistente, no un olvido.

### 4.5 Sombras

Sin sistema de `box-shadow` tokenizado; los usos son puntuales y siempre con color de marca en vez de negro puro: `box-shadow: 0 10px 35px rgb(214 181 107 / 12%)` en el botón primario, `0 0 8px rgb(147 197 253 / 45%)` en partículas. Regla implícita: **las sombras llevan el color del elemento que las proyecta**, nunca `rgba(0,0,0,...)` genérico.

### 4.6 Cards y componentes

- **Patrón "Template + Render"** (el más importante de todo el sistema, ver §5.6): tarjetas de datos complejos (partidas) no se generan con un componente Astro por instancia, sino con un `<template>` HTML compuesto por subcomponentes Astro (`ChampionBadge`, `ItemsRow`, `RunesRow`, `SummonersRow`, `MatchStatus`, `MatchStats`, `MatchBadges`, `MatchVideoBadge/Panel`, `MatchExpanded`) que se **clona y rellena con JS vanilla** (`live/matches/render.ts`). Coste de hidratación: cero. Esto es el patrón de referencia para cualquier futura lista de datos dinámicos densos (tier lists, builds).
- **Skeletons explícitos por familia**: `.data-skeleton` (credencial home, live dashboard), `.showcase-skeleton` (platform showcase), `.riot-skeleton` (bloque riot standalone/no usado actualmente, ver §5.5). Todos ocultan el contenido con un placeholder animado y se retiran con `classList.remove()` al llegar el dato real — nunca con un spinner genérico.
- **Estados vía `data-*`, no vía clases condicionales en JS**: `data-online`, `data-stream-live`, `data-home-priority`, `data-lp-positive/negative/pending`, `is-victory`/`is-defeat`. El CSS reacciona a atributos, el JS solo los conmuta.

### 4.7 Animaciones

- Todas las animaciones CSS están definidas con `@keyframes` con nombres descriptivos (`environment-drift`, `live-dot-pulse`, `rank-emblem-in`, `soul-live-breathe`…) y **todas** están envueltas en `@media (prefers-reduced-motion: no-preference)`; el bloque `reduce` opuesto fuerza `animation: none !important; transform: none !important`.
- Contadores numéricos (suscriptores, LP, estadísticas) **no usan una librería**: se animan a mano con `requestAnimationFrame` y un _easing_ cúbico manual (`1 - Math.pow(1 - progress, 3)`), repetido de forma consistente en `LiveDashboard.astro`, `LiveTeaser.astro` y otros.
- Reveals de entrada (`data-reveal` + `.is-visible`) se gestionan con `IntersectionObserver`, nunca con animación por scroll-position calculada a mano.

### 4.8 Responsive

Breakpoints observados en `global.css` (no son los defaults de Tailwind, están afinados a mano): `359px, 380px, 639px, 719px/720px, 767px/768px, 1023px/1024px, 1080px`. Mobile-first: los estilos base son móviles, `min-width`/`max-width` ajustan hacia arriba y hacia abajo puntualmente por componente.

### 4.9 Estados

- **Carga:** skeleton por familia (§4.6).
- **Vacío:** copy explícito y humano (`"Sesión en pausa"`, `"Todavía no hay actividad competitiva reciente"`) — nunca una lista vacía sin contexto.
- **Error:** copy en español, nunca un código técnico visible, y —crucial— **nunca bloquea el resto de la página**. Cada fetch de Live/Home está aislado con `.catch()` o `Promise.allSettled`.
- **Stale:** explícito (`stale: true`, cabecera `Warning: 110 - "Response is stale"`), no se disfraza de dato fresco.
- **Hover:** protegido con `@media (hover: hover)` para no dejar estados "pegados" en táctil.

---

## 5. Sistemas existentes

### 5.1 Content Graph

**Qué es:** un grafo de dominio estático (`src/domain/content-graph/`) que registra qué entidades existen en el ecosistema (`registry.ts`) y qué relaciones reales hay entre ellas, para que componentes como `ExploreNext.astro` puedan ofrecer "sigue explorando" sin que cada página tenga que hardcodear a dónde enlazar.

**Cómo funciona:** `types.ts` define el vocabulario (`ContentEntityKind`, `ContentRelationKind`); `registry.ts` contiene las entidades y relaciones **verificadas** actuales (portada, live, biblioteca de vídeos, canales, Lucian, credencial Master, objetivos); `adapters.ts` convierte modelos externos (un `RecentMatch` de Riot, un `YouTubeVideo`) en `ContentEntity` sin duplicar los datos originales. `getContentConnections()` filtra por `status: 'available'` y deduplica destinos.

**Documentación de referencia:** [`docs/content-graph.md`](content-graph.md) (auditoría original, cómo añadir una Tier List, riesgos a evitar).

**Estado real:** en uso en Home (`BrandClosing.astro` vía `getPrimaryConnection`) y Live (`ExploreNext` en `live.astro`). Los tipos de entidad `tier-list`, `build`, `guide`, `matchup`, `patch`, `tool`, `game` están **declarados pero sin ninguna entidad registrada todavía** — es la costura ya tendida para el roadmap (§6, capítulos III y VI).

### 5.2 Environment Engine

**Qué es:** el sistema que decide qué composición atmosférica de fondo se muestra según la ruta (`home`, `live`, `match`, `tier-list`, `about`, `youtube`, `twitch`), puramente decorativo.

**Cómo funciona:** `data/environments.ts` define qué capas (`grid`, `noise`, `mist`, `image`, `glow`, `rays`, `particles`) usa cada ambiente; `Environment.astro` las renderiza condicionalmente; `BaseLayout.astro` resuelve el ambiente vía `resolveEnvironment(Astro.url.pathname)`. Un script inline en `Environment.astro` añade parallax por puntero (±2-3px, solo con `pointer: fine` y sin `prefers-reduced-motion`) y fija `data-atmosphere="day"|"night"` en `<html>` según la hora local del navegador.

**Documentación de referencia:** [`docs/environment-engine.md`](environment-engine.md).

**Estado real:** completamente implementado para las 7 rutas declaradas, aunque solo `home` y `live` tienen página real hoy; `match`, `tier-list`, `about`, `youtube`, `twitch` son ambientes **preparados sin ruta que los consuma todavía**.

### 5.3 Home State Engine ("Living Homepage" — base del capítulo II)

**Qué es:** el sistema que hace que la portada reaccione a datos ya cargados por otros componentes, sin peticiones propias y sin que los componentes se conozcan entre sí.

**Cómo funciona:** `domain/home-state/signals.ts` es un _pub/sub_ mínimo (`publishHomeSignal` / `subscribeHomeSignals`) que guarda el último valor por tipo de señal. `engine.ts` define reglas (`homeStateDefinitions`) con prioridad numérica; `resolveHomeState()` evalúa todas y se queda con la de mayor prioridad activa. `HomeStateEngine.astro` consume el resultado, actualiza el bloque `[data-home-context]` del Hero, resalta la sección relevante (`data-home-priority`) y emite `tidusss:home-state-changed`.

**Prioridades actuales** (de `docs/home-state-engine.md`, verificado contra `engine.ts`):

| Estado               | Prioridad | Fuente                |
| -------------------- | --------: | --------------------- |
| Directo activo       |       100 | Twitch                |
| Nuevo vídeo          |        80 | YouTube               |
| Objetivo cercano     |        60 | YouTube o Riot        |
| Día normal (default) |        20 | Contexto local (hora) |

Estados **preparados pero inactivos** (esperan un `future-event` real): nuevo parche (70), nuevo récord (90), objetivo alcanzado (90), nuevo hito (65).

**Documentación de referencia:** [`docs/home-state-engine.md`](home-state-engine.md).

### 5.4 Match History (sistema de partidas de `/live`)

**Qué es:** la lista de últimas partidas de Solo Queue en Live, con tarjeta compacta y detalle expandible por partida.

**Cómo funciona:** ver §4.6 (patrón Template + Render). El HTML de la tarjeta es un `<template>` compuesto en `MatchCard.astro` a partir de subcomponentes puramente de marcado (`ChampionBadge`, `ItemsRow`, `RunesRow`, `SummonersRow`, `MatchStatus`, `MatchStats`, `MatchBadges`, `MatchVideoBadge`, `MatchExpanded` + `MatchVideoPanel`). `live/matches/render.ts` clona la plantilla por partida y la rellena: campeón, KDA, CS/min, participación en kills (calculada localmente a partir de `match.teams`), objetos, runas (con tooltip accesible por `pointerenter`/`focus`), hechizos, insignias (`MatchBadge[]`, actualmente sin generador — el tipo existe, nada las produce todavía), y el enlace verificado a un vídeo de YouTube si existe.

**Vídeo verificado:** `getVideoForMatch()` (`lib/match-video-links.ts`) solo conecta una partida a un vídeo si hay una entrada explícita en `config/match-video-links.ts` con `confidence: 'verified'`. **Ese registro está vacío hoy** — el sistema está completo pero sin datos.

### 5.5 Competitive Dashboard / Riot

**Qué es:** todo lo relacionado con mostrar rango, LP, rendimiento y contexto competitivo, repartido en **tres implementaciones con estados de uso distintos**:

1. **`CompetitiveCredential.astro`** (Home) — activa. Fetch directo a `/api/riot/overview`, rellena un widget compacto de rango/LP/winrate, publica señal `competitive` al Home State Engine.
2. **`live/LiveDashboard.astro` + `live/PlayerProfile.astro`** (Live) — activa. El sistema más completo: hoy en SoloQ, perfil competitivo agregado (campeones recientes, posiciones, resumen editorial autogenerado), refresco automático cada 120s y manual por botón.
3. **`src/components/riot/*`** (`CompetitiveStatus.astro`, `RankedSummary.astro`, `MatchRow.astro`, `RiotSkeleton.astro`, `RiotUnavailable.astro`) — **⚠️ código huérfano**. Verificado por `grep` exhaustivo: ninguno de estos cinco archivos está importado desde ninguna página ni desde ningún otro componente. Es, aparentemente, una primera generación del Competitive Dashboard sustituida por (1) y (2) sin haberse eliminado. Ver hallazgo en §11 (ADR-002).

**Analítica:** `lib/riot/analytics.ts` calcula rendimiento por campeón, resumen de sesión reciente (máx. 10 partidas de Solo Queue de los 15 IDs más recientes) y resumen de "hoy" (filtrado por fecha de Madrid vía `lib/time.ts`), incluyendo generación de frases editoriales automáticas (`editorialSummary`).

### 5.6 Hero

**Qué es:** la sección de apertura de Home. Titular de marca ("Cada combo cuenta."), CTA a YouTube/Twitch/Live, y un contexto editorial dinámico (`[data-home-context]`) que el Home State Engine rellena tras la carga.

**Detalle técnico:** el fondo de "fragmentos de gameplay" (`[data-hero-gameplay]`) se rellena con las miniaturas de los últimos vídeos reales una vez que `HomePlatformShowcase.astro` los recibe — es decir, el Hero **no pide datos por sí mismo**, los recibe de otro componente vía DOM directo. Parallax por puntero con CSS custom properties (`--pointer-x/y`), desactivado bajo `prefers-reduced-motion`.

### 5.7 YouTube

**Qué es:** dos rutas de datos con propósitos distintos. RSS público (`youtubeProvider.getLatest`, sin clave, usado como _contenido_ — feed de vídeos) y Data API v3 con clave (usada por las Functions para duración exacta, clasificación de Shorts y estadísticas del canal).

**Coste de cuota:** una actualización completa cuesta ~3 unidades (`channels.list` + `playlistItems.list` + `videos.list`), independientemente de cuántos vídeos se muestren (hasta 8 en el feed original, 12 en el endpoint de Function). Documentado con precisión en el `README.md`.

**Clasificación de Shorts:** heurística explícita (`durationSeconds <= 180`) porque la API no expone un indicador oficial — comentado en el propio código como decisión consciente, no un descuido.

### 5.8 Twitch

**Qué es:** estado de directo (`/api/twitch/status`) vía OAuth `client_credentials` + Helix `streams`. Si no hay directo, la interfaz nunca dice "offline" de forma seca: ofrece la próxima sesión como invitación (`"La próxima partida empieza en Twitch. Sígueme para no perdértela."`).

**Caché:** token OAuth en memoria de módulo (vida útil menos 5 min de margen); estado de stream con caché de función (60s fresco / 5min stale).

### 5.9 Soul Engine

**Qué es:** la capa de **personalidad de marca** del sitio — un motor de "Moments" contextuales (`data/references.ts` + `lib/soul-engine.ts` + `SoulEngine.astro`) que aparecen como un toast discreto (`[data-soul-moment]`) en momentos concretos:

- Saludo según hora del día (una vez por sesión).
- _Hold_ del logo (pointerenter/focus mantenido 2.2s).
- Directo de Twitch detectado (vía `MutationObserver` sobre atributos `data-online`/`data-stream-live`).
- Hover sobre una tarjeta de partida (victoria/derrota, con _debounce_ de 14s entre disparos).
- Llegar al final del scroll (`IntersectionObserver` sobre un centinela).
- **Código Konami** (↑↑↓↓←→←→ba) y **escribir "tidus"** — easter eggs literales, con textos que citan directamente Final Fantasy X (_"The dream has ended. But the story continues."_) y League of Legends (_"Lucian Mode. Coming soon."_).
- Visitante recurrente (≥25 visitas via `localStorage`).
- Nuevo récord — enganchado al evento `tidusss:home-state-changed`, en espera de que ese estado se active con datos reales.

**Selección de contenido:** ponderada por rareza (`common: 12, rare: 5, epic: 2, legendary: 1`) multiplicada por prioridad, evitando repetir la última referencia mostrada (persistida en `sessionStorage`).

**Documentación relacionada:** mencionado en [`docs/home-state-engine.md`](home-state-engine.md) §"Soul Engine", pero no tiene documento propio — candidato natural a `docs/soul-engine.md` cuando el capítulo V del roadmap se desarrolle.

### 5.10 Objetivos (Goals)

**Qué es:** `config/goals.ts` define objetivos con `mode: 'automatic' | 'manual' | 'long-term'` y `source: 'youtube' | 'youtube-videos' | 'riot' | 'manual'`. Se muestran en Live (`#objetivos`) con barra de progreso animada. El objetivo de suscriptores es dinámico contra una escala de hitos (`subscriberGoals`); el de LP es fijo (700); el de vídeos publicados fijo (500); "Partner de Twitch" es manual/largo plazo sin fuente de datos.

### 5.11 Activity Center

**Qué es:** dos superficies — el CTA de Home (`ActivityCenterCta.astro`, enlaza a `/live`) y el feed unificado en Live (`buildActivity()` en `lib/activity.ts`), que mezcla partidas y vídeos recientes en una sola lista cronológica, deduplicada por `id` y filtrada por timestamp válido.

### 5.12 Library (vídeos)

**Qué es hoy:** no es una página propia. Es la entidad `library:videos` del Content Graph, que apunta a `/#canales` (la sección de plataformas en Home). El "Latest video strip" en `HomePlatformShowcase.astro` es la superficie real donde se listan vídeos recientes. **No existe una página `/library` ni un catálogo navegable del histórico completo del canal** — es la brecha que cierra el capítulo X del roadmap.

### 5.13 League Laboratory (dominio nuevo, sin UI todavía)

**Qué es:** el nuevo dominio de producto **League Knowledge**, con identidad de marca **The League Laboratory** — el sistema donde vivirán todas las futuras herramientas de conocimiento de League of Legends (Tier Lists, Build Explorer, Rune Explorer, Champion Explorer, Patch Explorer, Matchup Explorer, Synergy Explorer, Guides, Concept Library, Meta Timeline, Draft Knowledge). Es la consecuencia directa de ADR-003 (§11): el Content Graph ya reservaba los tipos `build`, `champion`, `guide`, `matchup`, `patch` y `tier-list` precisamente para este momento.

**Cómo funciona:** `src/domain/league-laboratory/` sigue la misma forma que `content-graph`/`home-state` — cero dependencias de Astro/DOM/fetch, un barrel (`index.ts`), tipos separados de la lógica (`types.ts`), utilidades puras (`scope.ts`), un registro tipado con funciones de consulta (`registry.ts`, hoy con colecciones vacías) y un puente de conversión hacia el Content Graph (`content-graph-bridge.ts`). Diez entidades (`LabChampion`, `Patch`, `Build`, `RunePage`, `Matchup`, `Synergy`, `Concept`, `KnowledgeArticle`/`Guide`, `TierList`, `MetaState`) cubren las diez herramientas planeadas sin que ninguna necesite un tipo propio adicional. El diferenciador estructural frente a OP.GG/U.GG/Mobalytics es el value object `EditorialTake` (veredicto + razonamiento + confianza), embebido de forma obligatoria en Build, RunePage, Matchup, Synergy y en cada entrada de Tier List — el criterio de Tidusss es un campo del modelo, no una nota opcional.

**Documentación de referencia:** [`docs/league-laboratory.md`](league-laboratory.md) — diseño de dominio completo, justificación entidad por entidad, diagrama de relaciones, especificación de UI (layout/navegación/componentes/tarjetas/filtros sin implementar), roadmap interno y riesgos.

**Estado real:** dos aplicaciones públicas reales. **`/tier-list` — The Official Tidusss ADC Tier List** (ADR-005) y **`/campeones/[slug]` — Explorador de Campeones**, que ya no genera 4 páginas de muestra (ADR-007) sino **una por cada uno de los ~170 campeones del juego** (ADR-008), a partir de un catálogo generado desde Data Dragon (`scripts/sync-champion-catalog.mjs`) completamente separado de la curación editorial de Tidusss (`LabChampion`, hoy 4 campeones). El registro del dominio se refactorizó de un singleton mutable (`labRegistry`/`hydrateLabRegistry`) a una fábrica pura sin estado compartido (`buildLabRegistry`, ADR-006). El Content Graph solo registra los campeones curados, nunca el catálogo completo (ADR-009). Verificado con datos reales: el build genera **176 páginas**, incluidos campeones publicados por Riot después del corte de conocimiento de quien hizo este cambio — la prueba de que añadir 30 campeones mañana no requiere tocar ni una línea de esta arquitectura. Sigue sin endpoints, sin Build/RunePage/Matchup/Synergy/MetaState con datos reales, y sin las demás herramientas del capítulo. Detalle completo en [`docs/league-laboratory.md`](league-laboratory.md) §12-§14.

---

## 6. Roadmap

> Cada capítulo indica: **Objetivo**, **Arquitectura** (qué construir o extender), **Dependencias** (qué debe existir antes) e **Impacto** (qué cambia para el usuario). El estado de partida de cada capítulo se basa estrictamente en lo verificado en el código (§5); donde el capítulo requiere una decisión de producto que el código no puede responder, se marca **[Decisión de producto pendiente]**.

### Chapter I — Living Ecosystem ✅

- **Objetivo:** dejar de tratar web/YouTube/Twitch/Riot como silos; que cada dato dinámico tenga un lugar de origen único y una forma de conectarse al resto.
- **Arquitectura:** Content Graph (§5.1) + capa de servicios (`src/services`, `src/lib/riot`) + Functions como frontera de secretos.
- **Dependencias:** ninguna — es la base.
- **Impacto:** ya en producción. Es el cimiento sobre el que se apoyan todos los capítulos siguientes.
- **Estado verificado:** completo para las integraciones existentes (Riot, YouTube, Twitch).

### Chapter II — Living Homepage (en curso)

- **Objetivo:** que la portada deje de ser un elemento estático y reaccione de forma legible a lo que está pasando ahora mismo.
- **Arquitectura:** Home State Engine (§5.3), ya construido para 4 estados activos y 4 preparados.
- **Dependencias:** Content Graph (para resolver acciones sin hardcodear URLs) — ya satisfecha.
- **Impacto:** el usuario que vuelve a la portada ve algo distinto según si hay directo, vídeo nuevo u objetivo cerca.
- **Lo que falta para cerrar el capítulo:** activar los 4 estados "preparados" (`new-patch`, `new-record`, `goal-achieved`, `milestone`) con una fuente de datos real que hoy no existe — requiere que algún sistema (probablemente League Laboratory, capítulo III) empiece a publicar `future-event`.

### Chapter III — League Laboratory (dominio + Tier List + Explorador de Campeones a escala real)

- **Objetivo:** convertir el análisis de partidas/parches/campeones en contenido navegable propio (tier lists, guías, builds, matchups, sinergias, conceptos) en vez de vivir solo en YouTube — con criterio editorial como diferenciador frente a OP.GG/U.GG/Mobalytics.
- **Arquitectura:** capa de dominio completa (`src/domain/league-laboratory/`) **más dos aplicaciones públicas reales**: `/tier-list` (ADR-005) y `/campeones/[slug]` — el Explorador de Campeones, que ya genera **una página por cada uno de los ~170 campeones del juego** (ADR-008), no solo una muestra curada. El dominio separa el catálogo factual (generado desde Data Dragon, `scripts/sync-champion-catalog.mjs`) de la curación editorial (`LabChampion`, hoy 4 campeones) — el Content Graph solo registra estos últimos (ADR-009). El registro pasó de singleton mutable a fábrica pura sin estado compartido (ADR-006). Detalle completo en [`docs/league-laboratory.md`](league-laboratory.md) §12-§14. Los ambientes `tier-list` y `champion` del Environment Engine ya se activan automáticamente para sus rutas respectivas.
- **Dependencias:** Content Graph (satisfecha e integrada de verdad para los campeones curados). Pendiente: decidir si `rune-page`, `synergy`, `concept` y `meta-state` necesitan su propio `ContentEntityKind` **[Decisión pendiente, ver docs/league-laboratory.md §9]**.
- **Impacto:** 174 rutas públicas nuevas (`/tier-list` + 173 fichas de campeón; indexable solo Lucian por tener perfil editorial real, el resto `noindex, follow`). El campeón es, de forma verificada y a escala real, el nodo central del ecosistema del Laboratorio.
- **Lo que falta para avanzar el capítulo:** Build Explorer, Rune Explorer y el resto de herramientas (roadmap interno en `docs/league-laboratory.md` §8); ampliar la cobertura editorial más allá de Lucian (perfiles de Kai'Sa, Jinx y Ezreal); posible página `/campeones/` índice (descartada por ahora, ver `docs/league-laboratory.md` §14.12).

### Chapter IV — Environment Engine ✅

- **Objetivo:** dar identidad atmosférica propia a cada zona del sitio sin sacrificar rendimiento ni accesibilidad.
- **Arquitectura:** ya completa (§5.2). 7 ambientes definidos, 5 con ruta real o parcialmente en uso.
- **Dependencias:** ninguna.
- **Impacto:** ya en producción.
- **Lo que falta:** ambientes `match`, `tier-list`, `about`, `youtube`, `twitch` están definidos pero solo se activarán cuando existan las páginas correspondientes (capítulos III, VII, VIII).

### Chapter V — Soul Engine (MVP en producción, capítulo abierto)

- **Objetivo:** que la marca tenga textura y sorpresa, no solo información.
- **Arquitectura:** ya construido (§5.9) con 12 tipos de "Moment" y sistema de rareza.
- **Dependencias:** Home State Engine (para el hook de `new-record`, ya integrado).
- **Impacto:** ya en producción, pero es un sistema diseñado explícitamente para crecer — cada nuevo hito real de negocio (récord de espectadores, colaboración, aniversario del canal) es candidato natural a un nuevo `BrandReference`.
- **Lo que falta para "cerrar" (si se considera que debe cerrarse):** un catálogo documentado propio (`docs/soul-engine.md`) y, opcionalmente, un panel de moments más rico que el toast actual de una línea.

### Chapter VI — Knowledge Graph (extensión del Content Graph)

- **Objetivo:** que el Content Graph deje de ser solo "navegación sugerida" y empiece a responder preguntas de relación más ricas (qué builds se usaron en qué partidas, qué guías corresponden a qué parche).
- **Arquitectura:** extender `ContentRelationKind` y las consultas de `registry.ts`; posiblemente una vista de exploración visual del grafo **[Decisión de producto pendiente: ¿es una herramienta interna o una superficie pública?]**.
- **Dependencias:** Chapter III debe existir primero (no hay nada que conectar en el grafo si no hay tier lists/guías/builds reales).
- **Impacto:** mejora el SEO interno (enlazado contextual más rico) y la retención (más caminos de "sigue explorando").

### Chapter VII — Creator Platform (no iniciado)

- **Objetivo:** [Decisión de producto pendiente]. El código no contiene ninguna pista de qué debería incluir un "Creator Platform" (¿herramientas para otros creadores? ¿un panel de patrocinios? ¿multi-idioma?). No hay entidades, rutas ni datos que lo anticipen.
- **Arquitectura:** a definir completamente una vez exista el objetivo de producto.
- **Dependencias:** requiere una sesión de definición de producto antes de cualquier trabajo técnico.
- **Impacto:** desconocido hasta que se defina el objetivo.

### Chapter VIII — Career (no iniciado)

- **Objetivo:** [Decisión de producto pendiente]. La pista más cercana en el código es `Timeline.astro` + `data/content.ts#milestones` (trayectoria del canal, del primer vídeo a Master) — pero eso ya existe como sección de Home. "Career" podría ser una expansión de esa trayectoria a página propia, o algo distinto (progresión competitiva histórica, temporadas). Necesita definición.
- **Arquitectura:** si es una expansión de `milestones`, reutilizaría el mismo patrón de datos tipados + `SectionHeading`; si es progresión histórica de rango, dependería de tener snapshots persistentes de LP (que hoy explícitamente no existen — `lpDeltaEstimated: true`).
- **Dependencias:** posible prerequisito técnico: persistencia de snapshots de rango (Cloudflare KV), ya anticipada como pendiente en `docs/riot-api.md`.
- **Impacto:** desconocido hasta que se defina el objetivo.

### Chapter IX — Player Profile (MVP en producción)

- **Objetivo:** que el perfil competitivo sea más que un rango — que cuente cómo juega Tidusss (campeones, posiciones, forma reciente) con lectura editorial, no solo números.
- **Arquitectura:** ya construido como `live/PlayerProfile.astro` + `analyzeRecentSoloQueue()` (§5.5). Incluye ya resumen editorial autogenerado, campeones recientes, distribución de posiciones.
- **Dependencias:** Riot integration (satisfecha).
- **Impacto:** ya en producción dentro de Live.
- **Lo que falta para "cerrar":** el capítulo podría considerarse abierto en tanto crezca (comparativas entre parches, evolución histórica) — depende de snapshots persistentes, igual que Career.

### Chapter X — Library (no iniciado como página propia)

- **Objetivo:** un catálogo navegable del histórico completo de vídeos del canal, más allá del strip de "últimos 4" de Home.
- **Arquitectura:** la entidad `library:videos` ya existe en el Content Graph apuntando a un ancla de Home (`/#canales`); falta una página propia (`src/pages/library/` o similar) que pagine `getLatestYouTubeVideos` más allá de los 8-12 actuales, y actualizar la entidad para apuntar a la ruta nueva.
- **Dependencias:** ninguna técnica bloqueante — es el capítulo más directo de construir con lo que ya existe.
- **Impacto:** SEO (más contenido indexable), y una razón adicional para que `ExploreNext` tenga más destinos reales que ofrecer.

---

## 7. Convenciones

### 7.1 Naming

- **Archivos de componente:** `PascalCase.astro` (`HeroVisual.astro`, `MatchExpanded.astro`).
- **Módulos TypeScript:** `camelCase.ts` o `kebab-case.ts` según si exportan una función principal (`activity.ts`) o son un módulo de configuración de varias piezas (`match-video-links.ts`, `rank-assets.ts`) — el patrón dominante es **kebab-case para archivos, camelCase para lo que exportan**.
- **Clases CSS:** kebab-case, semánticas (`.hero-section`, `.riot-match-champion`), nunca utilidades atómicas propias (esas ya las da Tailwind).
- **Atributos `data-*`:** el mecanismo estándar para exponer _hooks_ de comportamiento y estado al JS/CSS (`data-reveal`, `data-home-target`, `data-match-card`). Un componente que necesite JS **siempre** expone sus nodos vía `data-*`, nunca vía clases reutilizadas para otra cosa.
- **Identificadores de dominio:** _template literal types_ con prefijo de tipo (`ContentEntityId = \`${ContentEntityKind}:${string}\``, p. ej. `'champion:lucian'`, `'goal:soloqueue-700'`). Cualquier ID de dominio nuevo debe seguir este patrón `tipo:slug`.
- **Barrels (`index.ts`):** cada carpeta de dominio (`domain/content-graph`, `domain/home-state`, `lib/riot`) expone su superficie pública vía un `index.ts` con `export * from './modulo'`. Los consumidores externos importan del barrel, no de los archivos internos directamente — excepto cuando el propio dominio se importa a sí mismo internamente (ver detalle de imports abajo).

### 7.2 Componentes

- Un componente `.astro` de sección (Home) sigue el patrón: frontmatter con imports + una única `<section id="..." class="... section-shell" data-reveal>`, `SectionHeading` para eyebrow/título/descripción cuando aplica, y opcionalmente un `<script>` al final si necesita datos dinámicos.
- Componentes puramente de marcado sin lógica (`ChampionBadge.astro`, `MatchStatus.astro`) no llevan frontmatter — son plantillas puras consumidas por `render.ts`.
- La lógica de fetch/hidratación vive **siempre** en un `<script>` al final del propio componente que la necesita, nunca en un archivo `.ts` separado importado por varios componentes de Astro (la única excepción es `live/matches/render.ts`, que es lógica de render compartida explícitamente extraída porque la reutilizan `LiveDashboard.astro`).

### 7.3 Directorios

- `components/live/*` y `components/riot/*` son los únicos subdirectorios de componentes — reservar subcarpetas para familias de componentes con más de ~4 archivos relacionados (como ya ocurre con `components/live/matches/`).
- Un dominio nuevo (capítulo III, VI…) debe replicar la estructura `domain/<nombre>/{types,engine|registry,index}.ts`, no mezclarse dentro de `content-graph` o `home-state` existentes salvo que sea una extensión directa de su vocabulario.

### 7.4 CSS / Tailwind

- Tailwind para layout, spacing, tipografía y breakpoints en el propio markup.
- CSS artesanal en `global.css`, dentro de `@layer components` cuando es un patrón reutilizable (`.button-primary`), o como regla suelta con selector de componente cuando es específico de una sección.
- **No crear un segundo archivo de estilos.** Toda la superficie visual bespoke vive en `global.css`. Si este archivo crece más allá de un tamaño manejable, la decisión de dividirlo debe pasar por una ADR (§11), no ocurrir de forma incremental sin acuerdo.
- Los estados visuales se activan por `data-*` en el HTML, nunca añadiendo/quitando clases de utilidad de Tailwind desde JS para representar estado (la única "clase de estado" tolerada es `.is-visible`/`.is-ready`/`.is-victory`/`.is-defeat`, que son semánticas, no utilidades).

### 7.5 TypeScript

- `astro/tsconfigs/strict` — no relajar el `tsconfig.json` para "hacer pasar" una implementación.
- Los tipos de dominio (`ContentEntity`, `HomeState`, `RiotOverview`…) son la interfaz de contrato entre capas; un cambio en ellos es, por definición, un cambio arquitectónico y debe evaluarse como tal.
- Los DTOs crudos de proveedores externos (`RiotAccountDto`, `RiotMatchDto`…) viven separados de los modelos normalizados (`RecentMatch`, `RankedSummary`) — nunca se pasa un DTO crudo a un componente.

### 7.6 Imports

- Rutas relativas (`../../lib/riot`), no hay _path aliases_ configurados en `tsconfig.json`. Cualquier introducción de aliases (`@/lib/...`) es un cambio de convención que debe documentarse aquí, no aparecer solo en un `tsconfig.json` modificado.
- Los tipos se importan con `import type` de forma consistente cuando el import es solo de tipo.

### 7.7 Buenas prácticas observadas (a mantener)

- Todo fetch al cliente tiene `.catch()` explícito con una ruta de UI degradada — no hay ni un solo `fetch` sin manejo de error en todo el código auditado.
- Los mensajes de consola (`console.info`/`console.warn`/`console.error`) en las Functions siguen un formato consistente `{ scope, event/phase, ... }` sin datos sensibles — replicar este formato en cualquier Function nueva.
- Ningún componente asume que un dato numérico existe: todo acceso a campos opcionales de Riot/YouTube pasa por `?? '—'`, `'Sin dato'` o una rama condicional explícita.

---

## 8. Principios de rendimiento

### Qué está permitido

- Astro con salida 100% estática para todo lo que no depende de datos en tiempo real. El HTML de Home y Live se sirve pre-generado.
- `<script>` vanilla con APIs nativas del navegador (`fetch`, `IntersectionObserver`, `MutationObserver`, `requestAnimationFrame`, Custom Events) como único mecanismo de interactividad.
- Caché en capas: memoria de proceso (de-dupe de _in-flight promises_ + TTL/stale) → cabeceras `Cache-Control`/`stale-while-revalidate` de Cloudflare. Cada integración externa nueva debe replicar este patrón de dos capas, no confiar solo en las cabeceras HTTP.
- Imágenes con `width`/`height` explícitos siempre, `loading="lazy"` por defecto y `loading="eager"`/`fetchpriority="high"` reservado **solo** para el elemento visual principal above-the-fold (firma de Lucian en Hero/Live).
- El patrón Template + Render (§4.6) para cualquier lista de tarjetas de datos densos — es más barato que instanciar N componentes Astro con hidratación individual (que, de hecho, ni siquiera existe como concepto en este proyecto: Astro aquí es _zero-hydration_ por diseño).

### Qué no está permitido

- **Ningún framework de UI reactivo** (React/Vue/Svelte/Solid/Alpine) sin pasar antes por una ADR — cambiaría el modelo de coste de JS de "cero por defecto" a "coste por isla", y contradice la Filosofía §2.3.
- **Ninguna petición sin caché** a Riot, YouTube o Twitch. Toda integración nueva a una API externa debe definir su propio TTL fresco/stale antes de mezclarse con el resto del código, igual que hace `docs/riot-api.md`.
- **Ninguna animación sin guarda de `prefers-reduced-motion`.**
- **Ninguna imagen sin dimensiones explícitas** (evita _layout shift_).
- **Ninguna dependencia de npm nueva "por comodidad"** para algo que ya resuelve una API nativa del navegador (fecha, animación, observación de intersección) — el proyecto entero demuestra que esto es deliberado (ni siquiera una librería de animación de conteo, que es de las más comunes de añadir "por defecto" en otros proyectos).

### Cómo deben hacerse futuras implementaciones

1. Si el dato es estático/editorial → vive en `src/data` o `src/config`, se resuelve en build time.
2. Si el dato requiere secreto o API externa → Function nueva en `functions/api/<proveedor>/<recurso>.ts`, que orquesta un servicio en `src/services` o `src/lib`, con su propio TTL fresco/stale documentado.
3. Si el dato debe influir en la portada → publica una `HomeSignal` nueva (extendiendo el _union type_, no creando un canal paralelo).
4. Si el dato es una lista densa de tarjetas → evaluar el patrón Template + Render antes que N componentes Astro individuales.

---

## 9. SEO

**Estado verificado:**

- `astro.config.mjs` fija `site: 'https://tidusss.es'` — canonical resuelto automáticamente por página vía `BaseLayout.astro` (`new URL(Astro.url.pathname, Astro.site)`).
- Meta description, Open Graph y Twitter Card se fijan por página vía props de `BaseLayout` (`title`, `description`), con fallback a `data/site.ts`. Cada página nueva debe pasar ambas props explícitamente, no confiar en el default salvo que realmente comparta el mensaje de marca genérico.
- `robots.txt` permite todo (`Allow: /`) y apunta a `sitemap.xml`.
- `sitemap.xml` es **estático y mantenido a mano** — hoy solo lista `/` y `/live`. **Riesgo:** cualquier página nueva (capítulos III, X del roadmap) debe añadirse manualmente aquí o quedará fuera de indexación; no hay generación automática de sitemap en el build (`@astrojs/sitemap` no está entre las dependencias).
- Las respuestas de `functions/api/**` llevan `X-Robots-Tag: noindex, nofollow` — correcto: el JSON de datos nunca debe indexarse.

**Cómo debe crecer el proyecto:**

- Toda página de contenido nueva (League Laboratory, Library) debe: (1) añadirse a `sitemap.xml`, (2) definir `title`/`description` propios y específicos, (3) considerar si necesita su propio `EnvironmentId` (ya hay varios preparados sin ruta) para consistencia visual, (4) registrar su entidad en el Content Graph para heredar enlazado interno vía `ExploreNext`.
- Si el volumen de páginas de contenido crece de forma sostenida (capítulo III en adelante), **evaluar añadir `@astrojs/sitemap`** para generar el sitemap en build en vez de mantenerlo a mano — decisión a registrar como ADR cuando se tome.
- El copy en español y la ausencia de contenido duplicado entre Home y Live (Home resume, Live detalla) ya es, en sí, una práctica de SEO sana — mantenerla al añadir capítulos: un capítulo nuevo no debe repetir el contenido de otro, debe enlazarlo.

---

## 10. Accesibilidad

**Reglas verificadas en el código actual (a mantener como estándar mínimo):**

1. **Movimiento:** todo lo animado debe tener una rama `@media (prefers-reduced-motion: reduce)` que anule transformaciones y animaciones, y toda animación por JS (contadores, reveals) debe comprobar `window.matchMedia('(prefers-reduced-motion: reduce)').matches` antes de animar frame a frame.
2. **Foco:** `:focus-visible` con outline visible de 2px y offset 4px es el estándar global — cualquier componente interactivo nuevo hereda este estilo, no define uno propio salvo necesidad justificada.
3. **Regiones dinámicas:** todo contenedor que se actualiza por JS sin recarga de página debe llevar `aria-live="polite"` (contexto de Home, feed de actividad, overview de Riot) y `aria-busy="true"/"false"` mientras carga.
4. **Iconografía decorativa:** `aria-hidden="true"` en todo elemento puramente visual (flechas `↗`/`→`, partículas del Environment Engine, iconos de plataforma cuando ya hay texto adyacente).
5. **Tooltips:** deben ser accesibles por teclado, no solo hover — el patrón de `RunesRow`/`render.ts` (`tabIndex`, `role="img"`, `aria-label`, `aria-describedby` hacia un `role="tooltip"`) es la referencia a replicar.
6. **Expansión/colapso:** usar `aria-expanded`, `aria-controls` con `id` único y `inert` en el panel colapsado (patrón de `wireExpansion` en `render.ts`) — no ocultar/mostrar solo con CSS sin gestionar el foco y la navegación por teclado.
7. **Formularios de navegación por teclado especiales** (Konami, "tidus"): deben ignorar el evento si el foco está en un campo de entrada real (`HTMLInputElement`, `HTMLTextAreaElement`, `HTMLSelectElement`, `isContentEditable`) — patrón ya presente en `soul-engine.ts`, replicar en cualquier atajo de teclado nuevo.
8. **Idioma:** el toast del Soul Engine fija `lang` dinámicamente cuando el mensaje está en inglés (`message.lang = selected.language`) — cualquier contenido bilingüe debe declarar su idioma real, no heredar el `lang="es"` del documento por defecto.

**Pendiente de verificación [no confirmado por auditoría de código, requiere herramienta de contraste/lector de pantalla real]:** contraste de color exacto de todos los pares texto/fondo, comportamiento con lectores de pantalla reales (NVDA/VoiceOver), navegación completa por teclado end-to-end en `/live`. Recomendado como acción de QA antes de cerrar cualquier capítulo del roadmap que añada superficie nueva.

---

## 11. Decisiones arquitectónicas (ADR log)

> Log append-only. Cada entrada nueva se añade al final con fecha. No se edita ni se borra una entrada pasada aunque quede obsoleta — se añade una entrada nueva que la sustituye y se referencia mutuamente.

### ADR-001 — 2026-07-24 — Adopción de la Platform Bible como fuente de verdad

**Contexto:** el proyecto tenía documentación técnica dispersa y de alta calidad (`docs/content-graph.md`, `docs/environment-engine.md`, `docs/home-state-engine.md`, `docs/riot-api.md`) pero ningún documento que conectara arquitectura, producto, diseño y roadmap en un solo lugar con autoridad.
**Decisión:** crear `docs/PLATFORM_BIBLE.md` como documento maestro. Los documentos técnicos existentes se conservan y se referencian, no se duplican.
**Consecuencia:** toda futura implementación relevante debe evaluarse contra este documento antes de empezar; toda decisión arquitectónica importante se añade aquí, no solo en el mensaje de commit.

### ADR-002 — 2026-07-24 — Hallazgo: código huérfano en `src/components/riot/`

**Contexto:** durante la auditoría se verificó por búsqueda exhaustiva (`grep` de importaciones) que `CompetitiveStatus.astro`, `MatchRow.astro`, `RankedSummary.astro`, `RiotSkeleton.astro` y `RiotUnavailable.astro` no están importados desde ninguna página ni componente activo. Todo indica que fueron la primera implementación del Competitive Dashboard, sustituida por `CompetitiveCredential.astro` (Home) y `LiveDashboard.astro`/`PlayerProfile.astro` (Live) sin limpieza posterior.
**Decisión pendiente:** **[Decisión de producto/ingeniería pendiente]** — eliminar estos 5 archivos, o archivarlos deliberadamente con un comentario de intención si se planea reutilizarlos. No se ha tomado acción sobre el código en esta auditoría (instrucción explícita del encargo: no modificar funcionalidad).
**Consecuencia si no se actúa:** riesgo de que un futuro colaborador los edite pensando que están en uso, o que un lector de la Bible confunda `RankedSummary.astro`/`MatchRow.astro` (no usados) con el sistema real de partidas (§5.4, §5.5).

### ADR-003 — 2026-07-24 — El Content Graph reserva tipos de entidad para capítulos futuros

**Contexto:** `ContentEntityKind` ya incluye `tier-list`, `build`, `guide`, `matchup`, `patch`, `tool`, `game` sin que exista ninguna entidad registrada de esos tipos.
**Decisión:** se interpreta como una decisión de diseño deliberada (preparar el vocabulario antes que el contenido) y no como código muerto, a diferencia de ADR-002 — porque son _tipos_, no _componentes sin uso_, y el propio `docs/content-graph.md` documenta explícitamente cómo activarlos ("Añadir una Tier List").
**Consecuencia:** el capítulo III (League Laboratory) del roadmap no requiere trabajo de modelado de dominio, solo contenido y rutas.

### ADR-004 — 2026-07-24 — Diseño del dominio League Knowledge / The League Laboratory

**Contexto:** se encargó diseñar la arquitectura completa de un nuevo dominio de producto — todo el conocimiento de League of Legends (tier lists, builds, runas, matchups, sinergias, conceptos, guías, meta) — antes de construir ninguna herramienta, con la instrucción explícita de no copiar el modelo de OP.GG/U.GG/Mobalytics (datos sin autor) sino estructurar el criterio editorial de Tidusss como parte del propio modelo de datos.
**Decisión:** crear `src/domain/league-laboratory/` con 10 entidades (`LabChampion`, `Patch`, `Build`, `RunePage`, `Matchup`, `Synergy`, `Concept`, `KnowledgeArticle`/`Guide`, `TierList`, `MetaState`), colapsando deliberadamente 5 de los 15 conceptos sugeridos en el encargo: `Lane` se fusiona en `Role` (reutilizando el vocabulario de posición que ya usa `lib/riot/types.ts`), `PatchNote` se fusiona en `Patch.editorialSummary`, `Opinion` se convierte en el value object obligatorio `EditorialTake`, y `Guide` pasa a ser una especialización tipada de `KnowledgeArticle` en vez de una entidad hermana. Se documenta un puente puro (`content-graph-bridge.ts`) hacia el Content Graph existente, reutilizando los `ContentEntityKind` ya reservados (`build`, `champion`, `guide`, `matchup`, `patch`, `tier-list`) sin modificar `domain/content-graph/` en absoluto.
**Consecuencia:** las diez herramientas futuras del laboratorio (Tier List, Build Explorer, Rune Explorer, Champion Explorer, Patch Explorer, Matchup Explorer, Synergy Explorer, Guides, Concept Library, Meta Timeline) son vistas sobre el mismo contrato, no diez modelos de datos distintos. `RunePage`, `Synergy`, `Concept` y `MetaState` quedan **sin** `ContentEntityKind` propio — no se ha tocado el archivo compartido `content-graph/types.ts` en este trabajo; extenderlo es una decisión futura explícitamente pendiente (ver `docs/league-laboratory.md` §6, §10). Cero cambios en Home, Live, Match History o cualquier API existente — verificado con `astro check` (91 archivos, 0 errores), `eslint` (sin salida) y `build` tras la creación de los 5 archivos nuevos.
**Documentación relacionada:** [`docs/league-laboratory.md`](league-laboratory.md).

### ADR-005 — 2026-07-24 — Primera aplicación del League Laboratory: The Official Tidusss ADC Tier List

**Contexto:** se encargó implementar la primera herramienta pública del League Laboratory (`/tier-list`) como demostración de que el dominio diseñado en ADR-004 sostiene una aplicación real sin arquitectura paralela, con la condición explícita de no fingir datos que no existen y de no modificar Home, Live, Match History ni las APIs existentes.
**Decisión:** construir `/tier-list` (`src/pages/tier-list.astro`) consumiendo directamente `LabChampion`, `Patch`, `TierList`/`TierListEntry`, `EditorialTake` y `Role` del dominio ya existente, con una fuente editorial separada en `src/data/league-laboratory/` (4 campeones: Lucian con valoración real, Kai'Sa/Jinx/Ezreal como placeholders honestos y explícitamente marcados) y 9 componentes nuevos reutilizables en `src/components/laboratory/`. Se extendió el modelo en dos puntos mínimos y justificados: `TierListEntry` pasó a ser una unión discriminada (`reviewed` con `tier` obligatorio / `placeholder` sin `tier`, para que un borrador no pueda reclamar un grado a nivel de tipo) y se añadió `TierList.queue`. Se integró de verdad con el Content Graph reutilizando el bridge ya existente: se añadió `href` a la entidad `champion:lucian` (antes no navegable) y se registraron una entidad `tier-list` y una `patch`, con relaciones que salen únicamente de la propia Tier List — nunca de `creator-project:tidusss` ni `creator-project:live` — para garantizar por construcción que Home y Live quedan intactos.
**Verificación:** `astro check` (109 archivos, 0 errores), `eslint` (sin salida), `build` (genera `/tier-list/index.html` junto a las 2 rutas existentes), comparación byte a byte del HTML de `dist/index.html` y `dist/live/index.html` antes/después (sin cambios), y verificación manual en navegador (filtro por tier, búsqueda, expansión de comentario vía `<details>` nativo, deep link por query params, responsive a 375px, ausencia de contenido invisible sin JavaScript). Durante la verificación se detectó y corrigió un bug real de coincidencia de mayúsculas/minúsculas entre los `data-tier-filter` de los filtros y los `data-tier` de las secciones.
**Consecuencia:** el Content Graph gana su primera integración real de un dominio externo distinto de Riot/YouTube, confirmando que el patrón "dominio rico + puente puro hacia el grafo" (ADR-004) funciona en producción. Quedan sin `ContentEntityKind` propio `rune-page`, `synergy`, `concept` y `meta-state` (decisión pendiente, sin cambios en este trabajo). El patrón Template + Render (§4.6) se reserva explícitamente para datos que llegan por `fetch()` en cliente — la Tier List, al ser contenido estático conocido en build time, se renderiza en servidor sin ese patrón y sin coste de JavaScript para su contenido principal.
**Documentación relacionada:** [`docs/league-laboratory.md`](league-laboratory.md) §12.

### ADR-006 — 2026-07-24 — El registro del League Laboratory pasa de singleton mutable a fábrica pura

**Contexto:** al revisar críticamente ADR-005 antes de construir la segunda herramienta del Laboratorio, se detectó que `labRegistry`/`hydrateLabRegistry` (un objeto mutable a nivel de módulo, "hidratado" por cada página) no tenía ninguna necesidad real de ser mutable — a diferencia del Home State Engine, cuyo estado reacciona a eventos del navegador impredecibles a lo largo de la vida de la página, los datos del Laboratorio son 100% estáticos y conocidos en el mismo bloque de frontmatter que los consulta. El propio `docs/league-laboratory.md` ya documentaba el riesgo: "es seguro hoy porque solo una página lo hidrata."
**Decisión:** sustituir `labRegistry`/`hydrateLabRegistry` por `buildLabRegistry(seed): LabRegistry`, una función pura que construye un registro inmutable por llamada. Todas las funciones de consulta (`getChampionKnowledge`, `getPatchKnowledge`, `getTierList`, `getMatchupsFor`, `getSynergiesFor`, `getMetaTimeline`, `getGuides`, `getLabChampion`, `getPatch`, `getConcept`) pasan a recibir el registro como primer parámetro explícito en vez de leer un singleton implícito. Cada página que consume el Laboratorio construye su propio registro; no hay estado compartido entre páginas en el mismo build.
**Consecuencia:** el riesgo de interferencia entre páginas del Laboratorio en el mismo proceso de build queda eliminado por construcción, no por convención. `/tier-list` se migró a la nueva API sin cambiar su comportamiento observable (build y HTML verificados idénticos). Cualquier herramienta futura del Laboratorio construye su registro de la misma forma explícita.
**Documentación relacionada:** [`docs/league-laboratory.md`](league-laboratory.md) §12.3, §13.

### ADR-007 — 2026-07-24 — Segunda aplicación del League Laboratory: el Explorador de Campeones

**Contexto:** se encargó construir el núcleo del Laboratorio — el campeón como entidad viva de la que cuelgan todas las futuras herramientas — con una página pública por campeón (`/campeones/<slug>`), filosofía editorial (no estadísticas), prohibición explícita de inventar contenido, y la exigencia de auditar y reutilizar antes de crear componentes nuevos.
**Decisión:** `/campeones/[slug].astro` (ruta dinámica con `getStaticPaths()`, una página por cada campeón ya registrado) reutiliza directamente `LabChampion`, `EditorialTake`, `Role` y la mayoría de componentes ya existentes de `/tier-list` (`PatchBadge`, `RoleBadge`, `ConfidenceIndicator`, `TierBadge`, `EmptyLaboratoryState` ampliado con CTA opcional, `LaboratoryMetadata` con `queue` ahora opcional, `LaboratoryHero`). Se detectó que "quién es, por qué jugarlo, cuándo es fuerte, errores frecuentes" es contenido **patch-independiente** (identidad del campeón), mientras que el tier de una Tier List es inherentemente volátil (cambia cada parche) — mezclarlos habría obligado a duplicar la biografía completa en cada futura Tier List. Se resolvió con una extensión mínima: `LabChampion.profile?: ChampionProfile` (resumen, atractivo, `EditorialTake` propio, fortalezas, debilidades, errores frecuentes, power spikes, dificultad), poblado con contenido real solo para Lucian; el resto queda `undefined` y se muestra con un estado vacío honesto ("perfil editorial pendiente de redacción"), nunca como una opinión inventada. Se renombró `TierListEntryReviewStatus` → `EditorialReviewStatus` al comprobar que el mismo concepto (revisado/borrador) se reutiliza ahora fuera del contexto de una Tier List. Siguiendo el patrón ya sentado en ADR-005, `content-graph/league-laboratory-extension.ts` (creado junto con este ADR, ver ADR-006 para el porqué de separarlo de `registry.ts`) registra los 4 campeones como nodos reales del Content Graph, cada uno con su propia página — incluidos los que todavía son un placeholder en la Tier List, porque su existencia como campeón es real aunque su valoración no lo sea todavía. Se añadieron relaciones en ambas direcciones (Tier List → Campeón, ya existente, y Campeón → Tier List, nueva), siempre con `from`/`to` fuera de `creator-project:tidusss`/`creator-project:live`.
**SEO:** se añadió un prop `noindex` opcional a `BaseLayout.astro` (por defecto `false`, sin cambio de comportamiento para ningún consumidor existente) para marcar `noindex, follow` las 3 fichas sin perfil editorial real — evita indexar contenido demasiado fino sin dejar de ser rastreable.
**Diseño:** ambiente propio y deliberadamente más sobrio (`champion`, capas `noise+mist+glow`, sin `grid` ni partículas) en el Environment Engine, ya resuelto automáticamente por `resolveEnvironment('/campeones')`. La identidad "más tranquila" se construye con espaciado y jerarquía tipográfica, no con animación nueva.
**Hallazgo corregido durante la implementación:** `ExploreNext.astro` renderizaba un `<p></p>` vacío cuando ni la relación ni la entidad destino tenían descripción (caso nuevo con los campeones placeholder, que no tienen `signatureNote`). Corregido para omitir el párrafo cuando no hay texto — cambio retrocompatible, verificado que Live (donde todas las relaciones ya tenían descripción) no cambia.
**Consecuencia:** el campeón es ahora, de verdad, el nodo central del ecosistema de League of Legends en tidusss.es — la Tier List y el Explorador de Campeones se enlazan mutuamente mediante relaciones reales, y cualquier herramienta futura (Build Explorer, Matchup Explorer) encontrará ya un perfil de campeón al que conectarse.
**Documentación relacionada:** [`docs/league-laboratory.md`](league-laboratory.md) §13.

### ADR-008 — 2026-07-24 — Separación Catálogo/Editorial: el Explorador de Campeones escala a ~170 campeones

**Contexto:** se encargó rediseñar el Explorador de Campeones para soportar el roster completo de League of Legends (~170 campeones) sin que la arquitectura tuviera que cambiar si Riot añade campeones nuevos. El diseño de ADR-007 (4 campeones, cada uno un `LabChampion` escrito a mano con nombre/título/icono/slug) no superaba esa prueba: escalarlo a 170 habría exigido escribir 170 objetos a mano, y seguir haciéndolo cada vez que Riot ampliara el roster.
**Decisión:** dividir `LabChampion` en dos tipos. `ChampionCatalogEntry` (nuevo) contiene los hechos objetivos y oficiales de Riot — nombre, título verificado, clases, dificultad oficial (1-10), clave de Data Dragon — y se genera automáticamente con un script nuevo, `scripts/sync-champion-catalog.mjs` (sin dependencias nuevas, `fetch` nativo de Node), que consulta Data Dragon y escribe `src/data/league-laboratory/catalog/champions.generated.ts`. `LabChampion` (recortado) queda exclusivamente para la curación editorial de Tidusss (roles seguidos, perfil, notas) y es opcional por campeón — hoy solo 4 lo tienen. `ChampionKnowledge` pasó de asumir siempre un `LabChampion` a `{ catalogEntry, labChampion?, ... }`. Se ejecutó el script de verdad contra Data Dragon (no es un ejercicio teórico): generó **173 campeones**, varios de ellos publicados por Riot después del corte de conocimiento de quien implementó este cambio — la prueba empírica de que la arquitectura no necesita saber nada sobre un campeón concreto para generarle una página correcta y honesta.
**Por qué no se genera en el build:** el build estático de este proyecto nunca ha dependido de la red (ni siquiera para Riot/YouTube/Twitch, resueltos en tiempo de petición vía Functions). Generar el catálogo en cada `astro build` habría roto esa garantía para todo el sitio, incluidos Home y Live, ante cualquier caída puntual de Data Dragon. El script es una herramienta de desarrollo (`npm run sync:champions`) cuyo resultado se commitea como cualquier otro dato.
**Rutas:** se evaluó y se descartó versionar la URL por parche (`/campeones/lucian/16.14`) y construir colecciones por clase (`/campeones/tirador/`) — ninguna estaba justificada todavía; el catálogo ya deja preparados los datos (`tags`) para la segunda si se decide construirla. `getStaticPaths()` pasó a iterar el catálogo completo en vez de los 4 campeones curados; ningún otro archivo de rutas cambió de forma.
**Hallazgo que valida ADR-007:** el título real de Lucian es "El Destello Purificador", no "El Purificador" — la suposición razonable que se decidió NO publicar en ADR-007 por falta de verificación. Confirma que la cautela fue correcta.
**Consecuencia:** `ChampionKnowledge.articles` (ambiguo: mezclaba guías y contenido editorial genérico) se separó en `guides` y `concepts` (estos últimos resueltos mediante una función nueva que recorre guías/matchups/sinergias del campeón). Las imágenes de campeón se desacoplaron del parche de la Tier List (ver ADR-009 para el detalle). Se detectó y eliminó CSS muerto (`.champion-identity-fallback`) al comprobar, durante la autocrítica final, que el catálogo garantiza un icono real para todo campeón y la rama de _fallback_ ya no era alcanzable.
**Documentación relacionada:** [`docs/league-laboratory.md`](league-laboratory.md) §14.

### ADR-009 — 2026-07-24 — El Content Graph no registra el catálogo completo, solo los campeones curados

**Contexto:** al escalar el catálogo a ~170 campeones, era necesario decidir explícitamente si los ~166 sin curación editorial debían registrarse como nodos del Content Graph (cada uno con su página real) o quedar fuera de él.
**Decisión:** mantener la misma política ya aplicada en ADR-007 a menor escala — el Content Graph solo registra campeones con curación editorial real (hoy 4). Un campeón de catálogo sin ninguna relación curada no tiene nada que ofrecer a "sigue explorando" y solo saturaría el grafo sin beneficio de navegación; su página sigue existiendo y siendo perfectamente visitable por URL directa o por el propio Explorador, solo no es un nodo navegable del grafo. `content-graph/league-laboratory-extension.ts` resuelve ahora el `ChampionCatalogEntry` de cada `LabChampion` curado para construir su `ContentEntity`, en lugar de leerlo del propio `LabChampion` (que ya no lleva esos datos).
**Alternativa descartada:** registrar los 170 como `ContentEntity` con `href` real (ya que todos tienen página). Se descartó porque el Content Graph existe para relaciones editoriales curadas, no como índice exhaustivo de rutas — esa función ya la cumple el sitemap. Registrar 170 nodos sin ninguna relación real habría sido ruido, no arquitectura.
**Consecuencia:** el criterio para "¿este campeón es un nodo del grafo?" queda fijado con independencia de la escala del catálogo — sigue siendo "¿tiene curación editorial?", no "¿tiene página?". Cualquier herramienta futura del Laboratorio debe aplicar el mismo criterio al decidir qué registra.
**Documentación relacionada:** [`docs/league-laboratory.md`](league-laboratory.md) §14.6.

### ADR-010 — 2026-07-24 — Blindaje del catálogo: pruebas automatizadas con `node:test` nativo, sin dependencias nuevas

**Contexto:** el catálogo de 173 campeones (ADR-008) y sus URLs públicas (empezando por `/campeones/lucian`, ya indexada) no tenían ninguna prueba automatizada que garantizara su estabilidad — solo verificación manual. Se encargó "blindar" el catálogo con pruebas reales, con la condición explícita de justificar la elección de herramienta contra el `package.json`/versión de Node/TypeScript ya existentes antes de añadir Vitest, Jest o cualquier otro test runner.
**Decisión:** usar `node:test` + `node:assert/strict`, nativos desde hace varias versiones de Node y ya cubiertos por el Node 24 instalado (`engines.node` exige `>=22.12.0`, donde `node:test` lleva siendo estable desde Node 20). Los archivos de dominio (`src/domain/league-laboratory/*.ts`) usan imports relativos sin extensión (`from './types'`) — convención ya establecida en todo el proyecto — que la resolución ESM nativa de Node no acepta tal cual. En vez de reescribir esos imports solo por los tests, se añadió `scripts/testing/register-ts-loader.mjs`: un hook de `module.registerHooks()` (la API síncrona actual, no `module.register()`, marcada `@deprecated` en `@types/node`) que reintenta con `.ts` o `.ts/index.ts` cuando la resolución nativa falla. Los tests importan así los archivos de dominio reales, sin modificarlos y sin transpilación. Se añadió `@types/node` como única dependencia nueva (de desarrollo, sin efecto en runtime ni en el bundle) porque `astro/tsconfigs/strict` no declara un `types` restrictivo y los tests usan tipos de Node (`node:test`, `node:assert/strict`) que sin ese paquete `astro check` no puede resolver.
**Determinismo corregido:** al escribir las pruebas de estabilidad de slugs se detectó que `championCatalogGeneratedAt` (una marca de tiempo `new Date().toISOString()`) no tenía ningún consumidor en el código (confirmado por búsqueda exhaustiva) y rompía la reproducibilidad: dos ejecuciones de `npm run sync:champions` con los mismos datos de origen producían diffs espurios solo por la fecha. Se eliminó por completo — no se sustituyó por un hash ni por otro valor derivado, porque `championCatalogVersion` (la versión de Data Dragon) ya identifica de forma determinista y con significado real qué snapshot de datos representa el archivo. Verificado empíricamente: dos ejecuciones consecutivas del script producen un archivo con el mismo SHA-256.
**Duplicación eliminada:** `scripts/sync-champion-catalog.mjs` tenía su propia copia de `slugify()`, idéntica a la que ya iba a necesitar la búsqueda del Centro de Campeones (ADR-011). Se extrajo una única función pura, `slugifyChampionKey`, a `src/domain/league-laboratory/normalize.ts` (junto con `normalizeSearchText`, ver ADR-011) — el script `.mjs` la importa directamente con extensión `.ts` explícita (no necesita el loader: Node ejecuta `.ts` nativamente con extensión explícita). El generador se refactorizó además para exponer `buildCatalogEntry`/`sortCatalogEntries`/`assertUniqueSlugs` como funciones puras testeables sin red, guardando la llamada real a Data Dragon detrás de una comprobación de "¿es este el módulo de entrada?" para que importarlas en un test no dispare ningún `fetch`.
**Cobertura añadida (47 tests, `test/league-laboratory/*.test.ts`):** normalización de búsqueda (los 8 casos reales exigidos: Kai'Sa, Kog'Maw, Rek'Sai, Cho'Gath, Bel'Veth, Dr. Mundo, Jarvan IV, Miss Fortune) y generación de slugs; unicidad/formato/estabilidad de los 173 slugs reales y el contrato de `/campeones/lucian`; resolución del estado editorial (`resolveChampionEditorialStatus`, ver ADR-011); `getChampionKnowledge` con y sin curación editorial y sobre un registro vacío; la política de no-registro del Content Graph (ADR-009) verificada de forma ejecutable en vez de solo documentada; las relaciones reales de Lucian con la Tier List; y el determinismo del generador sin red.
**Consecuencia:** `npm run test` (nuevo script) corre en local y puede añadirse a CI sin instalar nada adicional. `npm run build` no se modificó para no gatear los despliegues de Cloudflare Pages en este cambio — se deja documentado como recomendación de un paso futuro, no como algo decidido aquí.
**Documentación relacionada:** [`docs/league-laboratory.md`](league-laboratory.md) §15.

### ADR-011 — 2026-07-24 — Centro de Campeones (`/campeones`): el catálogo se convierte en un sistema explorable

**Contexto:** con 173 campeones ya generados (ADR-008) pero sin ningún punto de entrada público que los agrupara, se encargó construir ese punto de entrada — explícitamente no como una parrilla genérica de 173 iconos ni como un clon del champion select de Riot, sino como una herramienta editorial honesta que distinga con claridad entre campeones revisados, en borrador y pendientes, con búsqueda y filtros reales.
**Modelo de estado editorial:** se introdujo `ChampionEditorialStatus = 'reviewed' | 'draft' | 'pending'` (`types.ts`) resuelto por una única función pura, `resolveChampionEditorialStatus(labChampion)` (`registry.ts`): `reviewed` si tiene `profile`, `draft` si tiene `LabChampion` sin `profile`, `pending` si no tiene `LabChampion`. Ningún componente ni plantilla reimplementa este criterio con condicionales propios. Un archivo nuevo, `src/domain/league-laboratory/hub.ts`, añade `getCatalogCoverage` (cuenta real de campeones por estado, nunca escrita a mano), `resolveRiotDifficultyBucket` (agrupa la dificultad oficial 0-10 en baja/media/alta para que el filtro sea usable) e `isChampionInAnyTierList` — siguiendo el mismo patrón que `content-graph/league-laboratory-extension.ts` (ADR-006/009): cada herramienta nueva del Laboratorio amplía su propio archivo, no `registry.ts`.
**Búsqueda y filtros — arquitectura sin dependencias nuevas:** la búsqueda reutiliza `normalizeSearchText` (NFD + `\p{Diacritic}` + strip de apóstrofes/puntos + colapso de espacios) desde un `<script>` de Astro que Vite procesa y empaqueta como cualquier import de cliente — no hay librería de fuzzy-search. Los filtros (estado editorial, clase oficial, dificultad, inicial, presencia en la Tier List oficial) se aplican en el cliente sobre los 173 `<li>` ya renderizados en el HTML, marcados con atributos `data-*`; combinables entre sí (AND), sincronizados con la URL vía `history.replaceState` (nunca `pushState`, para no llenar el historial en cada tecla) y restaurados al cargar la página desde `location.search` — un enlace `/campeones?estado=reviewed&tierlist=1` reproduce exactamente ese estado. Se descartó explícitamente un filtro de "rol editorial": ese dato solo existe para los 4 campeones curados, así que filtrar por rol sobre un catálogo de 173 habría dejado la inmensa mayoría fuera de cualquier selección — un filtro real pero inútil.
**Degradación sin JavaScript:** los 173 campeones se renderizan siempre visibles en el HTML — el `<script>` de filtros nunca oculta contenido por defecto (a diferencia del patrón `[data-reveal]` de Home/Live, deliberadamente no reutilizado aquí). Sin JavaScript, los controles de búsqueda/filtro quedan presentes pero inertes: no rompen nada, simplemente no filtran. El estado "sin resultados" también se renderiza en el HTML con `hidden` estático, y solo el JavaScript lo muestra/oculta según haya coincidencias.
**Content Graph:** se añadió una entidad `tool:champion-hub` (href `/campeones`) en `content-graph/league-laboratory-extension.ts`, con relaciones reales en ambas direcciones hacia la Tier List oficial y hacia cada uno de los 4 campeones curados — respetando ADR-009: los ~169 campeones sin curación no se registran en el grafo. Todas las 173 fichas de campeón llevan además un enlace plano (no una relación de grafo) de vuelta a `/campeones`, igual que ya llevaban uno a `/tier-list` y a `/live`.
**Navegación principal:** se decidió NO añadir `/campeones` al nav principal (`src/data/site.ts`), por el mismo motivo ya aplicado a `/tier-list` en ADR-005 (que tampoco está en el nav pese a ser una página pública desde hace dos fases): el nav principal está curado en torno a las secciones de la portada de una sola página, y el descubrimiento de las herramientas del Laboratorio ocurre por Content Graph ("sigue explorando") y enlaces cruzados, no por el nav. Cambiar ese criterio para `/campeones` sin cambiarlo también para `/tier-list` habría sido inconsistente.
**SEO:** `/campeones` es indexable (no pasa `noindex`, comportamiento por defecto de `BaseLayout`) porque aporta valor real de navegación y contenido único (recuento honesto de cobertura, campeones revisados con extracto editorial). El canónico se calcula solo a partir de `Astro.url.pathname` (ya excluye el query string por construcción, propiedad existente desde antes de este trabajo, no nueva), así que ninguna combinación de filtros en la URL puede generar un canónico duplicado. `public/sitemap.xml` gana una única línea nueva (`/campeones`) — se descartó deliberadamente añadir `@astrojs/sitemap` o generar dinámicamente un listado con las 173 URLs (169 de ellas `noindex`): no aporta valor SEO real y contradice la instrucción explícita de no reescribir el SEO existente por completo.
**Corrección de idioma:** al construir esta página se detectó que "The League Laboratory" (nombre de producto en inglés) seguía apareciendo en texto visible ya publicado — `LaboratoryHero.astro` (valor por defecto), `/tier-list`, `/campeones/[slug]` (título, meta-descripción, eyebrow) y `champion/ChampionHeader.astro` — incumpliendo la instrucción vigente de usar terminología en español en todo texto editorial visible. Se corrigió a "El Laboratorio" en los cinco sitios, incluyendo `patches.ts` (`editorialSummary` de `patch1514`), para que el Centro de Campeones nuevo no introdujera una inconsistencia visible frente a páginas ya publicadas.
**Consecuencia:** el catálogo completo (173 campeones) es ahora explorable desde un único punto de entrada honesto sobre su propio estado de cobertura editorial, sin haber añadido ninguna dependencia, base de datos, CMS ni framework de UI reactivo — vanilla TypeScript filtrando 173 elementos en el cliente es, en la práctica, instantáneo.
**Documentación relacionada:** [`docs/league-laboratory.md`](league-laboratory.md) §15.

---

_Fin del documento. Próxima entrada de ADR: la que corresponda a la siguiente decisión arquitectónica tomada sobre este proyecto._
