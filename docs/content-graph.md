# Content Graph — arquitectura de la plataforma conectada

> **Naturaleza de este documento:** arquitectura de dominio, no una guía de implementación de una función concreta. Describe el sistema que hace que **cualquier** pieza de contenido de tidusss.es —un campeón, una build, un vídeo, una partida, un concepto, un parche— pueda conocer automáticamente sus relaciones con el resto, sin que cada herramienta futura (IA, recomendaciones, buscador, SEO, Academia...) tenga que reinventar cómo se conectan las cosas. La IA (`docs/pregunta-a-tidusss.md`) es **un consumidor más** de este grafo, no su razón de ser.
> **Estado:** v2 — **diseño aprobado, cerrado a nuevas iteraciones de arquitectura salvo bloqueo técnico real durante la implementación.** La v1 (secciones "Auditoría inicial" a "Extensión futura" de más abajo) ya está construida y en producción: entidades y relaciones núcleo, la extensión de League Laboratory, los adaptadores de Riot/YouTube y el componente `ExploreNext`. Este documento **añade** el diseño completo de entidades, cardinalidad, dirección, creación automática/manual, metadatos y validación que faltaba formalizar antes de seguir ampliando el grafo. Se aprueba explícitamente **sin** introducir abstracciones multi-juego: `champion`, `rune-page`, el formato de id sin namespace de juego, y el alcance inicial de `editorial-log` a `champion` quedan registrados como **deuda técnica aceptada y deliberada**, que solo se revisa el día que exista un segundo dominio de contenido real — no antes, y no de forma especulativa.
> **Roadmap (§14):** **Fase A** (consolidación de v1), **Fase B** (`build`/`matchup` activados con contenido real; `guide` sin activar, sin fuente) y **Fase C** (`rune-page`, `synergy`, `editorial-log` activados; `concept` activado parcialmente — 4 de 6, los que tienen relación real hoy) están **completadas y verificadas**. El vocabulario de tipos ya incluye `rune-page`, `synergy`, `concept`, `editorial-log`, `explains`, `synergizes-with` y `changed-in` — cada uno se incorporó exactamente en el cambio que construyó su primer productor real, nunca antes, tal como fijó la decisión de arquitectura tomada tras la Fase A. Solo `guide` y 2 de los 6 conceptos (Tempo, Wave Management) siguen sin registrar, por ausencia de fuente o de relación real — ver §14 para el detalle exacto.
> **Relación con la documentación existente:** consumidor puro de [`league-laboratory.md`](league-laboratory.md) (no redefine ninguna entidad de ese dominio, solo decide cómo se proyecta hacia el grafo). Es la base sobre la que se apoya [`pregunta-a-tidusss.md`](pregunta-a-tidusss.md) (§4 de ese documento asume exactamente los mecanismos de enlace que aquí se especifican). Referenciado como capítulo de arquitectura transversal en `PLATFORM_BIBLE.md`.

---

## Índice

