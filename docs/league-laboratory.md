# The League Laboratory

> **Naturaleza de este documento:** diseño de dominio **y** registro de sus aplicaciones reales. Las secciones 1-11 describen el sistema (diseñado antes de construir nada). La sección 12 documenta **Phase 1 — The Official Tidusss ADC Tier List**. La sección 13 documenta **Phase 2 — Explorador de Campeones**, que además corrige una decisión de Phase 1 (el registro pasa de singleton mutable a fábrica pura — ver §13.3).
> **Estado actual:** existen ya **dos rutas públicas reales**: `/tier-list` y `/campeones/[slug]` (una página por campeón: `lucian`, `kaisa`, `jinx`, `ezreal`). El campeón es ahora el nodo central del ecosistema del Laboratorio. El resto de herramientas (Build Explorer, Rune Explorer, Matchup Explorer…) siguen sin implementar.
> **Relación con el resto de la documentación:** este dominio es un **consumidor** del [Content Graph](content-graph.md) (lo extiende, no lo sustituye) y aparece como capítulo III en el roadmap de [`PLATFORM_BIBLE.md`](PLATFORM_BIBLE.md). No duplica nada de `docs/content-graph.md`, `docs/home-state-engine.md` ni `docs/environment-engine.md`.

---

## Índice

