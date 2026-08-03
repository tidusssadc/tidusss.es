# Índice de Conocimiento

> **Naturaleza de este documento:** arquitectura de dominio de una capa ya construida (`src/domain/knowledge-index/`), v1. Describe el sistema que transforma el contenido editorial publicado de tidusss.es en **documentos estructurados, recuperables y citables** — la unidad de conocimiento sobre la que trabajará, más adelante, el motor de respuesta de [`pregunta-a-tidusss.md`](pregunta-a-tidusss.md). No incluye embeddings, Vectorize, D1, generación con LLM, endpoints ni ninguna ruta nueva — eso sigue siendo diseño no implementado (`pregunta-a-tidusss.md` §3, §4.3, §16).
> **Relación con el Content Graph:** dos dominios deliberadamente separados. El [Content Graph](content-graph.md) describe **relaciones entre entidades** (qué se conecta con qué, para "sigue explorando"). El Índice de Conocimiento describe **unidades editoriales recuperables** (qué se puede citar, con qué texto exacto, con qué procedencia). Comparten el mismo dominio de origen (`src/domain/league-laboratory`) pero **no se importan entre sí** — ningún archivo de `domain/knowledge-index` importa de `domain/content-graph`, y viceversa.
> **Estado:** v1 construida y validada. Sin commit todavía.

---

## Índice

