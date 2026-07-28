# The League Laboratory

> **Naturaleza de este documento:** diseño de dominio **y** registro de sus aplicaciones reales. Las secciones 1-11 describen el sistema (diseñado antes de construir nada). La sección 12 documenta **Phase 1 — The Official Tidusss ADC Tier List**. La sección 13 documenta **Phase 2 — Explorador de Campeones** (4 campeones curados a mano). La sección 14 documenta **Phase 3 — el catálogo a escala real**: separación entre el catálogo factual (generado desde Data Dragon) y la curación editorial, que hizo posible pasar de 4 fichas de campeón a **173** sin tocar la arquitectura. La sección 15 documenta **Fase 4 — blindaje del catálogo con pruebas automatizadas y el Centro de Campeones** (`/campeones`), el punto de entrada público al catálogo completo.
> **Estado actual:** existen ya **tres rutas públicas reales**: `/tier-list`, `/campeones` (el Centro de Campeones, índice explorable) y `/campeones/[slug]` — esta última genera **una página por cada uno de los ~170 campeones del juego**, no solo los curados. El campeón es, de forma literal y verificada, el nodo central del ecosistema del Laboratorio. El resto de herramientas (Build Explorer, Rune Explorer, Matchup Explorer…) siguen sin implementar.
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
14. [Phase 3 — El campeón como centro del ecosistema: catálogo a escala](#14-phase-3--el-campeón-como-centro-del-ecosistema-catálogo-a-escala-170-campeones)
15. [Fase 4 — Blindaje del catálogo y Centro de Campeones](#15-fase-4--blindaje-del-catálogo-y-centro-de-campeones)
16. [Fase 5 — Guía editorial completa: Lucian](#16-fase-5--guía-editorial-completa-lucian)
17. [Fase 6 — Contenido real de Tidusss: Lucian, parche 26.14](#17-fase-6--contenido-real-de-tidusss-lucian-parche-2614)

---

## 1. Objetivos

- Dar a **League Knowledge** —todo el conocimiento de League of Legends que Tidusss quiere transmitir: tier lists, builds, runas, matchups, sinergias, conceptos, guías, lectura de meta— una **arquitectura única y compartida**, en vez de que cada herramienta futura (Tier List, Build Explorer, Rune Explorer…) reinvente sus propios tipos, su propia caché y sus propias tarjetas.
- Que la **primera herramienta real** (una Tier List) sea, literalmente, la primera aplicación de esta arquitectura — no un prototipo que luego haya que rehacer para que las siguientes nueve encajen.
- Que el laboratorio se integre con el Content Graph existente (§6) exactamente con el mismo patrón que ya usan Riot/YouTube (`domain/content-graph/adapters.ts`): un dominio rico y específico, proyectado hacia el grafo genérico mediante funciones puras de conversión.
- Que **el criterio de Tidusss sea un dato de primera clase**, no una nota a pie de página. Esto se resuelve estructuralmente en el modelo, no en el copy (§2, §4.2).

**Nombre del dominio vs. nombre de producto:** _League Knowledge_ es el nombre conceptual de este dominio de producto (lo que se sabe y se opina). _The League Laboratory_ fue su identidad de marca original de cara al usuario. **Actualización (Fase 4, ver §15):** el texto editorial visible en el sitio dice "El Laboratorio" en español — "The League Laboratory" queda como nombre interno (módulo `league-laboratory`, este documento, comentarios de código), nunca como copy público. En el código, el módulo se sigue llamando `league-laboratory` porque es una convención técnica ya asentada en rutas e imports — son la misma cosa vista desde dos ángulos, no dos sistemas distintos.

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

| Herramienta                | Entidad(es) que consume                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| Tier List                  | `TierList` (+ `Build`, `RunePage` referenciados por entrada)                                     |
| Build Explorer             | `Build`                                                                                          |
| Rune Explorer              | `RunePage`                                                                                       |
| Champion Explorer          | `LabChampion` (+ agregación vía `getChampionKnowledge`)                                          |
| Patch Explorer             | `Patch` (+ agregación vía `getPatchKnowledge`)                                                   |
| Matchup Explorer           | `Matchup`                                                                                        |
| Synergy Explorer           | `Synergy`                                                                                        |
| Guides                     | `KnowledgeArticle` con `format: 'guide'`                                                         |
| Concept Library            | `Concept`                                                                                        |
| Meta Timeline              | `MetaState`, ordenado por `Patch.sequence`                                                       |
| Draft Knowledge _(futura)_ | composición de `MetaState` + `Matchup` + `Synergy` + `TierList`, sin entidad propia todavía (§9) |

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

| Sugerido en el encargo | Decisión                                                                                                                          | Justificación                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Lane`                 | **Fusionado en `Role`**                                                                                                           | Riot ya expone una única cadena de posición (`TOP`/`JUNGLE`/`MIDDLE`/`BOTTOM`/`UTILITY`) que el proyecto **ya usa** en `lib/riot/types.ts` (`RecentMatch.position`) y en `LiveDashboard.astro` (`positionLabel`). Crear un segundo vocabulario "Lane" distinto de "Role" solo introduciría dos formas de decir lo mismo y el riesgo de que se desincronizaran. `Role` en el Laboratorio usa exactamente los mismos cinco valores.                                                                                                                                            |
| `PatchNote`            | **Fusionado en `Patch`**                                                                                                          | No vamos a re-alojar el changelog completo de Riot (eso ya existe en la web oficial de Riot; duplicarlo violaría el principio ya escrito en `docs/content-graph.md` de "no duplicar datos de proveedores"). Lo que sí aporta valor es la lectura editorial de qué cambió y por qué importa — eso es `Patch.editorialSummary`, un campo, no una entidad aparte.                                                                                                                                                                                                               |
| `Opinion`              | **Convertido en value object `EditorialTake`**                                                                                    | Una opinión nunca existe de forma aislada: siempre es una opinión _sobre_ un Build, un Matchup, una entrada de Tier List. Modelarla como entidad independiente con su propio ID habría obligado a toda consulta a hacer un salto extra (`Build → Opinion`) sin ganar nada. Como value object embebido, es más simple de consultar y, sobre todo, se puede hacer **obligatorio** en los campos que more importan (Build, RunePage, Matchup, Synergy, entrada de TierList) — eso es lo que convierte "mostrar criterio" en una regla estructural, no en una promesa de estilo. |
| `Guide`                | **Especialización de `KnowledgeArticle`**, no entidad separada                                                                    | Un Guide es, estructuralmente, un `KnowledgeArticle` cuyo `scope.championId` y `scope.role` son obligatorios en vez de opcionales. En vez de duplicar campos (título, conceptos relacionados, estado de publicación) en dos interfaces distintas, `Guide` es un tipo TypeScript refinado (`KnowledgeArticle & { format: 'guide'; scope: { championId; role } }`). Esto es coherente con que `'guide'` ya es un `ContentEntityKind` reservado — no se necesita una segunda entidad de dominio para lo mismo.                                                                  |
| `KnowledgeArticle`     | **Se mantiene**, como entidad base de todo el contenido editorial largo (guías, análisis, editoriales, explicaciones de concepto) | Es el contenedor genérico; `Guide` es su caso más restringido.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

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
  verdict: string; // la conclusión, en una frase
  reasoning: string; // el porqué
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

**Lectura de las relaciones clave** (todas expresadas como _foreign keys_ tipados dentro de cada entidad, no como una lista de aristas genérica — ver §5.1 para el porqué):

- `Build.championId`, `Build.role`, `Build.patchId` → una build siempre sabe de qué campeón/rol/parche habla.
- `Build.runePageId` (opcional) → una build puede recomendar una página de runas concreta sin duplicar sus datos.
- `TierListEntry.buildId` / `TierListEntry.runePageId` (opcionales) → una entrada de tier list puede señalar directamente la build recomendada para ese campeón ese parche.
- `Matchup.championId` / `Matchup.opponentChampionId` / `Matchup.role` → el matchup es simétrico en los datos pero direccional en la narrativa (siempre se lee "cómo juega Tidusss `championId` contra `opponentChampionId`").
- `Synergy.championIds` (2 o más) → cubre tanto dúos de línea como combos de equipo con el mismo tipo.
- `KnowledgeArticle.relatedConceptIds` / `relatedChampionIds` → un artículo enlaza los conceptos y campeones que toca, sin que el Concept o el Champion tengan que "saber" qué artículos los mencionan (se resuelve en consulta, vía `getChampionKnowledge`).
- `MetaState.patchId` + `Patch.sequence` → permite construir el Meta Timeline con un simple `sort`, sin fecha de calendario obligatoria.

### 5.1 Por qué _foreign keys_ tipados y no una lista de aristas genérica (a diferencia del Content Graph)

El Content Graph usa una lista plana de `ContentRelation { from, to, kind, label, priority }` porque su propósito es **navegación editorial laxa** ("quizá también quieras ver…"), donde cualquier par de entidades puede conectarse con cualquier verbo. El Laboratorio necesita **consultas estructurales precisas** ("dame todos los matchups de Lucian en ADC", "dame la tier list de soporte del parche 14.15") — eso se resuelve mejor con campos tipados directos (`matchup.role`, `tierList.patchId`) que se pueden filtrar con `Array.prototype.filter` sin tener que interpretar un `kind` de relación genérico. Son dos modelos de relación distintos a propósito, para dos propósitos distintos — y se conectan entre sí mediante el puente del §6, no compartiendo un único esquema.

## 6. Integración con el Content Graph

`src/domain/league-laboratory/content-graph-bridge.ts` contiene funciones puras que convierten entidades del Laboratorio en `ContentEntity`/`ContentRelation` del Content Graph — el mismo patrón exacto que ya usa `domain/content-graph/adapters.ts` para convertir un `RecentMatch` de Riot o un `YouTubeVideo` en una entidad navegable.

| Entidad del Lab                                    | `ContentEntityKind` reutilizado | ¿Ya reservado en `content-graph/types.ts`? |
| -------------------------------------------------- | ------------------------------- | ------------------------------------------ |
| `LabChampion`                                      | `champion`                      | Sí                                         |
| `Patch`                                            | `patch`                         | Sí                                         |
| `Build`                                            | `build`                         | Sí                                         |
| `Guide` (`KnowledgeArticle` con `format: 'guide'`) | `guide`                         | Sí                                         |
| `Matchup`                                          | `matchup`                       | Sí                                         |
| `TierList`                                         | `tier-list`                     | Sí                                         |
| `RunePage`                                         | —                               | **No**                                     |
| `Synergy`                                          | —                               | **No**                                     |
| `Concept`                                          | —                               | **No**                                     |
| `MetaState`                                        | —                               | **No**                                     |

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

**Ambiente visual:** se recomienda un único `EnvironmentId` de marca (`'laboratory'`, a añadir a `data/environments.ts` cuando se implemente la primera herramienta) compartido por _todas_ las herramientas del Laboratorio, en vez de un ambiente distinto por herramienta. El `'tier-list'` ya reservado en el Environment Engine puede mantenerse como alias del mismo ambiente o retirarse en favor de uno solo — es una decisión de implementación, no de este documento, pero la recomendación de producto es **una sola atmósfera para todo el Laboratorio**, para que se sienta como un espacio propio y coherente (justo lo contrario de la sensación de "spreadsheet" de OP.GG/U.GG).

### 7.2 Navegación

- Entrada principal (futura, no implementada hoy): un ítem en `data/site.ts#navigation` apuntando a `/laboratory`.
- Navegación secundaria _dentro_ del Laboratorio: pestañas o barra lateral con las herramientas activas (inicialmente solo "Tier List"; el resto aparecen a medida que se construyen — nunca se muestra un enlace a una herramienta que no existe todavía, coherente con la regla del Content Graph de no publicar entidades `planned` navegables).

### 7.3 Componentes reutilizables (contratos, no implementación visual)

- **`KnowledgeCard`** — la tarjeta base para Champion/Build/Matchup/Concept/Guide/entrada de Tier List. Se recomienda el mismo patrón **Template + Render** que ya usa el Match History (`live/matches/render.ts`): un `<template>` compuesto por subcomponentes de marcado puro, rellenado por una función de render compartida — cero coste de hidratación, ya validado en producción.
- **`ScopeFilterBar`** — un único componente de filtro (Patch + Role) reutilizado por toda herramienta que consuma `KnowledgeScope`.
- **`EditorialTakeBadge`** — el átomo visual que muestra `verdict` + `confidence` de forma consistente en cualquier tarjeta. Es, visualmente, la firma que diferencia al Laboratorio de un sitio de estadísticas — debe aparecer en _toda_ tarjeta que tenga un `EditorialTake`, nunca ser opcional a nivel de diseño aunque el campo de dominio sea, en algunos value objects, opcional.
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

| Elemento                                                       | Estado                                                                                                                                        |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/league-laboratory/types.ts`                        | ✅ Creado (extendido en Phase 1, ver §12.2)                                                                                                   |
| `src/domain/league-laboratory/scope.ts`                        | ✅ Creado (extendido en Phase 1: `roleLabel`, `queueLabel`)                                                                                   |
| `src/domain/league-laboratory/registry.ts`                     | ✅ Creado (extendido en Phase 1: `hydrateLabRegistry`)                                                                                        |
| `src/domain/league-laboratory/content-graph-bridge.ts`         | ✅ Creado — **ahora invocado en producción** desde `domain/content-graph/registry.ts` (Phase 1, §12.4)                                        |
| `src/domain/league-laboratory/index.ts`                        | ✅ Creado (barrel)                                                                                                                            |
| Datos reales (campeones, parches, tier list)                   | ✅ Parcial desde Phase 1 — ver §12.3 (solo la Tier List ADC; Build/RunePage/Matchup/Synergy/Concept/KnowledgeArticle/MetaState siguen vacíos) |
| Rutas públicas                                                 | ✅ `/tier-list` (Phase 1). `/laboratory` como hub todavía no existe                                                                           |
| Componentes visuales                                           | ✅ Parcial — ver §12.5 (los de la Tier List). Build Explorer, Rune Explorer, etc. siguen sin construir                                        |
| Endpoints/Functions                                            | ❌ No existen — la Tier List es contenido 100% estático, sin API propia                                                                       |
| Cambios en Home, Live, Match History o cualquier API existente | ❌ Ninguno, verificado (§12.4, §12.9)                                                                                                         |

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

**Por qué solo Lucian tiene una valoración real:** es el único campeón sobre el que el repositorio ya documenta información editorial explícita y verificable (título del sitio, `data/content.ts#recognition`, la entidad `champion:lucian` del Content Graph). Para el resto, el encargo prohíbe explícitamente inventar una opinión atribuida a Tidusss — así que se muestran como placeholder honesto en vez de fabricar una clasificación completa. El verdict de cada placeholder dice literalmente _"Placeholder editorial — pendiente de revisión por Tidusss"_; nunca se presenta como un veredicto real.

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
- **Hallazgo de auditoría aplicado:** el patrón `[data-reveal]` que Home/Live usan para el _reveal_ al hacer scroll define `opacity: 0` por defecto en `global.css`, y solo se corrige a `opacity: 1` mediante JavaScript (incluso la rama de `prefers-reduced-motion` necesita JS para detectarlo y aplicar la clase). Es decir, ese patrón concreto **no** es seguro sin JavaScript. Se decidió **no reutilizarlo** en esta página precisamente para poder cumplir "la página debe seguir siendo útil sin JavaScript" de forma literal, no aproximada.
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

Cada uno de los 7 bloques de conocimiento (vídeos, partidas, builds, runas, matchups, sinergias, conceptos) tiene un estado vacío propio y honesto, nunca genérico: explica _por qué_ está vacío (algunos, como partidas, explican explícitamente "no inventamos una relación que no existe") y, cuando tiene sentido, ofrece un siguiente paso real (canal de YouTube, Live). El perfil editorial ausente ("El perfil editorial de Kai'Sa todavía no existe") dice explícitamente que el campeón ya es parte del Laboratorio y que su ficha crecerá — nunca aparenta ser un error o contenido roto.

### 13.10 SEO

`noindex, follow` automático para las 3 fichas sin perfil real (ver ADR-007) — indexado solo Lucian, la única página con contenido suficiente para ser un buen resultado de búsqueda. `sitemap.xml` solo incluye `/campeones/lucian`. Title/description por campeón, distintos según haya o no perfil, nunca presentando el estado vacío como contenido definitivo. Sin datos estructurados: la razón ya documentada en Phase 1 (§12.7) aplica igual aquí.

### 13.11 Accesibilidad

Jerarquía semántica correcta (`h1` el nombre del campeón, `h2`/`h3` dentro del perfil, `h3` en cada bloque de conocimiento). Foco visible heredado del sistema global. El estado "tier pendiente" se comunica con texto ("Todavía sin clasificar") además de un badge con borde discontinuo, nunca solo color. Objetivos táctiles del enlace de estado de tier y de los CTA de estado vacío consistentes con el resto del Laboratorio (≥44px). Sin animaciones nuevas más allá de una transición de 0.2s ya guardada tras `prefers-reduced-motion`.

### 13.12 Rendimiento

Retrato del campeón como único elemento `loading="eager"`/`fetchpriority="high"` (el elemento principal above-the-fold de esta página), con `width`/`height` explícitos (308×560, las dimensiones reales del asset) para evitar _layout shift_. El resto de imágenes (ninguna en esta página, ya que solo se usa el retrato) no aplica. Cero JavaScript de cliente nuevo: la página entera se renderiza en servidor, sin ningún `<script>` propio.

### 13.13 Deuda técnica detectada

| Elemento                                                                                            | Severidad | Descripción                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Duplicación de `Role`/`roleLabel` entre `LiveDashboard.astro` y `domain/league-laboratory/scope.ts` | Media     | Ya detectada en Phase 1, sigue sin resolver — ahora con un segundo consumidor (`ChampionHeader`) además de la Tier List. Cuantos más consumidores, más cara será la eventual unificación.                                                                             |
| `champion.title` sin poblar en el dominio                                                           | Baja      | Campo preparado pero vacío en las 4 entradas reales, por precaución ante localización no verificada (§13.4). No es deuda urgente, pero alguien debe rellenarlo con la fuente correcta antes de que se acumulen más campeones sin título.                              |
| `ChampionHeader`/`ChampionProfileSection`/`ChampionTierStatus` sin generalizar todavía              | Baja      | Correcto para un solo consumidor; revisar en cuanto exista una segunda herramienta que muestre un campeón de forma prominente (Matchup Explorer, probablemente).                                                                                                      |
| Ausencia de tests automatizados para las funciones puras de `registry.ts`                           | Media     | El refactor a fábrica pura (ADR-006) hace que estas funciones sean triviales de testear (sin mocks de estado global) — una oportunidad barata que sigue sin aprovecharse, heredada de la falta general de tests del proyecto (ya señalada en `PLATFORM_BIBLE.md` §8). |

### 13.14 Riesgos futuros

- Si se añade un segundo parche real, `ChampionProfile.editorialTake.lastReviewedPatch` permitirá detectar perfiles desactualizados — pero nada lo comprueba todavía de forma activa (mismo riesgo ya señalado en Phase 1, §12 de `docs/league-laboratory.md`, ahora también aplicable al perfil del campeón, no solo a la entrada de Tier List).
- El fichero `content-graph/league-laboratory-extension.ts` concentra ya bastante lógica de proyección; si crece mucho más (Build Explorer, Matchup Explorer), podría merecer dividirse por tipo de entidad — vigilar, no actuar todavía.

### 13.15 Verificación manual realizada

`astro preview` en navegador real: contenido completo verificado en `/campeones/lucian` (perfil completo) y `/campeones/kaisa` (estado vacío honesto); `data-environment="champion"` confirmado; meta robots verificado por campeón (`index` solo Lucian); responsive a 375px sin _overflow_ horizontal; sin errores de consola; capturas de pantalla revisadas como diseñador (ver crítica de diseño en el informe de entrega). Se detectó y corrigió durante esta verificación que el estado vacío de retrato (`champion-identity-fallback`, pensado para el icono pequeño de 56px de la Tier List) se habría visto diminuto dentro del marco grande del retrato — corregido con una regla con mayor especificidad, sin duplicar la regla base.

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

## 14. Phase 3 — El campeón como centro del ecosistema: catálogo a escala (~170 campeones)

### 14.1 La pregunta que se respondió antes de escribir código

_"¿Cómo cambiaría mi arquitectura si mañana Riot añadiese 30 campeones nuevos?"_

Con el diseño de Phase 2, la respuesta honesta era mala: **habría que escribir 30 objetos `LabChampion` a mano**, uno por campeón, copiando nombre/título/icono/slug de cada uno. Eso no es una arquitectura que "soporte 170+ campeones sin modificarse" — es una que exige trabajo manual proporcional al tamaño del roster, para siempre. Esa era la señal de que el modelo de Phase 2 mezclaba dos cosas que no debían vivir juntas: **el hecho de que un campeón existe** (nombre, título oficial, clase, icono — Riot ya lo sabe y lo publica) y **lo que Tidusss opina de él** (que por definición nunca puede generarse automáticamente).

### 14.2 Decisión: separar el catálogo (factual) de la curación (editorial)

Se dividió lo que antes era un único `LabChampion` en dos:

- **`ChampionCatalogEntry`** — hechos objetivos y oficiales de Riot: `name`, `title` (verificado, no adivinado — ver §14.5), `tags` (clases oficiales), `riotDifficulty` (1-10, la propia escala de Riot), `dataDragonKey`. Existe para **los ~170 campeones del juego**. Se genera con `scripts/sync-champion-catalog.mjs` desde Data Dragon — nunca se escribe a mano.
- **`LabChampion`** (recortado) — solo lo que Tidusss cura: `roles` (en qué posición sigue este sitio al campeón), `playstyleTags` (su propia lectura, distinta de las clases de Riot), `signatureNote`, `profile?` (el perfil editorial completo). Existe **solo para los campeones de los que el Laboratorio dice algo** — hoy 4, con vocación de crecer sin que la arquitectura cambie.

`ChampionKnowledge` (la agregación que consume la página) pasó de asumir siempre un `LabChampion` a `{ catalogEntry, labChampion?, ... }` — `catalogEntry` siempre existe si el campeón es real; `labChampion` es ausente para la inmensa mayoría, y todo el resto de la página lo trata como tal, no como un error.

**Por qué dos tipos y no uno con campos opcionales superpuestos:** con un único tipo, un futuro regenerado del catálogo tendría que fusionarse con cuidado para no pisar el trabajo editorial ya escrito. Con dos archivos completamente separados (`catalog/champions.generated.ts` vs `champions.ts`), el generador **físicamente no puede** tocar el trabajo de Tidusss — no porque se acuerde de tener cuidado, sino porque no importa ni conoce ese archivo. Es una garantía de diseño, no una norma de proceso.

### 14.3 El generador: `scripts/sync-champion-catalog.mjs`

Un script de Node (sin dependencias nuevas: usa `fetch` nativo) que:

1. Consulta `https://ddragon.leagueoflegends.com/api/versions.json` para la versión vigente.
2. Descarga `champion.json` en `es_ES` (el idioma del sitio) para esa versión.
3. Convierte cada entrada en un `ChampionCatalogEntry`, con un slug derivado de forma determinista (`slugify`: inserta guiones en los cambios de minúscula→mayúscula y pasa a minúsculas — "AurelionSol" → "aurelion-sol", "JarvanIV" → "jarvan-iv", "KSante" → "k-sante").
4. Verifica que no haya slugs duplicados (falla el script si los hay — nunca falla en silencio).
5. Escribe `src/data/league-laboratory/catalog/champions.generated.ts`, con cabecera explícita de "generado, no editar a mano", versión y fecha.

**Ejecutado de verdad durante este trabajo** (no es un ejercicio teórico): `npm run sync:champions` contra Data Dragon real generó **173 campeones**, incluidos varios publicados después del corte de conocimiento del autor de este cambio (Ambessa, Aurora, Mel, Yunara, Zaahen) — la prueba más directa posible de que la arquitectura no necesita saber nada sobre un campeón nuevo para generarle una página correcta.

**Por qué no se hace en el build (`astro build`):** el build estático de este proyecto **nunca** depende de la red — ni siquiera para Riot/YouTube/Twitch, que se resuelven en tiempo de petición vía Cloudflare Pages Functions, jamás en build (principio ya documentado en `docs/riot-api.md` y `PLATFORM_BIBLE.md` §8). Si el catálogo se generase en cada build, una caída puntual de Data Dragon rompería el build **de todo el sitio**, incluidos Home y Live — que hoy son inmunes a que Riot esté caído. `npm run sync:champions` es una herramienta de desarrollo que un humano ejecuta cuando toca actualizar el catálogo; su resultado se commitea como cualquier otro cambio de datos, exactamente igual que `data/content.ts` cuando hay un hito nuevo.

### 14.4 Sistema de rutas: por qué `/campeones/<slug>` seguía siendo suficiente

Se evaluaron explícitamente las alternativas que planteaba el encargo:

- **Versionado en la URL** (`/campeones/lucian/16.14`) — descartado. La identidad de un campeón no está versionada por parche; lo que cambia por parche es su valoración (ya vive en `TierListEntry`/`ChampionProfile.editorialTake.lastReviewedPatch`), no la URL de su ficha. Versionar la URL fragmentaría el SEO y el enlazado de un mismo campeón en N URLs sin necesidad real.
- **Colecciones** (`/campeones/tirador/`, agrupando por clase) — no se construyeron todavía, pero el catálogo ya las deja preparadas (`tags` existe y es real para los 170). Es un candidato natural para un capítulo futuro, no para este.
- **Contenido generado** — es exactamente lo que se construyó (§14.3).

Lo que cambió no fue la forma de la ruta, sino **de dónde saca `getStaticPaths()` la lista de campeones**: antes, 4 objetos hechos a mano; ahora, los 173 del catálogo. Añadir 30 campeones mañana no toca `[slug].astro` en absoluto — solo regenera el catálogo.

### 14.5 Un hallazgo que confirma por qué no se debe adivinar contenido

En Phase 2 se dejó `LabChampion.title` sin rellenar para los 4 campeones, explícitamente por precaución ante no tener verificada la cadena exacta de localización. Con el catálogo real ya generado, se puede comprobar: el título real de Lucian en español es **"El Destello Purificador"**, no "El Purificador" (la suposición razonable, pero no verificada, que se había descartado a propósito en Phase 2). Es la validación empírica de aquella decisión — adivinar habría producido un dato incorrecto publicado en el sitio.

### 14.6 Content Graph: se mantiene la política de Phase 2, ahora a propósito y documentada

Los ~170 campeones del catálogo **no** se registran como nodos del Content Graph — solo los 4 con curación editorial (`adcLabChampions`), igual que en Phase 2. No es una limitación nueva: es la misma decisión, ahora puesta a prueba a una escala 40 veces mayor y confirmada como correcta (ver ADR-009 para la justificación completa). `content-graph/league-laboratory-extension.ts` ahora resuelve el `ChampionCatalogEntry` de cada `LabChampion` curado para construir su `ContentEntity` (nombre, slug), en vez de leerlo directamente del propio `LabChampion` (que ya no lo tiene).

### 14.7 Desacoplo de versión de Data Dragon

Antes (Phase 2), las imágenes de campeón usaban `patch.dataDragonVersion` — el parche declarado por la Tier List (`15.14.1`, ya desactualizado frente al real `16.14.1` en el momento de este trabajo). Ahora las imágenes de `/campeones/*` usan **`championCatalogVersion`** (la versión con la que se generó el catálogo, siempre coherente con los assets que describe), completamente desacoplada del parche editorial de la Tier List. Son dos conceptos distintos: "con qué versión de Data Dragon se resuelven las imágenes" vs. "de qué parche habla esta Tier List" — mezclarlos fue un acoplamiento accidental de Phase 2, corregido aquí sin tocar el contenido de la Tier List (que sigue diciendo "15.14", sin cambios, fuera de alcance de este trabajo).

Consecuencia práctica: el bloque de metadatos ("Parche…") en la ficha de un campeón **solo se muestra cuando hay contenido realmente anclado a un parche** (`profile.editorialTake.lastReviewedPatch`) — antes se mostraba siempre el parche de la Tier List, incluso en campeones de los que no se ha dicho nada, insinuando un contexto que no existía.

### 14.8 Conceptos y Guías: una ambigüedad de Phase 2 resuelta

`ChampionKnowledge.articles` (Phase 2) mezclaba dos cosas que el propio encargo pide como conexiones distintas: "Guías" y "Conceptos". Se separó en `guides: readonly Guide[]` (artículos con `format: 'guide'`) y `concepts: readonly Concept[]` — estos últimos resueltos por una función nueva, `getRelatedConceptsFor()`, que recorre las guías, matchups y sinergias del campeón y reúne los `Concept` que mencionan, sin que ningún componente tenga que conocer esa cadena. La página del campeón pasó de 7 a **8 secciones de conocimiento**, alineadas 1:1 con la lista del encargo.

### 14.9 Componentes: cambios y por qué

| Componente                                                                                                                                 | Cambio                                                                         | Motivo                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ChampionIdentity.astro`                                                                                                                   | Prop `champion: LabChampion` → `champion: ChampionCatalogEntry`                | Solo necesitaba nombre e icono — datos que ahora viven en el catálogo. Se eliminó también la rama de _fallback_ sin icono: con el catálogo, `dataDragonKey` es siempre real.               |
| `ChampionHeader.astro`                                                                                                                     | Reescrito: `catalogEntry` + `labChampion?` + `role?` (antes obligatorio)       | El rol ya no está garantizado para el 96% de los campeones. Se añadieron "Clase" (`tags`) y "Dificultad según Riot" — contenido real y significativo incluso sin ninguna curación.         |
| `TierListSection.astro` / `TierListPendingSection.astro`                                                                                   | `Map<LabChampionId, LabChampion>` → `Map<LabChampionId, ChampionCatalogEntry>` | Mismo motivo que `ChampionIdentity`; cero cambio de lógica.                                                                                                                                |
| `ChampionTierStatus.astro`, `ChampionProfileSection.astro`, `ChampionKnowledgeSection.astro`, `EditorialTakeCard.astro`, `TraitList.astro` | Sin cambios                                                                    | Ya estaban diseñados sobre datos genéricos (nombre de campeón como string, perfil opcional) — la auditoría previa a escribir código confirmó que no hacía falta tocarlos, y no se tocaron. |

**CSS muerto detectado y eliminado durante la autocrítica final:** `.champion-identity-fallback` (dos reglas) dejó de tener ningún consumidor en cuanto `ChampionIdentity`/`ChampionHeader` dejaron de necesitar una rama sin icono. Se eliminó en vez de dejarlo "por si acaso".

### 14.10 Verificación realizada

Build real: **176 páginas** (173 campeones + Home + Live + Tier List) en menos de un segundo. Verificado en navegador: una ficha completamente sin curar (`/campeones/ambessa`, dificultad Riot 10/10, sin rol, sin badge de especialidad, sin indicador de confianza) muestra contenido real y honesto en cada uno de sus bloques, sin una sola afirmación inventada; responsive a 375px sin _overflow_; `data-environment="champion"` correcto; cero errores de consola. Comparación de HTML de `dist/index.html`, `dist/live/index.html` y `dist/tier-list/index.html` antes/después: Home y Live bit a bit idénticos; Tier List cambia únicamente en que sus enlaces a campeones apuntan a `/campeones/<slug>` en vez de a `/live` (cambio ya introducido en Phase 2, no en esta fase).

### 14.11 Deuda técnica y riesgos (acumulado con Phase 1-2)

| Elemento                                                                                                                                         | Severidad | Estado                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Duplicación `Role`/`roleLabel` (Live vs. Laboratorio)                                                                                            | Media     | Sin resolver, ya señalada en Phase 1-2                                                                                                                                                                             |
| `championCatalogGeneratedAt` exportado pero sin ningún consumidor todavía                                                                        | Baja      | **Resuelto en Fase 4 (ADR-010):** eliminado por completo — rompía el determinismo del generador sin aportar nada, ver §15                                                                                          |
| Sin tests para `sync-champion-catalog.mjs` ni para las funciones de agregación de `registry.ts`                                                  | Media     | **Resuelto en Fase 4 (ADR-010):** 47 tests con `node:test` nativo, ver §15                                                                                                                                         |
| El catálogo completo (173 entradas) se importa transitivamente en cualquier página que toque `content-graph/registry.ts` (Home y Live incluidas) | Baja      | Sin impacto de bytes de cliente verificado (todo se resuelve en build, ningún `<script>` lo transporta), pero es un acoplamiento de grafo de módulos a vigilar si el catálogo crece mucho más o gana lógica pesada |
| Colecciones por clase (`/campeones/tirador/`, etc.)                                                                                              | —         | Deliberadamente no construidas — ver §14.4                                                                                                                                                                         |

### 14.12 Recomendaciones para el próximo capítulo

1. Antes de construir Build Explorer o Rune Explorer, decidir si necesitan iterar el catálogo completo (para "quién no tiene build todavía") o solo `adcLabChampions` — el registro ya soporta ambos casos sin cambios.
2. Si se documenta una segunda Tier List (otro rol), revisar si el parche mostrado en la ficha de campeón debería poder proceder de más de una fuente además de `ChampionProfile.editorialTake.lastReviewedPatch`.
3. Añadir un test que ejecute `slugify()` contra los 173 nombres reales y falle si Data Dragon cambia un `id` de forma que rompa una URL ya indexada (Lucian, hoy el único indexado, es el caso crítico a proteger).
4. Considerar una página `/campeones/` (índice navegable del catálogo, filtrable por clase) como aplicación natural de las colecciones descartadas en §14.4 — solo cuando haya más de 4 fichas con contenido real, para no invitar a explorar 169 páginas vacías.

**Las recomendaciones 3 y 4 de esta lista son exactamente lo que resuelve la Fase 4 (§15).**

## 15. Fase 4 — Blindaje del catálogo y Centro de Campeones

Con el catálogo a escala real (173 campeones, Fase 3) pero sin ninguna prueba automatizada ni ningún punto de entrada público que los agrupara, esta fase resuelve ambas carencias: primero "blinda" el catálogo con pruebas reales, y sobre esa base construye `/campeones` — el Centro de Campeones.

### 15.1 Estrategia de testing: `node:test` nativo, sin dependencias nuevas

Antes de escribir ningún test se auditó `package.json` (Node `>=22.12.0`, TypeScript `^6.0.3`, sin ningún test runner instalado) para justificar la herramienta en vez de asumirla. `node:test` + `node:assert/strict` son nativos y estables en el Node instalado (24.18.0); no se añadió Vitest, Jest ni ningún otro framework.

**El obstáculo real:** los archivos de dominio usan imports relativos sin extensión (`from './types'`), convención ya asentada en todo `src/domain`. La resolución ESM nativa de Node exige extensión explícita o falla con `ERR_MODULE_NOT_FOUND`. Reescribir esos imports solo para que los tests los pudieran importar habría sido tocar código de producción por una necesidad puramente de tooling. Se optó por lo contrario: un hook de resolución (`scripts/testing/register-ts-loader.mjs`) que, cuando la resolución nativa falla para un especificador relativo sin extensión, reintenta primero como archivo (`./types` → `./types.ts`) y luego como directorio/barrel (`../league-laboratory` → `../league-laboratory/index.ts`) — el mismo comportamiento en dos pasos que Node ya aplica de forma nativa para `.js`. Se usa `module.registerHooks()` (API síncrona, en el mismo proceso) y no `module.register()` (marcada `@deprecated` en `@types/node`, exige un segundo archivo cargado en un hilo de hooks aparte).

Se añadió `@types/node` como única dependencia nueva — de desarrollo, sin efecto en runtime ni en el bundle final — porque los tests importan `node:test`/`node:assert/strict` por su nombre y `astro/tsconfigs/strict` no restringe el campo `types`, así que sin el paquete `astro check` no podía resolver esos tipos.

**Un bug real de la primera versión del loader:** un chequeo de "¿el especificador ya tiene extensión?" basado en `/\.[a-z]+$/i` confundía nombres de archivo con puntos internos (`champions.generated`) con una extensión real, y se saltaba el reintento. Se corrigió con una lista explícita de extensiones conocidas (`.ts`, `.tsx`, `.js`, `.mjs`, `.cjs`, `.json`, `.node`). Detectado y corregido durante la propia ejecución de los primeros tests, no por revisión de código.

### 15.2 Determinismo del generador: `championCatalogGeneratedAt` eliminado

Al escribir el test de estabilidad de slugs se comprobó (búsqueda exhaustiva de `championCatalogGeneratedAt` en todo el repo) que ese campo —una marca de tiempo `new Date().toISOString()` incluida en cada archivo generado— no tenía ningún consumidor. Además rompía la reproducibilidad: dos ejecuciones de `npm run sync:champions` con los mismos datos de Data Dragon producían un archivo distinto solo por la fecha de generación.

**Decisión:** eliminarlo. No se sustituyó por un hash ni por ningún otro valor derivado — `championCatalogVersion` (la versión de Data Dragon) ya identifica el snapshot de datos de forma determinista y con significado real; un consumidor que quiera saber "cuándo se actualizó el catálogo" puede mirar el historial de git del archivo, que es la fuente de verdad real para esa pregunta. **Verificación empírica:** se ejecutó el script dos veces seguidas y se comparó el SHA-256 del archivo generado — idéntico byte a byte en ambas ejecuciones.

De paso se eliminó la duplicación de `slugify()`: existía una copia idéntica dentro de `scripts/sync-champion-catalog.mjs` y otra iba a hacer falta para la búsqueda del Centro de Campeones (§15.4). Se extrajo una única función pura, `slugifyChampionKey`, a un archivo nuevo sin ninguna dependencia interna, `src/domain/league-laboratory/normalize.ts` (junto con `normalizeSearchText`, ver §15.4). El script `.mjs` la importa con extensión `.ts` explícita — no necesita el loader de tests, porque Node ya ejecuta `.ts` de forma nativa cuando la extensión es explícita.

El generador se refactorizó además para exponer `buildCatalogEntry` (transforma un registro crudo de `champion.json` en un `ChampionCatalogEntry`), `sortCatalogEntries` y `assertUniqueSlugs` como funciones puras, y la llamada real a Data Dragon (`main()`) quedó protegida detrás de una comprobación de "¿es este archivo el punto de entrada del proceso?" (`import.meta.url === pathToFileURL(process.argv[1]).href`) — así, importar esas funciones desde un test nunca dispara una petición de red real.

### 15.3 Cobertura de tests (47 → 52 tests tras añadir `hub.ts`, `test/league-laboratory/*.test.ts`)

| Archivo                    | Qué prueba                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `normalize.test.ts`        | Los 8 casos reales exigidos de búsqueda (Kai'Sa/kaisa, Kog'Maw/kogmaw, Rek'Sai/reksai, Cho'Gath/chogath, Bel'Veth/belveth, Dr. Mundo/dr mundo, Jarvan IV/jarvan, Miss Fortune/miss fortune) y la generación de slugs (`AurelionSol`, `JarvanIV`, `DrMundo`, `MissFortune`, `KSante`).                                                                                                  |
| `catalog.test.ts`          | Tamaño realista (≥170), unicidad de slugs e ids, formato válido de slug (`^[a-z0-9]+(-[a-z0-9]+)*$`), formato `champion:<slug>`, estabilidad de la generación de slugs contra el catálogo real, el contrato **`/campeones/lucian` exacto**, 10 casos reales con apóstrofes/puntos/mayúsculas internas resueltos contra el catálogo real (no inventados), y ningún campo factual vacío. |
| `editorial-status.test.ts` | `resolveChampionEditorialStatus` con Lucian (reviewed), Kai'Sa/Jinx/Ezreal (draft) y sin `LabChampion` (pending).                                                                                                                                                                                                                                                                      |
| `registry.test.ts`         | `buildLabRegistry({})` produce colecciones vacías nunca `undefined`; `getChampionKnowledge` para un id fuera del catálogo, para Lucian (curado) y para un campeón real sin curación editorial.                                                                                                                                                                                         |
| `hub.test.ts`              | `getCatalogCoverage` (los totales reales suman el tamaño del catálogo, y con un registro vacío no falla), `resolveRiotDifficultyBucket` (los 3 tramos), `isChampionInAnyTierList`.                                                                                                                                                                                                     |
| `content-graph.test.ts`    | La política de ADR-009 comprobada de forma ejecutable (solo los campeones curados son nodos `champion`, nunca los 173), las relaciones reales de Lucian con la Tier List oficial, y que cada entidad de campeón tiene un `href` real a `/campeones/<slug>`.                                                                                                                            |
| `sync-script.test.ts`      | `buildCatalogEntry` determinista y sin pérdida de campos, `sortCatalogEntries` estable, `assertUniqueSlugs` no lanza con slugs únicos y lanza ante una colisión real.                                                                                                                                                                                                                  |

Ejecutable con `npm run test` (`node --import ./scripts/testing/register-ts-loader.mjs --test "test/**/*.test.ts"`). No se modificó `npm run build` para no gatear los despliegues de Cloudflare Pages con esta fase — queda como recomendación explícita para un paso futuro (§15.10), no como algo decidido aquí.

### 15.4 Modelo de estado editorial: una sola función, tres estados

Se introdujo `ChampionEditorialStatus = 'reviewed' | 'draft' | 'pending'` (`types.ts`) y `resolveChampionEditorialStatus(labChampion)` (`registry.ts`) como única fuente de verdad:

```ts
if (labChampion?.profile) return 'reviewed';
if (labChampion) return 'draft';
return 'pending';
```

Aplicado a los datos reales actuales: Lucian → `reviewed` (tiene `profile`); Kai'Sa, Jinx, Ezreal → `draft` (curados, sin `profile` todavía); los otros 169 → `pending` (ni siquiera tienen `LabChampion`). Ningún componente ni plantilla reimplementa este criterio con condicionales propios — `EditorialStatusBadge.astro` es el único lugar que traduce el estado a texto visible ("Revisado" / "Borrador" / "Pendiente de revisión"), y el texto es siempre la señal principal, nunca solo el color del badge.

`src/domain/league-laboratory/hub.ts` (nuevo) añade lo que necesita el Centro de Campeones, siguiendo el mismo patrón que `content-graph/league-laboratory-extension.ts` (cada herramienta nueva amplía su propio archivo, no `registry.ts`): `getCatalogCoverage(registry)` (recuento real por estado, nunca escrito a mano), `resolveRiotDifficultyBucket(riotDifficulty)` (agrupa la dificultad oficial 0-10 en baja/media/alta — Riot sí usa 0 como valor real, no solo 1-10, corregido en el test tras un fallo real contra Akshan) e `isChampionInAnyTierList(registry, championId)`.

### 15.5 El Centro de Campeones (`/campeones`): qué es y qué no es

Explícitamente **no** es una parrilla genérica de 173 iconos sin jerarquía, **no** es un clon del champion select de Riot, y **no** es una lista plana indiferenciada. Es una herramienta editorial honesta sobre su propio estado de cobertura:

1. **Recuento real** (`LaboratoryCoverageSummary.astro`): "173 campeones en el catálogo · 1 revisado · 3 en borrador · 169 pendientes de revisión" — siempre derivado de `getCatalogCoverage`, nunca tecleado a mano, más un párrafo honesto sobre el crecimiento progresivo del Laboratorio.
2. **Destacados** (`ChampionEditorialCard.astro`, dos secciones): "Analizados por Tidusss" (hoy solo Lucian, con extracto real de su `editorialTake.verdict`) y "Presencia curada, perfil en preparación" (Kai'Sa, Jinx, Ezreal, con la misma frase honesta que ya usa `ChampionProfileSection.astro` para un perfil ausente).
3. **Catálogo completo** (`ChampionCatalogRow.astro` × 173, dentro de `<ul data-champion-catalog-grid>`): fila compacta con icono, nombre, título, clases oficiales, badge de estado — cada fila es un `<a>` a `/campeones/<slug>`.
4. **Búsqueda y filtros** (`LaboratorySearch.astro`, ver §15.6).
5. **CTA** hacia `/tier-list` y `ExploreNext` hacia el resto del grafo (ver §15.7).

### 15.6 Búsqueda y filtros: arquitectura vanilla, sin dependencias nuevas

La búsqueda reutiliza `normalizeSearchText` (§15.2) desde un `<script>` de Astro — Vite lo procesa y empaqueta como cualquier import de cliente, sin necesidad de ningún loader especial porque `normalize.ts` no tiene imports internos. No hay librería de fuzzy-search: es la misma normalización simple aplicada por igual al texto y a la consulta.

Los filtros disponibles —estado editorial, clase oficial (`tags` de Riot), dificultad (agrupada en 3 tramos), inicial (calculada de verdad sobre los nombres del catálogo, no una lista estática A-Z) y presencia en la Tier List oficial— se aplican en el cliente sobre los 173 `<li data-champion-catalog-row>` ya renderizados en el HTML, cada uno con atributos `data-status`, `data-tags`, `data-difficulty`, `data-initial`, `data-tierlist` y `data-search`. Son combinables entre sí (AND) y se sincronizan con la URL vía `history.replaceState` — nunca `pushState`, para no llenar el historial del navegador en cada tecla — y se restauran al cargar la página leyendo `location.search`: un enlace `/campeones?estado=reviewed&tierlist=1` reproduce exactamente ese estado (verificado en navegador). Un `<p role="status" aria-live="polite">` anuncia el recuento de resultados a lectores de pantalla en cada cambio.

**Filtro descartado explícitamente: "rol editorial".** Ese dato (`LabChampion.roles`) solo existe para los 4 campeones curados; ofrecerlo como filtro sobre un catálogo de 173 habría dejado la inmensa mayoría fuera de cualquier selección posible — un control real pero inútil en la práctica actual. Queda como candidato para cuando la curación editorial crezca lo suficiente.

**Degradación sin JavaScript:** los 173 elementos se renderizan siempre visibles — el script de filtros nunca los oculta por defecto. A diferencia del patrón `[data-reveal]` que usan Home/Live (oculto por defecto, visible solo tras una clase añadida por JS), aquí no hay ningún estado inicial oculto: sin JavaScript, los controles de búsqueda y filtro quedan presentes pero inertes — no filtran nada, pero tampoco rompen ni esconden contenido. El mensaje de "sin resultados" también existe en el HTML con `hidden` estático desde el servidor; solo JavaScript lo muestra u oculta según haya coincidencias.

### 15.7 Content Graph y navegación

Se añadió una entidad `tool:champion-hub` (href `/campeones`) en `content-graph/league-laboratory-extension.ts`, con relaciones reales en ambas direcciones hacia la Tier List oficial y hacia cada uno de los 4 campeones curados. Se respeta ADR-009 sin excepción: los ~169 campeones sin curación editorial no se registran en el grafo por esta fase — su única vía de descubrimiento sigue siendo el propio Centro de Campeones o el enlace directo. Además, las 173 fichas de campeón (`[slug].astro`) llevan ahora un enlace plano —no una relación de grafo— de vuelta a `/campeones`, en la misma fila de CTA donde ya vivían los enlaces a `/tier-list` y a `/live`.

**Navegación principal:** se evaluó y se decidió **no** añadir `/campeones` a `src/data/site.ts` — el mismo criterio ya aplicado a `/tier-list` (tampoco está en el nav, pese a llevar dos fases publicada). El nav principal está curado en torno a las secciones de la portada de una sola página; el descubrimiento de las herramientas del Laboratorio ocurre por Content Graph y enlaces cruzados. Cambiar ese criterio solo para `/campeones` habría sido inconsistente con `/tier-list`.

### 15.8 SEO y sitemap

`/campeones` es indexable (no pasa `noindex` a `BaseLayout`, que por defecto es `false`) porque ofrece contenido único y real: el recuento honesto de cobertura y los extractos editoriales de los campeones destacados. El canónico se calcula solo a partir de `Astro.url.pathname` — propiedad que ya existía desde `BaseLayout.astro` original, no algo añadido en esta fase — así que ninguna combinación de `?q=`/`?estado=`/`?clase=`/etc. en la URL puede generar un canónico distinto ni fragmentar el SEO de la página.

`public/sitemap.xml` gana una única línea nueva, `/campeones`. Se evaluó y se descartó explícitamente añadir `@astrojs/sitemap` o generar dinámicamente un listado con las 173 URLs del catálogo (169 de ellas `noindex`): no aporta valor SEO real (Google no necesita un sitemap para encontrar páginas ya enlazadas desde `/campeones`) y habría contradicho la instrucción explícita de no reescribir el SEO existente por completo en esta fase.

### 15.9 Corrección de idioma en páginas ya publicadas

Al construir el Centro de Campeones se detectó que "The League Laboratory" (nombre de producto en inglés) seguía apareciendo como texto visible en páginas **ya publicadas** antes de esta fase: el valor por defecto de `LaboratoryHero.astro`, el eyebrow de `/tier-list`, el título/meta-descripción/eyebrow de `/campeones/[slug]`, el eyebrow de `ChampionHeader.astro` y el `editorialSummary` de `patch1514`. Esto incumplía la instrucción vigente de usar terminología en español en todo texto editorial visible ("El Laboratorio", nunca "League Laboratory", en copy público). Se corrigió en los cinco sitios a "El Laboratorio" — un cambio de copy puro, sin impacto arquitectónico, necesario para que el Centro de Campeones nuevo no introdujera una inconsistencia visible frente a páginas ya en producción. El nombre interno del módulo (`league-laboratory`, este documento, comentarios de código) no cambia — sigue siendo una convención técnica ya asentada, no copy público.

### 15.10 Verificación realizada

`npx astro check` (134 archivos, 0 errores), `npm run lint` (sin salida), `npm run test` (52/52), `npm run build` (**177 páginas**: 173 campeones + `/campeones` + Home + Live + Tier List) — todo verificado tras cada bloque de cambios, no solo al final. Determinismo del generador verificado por hash SHA-256 en dos ejecuciones consecutivas.

Verificación manual en navegador (servidor de desarrollo real, no solo el build): `/campeones` con recuentos reales (173/1/3/169) y las 173 filas visibles sin JavaScript; búsqueda de `kaisa`, `jarvan` (coincide con "Jarvan IV" como subcadena) y `dr mundo`, todas correctas; combinación `?estado=reviewed&tierlist=1` restaura exactamente el estado esperado (solo Lucian, botón y checkbox marcados); consulta sin resultados muestra el estado vacío; sin errores de consola en ninguna página tocada; `/campeones/lucian` y `/campeones/aatrox` (sin curación) ambas con el enlace nuevo a `/campeones` y el eyebrow correcto en español; `/tier-list`, `/` y `/live` verificados sin regresiones (sin errores de consola, contenido intacto). Responsive a 375px sin _overflow_ horizontal.

### 15.11 Deuda técnica y riesgos (acumulado con Fases 1-3)

| Elemento                                                                                                                 | Severidad | Estado                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Duplicación `Role`/`roleLabel` (Live vs. Laboratorio)                                                                    | Media     | Sin resolver, ya señalada en fases anteriores                                                                                                 |
| El catálogo completo (173 entradas) se importa transitivamente en cualquier página que toque `content-graph/registry.ts` | Baja      | Sin cambio — mismo riesgo ya documentado en Fase 3                                                                                            |
| Filtro de "rol editorial" descartado por falta de datos suficientes                                                      | —         | Deliberado — ver §15.6, candidato cuando crezca la curación editorial                                                                         |
| `npm run build` no ejecuta los tests nuevos antes de compilar                                                            | Baja      | Deliberado en esta fase (no se quería gatear el despliegue de Cloudflare Pages sin una decisión explícita) — recomendado como siguiente paso  |
| Colecciones por clase (`/campeones/tirador/`, etc.)                                                                      | —         | Sigue sin construirse — el Centro de Campeones cubre parte de esa necesidad con el filtro de clase, pero no genera URLs propias por colección |

### 15.12 Recomendaciones para el próximo capítulo

1. Decidir explícitamente si `npm run test` debe pasar a ser parte de `npm run build` (o de un paso de CI separado) antes de que el catálogo vuelva a regenerarse con `npm run sync:champions` — hoy es una decisión pendiente, no tomada por esta fase.
2. Si la curación editorial crece más allá de un puñado de campeones, reconsiderar el filtro de "rol editorial" descartado en §15.6.
3. Antes de construir Build Explorer o Rune Explorer, decidir si necesitan su propia fila de filtro en `/campeones` (p. ej. "tiene build publicada") — el patrón de `hub.ts` ya soporta añadir un nuevo derivado sin tocar `registry.ts`.

## 16. Fase 5 — Guía editorial completa: Lucian

Con el catálogo a escala (Fase 3) y un punto de entrada público (Fase 4), esta fase resuelve el problema opuesto: `/campeones/lucian` tenía ya identidad editorial (Fase 2) pero **ningún** dato real en Build/RunePage/Matchup/Synergy — esos tipos existían desde el diseño de dominio original (ADR-004) sin que nadie los hubiera poblado nunca. El encargo pedía convertir esa página en "el mejor recurso en español para aprender el campeón", con la filosofía "no te digo qué construir, te explico por qué" y 17 secciones concretas, prohibiendo explícitamente inventar contenido y exigiendo que todo fuera reutilizable para cualquier otro campeón curado.

### 16.1 El modelo de dominio no aguantaba el encargo tal cual estaba

`Build.coreItemIds: number[]` y `RunePage.primaryRuneIds: number[]` (Fase 0) eran listas de ids sueltos — suficientes para un futuro "Build Explorer" que solo necesitara mostrar iconos, pero incompatibles con "cuándo comprarlo, por qué, ventajas, inconvenientes, alternativas" por objeto. Como **cero builds o páginas de runas reales existían en todo el repositorio**, no había ningún dato que migrar: se rediseñaron directamente.

- `BuildItemChoice { itemId, timing?, reasoning, pros?, cons?, alternatives? }` sustituye a los ids sueltos en `startingItems`/`coreItems`/`situationalItems`. `reasoning` no es opcional — un objeto sin razonamiento no es una build editorial.
- `Build` gana `variant: 'primary' | 'situational'` y `situationalContext?` — una sola estructura resuelve a la vez "build principal", "builds alternativas" y, dentro de `situationalItems`, "objetos situacionales — cuándo comprar cada uno" (el propio `timing` de cada `BuildItemChoice`).
- `RuneChoice { runeId, reasoning? }` sustituye a `primaryRuneIds`/`secondaryRuneIds`/`statShardIds: number[]`.
- `Matchup` gana `tips?`, `videoUrl?`, `matchHref?` — los tres opcionales, para no obligar a rellenarlos con "próximamente" literal en el propio dato.
- `LabChampion` gana `editorialHistory?: EditorialHistoryEntry[]` (fecha ISO + resumen real) y `coreConceptIds?: ConceptId[]`.

### 16.2 Conceptos: dos vías fusionadas en una sola fuente de verdad

El diseño original (`getRelatedConceptsFor`, Fase 0) solo derivaba conceptos de lo que un matchup/guía/sinergia mencionara — correcto, pero inútil mientras esas colecciones estén vacías. Se añadió una segunda vía, `LabChampion.coreConceptIds`: la curación editorial directa de qué conceptos son fundamentales para entender a un campeón, **fusionada** (no sustituida) con la derivación automática dentro de la misma función. Ningún componente conoce las dos vías por separado — `knowledge.concepts` es siempre la unión.

`concepts.ts` (nuevo) contiene las 6 definiciones reales exigidas por el encargo — Spacing, Power Spike, Snowball, Trading, Tempo, Wave Management — escritas como vocabulario objetivo ya establecido en League of Legends, no como opinión editorial de Tidusss (esa vive en el `editorialTake` de cada matchup/sinergia que los use). Lucian se enlaza directamente a 4 de los 6 (`coreConceptIds: [spacing, power-spike, trading, snowball]`) porque su `profile` ya publicado en Fase 2 los evidencia con claridad — sus debilidades y errores comunes hablan literalmente de ventanas de daño y trades, sus power spikes están enumerados explícitamente. Deliberadamente **no** se enlaza a Tempo ni Wave Management: el perfil actual no dice nada específico sobre ellos, y enlazar los 6 "porque sí" habría sido una afirmación editorial no respaldada.

### 16.3 Sin contenido inventado: builds, runas, matchups y sinergias quedan vacíos a propósito

`src/data/league-laboratory/{builds,rune-pages,matchups,synergies}.ts` se crearon como arrays vacíos, cada uno con un comentario que documenta la forma exacta de una entrada real (id, campos, ejemplo) para cuando exista contenido genuino. No existe ninguna build, página de runas, matchup o sinergia real de Lucian escrita por Tidusss todavía — ese es exactamente el conocimiento que este trabajo no podía fabricar sin convertir "no inventes contenido" en papel mojado. La página muestra el estado "Pendiente de análisis" honesto en las cinco secciones correspondientes (Build, Runas, Matchups, Sinergias, Consejos rápidos), con copy que explica _por qué_ está vacío, no solo que lo está.

### 16.4 "Partidas donde aparece": la única sección con datos verdaderamente en vivo

A diferencia de todo lo demás en esta página (contenido editorial estático, conocido en build time), existe una fuente de datos real y ya operativa para partidas: `RecentMatch.championName` (`src/lib/riot/types.ts`) ya viaja dentro de `/api/riot/overview`, la misma Function que usa Live. `ChampionMatchHistory.astro` (nuevo, genérico por `championName`) hace `fetch()` en cliente, deduplica `today.matches`/`recent.matches` por `matchId`, filtra por nombre de campeón (case-insensitive) y renderiza hasta 5 partidas reales — cero cambios de backend, cero invención.

Esto reutiliza tres archivos marcados como código huérfano en ADR-002 (Fase 0): `RiotSkeleton.astro` y `RiotUnavailable.astro` se importan sin modificar; `MatchRow.astro` no se pudo importar literalmente (es un componente Astro — solo se renderiza en build/servidor, y estos datos solo existen en tiempo de petición del navegador), pero su forma visual (clases `.riot-match`, `.riot-match-champion`, `.riot-items`, etc., ya con CSS real y sin usar hasta ahora) se replicó en un `<template>` clonado por script, exactamente el mismo patrón que ya usa Live para `MatchCard.astro`. De los 5 archivos que ADR-002 dejó como "decisión pendiente", 3 tienen ahora un uso real; `RankedSummary.astro` y `CompetitiveStatus.astro` (Home) siguen sin consumidor.

**Vídeos relacionados** no corrió la misma suerte: se auditó a fondo `YouTubeVideo` (sin campo de campeón), `contentCards`/`milestones` (copy editorial estático, no registros por vídeo) y `matchVideoLinks` (`src/config/match-video-links.ts`, un esquema real de enlace manual partida↔vídeo, pero con el array vacío). No existe ningún dato, ni automático ni manual, que asocie un vídeo concreto a Lucian. La sección mantiene el mismo estado honesto que ya tenía desde Fase 2 — "no inventamos una relación que no existe" — con CTA al canal completo.

### 16.5 Diseño: de panel denso a guía de una columna

`champion-knowledge-grid` (rejilla de 2 columnas, pensada para un puñado de bloques cortos) se sustituyó por `champion-guide-sections` — una sola columna con `gap: 4rem`. Con 11 secciones nuevas o reescritas, mantener 2 columnas habría comprimido exactamente el tipo de contenido (bloques de build, tarjetas de matchup) que necesita respirar para sentirse "editorial premium" y no "panel de estadísticas". Se crearon 10 componentes nuevos (`BuildBlock`, `BuildItemCard`, `RuneBlock`, `MatchupCard`, `SynergyCard`, `ConceptCard`, `EditorialHistoryTimeline`, `EditorialTakeBlock`, `MatchupDifficultyBadge`, `ChampionMatchHistory`), ninguno con el nombre de Lucian en su código — todos reciben el campeón como prop. Verificado sirviendo la misma página para Kai'Sa (borrador, sin `profile`) y Aatrox (sin ninguna curación): cada sección degrada a su estado vacío correcto, sin ningún error de consola.

### 16.6 SEO

Título y meta-descripción de campeones con `profile` real se reescribieron para cubrir de forma natural las consultas del encargo ("Lucian ADC", "Guía Lucian", "Build Lucian", "Lucian Master", "Lucian EUW"), usando solo hechos ya reales (Tidusss, Master ADC EUW) — sin ninguna palabra clave forzada. Se añadió `Article` en JSON-LD, condicionado a `hasProfile` (no tiene sentido marcar como artículo una ficha que dice "Pendiente" en casi todo su contenido), con `datePublished`/`dateModified` derivados del propio `editorialHistory` — nunca una fecha inventada.

### 16.7 Verificación realizada

`npx astro check` (149 archivos, 0 errores), `npm run lint` (sin salida), `npm run test` (**60/60**, incluidos 8 tests nuevos: unicidad y completitud de los 6 conceptos, resolución de `coreConceptIds` en `getChampionKnowledge` con y sin conceptos sembrados, validez de fechas ISO del historial editorial de Lucian), `npm run build` (**177 páginas**, sin cambios de recuento — esta fase no añade ni quita rutas).

Verificación manual en navegador: `/campeones/lucian` con las 17 secciones presentes y sin un solo error de consola; los 4 conceptos reales (Spacing, Power Spike, Trading, Snowball) y las 3 entradas reales de historial editorial renderizan correctamente; "Partidas donde aparece" hace el fetch real a `/api/riot/overview`, recibe 404 en `astro dev` (las Functions de Cloudflare Pages no se sirven fuera de Wrangler/producción — mismo comportamiento que ya tiene Live en este mismo entorno, no una regresión) y muestra el estado de error de forma honesta; JSON-LD presente y con fechas correctas en Lucian, ausente en Kai'Sa (sin `profile`); `/campeones/kaisa` y `/campeones/aatrox` muestran las 17 secciones en su estado vacío correcto, confirmando la reutilización; `/campeones`, `/tier-list`, `/` y `/live` verificados sin regresiones. Responsive a 375px sin _overflow_ horizontal.

### 16.8 Deuda técnica y riesgos (acumulado con Fases 1-4)

| Elemento                                                                                                            | Severidad | Estado                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sin build/runas/matchups/sinergias reales para ningún campeón, incluido Lucian                                      | —         | Deliberado — es el contenido que solo Tidusss puede aportar; la arquitectura ya está lista para recibirlo sin cambios de código                                                                         |
| Sin resolución de iconos de runa (Data Dragon no expone `id → icono` tan directo como con objetos/campeones)        | Baja      | Nueva — documentado en `RuneBlock.astro`; requeriría un sync de `runesReforged.json` análogo a `sync-champion-catalog.mjs`, no construido porque no hay ninguna `RunePage` real todavía que lo necesite |
| "Cambios recientes del campeón" (parches de balance de Riot) sin ninguna fuente de datos                            | —         | Sin tipo de dominio nuevo — no se diseñó una estructura para datos que no existen todavía, seguirá "Pendiente" hasta que haya una fuente real que justificar                                            |
| `ChampionMatchHistory` depende de la ventana de partidas que expone `/api/riot/overview` (no un histórico completo) | Baja      | Limitación de la API de Riot, no de este trabajo — ya documentado en `docs/riot-api.md`                                                                                                                 |
| `RankedSummary.astro`/`CompetitiveStatus.astro` (Home, ADR-002) siguen sin consumidor                               | Baja      | Sin cambio — 3 de los 5 archivos huérfanos de ADR-002 sí se reutilizaron en esta fase                                                                                                                   |

### 16.9 Recomendaciones para el próximo capítulo

1. Cuando Tidusss aporte contenido real de build/runas/matchups/sinergias para Lucian, escribirlo directamente en `builds.ts`/`rune-pages.ts`/`matchups.ts`/`synergies.ts` siguiendo la forma documentada en cada archivo — no requiere ningún cambio en `[slug].astro` ni en los componentes.
2. Si se decide dar soporte visual a iconos de runa, construir un `sync-rune-data.mjs` análogo al de campeones, generando un mapa `runeId → iconUrl` desde `runesReforged.json`.
3. Repetir este mismo patrón (arquitectura + componentes genéricos, contenido real solo donde exista) para el segundo campeón que Tidusss quiera curar en profundidad — la reutilización ya está verificada contra Kai'Sa y Aatrox en su estado vacío; falta verificarla contra un segundo campeón con contenido real.

## 17. Fase 6 — Contenido real de Tidusss: Lucian, parche 26.14

Con la arquitectura de la guía (Fase 5) ya construida y verificada contra datos vacíos, esta fase la completa con el criterio genuino de Tidusss para el parche 26.14 — aportado íntegramente dentro del propio encargo, sin consultar ninguna fuente externa para decidir build, runas, matchups, sinergias o power spikes.

### 17.1 Un cambio de tipos mínimo pero real: nombres en vez de ids

`BuildItemChoice`/`RuneChoice` (Fase 5) exigían `itemId`/`runeId` numérico obligatorio, pensado para resolver iconos de Data Dragon. El contenido real de Tidusss llega como nombres — "Segador de Esencia", "Ataque Intensificado" — nunca como ids, y resolverlos habría exigido consultar Data Dragon, prohibido explícitamente en este encargo. Se añadió `name: string` (obligatorio, el dato real) a ambos tipos, y `itemId`/`runeId` pasaron a opcionales. `RunePage.primaryTreeId`/`secondaryTreeId` también pasaron a opcionales: no se conoce el árbol secundario de Lucian y el tipo no puede exigir un dato que el propio encargo prohíbe adivinar. `BuildItemCard.astro`/`RuneBlock.astro` se actualizaron para mostrar un icono real cuando existe `itemId`/`runeId`, y una inicial en un cuadro simple cuando no — nunca un icono inventado.

Se añadió también `Build.boots?: BuildItemChoice[]`: un slot propio, porque las botas no encajaban ni en "objetos iniciales" ni en "objetos situacionales" (la elección de botas es independiente de qué segundo objeto se compre) y el encargo pedía presentarlas sin declarar ninguna superior a la otra — ambas opciones (Tabis / Botas Jonias de la Lucidez) llevan su propio `reasoning` sobre cuándo elegirlas.

### 17.2 Build: dos rutas completas, no una nota al margen

Se representan "ruta más sólida" y "ruta personal de Tidusss" como dos `Build` completos (`variant: 'primary'` / `'situational'`), reutilizando sin ningún cambio el mecanismo ya diseñado en Fase 5 — la prueba de que ese diseño estaba bien pensado es que no hizo falta tocarlo para esto. Ambas builds comparten el mismo primer objeto (Segador de Esencia, con Brillo como componente inicial priorizado "cuando la economía de la partida lo permite" — nunca presentado como garantizado), las mismas botas y el mismo tercer objeto situacional (Últimas Palabras de Lord Dominik contra tanques/armadura, Recordatorio Letal contra curación). Difieren solo en el segundo objeto: Filo Infinito en la ruta sólida, Navori en la personal.

El riesgo de la ruta personal —retrasar Filo Infinito si el tercer objeto necesario es penetración— se documenta en dos sitios que se refuerzan: como `cons` del objeto Navori (visible directamente en su tarjeta) y como el `editorialTake` completo de esa build (el bloque con borde dorado ya construido en Fase 5, sin ningún componente nuevo). La tensión "recomendación general" vs. "preferencia personal" se hace evidente sin depender solo del color: la etiqueta del badge ("Build principal" en dorado / "Build alternativa" en azul), un _callout_ con borde e icono bajo el título (antes texto en cursiva plano, mejorado en esta fase) y el propio `editorialTake`.

### 17.3 Runas: solo lo confirmado, el resto "Pendiente de análisis" de verdad

La `RunePage` de Lucian tiene únicamente la runa principal (Ataque Intensificado, con su razonamiento). `secondaryRunes`/`statShards` son arrays vacíos — `RuneBlock.astro` los muestra explícitamente como "Pendiente de análisis" en vez de omitir la sección en silencio, para que quede claro que falta información, no que se decidió no mostrarla.

### 17.4 Sinergias: 6 parejas confirmadas, sin inventar profundidad

Milio, Nami, Yuumi, Braum, Nautilus y Pyke se modelan como 6 `Synergy` reales, todas `type: 'lane-duo'`, sin ninguna clasificación numérica ni tier (no había fuente para eso) y con una única `editorialTake` compartida, deliberadamente breve: "recomendada por Tidusss; el análisis detallado todavía está pendiente". Ampliar cada pareja con un análisis propio queda como trabajo futuro explícito, no como algo rellenado ahora con una suposición razonable.

### 17.5 Perfil del campeón: un refinamiento y dos adiciones, sin inventar un concepto nuevo

El power spike de nivel 2 (ya existente desde Fase 2) se **editó**, no se duplicó, para incorporar el matiz de que la agresividad depende de posición, habilidades disponibles, estado de la oleada, apoyo del support y errores del rival — es el mismo hecho, refinado. La curva de escalado general (fuerte en early/mid, más débil en late) se añadió como una fortaleza y una debilidad **nuevas** dentro de `ChampionProfile` — deliberadamente sin crear un tipo de dominio nuevo, porque es la misma clase de afirmación que ya vive en `strengths`/`weaknesses`, no un concepto distinto que justificara un campo propio. Los 4 errores frecuentes nuevos del encargo se fusionaron en 3 entradas de `commonMistakes` (combos lentos y aprovechamiento de la pasiva son la misma idea, tal como pedía explícitamente el encargo para no duplicar contenido). Los 9 consejos rápidos se añadieron tal cual al nuevo campo `ChampionProfile.quickTips` (Fase 5, hasta ahora vacío para Lucian).

### 17.6 SEO: derivado de los datos reales, no escrito a mano

Título, descripción y JSON-LD ahora leen el parche y los nombres de objeto/runa directamente de `orderedBuilds`/`knowledge.runePages` — nunca de una cadena con "Segador de Esencia"/"Ataque Intensificado" escrita a mano en la plantilla. Esto es deliberado: si mañana otro campeón (Kai'Sa, Ashe...) recibe una build principal real, su página generará automáticamente un título/descripción equivalente con sus propios objetos y su propio parche, sin tocar `[slug].astro`. Sin build real (el caso de hoy para todos los campeones salvo Lucian), cae al título genérico ya existente desde Fase 5.

### 17.7 Verificación realizada

`npx astro check` (151 archivos, 0 errores), `npm run lint` (sin salida), `npm run test` (**81/81**, 21 tests nuevos: builds, runas, sinergias, perfil de Lucian, y un test explícito de no-fuga de contenido real entre campeones), `npm run build` (**177 páginas**, sin cambios de recuento).

Verificación manual en navegador: `/campeones/lucian` con ambas builds, botas, runa principal con "Pendiente de análisis" honesto en lo no confirmado, las 6 sinergias, errores frecuentes fusionados, consejos rápidos, y el historial editorial con la nueva entrada de esta fase — sin errores de consola. `/campeones/kaisa` confirma que ninguna de las secciones nuevas de Lucian (build/runas/sinergias) se filtra a otro campeón: sigue mostrando sus estados "Pendiente" originales, sin JSON-LD (no tiene `profile`). `/tier-list`, `/campeones`, `/` y `/live` verificados sin regresiones. Responsive a 375px sin _overflow_ horizontal.

### 17.8 Deuda técnica y riesgos (acumulado con Fases 1-5)

| Elemento                                                                                       | Severidad | Estado                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sin resolución de iconos de objeto/runa por nombre (solo por `itemId`/`runeId` cuando existen) | Baja      | Deliberado — los nombres reales no vinieron con ids, y no se ha consultado Data Dragon para resolverlos; las tarjetas degradan a una inicial en vez de a un icono roto |
| Matchups de Lucian siguen sin ningún dato real                                                 | —         | Fuera de alcance de este encargo explícitamente ("no matchups específicos") — sigue "Pendiente de análisis"                                                            |
| El resto del árbol de runas (secundario, fragmentos) sigue sin confirmar                       | —         | Deliberado — mismo criterio que matchups, documentado como "Pendiente" real, no relleno genérico                                                                       |
| Las 6 sinergias comparten una única `editorialTake` genérica                                   | Baja      | Deliberado por esta fase — el encargo pedía descripciones prudentes, no un análisis por pareja; candidato a profundizar en un capítulo futuro                          |

### 17.9 Recomendaciones para el próximo capítulo

1. Cuando Tidusss aporte matchups reales (dificultad, notas de fase, consejos) o el resto de la página de runas, añadirlos directamente a `matchups.ts`/`rune-pages.ts` siguiendo la forma ya documentada — no requiere ningún cambio de código.
2. Si se profundiza en alguna de las 6 sinergias con análisis propio, sustituir su `editorialTake` compartida por una específica — la estructura ya lo permite sin cambios de tipo.
3. Considerar un `sync-rune-data.mjs`/mapa manual `nombre → itemId` solo si se decide invertir en iconos reales para objetos/runas nombrados sin id — no antes, para no resolver un problema sin contenido real que lo justifique todavía.