1. [Filosofía](#1-filosofía)
2. [Los dos grafos: por qué existen y cómo se relacionan](#2-los-dos-grafos-por-qué-existen-y-cómo-se-relacionan)
3. [Taxonomía de entidades](#3-taxonomía-de-entidades)
4. [Taxonomía de relaciones](#4-taxonomía-de-relaciones)
5. [Cardinalidad](#5-cardinalidad)
6. [Dirección](#6-dirección)
7. [Relaciones automáticas vs. relaciones manuales](#7-relaciones-automáticas-vs-relaciones-manuales)
8. [Metadatos](#8-metadatos)
9. [Preguntas resueltas](#9-preguntas-resueltas)
10. [Creación, validación y mantenimiento](#10-creación-validación-y-mantenimiento)
11. [Lo que este grafo hace posible sin rediseñarse](#11-lo-que-este-grafo-hace-posible-sin-rediseñarse)
12. [No-objetivos](#12-no-objetivos)
13. [Estado real de implementación (v1, ya construida)](#13-estado-real-de-implementación-v1-ya-construida)
14. [Roadmap de extensión (Fases A-C completadas)](#14-roadmap-de-extensión-fases-a-c-completadas)

---

## 1. Filosofía

En tidusss.es **ningún contenido debería existir de forma aislada.** Un campeón no es una ficha suelta: es un nodo conectado a sus builds, sus runas, sus matchups, sus sinergias, los conceptos que lo explican, los vídeos que lo muestran, las partidas reales donde aparece, su propio historial editorial y el parche que lo documenta. Una build no es una lista de objetos: sabe de qué campeón es, en qué parche se recomendó, qué vídeos la usan y qué partidas la demuestran. Un concepto no es una definición de diccionario: sabe qué campeones lo enseñan, en qué vídeos aparece explicado y qué partidas lo ilustran.

Este documento no diseña una entidad nueva de contenido — todas las entidades reales (Build, RunePage, Matchup, Synergy, Concept, Champion, Patch...) **ya existen** en [`league-laboratory.md`](league-laboratory.md). Lo que diseña es la **capa de conexión**: el sistema que decide, de forma explícita y verificable, qué se relaciona con qué, en qué dirección, con qué grado (uno-a-uno, uno-a-muchos, muchos-a-muchos), quién tiene permitido crear esa relación y cómo se comprueba que sigue siendo cierta con el tiempo.

Tres principios heredados directamente de cómo ya se construyó la v1 (§13), que este documento no relaja en ningún punto:

1. **Nunca se infiere una relación por parecido de texto.** Que un vídeo se titule "Cómo jugar Lucian nivel Master" no lo convierte automáticamente en un nodo conectado a `champion:lucian` — esa conexión solo existe si alguien la declara explícitamente (editorial) o si un dato estructural ya la garantiza (el campo `championId` de una `Build`).
2. **El grafo no duplica datos, los referencia.** Un nodo de vídeo no copia la descripción completa del vídeo de YouTube — apunta a ella. La fuente de verdad de cada dato sigue viviendo en su dominio de origen (`league-laboratory`, la API de Riot, la API de YouTube); el grafo solo guarda lo mínimo para decidir relaciones y navegación.
3. **Una entidad sin relación real no se registra "por si acaso".** El catálogo tiene ~173 campeones; el grafo de hoy solo registra los que tienen curación editorial real, exactamente igual que este documento seguirá recomendando para cualquier entidad futura (una build, un concepto) que todavía no tenga ninguna relación real que ofrecer.

---

## 2. Los dos grafos: por qué existen y cómo se relacionan

Antes de definir entidades hace falta resolver una ambigüedad que, sin nombrarla, generaría confusión en cualquier extensión futura: **existen, y deben seguir existiendo, dos grafos distintos con propósitos distintos.**

| | **League Laboratory** (`domain/league-laboratory`) | **Content Graph** (`domain/content-graph`) |
|---|---|---|
| Qué modela | El conocimiento en sí: qué build recomienda Tidusss, por qué, con qué confianza | Las conexiones navegables entre piezas de contenido de **toda** la plataforma, no solo de LoL |
| Alcance | Solo League of Legends / ADC | Toda la plataforma: LoL, vídeos, partidas, hitos de marca, objetivos competitivos, herramientas |
| Quién lo consulta | Las páginas del propio Laboratorio (`/campeones/[slug]`, `/tier-list`) para renderizar contenido | Cualquier superficie que necesite decir "sigue explorando" (`ExploreNext`), más los consumidores futuros (buscador, recomendaciones, Pregunta a Tidusss) |
| Granularidad | Rica y específica: un `BuildItemChoice` individual con su razonamiento | Deliberadamente más plana: una `Build` completa es un nodo; no se exponen sus objetos individuales como nodos del grafo |
| Quién manda si hay conflicto | El dominio de League Laboratory es la fuente de verdad del contenido | El Content Graph nunca contradice a League Laboratory — si un campeón no tiene `profile` real, el grafo no puede fingir que sí lo tiene |

**La relación entre ambos ya está resuelta arquitectónicamente y funciona:** el archivo puente (`league-laboratory/content-graph-bridge.ts`, con sus adaptadores puros `championToContentEntity`, `buildToContentEntity`, etc.) traduce entidades ricas de League Laboratory en nodos planos del Content Graph. Este documento **amplía qué se traduce**, no cambia el mecanismo de traducción.

Esto importa para todo lo que sigue: cuando se diga "el concepto es un nodo del grafo", se refiere siempre al Content Graph — el `Concept` completo (con su categoría, su resumen, sus conceptos relacionados) sigue viviendo, sin cambios, en `league-laboratory`.

---

## 3. Taxonomía de entidades

### 3.1 Entidades ya existentes en el Content Graph (v1, sin cambios)

`achievement`, `build`, `champion`, `channel`, `creator-project`, `game`, `goal`, `guide`, `library`, `match`, `matchup`, `moment`, `patch`, `reference`, `tier-list`, `tool`, `video`.

De estas, hoy **solo se registran realmente como nodos** (tienen entidades en `registry.ts`): `creator-project`, `library`, `channel`, `achievement`, `goal`, `champion` (solo los curados), `patch` (solo el de referencia de la Tier List), `tier-list`, `tool` (el Centro de Campeones). `build`, `matchup` y `guide` tienen **adaptadores ya escritos** en `content-graph-bridge.ts` (`buildToContentEntity`, `matchupToContentEntity`, `guideToContentEntity`) que **todavía no se invocan** desde ningún registro — es decir, la capacidad existe, pero no se ha activado. Esto no es un error: builds/matchups/guías reales solo empezaron a existir con el contenido de Lucian (Fase 6); activar su bridge es exactamente el trabajo de la Fase B (§14), en marcha.

`match` y `video` se generan **en tiempo de petición**, no en `registry.ts` — vía los adaptadores de Riot/YouTube (`adapters.ts`), porque su existencia depende de datos que llegan por API, no de contenido editorial fijado en build time. `game` y `reference` están declarados en el vocabulario de tipos pero, a día de hoy, sin ningún productor real — se mantienen como vocabulario reservado, no como deuda.

### 3.2 Entidades nuevas que este documento propone añadir al vocabulario

La filosofía del encargo ("un campeón conoce runas... conceptos... diario... sinergias") exige tres tipos de nodo que el Content Graph todavía no puede representar, porque `ContentEntityKind` no los incluye — aunque **el dominio de origen ya los modela por completo** en `league-laboratory/types.ts`:

| Nuevo `ContentEntityKind` | De dónde sale | Por qué necesita ser un nodo propio y no una propiedad de otro nodo |
|---|---|---|
| `rune-page` | `RunePage` | Tiene su propio parche, su propio `EditorialTake` y puede ser citada por un vídeo distinto de la build (alguien puede grabar "por qué estas runas" sin hablar de objetos) |
| `synergy` | `Synergy` | Conecta a **más de un campeón a la vez** (`championIds: LabChampionId[]`) — es el único nodo hoy que naturalmente tiene relación N:M con `champion`, y merece existir como nodo independiente en vez de aplanarse dentro de la ficha de un solo campeón |
| `concept` | `Concept` | Es, por diseño, la entidad más transversal de toda la plataforma — el mismo concepto ("power spike") puede enseñarse en el perfil de un campeón, en un matchup, en un vídeo y, en el futuro, en un artículo de Academia. Sin un nodo propio, no hay forma de preguntarle al grafo "¿qué sabe la plataforma sobre este concepto en total?" |

Y una cuarta pieza que requiere una decisión de diseño explícita, no solo una traducción directa:

**`editorial-log`** (nuevo) — representa el "diario" que pide el encargo. La entidad de origen, `EditorialHistoryEntry`, **no tiene identificador propio** en `league-laboratory/types.ts` (es una entrada de una lista, `date + patchId + summary`, sin `id`). Convertir cada entrada individual en un nodo del grafo exigiría inventarle un id sintético a algo que el dominio de origen deliberadamente no trató como una entidad direccionable — y el principio §1.1 prohíbe justamente inventar estructura que el dominio de origen no sostiene. La solución de diseño: **un nodo `editorial-log` por campeón** (relación 1:1, `editorial-log:lucian` ↔ `champion:lucian`), que agrega todas sus entradas y apunta a la sección ya existente en la página real (`/campeones/lucian#historial-editorial-heading`). El campeón "conoce su diario" a través de esa relación 1:1; el diario en sí no se disgrega en nodos por entrada porque ninguna entrada individual tiene, hoy, una página o ancla propia que pudiera servir de destino de enlace.

**Nota de diseño explícita (decisión de arquitectura, revisión posterior a la auditoría):** `editorial-log` es un **patrón**, no una entidad exclusiva de `champion`. Se implementa primero para campeones porque es donde vive hoy la única fuente real (`LabChampion.editorialHistory`), pero el mecanismo — un nodo 1:1 que agrega un historial fechado y apunta a la sección real donde se muestra — se diseña para poder aplicarse a cualquier entidad editorial futura que acumule su propio historial de cambios (una Tier List, un `Concept`, una herramienta del Laboratorio...), sin inventar un `editorial-log-v2`. Cuando eso ocurra, se sigue exactamente el mismo patrón 1:1 ya descrito aquí, cambiando solo la entidad ancla.

**"Academia" y "artículos"** (mencionados en la filosofía del encargo) **no necesitan un `ContentEntityKind` nuevo**: ya existe `KnowledgeArticle` en `league-laboratory` con un campo `format: 'guide' | 'analysis' | 'editorial' | 'explainer'` pensado exactamente para contenido no atado a un campeón concreto (`KnowledgeScope.championId` es opcional). "Academia" es, en términos de este grafo, un futuro nodo `tool` (como ya lo es el Centro de Campeones) que agrupa `KnowledgeArticle`s con `format: 'explainer'`/`'analysis'` de alcance conceptual — se resuelve con el vocabulario `guide` ya existente en `ContentEntityKind`, ampliando su uso, no creando un tipo nuevo.

**Cuándo se incorporan realmente `rune-page`, `synergy`, `concept` y `editorial-log` (decisión de arquitectura posterior a la Fase A):** el diseño de estos cuatro tipos —por qué necesitan ser nodos propios, su cardinalidad, su dirección— queda aprobado íntegro en esta sección y no se revisa. Lo que sí queda decidido de otra forma es **cuándo entran en `ContentEntityKind`**: no en una fase numerada dedicada solo a declarar vocabulario, sino en el mismo cambio que construya el primer productor real de cada uno (el adaptador equivalente a `buildToContentEntity`, para cuando exista contenido real de runas/sinergias/conceptos que registrar). Ver §14.

### 3.3 Vocabulario de entidades completo tras esta propuesta

```
achievement · build · champion · channel · concept (nuevo) · creator-project ·
editorial-log (nuevo) · game · goal · guide · library · match · matchup ·
moment · patch · reference · rune-page (nuevo) · synergy (nuevo) · tier-list ·
tool · video
```

Ningún kind existente se elimina o renombra — esto es una ampliación aditiva, coherente con "cualquier nueva funcionalidad debe poder construirse sin rediseñar el dominio" (objetivo final del encargo).

---

## 4. Taxonomía de relaciones

### 4.1 Relaciones ya existentes (v1, sin cambios)

`continues-with`, `documents`, `features`, `played-with`, `published-on`, `related-to`, `specializes-in`, `tracks`, `uses`.

### 4.2 Relaciones nuevas que requieren las entidades de §3.2

| Nuevo `ContentRelationKind` | Ejemplo de uso | Por qué ninguna existente sirve |
|---|---|---|
| `explains` | `concept:power-spike` → `champion:lucian` | `documents` ya se usa para "esta build documenta cómo jugar este campeón" (una relación de contenido derivado→campeón); `explains` es distinta semánticamente — un concepto no "documenta" a un campeón, lo **enseña**, y puede enseñarlo sin ser específico de él (el mismo concepto explica varios campeones a la vez) |
| `synergizes-with` | `champion:lucian` → `champion:milio` (vía el nodo `synergy:lucian-milio`, ver §5.3) | Es la única relación campeón↔campeón del grafo; `related-to` es demasiado genérica para algo con tanto significado propio (síntoma de una sinergia real, no una sugerencia editorial de navegación) |
| `changed-in` | `champion:lucian` → `patch:26-14` (vía `editorial-log:lucian`) | `tracks` ya significa "esta entrada de tier list sigue este parche como referencia estática"; `changed-in` es distinta — significa "algo cambió específicamente en este parche", una relación con carga temporal, no de referencia |

**Nota de diseño explícita (decisión de arquitectura, revisión posterior a la auditoría):** los ejemplos de la tabla anterior usan `champion` porque es el caso real disponible hoy, pero `explains` y `synergizes-with` **se tipan, al implementarse, contra `ContentEntityId` genérico — nunca contra `LabChampionId` ni ningún tipo específico de League of Legends.** `explains` debe poder salir de un `concept` hacia cualquier entidad que ese concepto enseñe (un campeón hoy; en el futuro, potencialmente una build, un artículo de Academia u otra pieza de contenido), y `synergizes-with` debe poder declararse entre cualesquiera dos entidades del grafo, no solo entre dos campeones. Esto no cambia el alcance del dominio (que sigue siendo, deliberadamente, solo League of Legends hoy — ver §12) — es una restricción de tipado en la capa de conexión, para no hornear en el grafo genérico un acoplamiento que el propio grafo existe para evitar.

**Cuándo se incorporan realmente (decisión de arquitectura posterior a la Fase A):** igual que en §3.2, `explains`, `synergizes-with` y `changed-in` no entran en `ContentRelationKind` en una fase separada dedicada solo a declararlas — se añaden junto con las entidades que los necesiten, en el mismo cambio que construya su primer productor real. Ver §14.

### 4.3 Vocabulario de relaciones completo tras esta propuesta

```
changed-in (nuevo) · continues-with · documents · explains (nuevo) · features ·
played-with · published-on · related-to · specializes-in ·
synergizes-with (nuevo) · tracks · uses
```

---

## 5. Cardinalidad

La cardinalidad no se declara como un campo nuevo en el tipo `ContentRelation` (seguiría siendo, correctamente, una lista plana de aristas) — se declara **aquí, como contrato de diseño**, y se verifica con pruebas (§10.2). Cada fila es una regla que cualquier relación de ese tipo debe cumplir.

| Relación | Cardinalidad | Ejemplo |
|---|---|---|
| `champion` → `build` | 1 : N | Lucian tiene 2 builds reales hoy (sólida, personal); una build pertenece exactamente a un campeón |
| `champion` → `rune-page` | 1 : N | Un campeón puede tener varias páginas de runas (distinto rol, distinto parche); una página de runas es de un único campeón |
| `champion` → `matchup` | 1 : N | Un matchup conecta a **dos** campeones, pero desde la perspectiva de "quién lo documenta" pertenece a uno (`Matchup.championId`); el oponente se referencia, no se "posee" (ver Dirección, §6.3) |
| `champion` ↔ `synergy` | **N : M** (vía el nodo `synergy`) | Una sinergia por definición involucra ≥2 campeones (`Synergy.championIds`); un campeón puede aparecer en varias sinergias distintas |
| `champion` ↔ `concept` | **N : M** | Un concepto explica a varios campeones; un campeón está explicado por varios conceptos (`LabChampion.coreConceptIds`, curado, más los derivados automáticamente de sus matchups/guías) |
| `champion` → `editorial-log` | **1 : 1** | Cada campeón curado tiene, como mucho, un diario — el propio (ver §3.2) |
| `champion` → `patch` | N : 1 | Varios campeones pueden documentarse bajo el mismo parche de referencia; un campeón, en un momento dado, referencia un único parche "actual" (aunque su historial pueda mencionar varios anteriores) |
| `champion` ↔ `video` | **N : M** | Un vídeo puede tratar sobre varios campeones (un vídeo de matchup trata de dos); un campeón aparece en varios vídeos |
| `champion` ↔ `match` | **N : M** en el sentido amplio, pero en la práctica **1 : N por partida** | Cada partida real se jugó con exactamente un campeón (`RecentMatch.championName`); un campeón aparece en muchas partidas |
| `build`/`matchup`/`rune-page`/`synergy` → `video` | N : M | Un vídeo puede ilustrar varias piezas de conocimiento a la vez; una pieza de conocimiento puede estar ilustrada por varios vídeos, o por ninguno todavía |
| `build`/`matchup`/`rune-page`/`synergy` → `match` | 0..1 : 1 | Hoy el modelo (`Matchup.matchHref`) solo contempla **una** partida de referencia por pieza de conocimiento, nunca varias — es deliberadamente el mínimo verificable, no una limitación técnica (ver §7) |
| `tier-list` ↔ `champion` | N : M | Una Tier List lista muchos campeones; un campeón puede aparecer en más de una Tier List si en el futuro existen varias (por rol, por parche) — ya se modela así hoy con relaciones explícitas en ambas direcciones |
| `patch` → cualquier entidad editorial | 1 : N | Un parche es referenciado por muchas builds/runas/tier lists; cada una de esas referencias apunta a un único parche a la vez |

---

## 6. Dirección

### 6.1 Regla general: las relaciones son dirigidas, nunca simétricas por defecto

`ContentRelation.from` y `ContentRelation.to` ya definen esto en el tipo actual. La regla de diseño que este documento fija explícitamente (porque hoy solo era una convención implícita en el código, no una regla escrita) es:

> **Si dos nodos deben poder navegarse en ambos sentidos, se declaran dos relaciones explícitas, una por sentido — nunca se infiere la inversa automáticamente a partir de una sola.**

Esto ya es exactamente lo que hace el código de hoy (`tierListFeaturesChampionRelation` + `championAppearsInTierListRelation` son dos relaciones distintas, una en cada sentido, con etiquetas y prioridades propias — no una función que genere la segunda a partir de la primera). Esta disciplina se mantiene para todas las relaciones nuevas de §4.2: por ejemplo, `champion → concept` (`explains`, invertida: el concepto explica al campeón) se declara junto con `concept → champion` si haec falta navegar en ambos sentidos desde ambos nodos.

**Por qué no autoinvertir:** la etiqueta visible (`label`) y el contexto (`context`) casi nunca son el mismo texto en ambas direcciones ("Ver la ficha de Lucian" no es la inversa gramatical de "Este campeón lo explica este concepto") — auto-generar la inversa produciría copy genérico exactamente donde el encargo pide personalidad y voz editorial, no frases automáticas.

### 6.2 Prioridad como mecanismo de dirección semántica, no solo de orden

`priority` ya existe en el tipo. Se formaliza aquí como el mecanismo por el que una misma entidad puede tener muchas relaciones salientes sin que todas compitan por la misma atención — el consumidor (`ExploreNext`, o cualquier consumidor futuro) siempre puede pedir solo la de mayor prioridad (`getPrimaryConnection`) sin tener que decidir "cuál es la más importante" en tiempo de renderizado.

### 6.3 Caso especial: relaciones "propietario vs. referenciado" (matchups)

Un `Matchup` tiene dos campeones (`championId`, `opponentChampionId`) pero **no** los trata como simétricos: `championId` es quien "posee" editorialmente el análisis (es el campeón cuya guía muestra este matchup como propio); `opponentChampionId` es referenciado. La regla de dirección: el nodo `matchup` tiene una relación `related-to`/`documents` **saliente** hacia el campeón propietario (ya existe, `matchupRelatedToChampionRelation`) y, si se quiere que el oponente también pueda navegar hacia ese matchup (por ejemplo, para responder "¿qué dice Tidusss sobre enfrentarse a Lucian?" desde la ficha de Draven), se añade una relación explícita adicional `matchup → opponentChampionId` con una etiqueta distinta ("Cómo lo ve el rival") — nunca se asume la reciprocidad.

---

## 7. Relaciones automáticas vs. relaciones manuales

Esta es la distinción que más impacto tiene en cómo se mantiene el grafo con el tiempo, y ya existe parcialmente en el código de hoy (`ContentRelation.source: 'editorial' | 'provider' | 'verified-manual'`) sin haber sido nunca documentada como una decisión de arquitectura explícita. Se formaliza en tres categorías, no dos:

### 7.1 Automáticas por estructura (`source: 'editorial'`, generadas por una función pura a partir de un campo que ya existe)

No requieren ninguna decisión humana en el momento de crearse — se derivan mecánicamente de un campo que el dominio de origen ya obliga a rellenar. Ejemplos ya construidos: `Build.championId` → relación `build → champion`; `TierListEntry.championId` → relación `tier-list → champion`. Ejemplos que este documento añade al mismo patrón: `RunePage.championId` → `rune-page → champion`; `Synergy.championIds` → N relaciones `synergy → champion` (una por elemento del array); `Matchup.championId`/`opponentChampionId` → las dos relaciones de §6.3; `LabChampion.coreConceptIds` → relaciones `champion → concept` (`explains`, invertida).

**Regla de diseño:** una relación solo puede ser "automática por estructura" si existe un campo tipado, obligatorio o ya validado por el dominio de origen, que la sostenga directamente. Nunca se deriva de texto libre (el `title` de una build, la `description` de un vídeo) — eso sería inferencia por parecido, prohibida por el principio §1.1.

### 7.2 Automáticas por proveedor (`source: 'provider'`)

Se generan en tiempo de petición a partir de datos que llegan de una API externa (Riot, YouTube), nunca en build time. Ejemplo ya construido: `matchChampionRelation` (una partida real de Riot conecta automáticamente con el campeón jugado, vía `match.championName`). Estas relaciones **nunca se persisten** en `registry.ts` — se generan y descartan en cada petición, porque los datos de origen (rango, partidas recientes) tampoco se persisten ahí.

### 7.3 Manuales (`source: 'editorial'` cuando no hay campo estructural detrás, o `'verified-manual'`)

Requieren una decisión humana explícita porque **no existe ningún campo estructural que garantice la relación** — solo alguien que haya comprobado que es cierta. Ejemplo ya construido y documentado como el más estricto de todos: `verifiedMatchVideoRelation` (un vídeo documenta una partida concreta) — el propio nombre de la función, y su `source: 'verified-manual'`, dejan constancia de que esta relación exige verificación humana explícita, nunca coincidencia de fecha o de título. Ejemplos nuevos que caen en esta misma categoría por el mismo motivo: `Matchup.videoUrl`/`Matchup.matchHref` (ya existen como campos opcionales en el dominio, con comentario explícito de "nunca inventado, ausente mientras no exista uno verificado" — la relación de grafo correspondiente hereda exactamente esa misma disciplina, no la relaja).

### 7.4 Tabla resumen: quién puede crear qué

| Tipo de relación | Quién la crea | Cuándo | Se puede automatizar? |
|---|---|---|---|
| Automática por estructura | Una función pura del bridge (`content-graph-bridge.ts`) | Build time, a partir de datos ya escritos en `league-laboratory` | Sí, siempre — no requiere ninguna decisión nueva más allá de escribir el contenido editorial en su dominio de origen |
| Automática por proveedor | Un adaptador (`adapters.ts`) | Tiempo de petición | Sí, siempre, pero nunca se persiste |
| Manual (vídeo↔partida, vídeo↔concepto/build/matchup, concepto↔artículo) | Tidusss, al escribir o revisar el contenido (por ejemplo, rellenando `Matchup.videoUrl` al publicar la guía) | En el momento de curar el contenido editorial | No — y no debe automatizarse nunca, porque automatizarlo sería exactamente la inferencia por coincidencia que el principio §1.1 prohíbe |

---

## 8. Metadatos

### 8.1 Metadatos de entidad (`ContentEntity`, ya existentes, sin cambios de tipo)

`id`, `kind`, `title`, `description?`, `href?`, `external?`, `source`, `status`. Se mantienen sin ampliar — cualquier metadato adicional específico de un tipo de entidad (el `EditorialConfidence` de un build, el `patchId` de una tier list) **no** se añade a `ContentEntity` de forma genérica; vive en el dominio de origen y se consulta ahí cuando haga falta detalle, exactamente como ya ocurre hoy (el grafo no duplica el `EditorialTake` completo de una build, solo su `description` como resumen).

### 8.2 Metadato nuevo propuesto: frescura editorial

Para que un consumidor futuro (Pregunta a Tidusss, un buscador, una vista de "contenido reciente") pueda razonar sobre qué tan reciente es una pieza de conocimiento sin tener que recorrer todo `league-laboratory` por su cuenta, se propone que el bridge exponga, **solo para las entidades que lo tengan disponible en su dominio de origen**, un campo opcional adicional en la descripción/metadata ya existente — no un campo nuevo en el tipo `ContentEntity` (mantenerlo fuera del tipo evita que toda entidad sin fecha real tenga que rellenar `null` a mano). En su lugar, la fecha vive donde ya vive (`Patch.releasedAt`, `EditorialHistoryEntry.date` agregada en el nodo `editorial-log`) y los consumidores que la necesiten la piden al dominio de origen a través del propio nodo `editorial-log`/`patch` — el Content Graph solo garantiza que el **enlace** a esa fuente de fecha existe, no que la fecha se duplique en dos sitios.

### 8.3 Metadatos de relación (`ContentRelation`, ya existentes, sin cambios de tipo)

`from`, `to`, `kind`, `label`, `context?`, `priority`, `source`. Suficientes para todo lo diseñado en este documento — no se propone ningún campo nuevo aquí. Es deliberado: el tipo de relación ya captura "qué es" (`kind`), "cómo se creó" (`source`, ahora con la taxonomía completa de §7) y "cómo se presenta" (`label`, `context`, `priority`). Añadir más solo tentaría a guardar datos que pertenecen al dominio de origen.

---

## 9. Preguntas resueltas

Respuesta directa a cada pregunta planteada en el encargo, citando el mecanismo exacto de este documento que la resuelve.

**¿Cómo sabe un vídeo que pertenece a Lucian?**
No lo "sabe" automáticamente nunca. Un vídeo se conecta a `champion:lucian` únicamente por una relación manual (§7.3) que alguien declara explícitamente al revisar el contenido del vídeo — nunca por analizar el título o la descripción del vídeo en busca del nombre del campeón. Esta es la limitación más importante y más deliberada de todo el sistema: mientras no exista ese etiquetado manual, la sección "Vídeos relacionados" de la guía de Lucian sigue mostrando honestamente su estado vacío (ya documentado en `league-laboratory.md`), en vez de adivinar.

**¿Cómo sabe una build qué vídeos la utilizan?**
Igual que el caso anterior, en la dirección inversa: es una relación manual `video → build` (kind `documents` o `features`, a decidir en la fase de construcción), declarada por Tidusss al vincular un vídeo publicado con la build real que explica. La build nunca "busca" vídeos por su cuenta.

**¿Cómo sabe un concepto qué campeones lo enseñan?**
Dos vías combinadas, ya diseñadas en `league-laboratory` y simplemente proyectadas al grafo: (a) automática por estructura, vía `LabChampion.coreConceptIds` (curación editorial directa: "estos son los conceptos fundamentales de este campeón"); (b) automática derivada, vía la misma función que ya usa la guía de campeón (`getRelatedConceptsFor`) para juntar los conceptos referenciados desde los matchups y guías de ese campeón. El grafo no añade una tercera vía nueva — expone, como relaciones navegables, exactamente lo que `league-laboratory` ya calcula para renderizar la sección "Conceptos importantes".

**¿Cómo sabe una partida qué guía la referencia?**
No lo sabe por sí sola. Una partida (`match:...`) es un nodo generado en tiempo de petición a partir de datos reales de Riot — no tiene, ni puede tener, conocimiento editorial persistido sobre sí misma. La relación va en el sentido contrario y es manual: es la guía (o el `Matchup`, vía `matchHref`) la que declara "esta partida real ilustra lo que digo aquí", nunca la partida la que "busca" su guía.

**¿Cómo sabe un parche qué contenido cambia?**
Vía la relación `changed-in` (§4.2), que sale de `editorial-log:<champion>` hacia `patch:<id>` por cada entrada del historial editorial que mencione ese `patchId` — ya es exactamente el dato que `EditorialHistoryEntry.patchId` guarda hoy, solo proyectado como relación de grafo en vez de quedarse solo como campo interno de `league-laboratory`.

**¿Cómo se crean estas relaciones?** — resuelto en detalle en §7 y §10.1.
**¿Cómo se validan?** — resuelto en §10.2.
**¿Cómo se mantienen?** — resuelto en §10.3.

---

## 10. Creación, validación y mantenimiento

### 10.1 Creación

Se mantiene, sin cambios, el patrón ya construido: cada dominio de origen (`league-laboratory`, futuros dominios) expone sus propios adaptadores puros (`content-graph-bridge.ts`) que producen `ContentEntity[]`/`ContentRelation[]`; un único archivo de extensión por dominio (`league-laboratory-extension.ts` es el ejemplo ya construido) los recopila; `registry.ts` los concatena en el grafo final. Ningún dominio nuevo obliga a tocar `registry.ts` más que para añadir una línea de import — la regla que ya deja escrita `content-graph.md` v1 ("no es necesario modificar el componente, los modelos de Riot, los servicios de YouTube, el layout ni las demás páginas") se mantiene intacta y se extiende a los tres `kind` nuevos de §3.2.

### 10.2 Validación

Se propone extender la disciplina de pruebas que `league-laboratory` ya aplica (el test "el contenido real de Lucian no aparece en la ficha de otro campeón curado" es el precedente exacto a seguir) con un conjunto de invariantes de grafo, verificables automáticamente sin necesidad de ningún LLM ni revisión manual:

- **Sin aristas colgantes:** todo `ContentRelation.to` debe resolver a un `ContentEntity.id` que exista de verdad en `registry.ts` (o ser generado en el mismo ciclo de petición, para las de proveedor).
- **Coherencia de prefijo:** el `id` de toda entidad debe empezar por `${kind}:` — ya lo garantiza el tipo `ContentEntityId`, pero se propone una prueba explícita que lo confirme sobre el registro completo, no solo confiar en el tipado estático.
- **Ninguna entidad `planned` es navegable:** ya es una regla documentada en v1 (`getContentConnections` filtra por `status === 'available'`); se propone una prueba que falle si alguna vez una entidad `planned` tiene `href` relleno (señal de que alguien empezó a construir una ruta sin haber activado la entidad correctamente).
- **Cardinalidad respetada:** para las relaciones de cardinalidad 1:1 (`champion` ↔ `editorial-log`) y 1:N donde N tiene un dueño único (`build` → `champion`), una prueba que confirme que nunca existen dos aristas `from` distintas apuntando al mismo destino donde el diseño exige unicidad.
- **Ninguna relación manual sin fuente verificable:** toda relación con `source: 'verified-manual'` debe poder trazarse a un campo real del dominio de origen que la sostenga (`Matchup.videoUrl`, `Matchup.matchHref`) — nunca a una relación añadida "a mano" directamente en el archivo de extensión sin ese respaldo, que sería reintroducir exactamente la inferencia no verificada que este sistema existe para evitar.

### 10.3 Mantenimiento

El grafo se **reconstruye por completo en cada build**, igual que el resto del sitio estático — no hay estado incremental que mantener sincronizado entre despliegues. Esto significa que "mantener el grafo" no es una tarea aparte: **es una consecuencia automática de mantener bien `league-laboratory`.** Si Tidusss publica una build nueva con su `championId` correcto, la relación `build → champion` aparece sola en el siguiente build del sitio, sin ninguna tarea de sincronización manual adicional — exactamente como ya ocurre hoy con `tier-list → champion`. Las únicas relaciones que exigen mantenimiento activo y recurrente son, por diseño, las manuales (§7.3): vincular un vídeo nuevo a la build/matchup/concepto que ilustra sigue siendo, deliberadamente, un acto editorial consciente, no un proceso a automatizar.

---

## 11. Lo que este grafo hace posible sin rediseñarse

Se enumera explícitamente porque es el objetivo final del encargo — la prueba de que el diseño es suficiente:

- **Pregunta a Tidusss** (`docs/pregunta-a-tidusss.md`) consume el grafo para rellenar `relatedConcepts`, `relatedChampions`, `relatedVideos` y `relatedMatches` de cada respuesta — sin este documento, esa sección de aquel documento no tendría una fuente real de la que leer.
- **Vídeos relacionados**, hoy vacío en la guía de cada campeón por falta de datos (no por falta de arquitectura), se activa el día que existan relaciones manuales vídeo↔campeón/build/matchup — la sección de la página ya está construida, solo espera al dato.
- **Un buscador de contenido** interno podría recorrer el grafo por `kind` y `relation` sin tocar ninguna página existente.
- **Recomendaciones** ("si te interesa esto, también te interesa...") son, literalmente, `getContentConnections` con un `limit` — ya existe la función, solo faltan más relaciones que recorrer.
- **SEO estructurado** (datos enlazados tipo `sameAs`/`about` en JSON-LD) puede generarse recorriendo las relaciones salientes de una entidad sin duplicar lógica de enlazado en cada página.
- **Academia**, cuando se construya, se registra como un `tool` más con sus `KnowledgeArticle`s enlazados a `concept`s existentes — cero cambios en el resto del grafo.

---

## 12. No-objetivos

Idénticos en espíritu a los ya declarados en v1, ampliados con lo que aprende este documento:

- No se infieren relaciones por coincidencia de texto, nombre o fecha — nunca, para ningún `kind` nuevo o futuro.
- No se persiste ninguna relación de proveedor (`source: 'provider'`) en `registry.ts` — se generan y se descartan en cada petición.
- No se convierte `editorial-log` en un archivo de nodos por entrada — es 1:1 con el campeón, agregando toda su historia, mientras el dominio de origen no dé a cada entrada un identificador propio.
- No se automatiza jamás una relación marcada `verified-manual` — automatizarla la degradaría a exactamente el tipo de inferencia que ese `source` existe para distinguir de las demás.
- No se añaden campos nuevos a `ContentEntity`/`ContentRelation` para guardar datos que ya viven, correctamente, en su dominio de origen (§8.1, §8.3) — el grafo enlaza, no duplica.
- No se registra ninguna entidad (campeón, build, concepto...) que no tenga, hoy, al menos una relación real que ofrecer — saturar el grafo con nodos sin conexión no ayuda a ningún consumidor futuro, solo añade ruido.

---

## 13. Estado real de implementación (v1, ya construida)

*(Contenido original del documento, verificado contra el código el 28 de julio de 2026 — se conserva íntegro porque sigue siendo exacto.)*

### Auditoría inicial

Entidades que ya existían antes del Content Graph: vídeos y canales; partidas, campeones, perfil y rango; objetivos y logros; hitos, momentos y referencias; portada y centro de actividad.

Relaciones reales que ya existían, pero estaban dispersas: una partida contiene el campeón jugado; un vídeo pertenece al canal de YouTube; una partida puede tener un vídeo verificado mediante `match-video-links`; el centro de actividad agrega Riot, YouTube y Twitch; la portada conduce al centro de actividad.

Faltaban identificadores de dominio comunes, tipos de relación y una consulta central para obtener el siguiente paso sin conocer el proveedor o componente.

### Estructura

- `src/domain/content-graph/types.ts` — define `ContentEntity`, `ContentRelation`, sus identificadores y el contrato del grafo.
- `src/domain/content-graph/registry.ts` — contiene únicamente entidades disponibles y relaciones verificables; expone consultas ordenadas por prioridad y elimina destinos duplicados.
- `src/domain/content-graph/adapters.ts` — convierte modelos existentes de Riot y YouTube en entidades de dominio; no realiza peticiones ni duplica los datos originales.
- `src/domain/content-graph/league-laboratory-extension.ts` — todo lo que League Laboratory aporta al grafo, aislado de `registry.ts`.
- `src/domain/league-laboratory/content-graph-bridge.ts` — adaptadores puros de entidad de Laboratorio → `ContentEntity`/`ContentRelation`.
- `src/components/ExploreNext.astro` — representa relaciones navegables; no decide qué mostrar, recibe una entidad de origen y consulta el grafo.

### Relaciones actuales

Portada → centro de actividad; portada → biblioteca de vídeos; portada → especialidad en Lucian; Live → vídeos y análisis; Live → Twitch; Live → YouTube; Live → credencial Master; Live → objetivos existentes; partida → campeón (mediante adaptador); vídeo → partida (solo con asociación verificada); Centro de Campeones ↔ campeones curados; Centro de Campeones ↔ Tier List; Tier List ↔ cada campeón de sus entradas; Tier List → parche de referencia.

No se generan relaciones por coincidencias de texto ni se inventan asociaciones entre vídeos y partidas.

### Añadir una Tier List (ejemplo de extensión ya validado)

1. Crear la página, por ejemplo `src/pages/tier-list/[slug].astro`.
2. Registrar una entidad disponible (`kind: 'tier-list'`, con `id`, `title`, `href`, `source: 'editorial'`, `status: 'available'`).
3. Registrar solamente relaciones comprobables (parche, campeones incluidos, guía publicada).
4. Renderizar `ExploreNext` al final de la página usando el identificador de la Tier List.

No es necesario modificar el componente, los modelos de Riot, los servicios de YouTube, el layout ni las demás páginas.

### Riesgos ya identificados en v1 (y que este documento reafirma)

Duplicar datos de proveedores dentro del grafo; inferir relaciones por títulos o nombres parecidos; convertir el registro en un CMS; publicar entidades `planned`; acoplar los identificadores de dominio a una ruta concreta.

---

## 14. Roadmap de extensión (Fases A-C completadas)

### Fase A — Consolidación de v1 (completada)

Ejecutada y verificada contra el código. **No amplió `ContentEntityKind`/`ContentRelationKind`** — todo el trabajo consolidó y endureció el vocabulario y las entidades/relaciones ya activas en v1, sin ampliar todavía el alcance editorial del grafo:

- Corregido un defecto real de v1: las entidades `planned` (objetivos futuros, `src/config/goals.ts`) podían llevar `href` relleno, violando la invariante "una entidad `planned` nunca es navegable" (§10.2) — corregido en `registry.ts`.
- Nuevo sistema de invariantes de grafo (`src/domain/content-graph/invariants.ts`): ids de entidad únicos, relaciones sin duplicados, ninguna relación colgante, coherencia del prefijo `${kind}:`, ninguna entidad `planned` navegable, ninguna relación autoinvertida con la misma etiqueta literal, ningún campo interno de `league-laboratory` filtrado fuera del contrato público de `ContentEntity`/`ContentRelation` — las siete agregadas en un único `validateContentGraph`.
- Resolución de entidades por `kind` (`getContentEntitiesByKind`) y extracción de un núcleo puro y parametrizable de la resolución de conexiones (`resolveConnections`), sin cambiar el comportamiento público de `getContentConnections`/`getPrimaryConnection`.
- Validación: **141 tests pasando (0 fallos)**, **`astro check` con 0 errores**, **ESLint limpio**, **build correcto con 177 páginas**.

### Fase B — Activar contenido editorial real: `build`, `matchup`, `guide` (completada)

`build`, `matchup` y `guide` **ya existían en `ContentEntityKind` desde v1** — esta fase no amplió vocabulario, solo activó adaptadores ya escritos:

- **`build`**: activado con contenido real — las 2 builds publicadas de Lucian (`buildToContentEntity`, `buildDocumentsChampionRelation`). Corrección aplicada en esta misma revisión: el label usaba el slug del `championId` (`lucian`) en vez del nombre editorial real (`Lucian`) — `buildDocumentsChampionRelation` ahora recibe el nombre como parámetro explícito, resuelto siempre desde el catálogo.
- **`matchup`**: wiring activado (`matchupToContentEntity`/`matchupRelatedToChampionRelation` invocados sobre `leagueLaboratoryMatchups`), pero **registra 0 entidades hoy** — no existe todavía ningún matchup real analizado por Tidusss. Se activará solo con el próximo build del sitio, en cuanto exista contenido real, sin tocar código.
- **`guide`**: **sin activar**. No existe ninguna fuente `KnowledgeArticle`/`Guide` en `src/data/league-laboratory` — ni siquiera un archivo vacío como el de `matchup`. Activar `guideToContentEntity`/`guideDocumentsChampionRelation` queda pendiente hasta que esa fuente exista de verdad.

### Fase C — Expansión editorial: `rune-page`, `synergy`, `concept`, `editorial-log` (completada)

Cada tipo se incorporó al vocabulario en el mismo cambio que construyó su primer adaptador real — nunca por separado, tal como fijó la decisión de arquitectura de la Fase A:

- **`rune-page`**: activado — la página de runas real de Lucian (parche 26.14), vía `runePageToContentEntity`/`runePageDocumentsChampionRelation` (relación `documents`, reutilizando vocabulario existente, sin inventar un tipo de relación nuevo).
- **`synergy`**: activado — las 6 sinergias reales recomendadas por Tidusss. Cada sinergia genera su nodo (`synergyToContentEntity`, título compuesto a partir de los nombres reales de campeón), una relación `documents` hacia Lucian (el campeón propietario) y una relación `synergizes-with` explícita y dirigida de Lucian hacia el socio — nunca la inversa. Los 6 socios sin curación editorial propia (Milio, Nami, Yuumi, Braum, Nautilus, Pyke) se registraron como campeones "planos" (sin `LabChampion`) porque, a partir de esta fase, tienen una relación real que ofrecer; sin `synergizes-with` no se habrían registrado (§1.3/§12). Efecto visible confirmado: "Sigue explorando" en `/campeones/lucian` ahora puede mostrar un socio de sinergia real junto a la Tier List y el Centro de Campeones.
- **`concept`**: activado **parcialmente, por diseño** — solo los 4 conceptos que `LabChampion.coreConceptIds` de Lucian enlaza directamente (Spacing, Power Spike, Trading, Snowball), vía `conceptToContentEntity`/`conceptExplainsRelation`. Los otros 2 de `leagueLaboratoryConcepts` (Tempo, Wave Management) **no se registran**: no están referenciados por ningún matchup, sinergia o campeón curado todavía, así que no tienen ninguna relación real que ofrecer.
- **`editorial-log`**: activado — un único nodo `editorial-log:lucian` (1:1, nunca uno por entrada) que agrega las 4 entradas reales de `LabChampion.editorialHistory`, con relación `documents` hacia Lucian. `changed-in` se generó solo para las entradas con `patchId` explícito (3 de las 4 entradas; deduplicado por parche, ya que dos entradas comparten `patch:15-14`), produciendo exactamente 2 relaciones (`patch:15-14`, `patch:26-14`) — la entrada sin `patchId` no genera ninguna relación. `patch:26-14` se registró como entidad (antes solo existía `patch:15-14`) porque, sin ella, la relación `changed-in` habría sido una arista colgante.

### Vocabulario aún diferido

- **`guide`**: sin activar (ver Fase B) — sin fuente de datos real.
- **2 de los 6 `concept`** (Tempo, Wave Management): sin registrar — sin relación real que ofrecer todavía, no por no estar modelados (ambos ya son `Concept` reales y estables en `leagueLaboratoryConcepts`).

Con esto, el vocabulario completo aprobado en el diseño original (`champion`, `build`, `matchup`, `rune-page`, `synergy`, `concept`, `editorial-log`, `explains`, `synergizes-with`, `changed-in`) está incorporado a `ContentEntityKind`/`ContentRelationKind`. Solo `guide` permanece sin activar por ausencia total de fuente, exactamente como predijo la decisión de arquitectura de la Fase A: nunca se añadió vocabulario inerte, cada tipo llegó junto con su primer productor real.

Una vez activado el contenido real de las Fases B/C, queda pendiente revisar si tiene sentido activar por fin una sección real de "Vídeos relacionados" en la guía de campeón (§11) — condicionado a que exista al menos un vídeo real etiquetado manualmente (§7.3); si no existe ninguno, la sección sigue, correctamente, en su estado vacío honesto.

Este roadmap no incluye ninguna pieza de `docs/pregunta-a-tidusss.md` (embeddings, Vectorize, D1, generación) — esas fases dependen de que este documento esté aprobado y, al menos parcialmente, construido, pero no al revés.