1. [Filosofía](#1-filosofía)
2. [El contrato: `KnowledgeDocument`](#2-el-contrato-knowledgedocument)
3. [Qué se indexa y qué se excluye](#3-qué-se-indexa-y-qué-se-excluye)
4. [Granularidad: por qué documentos semánticos, no fragmentos por caracteres](#4-granularidad-por-qué-documentos-semánticos-no-fragmentos-por-caracteres)
5. [Arquitectura de módulos](#5-arquitectura-de-módulos)
6. [IDs: cómo se garantiza que sean estables y deterministas](#6-ids-cómo-se-garantiza-que-sean-estables-y-deterministas)
7. [URLs y anclas: cómo se verifica que existan de verdad](#7-urls-y-anclas-cómo-se-verifica-que-existan-de-verdad)
8. [Confianza: cuándo se hereda y cuándo no existe](#8-confianza-cuándo-se-hereda-y-cuándo-no-existe)
9. [Exportación: objetos TypeScript y JSON determinista](#9-exportación-objetos-typescript-y-json-determinista)
10. [Validación e invariantes](#10-validación-e-invariantes)
11. [Cómo se mantiene](#11-cómo-se-mantiene)
12. [Lo que esta v1 no hace](#12-lo-que-esta-v1-no-hace)
13. [Estado real de implementación](#13-estado-real-de-implementación)

---

## 1. Filosofía

El contenido editorial de tidusss.es ya existe, ya está publicado y ya vive estructurado en `src/data/league-laboratory` — el problema que resuelve este dominio no es "encontrar contenido", es **convertir ese contenido, ya de por sí estructurado, en unidades que un sistema de recuperación pueda citar con precisión**: con su texto exacto, su procedencia verificable, su URL real y su nivel de confianza heredado del propio criterio editorial que lo respalda.

Tres principios, heredados directamente de `content-graph.md` y `league-laboratory.md`, que este dominio no relaja:

1. **Nunca se inventa contenido.** Un documento de conocimiento nunca contiene una frase que Tidusss no haya escrito. Cuando un campo del dominio de origen está vacío o pendiente (runas secundarias sin confirmar, matchups sin analizar), no se genera ningún documento para él — ni siquiera uno que diga "pendiente".
2. **El dominio de origen manda.** Este dominio **lee** `league-laboratory`, nunca lo reinterpreta ni le añade estructura que no tenga. Si el dominio de origen no tiene un campo (`Synergy` no tiene `title`), este dominio lo compone a partir de datos reales ya existentes (los nombres de los campeones), nunca inventa un texto libre nuevo.
3. **Solo se indexa lo que un visitante humano ya puede ver.** El mismo filtro que decide qué se muestra como contenido real en `/campeones/[slug]` (perfil existente, entrada de Tier List revisada, elección de runa con razonamiento) decide qué se indexa aquí. El índice no puede "saber" más que la propia web pública.

---

## 2. El contrato: `KnowledgeDocument`

```ts
interface KnowledgeDocument {
  id: string;                    // estable, determinista — ver §6
  type: KnowledgeDocumentType;    // vocabulario cerrado de 16 valores — ver §3
  title: string;
  content: string;                // el texto exacto, editorial, real
  url: string;                    // ruta real + ancla real cuando aplica — ver §7
  source: 'editorial';             // único valor hoy: todo es criterio de Tidusss
  language: 'es';                  // único valor hoy: PLATFORM_BIBLE.md §2.4
  sourceEntityId: string;          // id de la entidad real de league-laboratory
  patchId?: string;                // solo si el dato de origen lo declara explícitamente
  date?: string;                    // solo para historial editorial (fecha ISO real)
  confidence?: EditorialConfidence; // heredado del EditorialTake más cercano, si existe
  relatedEntityIds: readonly string[]; // nunca vacío
}
```

Cada campo responde a un requisito explícito del encargo (título, contenido, URL+ancla real, fuente, idioma, parche/fecha cuando existan, entidades relacionadas, id de la entidad de origen) — ninguno es superfluo, ninguno falta.

---

## 3. Qué se indexa y qué se excluye

| Fuente real | ¿Se indexa? | Documentos generados |
|---|---|---|
| Identidad y estilo de juego (`LabChampion.roles/signatureNote/playstyleTags`) | Sí | 1 por campeón con contenido editorial real |
| "Entendiendo a X" (`ChampionProfile.summary`/`.appeal`) | Sí | 2 (una pregunta cada uno) |
| Veredicto de perfil (`ChampionProfile.editorialTake`) | Sí | 1 |
| Fortalezas / debilidades / errores frecuentes / power spikes / consejos rápidos | Sí | 1 por elemento real de cada lista |
| Historial editorial (`LabChampion.editorialHistory`) | Sí | 1 por entrada real, con su fecha y su `patchId` si existe |
| Build 26.14 (`BuildItemChoice` + `EditorialTake`) | Sí | 1 por elección de objeto (todas las ranuras) + 1 por veredicto de build |
| Runas confirmadas (`RuneChoice` con `reasoning` + `EditorialTake`) | Sí | 1 por elección de runa **con razonamiento real** + 1 por veredicto |
| Sinergias (`Synergy`) | Sí | 1 por sinergia (ya atómica) |
| Conceptos relacionados con Lucian (`LabChampion.coreConceptIds`) | Sí | 1 por concepto realmente enlazado |
| Entradas **revisadas** de la Tier List | Sí | 1 por entrada con `reviewStatus: 'reviewed'` |
| **Campeones sin `profile`** (Kai'Sa, Jinx, Ezreal — draft) | **No** | 0 — sin veredicto editorial real que citar |
| **Entradas `placeholder` de la Tier List** | **No** | 0 — texto de sistema, no opinión real de Tidusss |
| **Ramas de runas vacías** (secundaria, fragmentos — pendientes de análisis) | **No** | 0, por construcción: un array vacío produce cero documentos, nunca un documento de relleno |
| **Conceptos sin ninguna relación real** (Tempo, Wave Management) | **No** | 0 — mismo criterio que ya aplica `content-graph` a `concept`, por consistencia entre dominios |
| Datos de Riot/Twitch/YouTube en vivo | No | Operativos, no editoriales — cambian cada minuto, no pertenecen a este índice |
| Datos puramente factuales sin valor editorial (clase oficial de Riot, dificultad oficial) | No | Son hechos de Riot, no criterio de Tidusss |

---

## 4. Granularidad: por qué documentos semánticos, no fragmentos por caracteres

Trocear texto por número de caracteres rompería frases a la mitad y perdería la metadata que cada campo del dominio ya lleva (a qué build pertenece, con qué confianza, de qué parche). El dominio de origen **ya está estructurado** en unidades de sentido — una razón por la que elegir un objeto, un veredicto editorial, un consejo rápido — así que cada `KnowledgeDocument` se corresponde exactamente con una de esas unidades reales, nunca con un corte arbitrario de texto.

---

## 5. Arquitectura de módulos

```
src/domain/knowledge-index/
├── types.ts        el contrato KnowledgeDocument + vocabulario cerrado de tipos
├── builders.ts      productores puros — uno por tipo de entidad de origen
├── invariants.ts    validadores puros — mismo patrón que content-graph/invariants.ts
├── serialize.ts     JSON determinista (ordenado por id)
├── registry.ts      ensambla el índice real desde src/data/league-laboratory
└── index.ts         barrel
```

**Productores separados** (`builders.ts`): `championIdentityDocuments`, `championUnderstandingDocuments`, `championProfileTraitDocuments`, `editorialHistoryDocuments`, `buildDocuments`, `runePageDocuments`, `synergyDocuments`, `conceptDocuments`, `tierListEntryDocuments`. Cada uno recibe la entidad real de origen más el nombre/URL ya resueltos por quien llama (nunca los deriva de un slug ni de texto libre) — mismo patrón que `league-laboratory/content-graph-bridge.ts`.

`registry.ts` es el único archivo que decide **qué se indexa de verdad**: recorre `src/data/league-laboratory`, aplica las exclusiones de §3, y ordena el resultado por `id`. Ningún otro archivo decide inclusión/exclusión — igual que `content-graph/league-laboratory-extension.ts` es el único lugar que decide qué se registra en el grafo.

---

## 6. IDs: cómo se garantiza que sean estables y deterministas

Formato `knowledge:<sourceEntityId>:<campo>[:índice]`, por ejemplo:

- `knowledge:champion:lucian:identity`
- `knowledge:champion:lucian:strength:0`
- `knowledge:build:lucian-26-14-solid:item:core:1`
- `knowledge:rune-page:lucian-26-14:choice:primary:0`
- `knowledge:tier-list:official-adc:entry:champion:lucian`

Nunca se genera con `Math.random()`, `Date.now()`, un contador global ni ningún estado mutable — se deriva enteramente de campos reales (el id de la entidad de origen + el nombre del campo + la posición dentro de un array real, que es en sí misma un dato estable del dominio de origen, no un artefacto de ejecución). `registry.ts` ordena el resultado final por `id`, así que el orden en que se recorren builds/runas/sinergias/etc. nunca afecta al array exportado.

---

## 7. URLs y anclas: cómo se verifica que existan de verdad

Cada `url` usa exactamente el mismo esquema de rutas y anclas que ya usa `content-graph/league-laboratory-extension.ts` (`/campeones/<slug>#build-heading`, `#runas-heading`, `#sinergias-heading`, `#concepts-heading`, `#historial-editorial-heading`, o `/tier-list` sin ancla). Esto no es una coincidencia de estilo: **es la misma ancla real**, verificada de dos formas:

1. En diseño: los IDs de sección (`id="build"`, `id="runas"`...) ya se auditaron contra `src/pages/campeones/[slug].astro` al construir el Content Graph (Fase C).
2. En prueba automatizada: `test/knowledge-index/registry.test.ts` **lee el código fuente real** de `[slug].astro` y confirma que cada ancla usada por el índice corresponde a un `id="..."` que existe de verdad en ese archivo — no una constante de confianza, una comprobación contra el archivo real.

---

## 8. Confianza: cuándo se hereda y cuándo no existe

- **Se hereda** de `EditorialTake.confidence` cuando el documento pertenece a (o deriva de) un build, una página de runas, una sinergia, una entrada de Tier List o el perfil de un campeón — todos ellos llevan su propio veredicto editorial con confianza explícita en el dominio de origen.
- **No existe** (`confidence: undefined`) para los `Concept` — son, según su propio comentario de origen en `concepts.ts`, "definiciones objetivas de vocabulario ya establecido en League of Legends, no opiniones editoriales de Tidusss". Asignarles una confianza fingiría que son un veredicto cuando no lo son.

---

## 9. Exportación: objetos TypeScript y JSON determinista

**Decisión, justificada:** esta v1 exporta **ambos**, no uno u otro:

- **`knowledgeDocuments: readonly KnowledgeDocument[]`** (`registry.ts`) es el artefacto primario — un array tipado, consumible directamente por cualquier código TypeScript dentro del propio build de Astro (tests, o un futuro consumidor dentro del mismo repositorio), sin coste de serialización.
- **`serializeKnowledgeIndex(documents): string`** (`serialize.ts`) produce el mismo contenido como JSON determinista (ordenado por `id`, formato estable) — pensado para un futuro consumidor **fuera** del build de TypeScript (un script Node independiente que calcule embeddings, según `pregunta-a-tidusss.md` §4.3), que necesitará un artefacto serializable, no un módulo TypeScript importado.

Ninguna de las dos funciones escribe a disco ni a red — la decisión de **dónde** persistir el JSON (¿un archivo en el propio repo? ¿subido a un almacén externo?) es del futuro script que lo consuma, no de este dominio puro.

---

## 10. Validación e invariantes

`invariants.ts` expone validadores puros, mismo patrón que `content-graph/invariants.ts`:

- `findDuplicateDocumentIds` — ids únicos.
- `findEmptyContentDocuments` / `findEmptyTitleDocuments` — ningún documento vacío.
- `findDocumentsMissingSourceEntityId` — todo documento resuelve a una entidad de origen real.
- `findDocumentsWithInvalidUrl` — toda URL es una ruta relativa real (con o sin ancla), nunca externa ni vacía.
- `findDocumentsWithoutRelatedEntities` — todo documento declara al menos una entidad relacionada real.
- `findDocumentsWithInvalidLanguageOrSource` — `language`/`source` dentro del vocabulario cerrado.
- `validateKnowledgeIndex` — agrega las anteriores; `[]` significa índice válido.

`test/knowledge-index/registry.test.ts` confirma que el índice **real** (`knowledgeDocuments`) pasa `validateKnowledgeIndex` con cero violaciones, además de las pruebas específicas de exclusión, separación de parches y no fuga de contenido entre campeones (ver informe de entrega para el detalle completo).

---

## 11. Cómo se mantiene

Igual que el Content Graph (`content-graph.md` §10.3): el índice se **reconstruye por completo en cada build**, calculado una vez como una constante de módulo (`buildKnowledgeDocuments()` se ejecuta al importar `registry.ts`). No hay estado mutable entre reconstrucciones, no hay caché que invalidar a mano. Si Tidusss publica una build nueva con su `championId`/`reasoning` reales, sus documentos aparecen solos en el siguiente build del sitio — mantener el índice es, de nuevo, una consecuencia automática de mantener bien `league-laboratory`, no una tarea aparte.

---

## 12. Lo que esta v1 no hace

Explícitamente fuera de alcance, por instrucción directa del encargo:

- Embeddings, Cloudflare Vectorize, D1, generación con Claude, RAG, `/pregunta`, buscador semántico — todo eso sigue siendo diseño no implementado en `pregunta-a-tidusss.md`.
- Ninguna interfaz, ninguna ruta nueva, ningún cambio visual en la web.
- `BuildItemAlternative` (alternativas de objeto) no genera documento propio — no estaba en el alcance pedido.
- `guide`/`KnowledgeArticle` — sin fuente de datos real (mismo motivo que en `content-graph.md` §14), nada que indexar.

---

## 13. Estado real de implementación

- `src/domain/knowledge-index/{types,builders,invariants,serialize,registry,index}.ts` — construidos y validados.
- `test/knowledge-index/{invariants,builders,registry}.test.ts` — 45 pruebas, todas verdes.
- `npm test` (258/258), `npx astro check` (0 errores), `npx eslint .` (limpio), `npm run build` (177 páginas, sin cambios) — validado tras esta implementación.
- Sin commit, sin push, sin despliegue.
