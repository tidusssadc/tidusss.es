# The League Laboratory

> **Naturaleza de este documento:** diseño de dominio. Describe un sistema, no una página. En esta iteración se ha construido **únicamente** la capa de dominio (`src/domain/league-laboratory/`): tipos, contratos, registro vacío y el puente hacia el Content Graph. **No existe ninguna ruta, componente visual, endpoint ni dato real todavía.** Este documento es la referencia para implementar la primera herramienta (Tier List) y las siguientes, sin rediseñar la arquitectura en cada una.
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
11. [Estado real de implementación](#11-estado-real-de-implementación)

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

- **`LabChampion`** — el conocimiento editorial sobre un campeón: en qué roles se considera viable, si es un campeón "señal" de Tidusss (como Lucian hoy), etiquetas de estilo de juego, nota de autor. **No duplica** nombre/imagen/estadísticas base — eso ya lo sirve Data Dragon (`lib/riot/datadragon.ts`) y se seguirá pidiendo ahí cuando haya UI.
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

1. **Dominio (este trabajo).** Tipos, contratos, registro vacío, puente al Content Graph, documentación. Sin UI, sin rutas, sin datos.
2. **Primera herramienta: Tier List.** Se elige primera porque es la entidad con menos dependencias externas nuevas — `TierListEntry` puede lanzarse con Champion + Patch + Role + `EditorialTake`, sin necesitar todavía Build/RunePage completos (son opcionales en la entrada). Implica: poblar `LabChampion` y `Patch` con datos reales mínimos, poblar una `TierList`, construir `ScopeFilterBar`, `KnowledgeCard` (vía Template + Render) y `EditorialTakeBadge`, y una única ruta pública.
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

## 11. Estado real de implementación

| Elemento | Estado |
| --- | --- |
| `src/domain/league-laboratory/types.ts` | ✅ Creado |
| `src/domain/league-laboratory/scope.ts` | ✅ Creado |
| `src/domain/league-laboratory/registry.ts` | ✅ Creado (colecciones vacías, funciones de consulta listas) |
| `src/domain/league-laboratory/content-graph-bridge.ts` | ✅ Creado (funciones puras, no invocadas desde ningún sitio en producción) |
| `src/domain/league-laboratory/index.ts` | ✅ Creado (barrel) |
| Datos reales (campeones, parches, builds…) | ❌ No existen |
| Rutas públicas (`/laboratory`, etc.) | ❌ No existen |
| Componentes visuales (`KnowledgeCard`, `ScopeFilterBar`, `EditorialTakeBadge`) | ❌ No existen — solo especificados (§7) |
| Endpoints/Functions | ❌ No existen |
| Cambios en Home, Live, Match History o cualquier API existente | ❌ Ninguno — no se ha tocado ningún archivo fuera de `src/domain/league-laboratory/`, `docs/league-laboratory.md` y `docs/PLATFORM_BIBLE.md` |