1. [Objetivos](#1-objetivos)
2. [Filosofía](#2-filosofía)
3. [Arquitectura](#3-arquitectura)
4. [Dominio y entidades](#4-dominio-y-entidades)
5. [Relaciones](#5-relaciones)
6. [Integración con el Content Graph](#6-integración-con-el-content-graph)
7. [Sistema de UI (especificación, no implementación)](#7-sistema-de-ui-especificación-no-implementación)
8. [Roadmap interno](#8-roadmap-interno)
9. [Herramientas futuras](#9-herramientas-futuras)
10. [Riesgos](#10-riesgos)
11. [Estado real de implementación (dominio)](#11-estado-real-de-implementación-dominio)
12. [Phase 1 — The Official Tidusss ADC Tier List](#12-phase-1--the-official-tidusss-adc-tier-list)
13. [Phase 2 — Explorador de Campeones](#13-phase-2--explorador-de-campeones)

---

## 1. Objetivos

- Dar a **League Knowledge** —todo el conocimiento de League of Legends que Tidusss quiere transmitir: tier lists, builds, runas, matchups, sinergias, conceptos, guías, lectura de meta— una **arquitectura única y compartida**, en vez de que cada herramienta futura (Tier List, Build Explorer, Rune Explorer…) reinvente sus propios tipos, su propia caché y sus propias tarjetas.
- Que la **primera herramienta real** (una Tier List) sea, literalmente, la primera aplicación de esta arquitectura — no un prototipo que luego haya que rehacer para que las siguientes nueve encajen.
- Que el laboratorio se integre con el Content Graph existente (§6) exactamente con el mismo patrón que ya usan Riot/YouTube (`domain/content-graph/adapters.ts`): un dominio rico y específico, proyectado hacia el grafo genérico mediante funciones puras de conversión.
- Que **el criterio de Tidusss sea un dato de primera clase**, no una nota a pie de página. Esto se resuelve estructuralmente en el modelo, no en el copy (§2, §4.2).

**Nombre del dominio vs. nombre de producto:** *League Knowledge* es el nombre conceptual de este dominio de producto (lo que se sabe y se opina). *The League Laboratory* es su identidad de marca de cara al usuario (dónde vive ese conocimiento). En el código, el módulo se llama `league-laboratory` porque es el nombre que va a aparecer en rutas, navegación y en este mismo documento — son la misma cosa vista desde dos ángulos, no dos sistemas distintos.

## 2. Filosofía

OP.GG, U.GG y Mobalytics comparten un mismo modelo mental: **estadísticas agregadas de millones de partidas, presentadas sin autor**. Son correctos, exhaustivos y anónimos. El Laboratorio parte de la premisa contraria:

- **No competimos en volumen de datos.** No vamos a tener más partidas analizadas que OP.GG. No lo intentamos.
- **Competimos en criterio.** Cada pieza de conocimiento del Laboratorio lleva la firma de una lectura: por qué esta build, por qué este matchup es difícil, por qué este campeón sube en el tier list este parche. Esto está resuelto estructuralmente: **`EditorialTake` es un campo obligatorio** en Build, RunePage, Matchup, Synergy y en cada entrada de una Tier List (§4.2) — no es un campo de texto libre opcional que alguien pueda saltarse.
- **Mostramos relaciones, no tablas sueltas.** Un campeón no es una fila de una tabla: es un nodo conectado a sus builds, sus matchups, sus guías, sus vídeos y sus partidas reales. Esto es exactamente el patrón que el Content Graph ya demostró en Home/Live (§6).
- **Cuando no sabemos algo, lo decimos.** Igual que `RiotOverview` nunca inventa un LP delta sin snapshot previo, el Laboratorio nunca debe rellenar un veredicto vacío con una frase genérica. `EditorialTake.confidence` existe precisamente para poder decir "esto es una intuición temprana" en vez de fingir certeza.

## 3. Arquitectura

### 3.1 Ubicación en el árbol de dominio existente

```
src/domain/
├── content-graph/       (existente, sin cambios)
├── home-state/          (existente, sin cambios)
└── league-laboratory/   (nuevo)
    ├── index.ts                  barrel — export * / export type *
    ├── types.ts                  entidades, IDs, vocabularios controlados
    ├── scope.ts                  KnowledgeScope + utilidades de Patch (puras)
    ├── registry.ts               colecciones tipadas (vacías) + funciones de consulta
    └── content-graph-bridge.ts   adaptadores Entidad de Lab → ContentEntity/ContentRelation
```

Sigue exactamente la misma forma que `domain/content-graph/` y `domain/home-state/`: cero dependencias de Astro, DOM o `fetch`; un barrel que re-exporta la superficie pública; tipos separados de la lógica de consulta.

### 3.2 Principio rector: un contrato, diez herramientas

Ninguna de las diez herramientas listadas en el encargo (Tier List, Build Explorer, Rune Explorer, Champion Explorer, Patch Explorer, Matchup Explorer, Synergy Explorer, Guides, Concept Library, Meta Timeline) introduce un tipo de dato nuevo. Todas son **vistas distintas sobre las mismas diez entidades** (§4):

| Herramienta | Entidad(es) que consume |
| --- | --- |
| Tier List | `TierList` (+ `Build`, `RunePage` referenciados por entrada) |
| Build Explorer | `Build` |
| Rune Explorer | `RunePage` |
| Champion Explorer | `LabChampion` (+ agregación vía `getChampionKnowledge`) |
| Patch Explorer | `Patch` (+ agregación vía `getPatchKnowledge`) |
| Matchup Explorer | `Matchup` |
| Synergy Explorer | `Synergy` |
| Guides | `KnowledgeArticle` con `format: 'guide'` |
| Concept Library | `Concept` |
| Meta Timeline | `MetaState`, ordenado por `Patch.sequence` |
| Draft Knowledge *(futura)* | composición de `MetaState` + `Matchup` + `Synergy` + `TierList`, sin entidad propia todavía (§9) |

Esto es lo que hace innecesario "construir todas las herramientas": construir bien las diez entidades y las funciones de consulta (`registry.ts`) ya deja preparadas las diez vistas.

### 3.3 Capas y flujo

```
functions/api/**  (futuro, no implementado)
        │  cuando exista un endpoint que sirva datos del Lab, seguirá el mismo
        │  patrón que /api/riot/overview: lee secretos si los hay, orquesta,
        │  normaliza errores → { ok, data | error }.
        ▼
src/domain/league-laboratory/registry.ts
        │  hoy: colecciones vacías + funciones de consulta puras
        │  mañana: se rellenan con datos editoriales reales (probablemente
        │  desde src/data/league-laboratory/*.ts, igual que data/content.ts)
        ▼
src/domain/league-laboratory/content-graph-bridge.ts
        │  proyecta LabChampion/Build/Guide/Matchup/TierList/Patch → ContentEntity
        │  (solo cuando se registren datos reales; hoy no se invoca desde
        │  ningún sitio en producción)
        ▼
src/domain/content-graph/  (existente, sin modificar)
```

## 4. Dominio y entidades

Se han diseñado **10 entidades**, no las 15 sugeridas en el encargo. Cada colapso está justificado explícitamente — es el resultado de aplicar la misma disciplina que ya rige el resto del proyecto ("no inventar lo que no hace falta").

### 4.1 Por qué 10 y no 15

| Sugerido en el encargo | Decisión | Justificación |
| --- | --- | --- |
| `Lane` | **Fusionado en `Role`** | Riot ya expone una única cadena de posición (`TOP`/`JUNGLE`/`MIDDLE`/`BOTTOM`/`UTILITY`) que el proyecto **ya usa** en `lib/riot/types.ts` (`RecentMatch.position`) y en `LiveDashboard.astro` (`positionLabel`). Crear un segundo vocabulario "Lane" distinto de "Role" solo introduciría dos formas de decir lo mismo y el riesgo de que se desincronizaran. `Role` en el Laboratorio usa exactamente los mismos cinco valores. |
| `PatchNote` | **Fusionado en `Patch`** | No vamos a re-alojar el changelog completo de Riot (eso ya existe en la web oficial de Riot; duplicarlo violaría el principio ya escrito en `docs/content-graph.md` de "no duplicar datos de proveedores"). Lo que sí aporta valor es la lectura editorial de qué cambió y por qué importa — eso es `Patch.editorialSummary`, un campo, no una entidad aparte. |
| `Opinion` | **Convertido en value object `EditorialTake`** | Una opinión nunca existe de forma aislada: siempre es una opinión *sobre* un Build, un Matchup, una entrada de Tier List. Modelarla como entidad independiente con su propio ID habría obligado a toda consulta a hacer un salto extra (`Build → Opinion`) sin ganar nada. Como value object embebido, es más simple de consultar y, sobre todo, se puede hacer **obligatorio** en los campos que more importan (Build, RunePage, Matchup, Synergy, entrada de TierList) — eso es lo que convierte "mostrar criterio" en una regla estructural, no en una promesa de estilo. |
| `Guide` | **Especialización de `KnowledgeArticle`**, no entidad separada | Un Guide es, estructuralmente, un `KnowledgeArticle` cuyo `scope.championId` y `scope.role` son obligatorios en vez de opcionales. En vez de duplicar campos (título, conceptos relacionados, estado de publicación) en dos interfaces distintas, `Guide` es un tipo TypeScript refinado (`KnowledgeArticle & { format: 'guide'; scope: { championId; role } }`). Esto es coherente con que `'guide'` ya es un `ContentEntityKind` reservado — no se necesita una segunda entidad de dominio para lo mismo. |
| `KnowledgeArticle` | **Se mantiene**, como entidad base de todo el contenido editorial largo (guías, análisis, editoriales, explicaciones de concepto) | Es el contenedor genérico; `Guide` es su caso más restringido. |

El resto (`Champion`, `Patch`, `Build`, `RunePage`, `Matchup`, `Synergy`, `Concept`, `TierList`, `MetaState`) se mantienen como entidades propias porque cada una tiene una identidad, un ciclo de vida y una forma de consulta distintos — fusionar cualquiera de ellas habría obligado a modelar un campo condicional ("si es de tipo X entonces...") en vez de un tipo propio, que es justo el tipo de complejidad que se quiere evitar.

### 4.2 Las 10 entidades

Definidas en [`src/domain/league-laboratory/types.ts`](../src/domain/league-laboratory/types.ts).

- **`LabChampion`** — el conocimiento editorial sobre un campeón: en qué roles se considera viable, si es un campeón "señal" de Tidusss (como Lucian hoy), etiquetas de estilo de juego, nota de autor y, desde Phase 2 (§13), un `profile?: ChampionProfile` opcional con la identidad editorial completa (resumen, atractivo, veredicto propio, fortalezas, debilidades, errores frecuentes, power spikes, dificultad) — deliberadamente separado de `TierListEntry` porque es contenido patch-independiente, no una valoración de este parche. **No duplica** nombre/imagen/estadísticas base — eso ya lo sirve Data Dragon (`lib/riot/datadragon.ts`) y se seguirá pidiendo ahí cuando haya UI.
- **`Patch`** — el ancla temporal de todo el dominio. Casi ninguna pieza de conocimiento de League es válida "para siempre"; casi todo es "válido en este parche". `sequence: number` es un entero asignado a mano y creciente (no se intenta parsear "14.15" como número, porque el formato de versión de Riot no es un número decimal fiable para ordenar — evita un bug clásico de comparar "14.9" > "14.10" como texto). `dataDragonVersion` opcional conecta con la versión real de Data Dragon cuando se necesiten assets (iconos de campeón/objeto) consistentes con el resto del sitio.
- **`Build`** — una recomendación de objetos/hechizos/habilidades para un campeón en un rol, en un parche. Los IDs de objeto (`startingItemIds`, `coreItemIds`, `situationalItemIds`) son `number`, el mismo tipo que ya usa `RecentMatch.items` en `lib/riot/types.ts` — se resuelven con el mismo `dataDragonUrls().item()` que ya existe, sin inventar una segunda tabla de assets.
- **`RunePage`** — igual que Build pero para runas. `primaryTreeId`/`secondaryTreeId` son los mismos IDs numéricos de árbol (8000/8100/8200/8300/8400) que ya usa `runeStyles` en `lib/riot/normalize.ts`.
- **`Matchup`** — la relación campeón↔campeón en un mismo rol: quién está favorecido, dificultad, notas por fase (early/mid/late), con `EditorialTake` obligatorio.
- **`Synergy`** — la relación entre dos o más campeones (dupla de línea, combo de team comp), con un `type` controlado (`lane-duo`, `team-comp`, `engage-combo`, `peel-combo`).
- **`Concept`** — la unidad atómica de enseñanza (p. ej. "gestión de oleada", "trading stance", "visión ofensiva"). Se referencia desde Guides, Matchups y Synergies en vez de repetir la explicación en cada sitio — es literalmente la aplicación del principio "relaciones, no texto duplicado".
- **`KnowledgeArticle`** (con `Guide` como refinamiento) — el contenido largo: guías, análisis de meta, explicaciones de concepto.
- **`TierList`** — un ranking de campeones por rol y parche, cada entrada con grado (`TierGrade`), `EditorialTake` obligatorio, tendencia opcional (`rising`/`falling`/`stable`) y enlaces opcionales a la Build/RunePage recomendadas para esa entrada.
- **`MetaState`** — la fotografía editorial de "qué manda ahora mismo" en un parche: campeones en alza/baja, resumen, artículos relacionados. Alimenta Meta Timeline (ordenando por `Patch.sequence`) y, más adelante, Draft Knowledge.

### 4.3 El value object que conecta todo: `EditorialTake`

```ts
interface EditorialTake {
  verdict: string;        // la conclusión, en una frase
  reasoning: string;      // el porqué
  confidence: 'low' | 'medium' | 'high';
  lastReviewedPatch?: PatchId;
}
```

Aparece embebido en `Build`, `RunePage`, `Matchup`, `Synergy` y en cada `TierListEntry`. Es, estructuralmente, la diferencia entre el Laboratorio y una tabla de estadísticas: **no existe una Build sin veredicto**, porque el campo no es opcional.

### 4.4 El value object de filtrado: `KnowledgeScope`

```ts
interface KnowledgeScope {
  championId?: LabChampionId;
  role?: Role;
  patchId?: PatchId;
}
```

Usado por `KnowledgeArticle.scope` y por las utilidades de `scope.ts` (`scopeMatchesChampion`, `scopeMatchesRole`, `scopeMatchesPatch`). Es el mismo campo que alimentará el filtro compartido de la UI (§7) — el filtro no es un concepto de interfaz suelto, es una proyección directa de este tipo.

## 5. Relaciones

El encargo proponía esta cadena:

> Champion → Builds → Guides → Videos → Matches → Tier Lists → Concepts → Patch → Runes

Es una intuición correcta sobre qué está conectado, pero como cadena lineal no refleja cómo se consulta el dominio en la práctica (una Tier List no "está debajo" de una Guide; ambas cuelgan de un Champion y un Patch de forma independiente). El grafo real, tal como está modelado en `types.ts` y resuelto en `registry.ts`, es:

```
                         ┌───────────┐
                         │   Patch   │◄──────────────────────────┐
                         └─────┬─────┘                           │
              ┌────────────────┼────────────────┬────────────────┤
              ▼                ▼                ▼                ▼
        ┌───────────┐    ┌───────────┐    ┌───────────┐   ┌────────────┐
        │ TierList  │    │  Build /  │    │ MetaState │   │  Matchup / │
        │ (por rol) │    │ RunePage  │    │           │   │  Synergy   │
        └─────┬─────┘    └─────┬─────┘    └─────┬─────┘   └──────┬─────┘
              │                │                │                │
              └────────┬───────┴───────┬────────┘                │
                        ▼               ▼                        │
                  ┌───────────┐   ┌──────────────┐                │
                  │ LabChampion│◄─┤ KnowledgeArticle             │
                  └─────┬──────┘   │ (Guide cuando               │
                        │          │  scope.championId+role)     │
                        │          └──────┬───────────────────────┘
                        │                 ▼
                        │           ┌───────────┐
                        └──────────►│  Concept  │◄── referenciado también
                                    └───────────┘     desde Matchup/Synergy

  LabChampion, además, se conecta (fuera de este dominio, vía adaptadores
  ya existentes en domain/content-graph/adapters.ts) con:
    Video (YouTube)  ──published-on──►  Channel
    Match (Riot)     ──played-with──►  Champion   (ya existe hoy)
```

**Lectura de las relaciones clave** (todas expresadas como *foreign keys* tipados dentro de cada entidad, no como una lista de aristas genérica — ver §5.1 para el porqué):

- `Build.championId`, `Build.role`, `Build.patchId` → una build siempre sabe de qué campeón/rol/parche habla.
- `Build.runePageId` (opcional) → una build puede recomendar una página de runas concreta sin duplicar sus datos.
- `TierListEntry.buildId` / `TierListEntry.runePageId` (opcionales) → una entrada de tier list puede señalar directamente la build recomendada para ese campeón ese parche.
- `Matchup.championId` / `Matchup.opponentChampionId` / `Matchup.role` → el matchup es simétrico en los datos pero direccional en la narrativa (siempre se lee "cómo juega Tidusss `championId` contra `opponentChampionId`").
- `Synergy.championIds` (2 o más) → cubre tanto dúos de línea como combos de equipo con el mismo tipo.
- `KnowledgeArticle.relatedConceptIds` / `relatedChampionIds` → un artículo enlaza los conceptos y campeones que toca, sin que el Concept o el Champion tengan que "saber" qué artículos los mencionan (se resuelve en consulta, vía `getChampionKnowledge`).
- `MetaState.patchId` + `Patch.sequence` → permite construir el Meta Timeline con un simple `sort`, sin fecha de calendario obligatoria.

### 5.1 Por qué *foreign keys* tipados y no una lista de aristas genérica (a diferencia del Content Graph)

El Content Graph usa una lista plana de `ContentRelation { from, to, kind, label, priority }` porque su propósito es **navegación editorial laxa** ("quizá también quieras ver…"), donde cualquier par de entidades puede conectarse con cualquier verbo. El Laboratorio necesita **consultas estructurales precisas** ("dame todos los matchups de Lucian en ADC", "dame la tier list de soporte del parche 14.15") — eso se resuelve mejor con campos tipados directos (`matchup.role`, `tierList.patchId`) que se pueden filtrar con `Array.prototype.filter` sin tener que interpretar un `kind` de relación genérico. Son dos modelos de relación distintos a propósito, para dos propósitos distintos — y se conectan entre sí mediante el puente del §6, no compartiendo un único esquema.

## 6. Integración con el Content Graph

`src/domain/league-laboratory/content-graph-bridge.ts` contiene funciones puras que convierten entidades del Laboratorio en `ContentEntity`/`ContentRelation` del Content Graph — el mismo patrón exacto que ya usa `domain/content-graph/adapters.ts` para convertir un `RecentMatch` de Riot o un `YouTubeVideo` en una entidad navegable.

| Entidad del Lab | `ContentEntityKind` reutilizado | ¿Ya reservado en `content-graph/types.ts`? |
| --- | --- | --- |
| `LabChampion` | `champion` | Sí |
| `Patch` | `patch` | Sí |
| `Build` | `build` | Sí |
| `Guide` (`KnowledgeArticle` con `format: 'guide'`) | `guide` | Sí |
| `Matchup` | `matchup` | Sí |
| `TierList` | `tier-list` | Sí |
| `RunePage` | — | **No** |
| `Synergy` | — | **No** |
| `Concept` | — | **No** |
| `MetaState` | — | **No** |

Seis de las diez entidades bridgean hoy sin ningún cambio en `domain/content-graph/`, porque `ContentEntityKind` ya reservaba `build`, `champion`, `guide`, `matchup`, `patch` y `tier-list` desde la auditoría original (ver ADR-003 en `PLATFORM_BIBLE.md`). Las cuatro restantes (`RunePage`, `Synergy`, `Concept`, `MetaState`) **no tienen todavía un `ContentEntityKind` propio** — no se ha modificado `content-graph/types.ts` en este trabajo (el encargo pedía no tocar código existente), así que quedan documentadas como huecos a decidir antes de construir sus respectivos exploradores:

- **Opción A:** extender `ContentEntityKind` con `'rune-page' | 'synergy' | 'concept' | 'meta-state'` cuando llegue el momento (requiere una ADR propia, es un cambio a un archivo compartido).
- **Opción B:** no proyectarlas al Content Graph en absoluto — quedan como conocimiento interno del Laboratorio, consultable solo a través de `registry.ts`, sin aparecer en `ExploreNext`.

Esta decisión **no se toma en este documento** — se dejará para cuando exista contenido real de esos tipos y se sepa si de verdad aporta valor de navegación cruzada.

**Importante:** las funciones del bridge son conversiones puras (`Entidad → ContentEntity`), no efectos. **No se ha modificado `domain/content-graph/registry.ts`** ni se ha registrado ninguna entidad real del Laboratorio en el grafo — hoy no hay datos que registrar. Cuando exista el primer dato real (la primera Tier List publicada), el paso de integración será: llamar a estas funciones y añadir su resultado a `contentGraph.entities`/`relations`, probablemente mediante una función de composición nueva (`registerLabEntities(graph)`) que aún no existe.

## 7. Sistema de UI (especificación, no implementación)

No se ha creado ningún archivo `.astro` para el Laboratorio. Lo que sigue es la especificación que debe respetar la primera implementación (Tier List) y todas las siguientes.

### 7.1 Layout general

Una superficie propia (ruta futura, p. ej. `/laboratory`), construida sobre el `BaseLayout.astro` existente (sin modificarlo hoy). Tres franjas:

1. **Cabecera del Laboratorio** — igual patrón que `SectionHeading.astro` (eyebrow + título + descripción), pero fija en la parte superior de cualquier herramienta, no solo en la home.
2. **Barra de alcance (`ScopeFilterBar`)** — selector de Patch + Role compartido por todas las herramientas, porque casi todas las entidades tienen `KnowledgeScope`. Se implementa una vez, la usan las diez herramientas.
3. **Área de contenido** — la vista específica de la herramienta (grid de tarjetas, lista, timeline).

**Ambiente visual:** se recomienda un único `EnvironmentId` de marca (`'laboratory'`, a añadir a `data/environments.ts` cuando se implemente la primera herramienta) compartido por *todas* las herramientas del Laboratorio, en vez de un ambiente distinto por herramienta. El `'tier-list'` ya reservado en el Environment Engine puede mantenerse como alias del mismo ambiente o retirarse en favor de uno solo — es una decisión de implementación, no de este documento, pero la recomendación de producto es **una sola atmósfera para todo el Laboratorio**, para que se sienta como un espacio propio y coherente (justo lo contrario de la sensación de "spreadsheet" de OP.GG/U.GG).

### 7.2 Navegación

- Entrada principal (futura, no implementada hoy): un ítem en `data/site.ts#navigation` apuntando a `/laboratory`.
- Navegación secundaria *dentro* del Laboratorio: pestañas o barra lateral con las herramientas activas (inicialmente solo "Tier List"; el resto aparecen a medida que se construyen — nunca se muestra un enlace a una herramienta que no existe todavía, coherente con la regla del Content Graph de no publicar entidades `planned` navegables).

### 7.3 Componentes reutilizables (contratos, no implementación visual)

- **`KnowledgeCard`** — la tarjeta base para Champion/Build/Matchup/Concept/Guide/entrada de Tier List. Se recomienda el mismo patrón **Template + Render** que ya usa el Match History (`live/matches/render.ts`): un `<template>` compuesto por subcomponentes de marcado puro, rellenado por una función de render compartida — cero coste de hidratación, ya validado en producción.
- **`ScopeFilterBar`** — un único componente de filtro (Patch + Role) reutilizado por toda herramienta que consuma `KnowledgeScope`.
- **`EditorialTakeBadge`** — el átomo visual que muestra `verdict` + `confidence` de forma consistente en cualquier tarjeta. Es, visualmente, la firma que diferencia al Laboratorio de un sitio de estadísticas — debe aparecer en *toda* tarjeta que tenga un `EditorialTake`, nunca ser opcional a nivel de diseño aunque el campo de dominio sea, en algunos value objects, opcional.
- **`SearchBox`** — filtrado en cliente sobre lo ya cargado (título, tags, nombre de campeón). Sin backend de búsqueda, sin dependencia nueva — coherente con el principio de rendimiento de la Bible (§8: "ninguna dependencia nueva por comodidad").

### 7.4 Jerarquía visual

Título de la pieza de conocimiento primero; contexto (`KnowledgeScope`: campeón · rol · parche) inmediatamente debajo, en un formato consistente (ya resuelto por `describeScope()` en `scope.ts`); `EditorialTakeBadge` siempre visible, nunca escondido tras un clic; datos estructurados (objetos, runas, stats) al final, como apoyo del criterio, no como protagonista.

### 7.5 Sistema de tarjetas y filtros

El contrato de una tarjeta (qué campos necesita cualquier `KnowledgeCard`) se deriva directamente de los tipos ya definidos: `title`, `scope: KnowledgeScope`, `editorialTake?: EditorialTake`, `href` (cuando exista ruta). Los filtros disponibles en cualquier herramienta son, literalmente, los campos de `KnowledgeScope` más `TierGrade` y `ArticleFormat` donde aplique — no se inventan filtros nuevos por herramienta.

## 8. Roadmap interno

1. **Dominio (hecho).** Tipos, contratos, registro vacío, puente al Content Graph, documentación.
2. **Primera herramienta: Tier List (hecha — Phase 1, §12).** Implementada en `/tier-list`: `LaboratoryMetadata`, `ChampionIdentity`, `EditorialTakeCard`, `ConfidenceIndicator`, `TierBadge`, filtros y búsqueda. No usó Template + Render (contenido estático, ver §12.5) — ese patrón queda reservado para cuando una herramienta del Laboratorio consuma datos por `fetch()` en cliente.
3. **Build Explorer + Rune Explorer.** Reutilizan `KnowledgeCard`/`ScopeFilterBar` ya construidos; añaden el primer uso real de `Build.runePageId` cruzado.
4. **Champion Explorer.** Primera vista que usa `getChampionKnowledge()` en serio (agregación entre Build, RunePage, Matchup, Synergy, Guide, apariciones en Tier List).
5. **Matchup Explorer + Synergy Explorer.** Requieren tener ya varios campeones con conocimiento cargado para que las relaciones tengan sentido.
6. **Guides + Concept Library.** El contenido largo; depende de que ya existan Concepts suficientes para enlazar.
7. **Patch Explorer + Meta Timeline.** Vistas agregadas por parche; se benefician de tener ya Tier Lists y MetaStates de más de un parche.
8. **Draft Knowledge y siguientes (§9).**

## 9. Herramientas futuras

- **Draft Knowledge** — composición de `MetaState` + `Matchup` + `Synergy` + `TierList` para responder "qué priorizar en draft este parche". No requiere entidad propia con los datos actuales; si crece (p. ej. secuencias de ban/pick recomendadas), sería candidata a una entidad `DraftNote` nueva — no se crea ahora por no tener todavía un caso de uso concreto que la justifique.
- **Comparador de campeones** — vista sobre `LabChampion` + `getChampionKnowledge()` para dos o más campeones a la vez; no requiere entidad nueva.
- **Historial de tier lists por campeón** (evolución de tier a través de parches) — consulta pura sobre `TierList`/`TierListEntry` ya existentes, ordenando por `Patch.sequence`.
- **Vínculo Matchup ↔ Match real** — cuando un `Matchup` documentado coincida con una partida real jugada (vía `RecentMatch` de Riot), enlazarlos como evidencia. Requeriría un campo opcional `verifiedMatchIds?: string[]` en `Matchup` — no añadido todavía por no tener un caso de uso confirmado.
- **Extensión del Content Graph** con `rune-page`, `synergy`, `concept`, `meta-state` como `ContentEntityKind` propios, si se decide que merecen navegación cruzada pública (§6).

## 10. Riesgos

1. **Que el Laboratorio empiece a "inventar" veredictos para rellenar huecos.** El value object `EditorialTake` hace el campo estructuralmente presente, pero no impide que, bajo presión de lanzar contenido, se rellene con frases vacías ("es buena build") en vez de razonamiento real. Es un riesgo editorial, no técnico — el tipo no puede validar la calidad de `reasoning`.
2. **Que `Guide` y `KnowledgeArticle` genérico se confundan en la práctica** si no se documenta con claridad en el futuro componente de autoría cuál es cuál — mitigado hoy por el `format` discriminante y por este mismo documento.
3. **Deriva de vocabulario `Role`** si en algún momento se edita `positionLabel` en `LiveDashboard.astro` sin actualizar el `Role` del Laboratorio (o viceversa) — ambos hoy son listas independientes que **coinciden por convención**, no por un tipo compartido importado. Recomendación futura (no ejecutada ahora, para no tocar `LiveDashboard.astro`): extraer un `Role`/`positionLabel` común a `src/lib` o `src/domain` que ambos sistemas importen.
4. **Que el bridge hacia el Content Graph se implemente registrando entidades `planned`** en el grafo por error, violando la regla ya escrita en `docs/content-graph.md` de no publicar entidades no disponibles como navegables. Las funciones del bridge respetan `status: 'available' | 'planned'` correctamente según el campo de origen (`guide.status`, `tierList.status`), pero quien las invoque en el futuro debe seguir respetando `getContentConnections({ navigableOnly: true })` como filtro final.
5. **Sitemap manual.** Igual que ya advertía `PLATFORM_BIBLE.md` §9: cuando exista la primera ruta pública del Laboratorio, hay que añadirla a mano a `public/sitemap.xml` — no hay generación automática.
6. **Cuatro `ContentEntityKind` pendientes de decidir** (`rune-page`, `synergy`, `concept`, `meta-state`) — si se construyen sus exploradores antes de resolver esta decisión, existe el riesgo de bridging ad-hoc inconsistente entre herramientas.

## 11. Estado real de implementación (dominio)

| Elemento | Estado |
| --- | --- |
| `src/domain/league-laboratory/types.ts` | ✅ Creado (extendido en Phase 1, ver §12.2) |
| `src/domain/league-laboratory/scope.ts` | ✅ Creado (extendido en Phase 1: `roleLabel`, `queueLabel`) |
| `src/domain/league-laboratory/registry.ts` | ✅ Creado (extendido en Phase 1: `hydrateLabRegistry`) |
| `src/domain/league-laboratory/content-graph-bridge.ts` | ✅ Creado — **ahora invocado en producción** desde `domain/content-graph/registry.ts` (Phase 1, §12.4) |
| `src/domain/league-laboratory/index.ts` | ✅ Creado (barrel) |
| Datos reales (campeones, parches, tier list) | ✅ Parcial desde Phase 1 — ver §12.3 (solo la Tier List ADC; Build/RunePage/Matchup/Synergy/Concept/KnowledgeArticle/MetaState siguen vacíos) |
| Rutas públicas | ✅ `/tier-list` (Phase 1). `/laboratory` como hub todavía no existe |
| Componentes visuales | ✅ Parcial — ver §12.5 (los de la Tier List). Build Explorer, Rune Explorer, etc. siguen sin construir |
| Endpoints/Functions | ❌ No existen — la Tier List es contenido 100% estático, sin API propia |
| Cambios en Home, Live, Match History o cualquier API existente | ❌ Ninguno, verificado (§12.4, §12.9) |

## 12. Phase 1 — The Official Tidusss ADC Tier List

Primera aplicación pública real construida sobre el dominio descrito en §1-11. Esta sección documenta qué se construyó, qué se extendió del modelo y por qué, y qué límites tiene deliberadamente esta V1.

### 12.1 Objetivo y alcance

Ruta pública: **`/tier-list`** (`src/pages/tier-list.astro`), tal y como se pidió explícitamente. `docs/content-graph.md` había anticipado un patrón `src/pages/tier-list/[slug].astro` para cuando existan **varias** tier lists públicas; esta V1 excluye explícitamente esa funcionalidad (una sola tier list, sin comparador entre parches), así que una ruta estática plana es la implementación correcta para el alcance actual — no es una desviación, es la misma convención que ya usa `src/pages/live.astro`. Cuando exista una segunda tier list pública real, migrar a `[slug].astro` será el momento de revisar esta decisión, no antes.

La página se integra visualmente como una sección más de tidusss.es: usa `BaseLayout`, `Navbar` y `Footer` sin modificarlos, y el Environment Engine resuelve automáticamente el ambiente `'tier-list'` para `/tier-list` — **ya estaba preparado** (`resolveEnvironment` en `data/environments.ts` incluía `if (pathname.startsWith('/tier-list')) return 'tier-list';` desde antes de este trabajo), así que no ha hecho falta tocar el Environment Engine en absoluto.

### 12.2 Extensión mínima del modelo (justificada)

Al diseñar el contenido real se detectaron dos límites genuinos del modelo original que impedían representar la V1 con honestidad. Ambos se resolvieron como extensión mínima, no como campos de presentación:

1. **`TierListEntry` no distinguía "revisado" de "placeholder".** El encargo exige que el sistema pueda mostrar campeones con una valoración real (Lucian) junto a campeones sin revisar todavía, sin que estos últimos aparenten ser una opinión definitiva de Tidusss. El modelo original obligaba a todo `TierListEntry` a llevar un `tier: TierGrade` — es decir, un placeholder se vería forzado a reclamar un grado de tier inventado. Se convirtió `TierListEntry` en una unión discriminada:

   ```ts
   type TierListEntry = ReviewedTierListEntry | PlaceholderTierListEntry;
   // ReviewedTierListEntry: reviewStatus: 'reviewed'; tier: TierGrade; trend?; ...
   // PlaceholderTierListEntry: reviewStatus: 'placeholder'; (sin tier, sin trend)
   ```

   Un placeholder **no puede** llevar `tier` a nivel de tipo — no es una convención de UI, el compilador lo impide. Es la misma disciplina que ya aplica `RiotOverview.state: 'no-recent-matches'` en vez de forzar un `0%` cuando no hay datos.

2. **Faltaba un dato real y explícito de "fortalezas/debilidades" y "cola competitiva".** Se añadieron `strengths?`/`weaknesses?` a la base de `TierListEntry` y `queue: CompetitiveQueue` (`'solo-duo' | 'flex' | 'aram' | 'normal'`) a `TierList` — ambos exigidos directamente por los requisitos de producto de esta fase (fortalezas/debilidades, "cola o contexto competitivo"), y ambos son hechos de dominio, no de presentación.

Extensión adicional menor: `LabChampion.dataDragonKey?: string` — la clave interna de Data Dragon (p. ej. `"Kaisa"`), necesaria para resolver el icono real del campeón reutilizando `lib/riot/datadragon.ts` sin duplicar una segunda tabla de assets.

### 12.3 Fuente editorial (separada del dominio y de la presentación)

`src/data/league-laboratory/` (nuevo, análogo a `src/data/content.ts` para Home):

- `champions.ts` — 4 `LabChampion`: **Lucian** (real) y **Kai'Sa, Jinx, Ezreal** (placeholders, campeones reales de League of Legends pero sin opinión editorial todavía).
- `patches.ts` — 1 `Patch`: `15.14` (mismo valor que `FALLBACK_VERSION` de `lib/riot/datadragon.ts`, reutilizado deliberadamente en vez de inventar un número de parche distinto).
- `official-adc-tier-list.ts` — la `TierList` completa: 1 entrada `reviewed` (Lucian, tier `S`) + 3 `placeholder`.

**Por qué solo Lucian tiene una valoración real:** es el único campeón sobre el que el repositorio ya documenta información editorial explícita y verificable (título del sitio, `data/content.ts#recognition`, la entidad `champion:lucian` del Content Graph). Para el resto, el encargo prohíbe explícitamente inventar una opinión atribuida a Tidusss — así que se muestran como placeholder honesto en vez de fabricar una clasificación completa. El verdict de cada placeholder dice literalmente *"Placeholder editorial — pendiente de revisión por Tidusss"*; nunca se presenta como un veredicto real.

**Separación de capas cumplida:** `src/data/league-laboratory/` (contenido) no importa nada de `src/components/` (presentación) ni depende de ninguna API externa; `src/domain/league-laboratory/` (tipos y consultas) no sabe que estos datos existen hasta que algo los pasa explícitamente a `hydrateLabRegistry()`. Sustituir esta fuente por un CMS o un panel editorial en el futuro no requeriría tocar `src/domain/` ni `src/components/laboratory/` — solo el módulo que llama a `hydrateLabRegistry()`.

**Cómo se conecta al dominio:** `src/pages/tier-list.astro` llama a `hydrateLabRegistry({ champions, patches, tierLists })` (nueva función en `registry.ts`, additiva) y después consulta el dominio con sus funciones reales (`getTierList(patchId, role)`), en vez de leer los arrays de datos directamente — así la página ejercita de verdad la capa de consulta, no solo los tipos.

**Actualización (Phase 2 / ADR-006):** la limitación descrita originalmente aquí (`hydrateLabRegistry` mutando un registro compartido en memoria de módulo, seguro solo mientras exista una única página) **ya no aplica**. Antes de construir el Explorador de Campeones —la segunda página real del Laboratorio— se sustituyó ese singleton por `buildLabRegistry(seed): LabRegistry`, una fábrica pura sin estado compartido: cada página construye su propio registro inmutable y lo pasa explícitamente a las funciones de consulta. Ver §13.3.

### 12.4 Integración con el Content Graph (real, no solo preparada)

Se usó el bridge ya existente (`content-graph-bridge.ts`) sin crear un segundo camino de integración. Cambios, todos aditivos, en `domain/content-graph/registry.ts`:

- Se añadió `href: '/live'` a la entidad `champion:lucian` ya existente (antes no era navegable — no tenía `href`, así que cualquier conexión hacia ella ya quedaba filtrada por `getContentConnections`). **Verificado que esto no cambia el resultado de `getPrimaryConnection('creator-project:tidusss')`** (Home): la relación con mayor prioridad hacia Live sigue siendo la misma (100 > 70), y se confirmó comparando el HTML generado antes y después — `dist/index.html` sigue enlazando exactamente a `/live/` con el mismo texto.
- Se registraron dos entidades nuevas: la Tier List (`kind: 'tier-list'`, con `href: '/tier-list'`) y el Parche 15.14 (`kind: 'patch'`, sin `href` — no hay Patch Explorer todavía, así que queda correctamente no-navegable por el filtro existente, sin necesidad de marcarlo `planned`).
- Se registraron dos relaciones, **ambas con `from` la propia Tier List**, nunca `from: creator-project:tidusss` ni `from: creator-project:live`: Tier List → Champion (Lucian) y Tier List → Patch. Esto garantiza, por construcción, que ninguna consulta anclada en Home o Live puede verse afectada — `getContentConnections` filtra por `relation.from === from`, así que una relación con otro `from` es invisible para esas consultas sin importar su prioridad.
- **Verificado empíricamente** (no solo argumentado): se generó el build antes y después de estos cambios y se comparó el HTML de `dist/index.html` y `dist/live/index.html` — bit a bit idéntico en las secciones de navegación (`BrandClosing`, `ExploreNext`).

La página `/tier-list` renderiza `<ExploreNext source="tier-list:official-adc" />`, que muestra la única conexión navegable real (hacia Lucian/Live) — la conexión hacia el Parche se omite automáticamente porque el Parche no tiene `href`, demostrando que el mecanismo de "tolerar la ausencia" ya documentado en §10 funciona sin cambios adicionales.

### 12.5 Componentes

**Nuevos, reutilizables (`src/components/laboratory/`)** — pensados para las próximas herramientas del Laboratorio, no solo para la Tier List:

`LaboratoryHero`, `LaboratoryMetadata`, `PatchBadge`, `RoleBadge`, `ConfidenceIndicator`, `EditorialTakeCard`, `ChampionIdentity`, `EmptyLaboratoryState`, `TierBadge`.

**Nuevos, específicos de la Tier List (`src/components/laboratory/tier-list/`)** — no se generalizaron porque hoy solo tienen un consumidor (evita abstracción prematura; se revisará cuando exista una segunda herramienta que necesite algo parecido):

`TierListLegend`, `TierListFilters`, `TierListSection`, `TierListPendingSection`.

**Decisión deliberada: no se usó el patrón Template + Render.** Ese patrón (`live/matches/render.ts`) existe para abaratar el coste de renderizar datos que llegan por `fetch()` en el cliente. El contenido de la Tier List es editorial y estático, conocido en build time — Astro ya lo renderiza en el servidor sin ningún coste de JavaScript. Aplicar Template + Render aquí habría sido cargo-cult, no reutilización real: se documentó esta distinción explícitamente para que quede claro por qué esta herramienta no sigue ese patrón mientras que Match History sí.

**Reutilizados sin modificar:** `BaseLayout.astro`, `Navbar.astro`, `Footer.astro`, `ExploreNext.astro`, `Environment.astro` (vía el `EnvironmentId` `'tier-list'` ya existente), y `lib/riot/datadragon.ts` (`dataDragonUrls().champion()`) para los iconos reales de campeón.

### 12.6 Interacción y "sin JavaScript"

- El comentario editorial se expande con `<details>/<summary>` nativo — sin JavaScript, ya funciona (abrir/cerrar, foco, `aria-expanded` implícito los da el navegador).
- El filtro por tier y la búsqueda por campeón sí requieren JavaScript (vanilla, sin librería). **Sin JS, todos los campeones permanecen visibles** — el atributo `hidden` nunca se activa si el script no corre, así que la página sigue siendo completamente legible y útil.
- **Hallazgo de auditoría aplicado:** el patrón `[data-reveal]` que Home/Live usan para el *reveal* al hacer scroll define `opacity: 0` por defecto en `global.css`, y solo se corrige a `opacity: 1` mediante JavaScript (incluso la rama de `prefers-reduced-motion` necesita JS para detectarlo y aplicar la clase). Es decir, ese patrón concreto **no** es seguro sin JavaScript. Se decidió **no reutilizarlo** en esta página precisamente para poder cumplir "la página debe seguir siendo útil sin JavaScript" de forma literal, no aproximada.
- Deep link por parámetros de URL: `?tier=<slug>` y `?champion=<slug>` (o `#campeon-<slug>`) preseleccionan filtro y abren el comentario del campeón correspondiente. Verificado en navegador.
- Se detectó y corrigió durante la verificación un bug real: las zapatillas (`data-tier-filter`) del filtro usaban el grado bonito (`"S"`) mientras que las filas de tier usaban el slug (`"s"`) — nunca coincidían. Corregido para que ambos usen la misma función de slug que `TierBadge`.

### 12.7 Accesibilidad, SEO y rendimiento — decisiones específicas de esta fase

- **Tokens de tier:** 6 variables CSS nuevas (`--lab-tier-s-plus` … `--lab-tier-d`) reutilizando colores ya existentes en la paleta (dorado/azul/neutros de `PLATFORM_BIBLE.md` §4.2) — nunca un hue nuevo. La jerarquía no depende solo del color: el grado siempre se muestra como texto (S+/S/A/B/C/D) y el tamaño de la insignia decrece de S+ a D como segunda señal.
- **Contraste de las insignias de tier:** texto oscuro (`#060913`, el propio fondo de marca) sobre el color de tier — el mismo patrón ya usado por `.button-primary` (texto oscuro sobre dorado), no una técnica nueva.
- **Objetivos táctiles:** los chips de filtro y el campo de búsqueda tienen `min-height: 2.75rem` (44px), verificado en viewport de 375px.
- **Datos estructurados:** se decidió **no añadir JSON-LD**. No existe un tipo de schema.org que represente honestamente "clasificación editorial con niveles de confianza y entradas mixtas revisadas/borrador" sin forzar una semántica de `Rating`/`Review` que no aplica — forzarla habría arriesgado que buscadores mostraran estrellas de valoración inexistentes. Se documenta como decisión explícita, no como omisión.
- **Metadata honesta:** `title`/`description`/Open Graph mencionan que es un criterio editorial ("no un promedio de win rate"), nunca presentan el contenido placeholder como definitivo.
- **`sitemap.xml`** actualizado a mano con `/tier-list` (riesgo ya documentado en `PLATFORM_BIBLE.md` §9 — sigue sin generación automática).
- **Fecha de actualización:** se usa una fecha absoluta (`Intl.DateTimeFormat` con `Europe/Madrid`), no `relativeTime()`. Esta página es 100% estática — un "hace 2 días" calculado en build quedaría mintiendo silenciosamente hasta el siguiente despliegue. Es una decisión de corrección, no solo de estilo.
- **Imágenes:** iconos de campeón reales de Data Dragon, `width`/`height` explícitos (56×56), `loading="lazy"` (no son el elemento principal above-the-fold).

### 12.8 Verificación manual realizada

Con el sitio construido (`npm run build`) y servido (`astro preview`) en un navegador real:

- Contenido presente en el HTML estático servido, sin depender de JavaScript (comprobado leyendo `dist/tier-list/index.html` directamente).
- Filtro por tier, búsqueda por campeón, expansión de comentario y deep link por query params probados en el DOM real — todos funcionando tras corregir el bug de §12.6.
- Responsive: a 375px de viewport, `.tier-list-entry` cae a una sola columna (sin `overflow-x`), confirmado por estilo computado.
- Sin errores de consola ni peticiones fallidas propias de la página (los 404 de `/api/riot/overview` etc. son una limitación conocida y preexistente de `astro preview`/`astro dev`, que no ejecutan `functions/`, no algo introducido por esta fase).
- `data-environment="tier-list"` presente en el HTML, confirmando que el Environment Engine se activó sin cambios.

### 12.9 Limitaciones explícitas de esta V1

- Cobertura editorial real limitada a **un campeón** (Lucian). Es deliberado, no un olvido: ver §12.3.
- Sin comparador entre parches, sin editor personal, sin autenticación, sin persistencia remota, sin exportación como imagen, sin votación comunitaria, sin panel de administración, sin múltiples tier lists públicas — todo explícitamente fuera de alcance por encargo.
- Sin entrada en la navegación principal (`data/site.ts#navigation`/`Navbar.astro`): añadirla habría modificado un componente compartido que se renderiza también en Home y Live, y esta fase tenía prohibido tocarlos. La página es accesible por URL directa, por el sitemap y por el enlace de "sigue explorando" que ya existía.
- ~~`hydrateLabRegistry` no está preparado para que dos páginas del Laboratorio hidraten el registro compartido...~~ **Resuelto en Phase 2 (ADR-006):** el registro pasó a ser una fábrica pura sin estado compartido antes de construir la segunda página. Ver §13.3.
- `Build`/`RunePage`/`Matchup`/`Synergy`/`Concept`/`KnowledgeArticle`/`MetaState` siguen sin ningún dato real — la Tier List no los referencia todavía (los campos `buildId`/`runePageId` de cada entrada existen en el tipo pero están vacíos).

### 12.10 Próximos pasos

1. Añadir un enlace a `/tier-list` en la navegación principal — requiere aprobación explícita por tocar `Navbar.astro`/`data/site.ts`.
2. Revisar más campeones ADC (mover placeholders a `reviewed` conforme Tidusss los valore).
3. Build Explorer / Rune Explorer como siguientes herramientas, reutilizando `LaboratoryMetadata`, `PatchBadge`, `RoleBadge`, `ConfidenceIndicator`, `EditorialTakeCard`.
4. Resolver el hueco de `ContentEntityKind` para `rune-page`/`synergy`/`concept`/`meta-state` (§6) antes de que esas herramientas necesiten aparecer en el Content Graph.
5. ~~Revisar `hydrateLabRegistry`...~~ **Hecho en Phase 2** — ver ADR-006 y §13.3.

## 13. Phase 2 — Explorador de Campeones

### 13.1 Objetivo y alcance

Ruta pública: **`/campeones/<slug>`** (`src/pages/campeones/[slug].astro`, ruta dinámica con `getStaticPaths()`). Una página real por cada campeón ya registrado — hoy 4: `lucian`, `kaisa`, `jinx`, `ezreal`. No es una página de estadísticas: responde quién es el campeón, por qué merece la pena jugarlo, cuándo es fuerte, qué errores comete la mayoría, y qué piensa Tidusss realmente — con un estado vacío honesto donde todavía no hay contenido.

### 13.2 Crítica previa al prompt (pensamiento crítico aplicado)

Antes de escribir código se revisó si "una página por campeón, todas con la misma forma" era la mejor arquitectura, o si convenía, por ejemplo, generar las fichas de campeones sin perfil todavía como `planned` (no navegables) en vez de páginas reales. Se descartó esa alternativa: el encargo pide explícitamente que "cada campeón se convierta en una entidad viva" y que "las futuras herramientas se conecten automáticamente con él" — un campeón sin página no puede ser un nodo real del Content Graph ni un destino de "sigue explorando". La alternativa correcta no era menos páginas, sino **páginas reales con estados vacíos honestos y `noindex` mientras no haya contenido real** (§13.7) — que es lo que se implementó.

La corrección más importante de este pensamiento crítico fue interna, no del prompt: al diseñar el contenido se detectó que el registro del dominio (`labRegistry`/`hydrateLabRegistry`, Phase 1) no debía sobrevivir a una segunda página real sin corregirse antes — ver ADR-006 y §13.3.

### 13.3 Refactor de arquitectura: de singleton mutable a fábrica pura (ADR-006)

**Antes de escribir el Explorador de Campeones**, se sustituyó `labRegistry` (objeto mutable a nivel de módulo) + `hydrateLabRegistry()` (mutación) por:

```ts
export const buildLabRegistry = (seed: Partial<LabRegistry>): LabRegistry => ({ ...datos, sin mutación... });
```

Todas las funciones de consulta (`getChampionKnowledge`, `getPatchKnowledge`, `getTierList`, `getMatchupsFor`, `getSynergiesFor`, `getMetaTimeline`, `getGuides`, `getLabChampion`, `getPatch`, `getConcept`) pasaron a recibir `registry: LabRegistry` como primer parámetro. `/tier-list` se migró a la nueva API en el mismo cambio — verificado que su HTML generado no varía.

**Por qué ahora y no antes:** en Phase 1 esto era un riesgo teórico ("seguro porque solo una página lo hidrata", documentado explícitamente como tal). Con la segunda página real construida en el mismo build, el riesgo dejaba de ser teórico. Corregirlo en este momento — antes de que doliera, no después — es la aplicación directa del pensamiento crítico pedido: no se implementó automáticamente la arquitectura de Phase 1 solo porque ya existía.

### 13.4 Extensión de dominio: `ChampionProfile` y el porqué de separarlo de `TierListEntry`

Se necesitaba representar "quién es, por qué jugarlo, cuándo es fuerte, errores frecuentes, dificultad" — campos que **no existían** en ningún tipo del dominio. Dos arquitecturas posibles:

- **A) Leer estos datos de la entrada de la Tier List actual** (`TierListEntry.editorialTake`/`strengths`/`weaknesses`, ya existentes). Se descartó: el tier de un campeón cambia cada parche; su identidad editorial (quién es, por qué jugarlo) no. Acoplar ambos habría obligado a que cada Tier List futura repitiera, para siempre, la biografía completa de cada campeón solo para que su ficha no quedara vacía.
- **B) Un perfil editorial propio en `LabChampion`, independiente del parche** — la opción elegida.

```ts
interface ChampionProfile {
  summary: string;
  appeal: string;
  editorialTake: EditorialTake; // veredicto propio del campeón, no de un parche
  strengths: readonly string[];
  weaknesses: readonly string[];
  commonMistakes: readonly string[];
  powerSpikes: readonly string[];
  difficulty: 'low' | 'medium' | 'high';
}
// LabChampion.profile?: ChampionProfile — ausente mientras no exista un perfil real.
```

Solo Lucian tiene un `profile` real, construido a partir de hechos ya documentados en el repo (especialidad competitiva, nivel Master, contenido del canal) — nunca inventado. Kai'Sa, Jinx y Ezreal quedan con `profile: undefined`, mostrando el mejor estado vacío posible (§13.8), nunca una opinión simulada.

**Renombrado:** `TierListEntryReviewStatus` → **`EditorialReviewStatus`**. El concepto (revisado/borrador) ya no pertenece solo a una entrada de Tier List — el perfil de un campeón también puede estar "pendiente". Mantener el nombre viejo habría sido engañoso para cualquier persona que lo leyera dentro de dos años.

**Campo añadido y deliberadamente vacío:** `LabChampion.title?: string` (el título oficial del campeón, p. ej. "El Purificador"). Se dejó **sin rellenar para los 4 campeones** — no por pereza, sino porque no había confianza suficiente en la cadena exacta de localización al español de todos los títulos como para publicarlos sin riesgo de afirmar algo incorrecto. Es exactamente el tipo de "cuando falte contenido, diseña el mejor estado vacío posible" aplicado a un campo pequeño: la UI simplemente omite la línea cuando está ausente, en vez de arriesgar un dato no verificado.

### 13.5 Fuente editorial

`src/data/league-laboratory/champions.ts` — se amplió (no se creó un fichero nuevo) con el `profile` de Lucian. Sigue siendo la única fuente editorial, separada de dominio y presentación, tal como exige §7 de este documento.

### 13.6 Integración real con el Content Graph (y una segunda corrección de arquitectura)

Se detectó, además del registro mutable, un segundo problema de acoplamiento ya anticipado en la crítica previa a Phase 1: `domain/content-graph/registry.ts` importaba directamente datos concretos del Laboratorio (`officialAdcTierList`, `patch1514`, `lucian`). Con una sola herramienta era tolerable; con la segunda (que necesitaba registrar 4 campeones, no 1) habría significado seguir haciendo crecer un archivo compartido y sensible en cada PR futura.

**Corrección:** todo lo que el Laboratorio aporta al Content Graph se movió a un fichero de extensión nuevo, `domain/content-graph/league-laboratory-extension.ts`, que exporta `leagueLaboratoryEntities`/`leagueLaboratoryRelations`. `content-graph/registry.ts` ahora importa solo esas dos constantes — no vuelve a crecer cuando se añada Build Explorer o Matchup Explorer; esas herramientas amplían el fichero de extensión, no el registro central.

**Qué se registra ahora:**

- Los **4 campeones** (Lucian, Kai'Sa, Jinx, Ezreal) como `ContentEntity` de kind `champion`, cada uno con `href: /campeones/<slug>` — **incluidos los que todavía son un placeholder en la Tier List**. Es una distinción deliberada: que Kai'Sa no tenga todavía una valoración de tier no significa que no exista como campeón real con una página real.
- La entidad `champion:lucian` que antes se escribía a mano en `coreEntities` (Phase 1) se eliminó de ahí — ahora la genera esta misma extensión, evitando una fuente de verdad duplicada. Se verificó que el título y la descripción generados coinciden exactamente con los que tenía antes (`championToContentEntity` usa `champion.name`/`champion.signatureNote`, ya escritos para coincidir).
- Relaciones en **ambas direcciones**: Tier List → Campeón (ya existía en Phase 1, ahora para los 4 campeones de la Tier List, no solo Lucian) y **Campeón → Tier List** (nueva, `championAppearsInTierListRelation`). Ninguna relación tiene `from: creator-project:tidusss` ni `from: creator-project:live` — se mantiene la misma garantía de Phase 1 de que Home y Live son intocables por construcción.
- Se actualizó el `href` de `champion:lucian` de `/live` (Phase 1, un destino provisional) a `/campeones/lucian` (Phase 2, su destino real). Esto cambia el enlace de "sigue explorando" de `/tier-list` de apuntar a Live a apuntar al perfil del campeón — un cambio de comportamiento deliberado y positivo de Tier List, no una regresión: verificado que sigue siendo un enlace real y funcional.

**Verificación:** comparación del HTML de `dist/index.html` y `dist/live/index.html` antes/después — idénticos en navegación. `dist/tier-list/index.html` ahora enlaza a los 3 perfiles de campeón con entrada en la Tier List (antes solo a Lucian) — cambio esperado y correcto.

**Hallazgo corregido en `ExploreNext.astro`:** con campeones sin `signatureNote` (los placeholders), el componente generaba un `<p></p>` vacío (`relation.context ?? target.description`, ambos `undefined`). Corregido para omitir el párrafo cuando no hay texto. Cambio retrocompatible — verificado que Live, donde todas las relaciones ya tenían descripción, no cambia.

### 13.7 Componentes

**Auditados y reutilizados sin cambios:** `PatchBadge`, `RoleBadge`, `ConfidenceIndicator`, `TierBadge`, `LaboratoryHero`, `BaseLayout`, `Navbar`, `Footer`, `ExploreNext`.

**Reutilizados con una ampliación retrocompatible:**
- `LaboratoryMetadata` — `queue` pasó de obligatorio a opcional (la ficha de un campeón no tiene cola competitiva propia; la Tier List sigue pasándolo igual que siempre).
- `EmptyLaboratoryState` — se añadieron `ctaHref`/`ctaLabel`/`ctaExternal` opcionales, para los casos donde el estado vacío sí tiene un siguiente paso honesto (p. ej. "ver el canal de YouTube" en vez de nada).

**Extraído para eliminar una duplicación que este trabajo estaba a punto de introducir:** `TraitList.astro` — el bloque "etiqueta + lista" que `EditorialTakeCard` ya dibujaba para fortalezas/debilidades. En vez de escribir la misma lista una segunda vez para power spikes/errores frecuentes en la ficha de campeón, se extrajo un átomo y `EditorialTakeCard` se reescribió para usarlo también — una simplificación real, no solo una adición.

**Nuevos, deliberadamente NO exclusivos del Explorador de Campeones (`src/components/laboratory/`):**
- `ChampionKnowledgeSection.astro` — "aquí va contenido real, o aquí va un estado vacío", con `hasContent` explícito (no se infiere de si hay children, para que el comportamiento sea evidente leyendo el componente, no adivinado). Es el patrón que Build Explorer, Matchup Explorer, etc. van a necesitar exactamente igual.

**Nuevos, específicos de esta herramienta (`src/components/laboratory/champion/`):** `ChampionHeader`, `ChampionProfileSection`, `ChampionTierStatus`. No se generalizaron todavía porque solo tienen un consumidor — se revisará cuándo generalizarlos cuando exista un segundo.

**Por qué no se reutilizó `EditorialTakeCard` para el perfil del campeón:** ese componente colapsa el razonamiento detrás de un `<details>` — un patrón correcto para una lista densa de entradas (la Tier List), pero equivocado para la página dedicada de un único campeón, donde el usuario ha venido específicamente a leer. `ChampionProfileSection` muestra todo expandido siempre; es una diferencia de contexto, no una inconsistencia.

**Nuevo helper, no componente:** `dataDragonUrls().championLoading()` en `lib/riot/datadragon.ts` — resuelve el arte de carga oficial del campeón (retrato, no el icono cuadrado pequeño que ya usaba la Tier List), reutilizando exactamente el mismo patrón de los otros métodos de esa función.

### 13.8 Navegación

Tier List → Campeón → (Vídeos / Partidas / Conceptos, hoy vacíos honestamente) → Volver al Laboratorio (CTA a `/tier-list` y a `/live`) → Campeón → Tier List (relación inversa, vía "Sigue explorando"). La cadena pedida en el encargo queda cerrada en ambos sentidos con relaciones reales del Content Graph, no con enlaces sueltos hardcodeados.

No se añadió entrada en la navegación principal (`Navbar.astro`/`data/site.ts`) — es un componente compartido con Home y Live, fuera del alcance de este encargo sin aprobación explícita.

### 13.9 Estados vacíos

Cada uno de los 7 bloques de conocimiento (vídeos, partidas, builds, runas, matchups, sinergias, conceptos) tiene un estado vacío propio y honesto, nunca genérico: explica *por qué* está vacío (algunos, como partidas, explican explícitamente "no inventamos una relación que no existe") y, cuando tiene sentido, ofrece un siguiente paso real (canal de YouTube, Live). El perfil editorial ausente ("El perfil editorial de Kai'Sa todavía no existe") dice explícitamente que el campeón ya es parte del Laboratorio y que su ficha crecerá — nunca aparenta ser un error o contenido roto.

### 13.10 SEO

`noindex, follow` automático para las 3 fichas sin perfil real (ver ADR-007) — indexado solo Lucian, la única página con contenido suficiente para ser un buen resultado de búsqueda. `sitemap.xml` solo incluye `/campeones/lucian`. Title/description por campeón, distintos según haya o no perfil, nunca presentando el estado vacío como contenido definitivo. Sin datos estructurados: la razón ya documentada en Phase 1 (§12.7) aplica igual aquí.

### 13.11 Accesibilidad

Jerarquía semántica correcta (`h1` el nombre del campeón, `h2`/`h3` dentro del perfil, `h3` en cada bloque de conocimiento). Foco visible heredado del sistema global. El estado "tier pendiente" se comunica con texto ("Todavía sin clasificar") además de un badge con borde discontinuo, nunca solo color. Objetivos táctiles del enlace de estado de tier y de los CTA de estado vacío consistentes con el resto del Laboratorio (≥44px). Sin animaciones nuevas más allá de una transición de 0.2s ya guardada tras `prefers-reduced-motion`.

### 13.12 Rendimiento

Retrato del campeón como único elemento `loading="eager"`/`fetchpriority="high"` (el elemento principal above-the-fold de esta página), con `width`/`height` explícitos (308×560, las dimensiones reales del asset) para evitar *layout shift*. El resto de imágenes (ninguna en esta página, ya que solo se usa el retrato) no aplica. Cero JavaScript de cliente nuevo: la página entera se renderiza en servidor, sin ningún `<script>` propio.

### 13.13 Deuda técnica detectada

| Elemento | Severidad | Descripción |
| --- | --- | --- |
| Duplicación de `Role`/`roleLabel` entre `LiveDashboard.astro` y `domain/league-laboratory/scope.ts` | Media | Ya detectada en Phase 1, sigue sin resolver — ahora con un segundo consumidor (`ChampionHeader`) además de la Tier List. Cuantos más consumidores, más cara será la eventual unificación. |
| `champion.title` sin poblar en el dominio | Baja | Campo preparado pero vacío en las 4 entradas reales, por precaución ante localización no verificada (§13.4). No es deuda urgente, pero alguien debe rellenarlo con la fuente correcta antes de que se acumulen más campeones sin título. |
| `ChampionHeader`/`ChampionProfileSection`/`ChampionTierStatus` sin generalizar todavía | Baja | Correcto para un solo consumidor; revisar en cuanto exista una segunda herramienta que muestre un campeón de forma prominente (Matchup Explorer, probablemente). |
| Ausencia de tests automatizados para las funciones puras de `registry.ts` | Media | El refactor a fábrica pura (ADR-006) hace que estas funciones sean triviales de testear (sin mocks de estado global) — una oportunidad barata que sigue sin aprovecharse, heredada de la falta general de tests del proyecto (ya señalada en `PLATFORM_BIBLE.md` §8). |

### 13.14 Riesgos futuros

- Si se añade un segundo parche real, `ChampionProfile.editorialTake.lastReviewedPatch` permitirá detectar perfiles desactualizados — pero nada lo comprueba todavía de forma activa (mismo riesgo ya señalado en Phase 1, §12 de `docs/league-laboratory.md`, ahora también aplicable al perfil del campeón, no solo a la entrada de Tier List).
- El fichero `content-graph/league-laboratory-extension.ts` concentra ya bastante lógica de proyección; si crece mucho más (Build Explorer, Matchup Explorer), podría merecer dividirse por tipo de entidad — vigilar, no actuar todavía.

### 13.15 Verificación manual realizada

`astro preview` en navegador real: contenido completo verificado en `/campeones/lucian` (perfil completo) y `/campeones/kaisa` (estado vacío honesto); `data-environment="champion"` confirmado; meta robots verificado por campeón (`index` solo Lucian); responsive a 375px sin *overflow* horizontal; sin errores de consola; capturas de pantalla revisadas como diseñador (ver crítica de diseño en el informe de entrega). Se detectó y corrigió durante esta verificación que el estado vacío de retrato (`champion-identity-fallback`, pensado para el icono pequeño de 56px de la Tier List) se habría visto diminuto dentro del marco grande del retrato — corregido con una regla con mayor especificidad, sin duplicar la regla base.

### 13.16 Limitaciones explícitas de esta V1

- Solo Lucian tiene perfil editorial real; Kai'Sa, Jinx y Ezreal muestran el estado vacío por diseño, no por error.
- `champion.title` sin poblar para los 4 (§13.4).
- Vídeos y partidas relacionadas son estados vacíos con CTA, no listados reales — no existe todavía un sistema de etiquetado de vídeos por campeón ni una integración de partidas filtradas por campeón en esta página (deliberado, ver §13.9).
- Sin entrada en la navegación principal (mismo motivo que Phase 1, §12.9).

### 13.17 Próximos pasos

1. Escribir el perfil editorial real de Kai'Sa, Jinx y Ezreal conforme Tidusss los revise; quitar su `noindex` y añadirlos al `sitemap.xml` en el mismo cambio.
2. Rellenar `champion.title` con la fuente correcta verificada.
3. Build Explorer / Rune Explorer, ahora con un perfil de campeón real al que enlazar sus recomendaciones.
4. Unificar `Role`/`roleLabel` entre Live y el Laboratorio si un tercer consumidor lo justifica.
5. Tests unitarios para `registry.ts` ahora que sus funciones son puras y triviales de testear.
