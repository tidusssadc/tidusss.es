# Pregunta a Tidusss — Documento de diseño de producto

> **Naturaleza de este documento:** diseño de producto puro. **No contiene una sola línea de código ni de implementación.** Es la especificación que se aprueba (o se corrige) antes de escribir la primera línea de la v1. Sigue la misma disciplina que el resto de `docs/`: no se inventa nada que no esté aquí decidido explícitamente, y todo lo que queda abierto se marca como **[Decisión pendiente]** en vez de asumirse.
> **Relación con la documentación existente:** este producto es un **consumidor de solo lectura** de [`league-laboratory.md`](league-laboratory.md) (el conocimiento editorial: builds, runas, matchups, sinergias, conceptos, perfiles, tier list) y de [`content-graph.md`](content-graph.md) (los vídeos, partidas y guías ya enlazados a esas entidades). No introduce entidades de dominio nuevas en `league-laboratory` — indexa las que ya existen. Si en el futuro necesita datos que el dominio no modela todavía, ese cambio se decide y documenta allí primero, no aquí.
> **Estado:** propuesta v0.1, sin aprobar, sin construir.

---

## Índice

0. [Resumen ejecutivo](#0-resumen-ejecutivo)
1. [Filosofía y principios no negociables](#1-filosofía-y-principios-no-negociables)
2. [Arquitectura funcional](#2-arquitectura-funcional)
3. [Arquitectura técnica](#3-arquitectura-técnica)
4. [El sistema RAG](#4-el-sistema-rag)
5. [El contrato de respuesta](#5-el-contrato-de-respuesta)
6. [UX completa y flujo del usuario](#6-ux-completa-y-flujo-del-usuario)
7. [Estados vacíos](#7-estados-vacíos)
8. [Estados de carga](#8-estados-de-carga)
9. [Estados de error](#9-estados-de-error)
10. [Sistema de confianza](#10-sistema-de-confianza)
11. [Sistema de fuentes](#11-sistema-de-fuentes)
12. [Integración con el resto de la web](#12-integración-con-el-resto-de-la-web)
13. [Guardrails anti-alucinación (control del LLM)](#13-guardrails-anti-alucinación-control-del-llm)
14. [Métricas de éxito](#14-métricas-de-éxito)
15. [Riesgos y mitigaciones](#15-riesgos-y-mitigaciones)
16. [Roadmap de construcción por fases](#16-roadmap-de-construcción-por-fases)
17. [Decisiones pendientes antes de construir](#17-decisiones-pendientes-antes-de-construir)

---

## 0. Resumen ejecutivo

**Pregunta a Tidusss** no es un chatbot. Es un **oráculo de criterio editorial acotado**: un producto que responde preguntas sobre ADC, League of Legends y, sobre todo, los campeones que Tidusss ha analizado — usando **exclusivamente** lo que él ya ha publicado en tidusss.es. Si la pregunta cae fuera de ese conocimiento, el producto lo dice explícitamente en vez de improvisar con conocimiento general de un modelo de lenguaje.

La tesis de diseño en una frase: **la caja de texto no es el producto — el producto es la evidencia que rodea a la respuesta.** Cualquiera puede montar una caja de texto conectada a un LLM en una tarde. Lo que hace esto premium y diferencial es que cada respuesta llega acompañada, siempre, de: de dónde sale (fuente exacta, con enlace), cuándo se dijo (fecha/parche editorial), cuánto se puede confiar en ella (nivel de confianza, heredado del propio criterio de Tidusss) y qué más hay relacionado (conceptos, vídeos, partidas, otros campeones). Sin esos cuatro elementos, no es una respuesta de Pregunta a Tidusss — es solo texto.

Esto se apoya en algo que **ya existe** en el código: el dominio `league-laboratory` obliga a que builds, runas, matchups, sinergias y entradas de tier list lleven un `EditorialTake` (veredicto + razonamiento + nivel de confianza) como campo estructural, no como texto libre opcional. Pregunta a Tidusss no inventa un sistema de confianza nuevo — **hereda y expone** el que ya obliga a existir el propio modelo de datos.

---

## 1. Filosofía y principios no negociables

Estos principios son la vara de medir de cualquier decisión de diseño posterior en este documento. Si una idea los viola, se descarta, por atractiva que parezca.

1. **El silencio es una respuesta válida.** "Tidusss no ha analizado esto todavía" es un resultado de éxito del producto, no un fallo. El producto nunca debe sentir la presión de "siempre dar algo".
2. **Cero conocimiento de LoL genérico.** El modelo no debe responder desde lo que "sabe" de League of Legends en general (parches viejos, builds de otros creadores, meta genérico de internet). Solo desde el corpus indexado de tidusss.es. Esto es más estricto que "prioriza tus fuentes" — es "**no tienes otras fuentes**".
3. **Cada afirmación es rastreable.** Si la respuesta dice algo, tiene que poder señalarse la frase exacta, en la entidad exacta (un `Build`, un `Matchup`, un `EditorialTake`...), de la que sale. Si no se puede rastrear, no se dice.
4. **La confianza no la decide el LLM, la hereda del dato.** Un `EditorialTake` con `confidence: 'baja'` en el dominio produce una respuesta que se presenta con confianza baja, sin que el modelo "opine" sobre lo segura que se siente.
5. **Nunca se disfraza una opinión personal de consenso.** Si la fuente es "preferencia personal de Tidusss" (como la build de Navori frente a Filo Infinito, ya documentada en el dominio), la respuesta lo dice así, no como un hecho objetivo.
6. **No es una conversación infinita.** El objetivo del usuario es resolver una duda concreta, no mantener una charla. La interfaz debe desalentar activamente los hilos largos tipo chat (ver §6).
7. **Todo lo que el producto cita, ya vivía en la web.** No se genera contenido nuevo que no exista en otra página — el producto es un **buscador de significado** sobre contenido publicado, nunca un generador de contenido editorial nuevo.

---

## 2. Arquitectura funcional

### 2.1 Las tres piezas funcionales

```
┌─────────────────────┐     ┌──────────────────────┐     ┌───────────────────────┐
│   1. Puerta de       │     │  2. Motor de         │     │  3. Presentación      │
│      alcance         │────▶│     respuesta         │────▶│     con evidencia      │
│  (¿esto es LoL/ADC/  │     │  (recuperar + generar │     │  (respuesta + confianza│
│   Tidusss?)          │     │   de forma acotada)   │     │  + fuentes + enlaces)  │
└─────────────────────┘     └──────────────────────┘     └───────────────────────┘
```

**1. Puerta de alcance (scope gate).** Antes de gastar un solo token de generación, se decide si la pregunta puede, en principio, responderse con el corpus. Esto no es un "prompt que le pide amablemente al modelo que se ciña al tema" — es una comprobación explícita y barata (similitud de embeddings contra el corpus + lista de temas permitidos) que puede **cortocircuitar** el resto del flujo con una respuesta fija de "esto no es lo mío" (§7).

**2. Motor de respuesta.** Solo se activa si la puerta de alcance deja pasar la pregunta. Recupera los fragmentos de conocimiento editorial más relevantes (§4) y genera una respuesta **obligada** a citar exclusivamente esos fragmentos. La generación produce una salida **estructurada** (no texto libre): respuesta, lista de fuentes usadas, conceptos relacionados, confianza — nunca un bloque de texto sin estructura que haya que "parsear" a ojo.

**3. Presentación con evidencia.** La interfaz nunca muestra el texto de la respuesta solo — siempre lo envuelve en el contrato de respuesta (§5): confianza, fuentes, fecha editorial, enlaces relacionados. Esta capa es pura UI/composición, no vuelve a tocar al LLM.

### 2.2 Qué NO hace el sistema (alcance funcional negativo)

Definir el producto por lo que rechaza hacer es tan importante como definirlo por lo que hace:

- No mantiene memoria de conversación entre sesiones (no hay "historial de chat" persistente por usuario — ver §6.2 sobre por qué esto es una decisión de producto, no una limitación técnica).
- No responde preguntas fuera de LoL/ADC/Tidusss aunque el modelo "sepa" la respuesta (geografía, cultura general, otros juegos, otros streamers).
- No compara a Tidusss con otros creadores de contenido ni emite opiniones que Tidusss no haya publicado él mismo.
- No genera builds, matchups o veredictos nuevos "por inferencia" a partir de datos parciales — si el `Matchup` contra un campeón no existe en el dominio, no se improvisa uno combinando conceptos sueltos.
- No sustituye a la navegación normal de la web — es un atajo hacia el mismo contenido que ya vive en `/campeones/[slug]`, `/tier-list`, etc., nunca una fuente de verdad paralela.

---

## 3. Arquitectura técnica

### 3.1 Encaje en la infraestructura ya existente

tidusss.es es un sitio **estático** (Astro) desplegado en **Cloudflare Pages**, con **Cloudflare Pages Functions** para todo lo que necesita ejecutarse en petición (los proxies de Riot/Twitch/YouTube ya existentes en `functions/`). Pregunta a Tidusss sigue exactamente ese patrón: **la página es estática, la respuesta es una Function**.

```
src/pages/
└── pregunta.astro              página estática: hero, input, sugerencias, shell de resultados

functions/
└── api/
    └── ask.ts                  POST — recibe la pregunta, ejecuta el pipeline, devuelve JSON

scripts/knowledge/
└── build-index.mjs             build-time: recorre league-laboratory + content-graph,
                                 genera fragmentos, calcula embeddings, publica el índice

(nuevo almacén, fuera del repo, gestionado por Cloudflare)
├── Vectorize index              vectores + metadatos mínimos de cada fragmento
└── D1 (SQL) o KV                metadatos completos por fragmento: entidad, URL, fecha,
                                  confianza editorial, texto fuente
```

Ningún componente nuevo vive en `src/domain/league-laboratory` — ese dominio no cambia. Se añade un **dominio propio, pequeño y desacoplado** para esta función (ver 3.3), que **lee** del dominio existente en tiempo de build, exactamente como ya hace `scripts/sync-champion-catalog.mjs` (o equivalente) para generar el catálogo desde Data Dragon.

### 3.2 Por qué estas piezas y no otras (con alternativas descartadas)

| Pieza | Elección propuesta | Por qué | Alternativa descartada |
|---|---|---|---|
| Vector store | **Cloudflare Vectorize** | Ya vivimos en el ecosistema Cloudflare (Pages + Functions); cero proveedor nuevo que gestionar, cero credenciales nuevas fuera del panel que ya se usa | Pinecone/Weaviate — añaden un proveedor externo más para un volumen de datos que, hoy, es pequeño (decenas de fragmentos, no millones) |
| Almacén de metadatos | **Cloudflare D1** | Los metadatos de un fragmento (entidad de origen, URL+ancla, fecha editorial, confianza) son relacionales por naturaleza (un fragmento pertenece a una entidad, una entidad pertenece a un campeón); SQL expresa eso mejor que pares clave-valor | KV puro — más simple, pero obliga a serializar todo el metadato en el valor y complica futuras consultas ("dame todos los fragmentos con confianza baja") |
| Generación | **API de Claude (Anthropic)** | Mejor seguimiento de instrucciones estrictas de "no salgas del contexto" que se ha observado en la práctica; soporta salida estructurada (tool use / structured output) de forma nativa, necesaria para el contrato de respuesta (§5) | Modelo autoalojado en Workers AI — más barato, pero peor adherencia a instrucciones de acotamiento estricto con el volumen de contexto que maneja este caso |
| Embeddings | **Por decidir — ver 3.2.1** | — | — |
| Caché de respuestas | **Cloudflare KV**, clave = hash(pregunta normalizada) + versión del índice | Las preguntas se repiten (todo el mundo pregunta "¿qué build llevo con Lucian?"); cachear evita coste y latencia repetidos | Sin caché — descartado por coste: cada repetición de la misma pregunta popular pagaría de nuevo el ciclo completo de recuperación + generación |
| Rate limiting | Reglas nativas de Cloudflare + contador en KV por IP/sesión | A diferencia de los proxies de Riot/YouTube (gratuitos), cada pregunta cuesta dinero en tokens de LLM — necesita un techo explícito | — |

#### 3.2.1 Embeddings: decisión abierta, con criterio

El corpus es **español**, con terminología mixta español/inglés propia de LoL ("power spike", "wave management", nombres de objetos en español de la localización del juego). El modelo de embeddings tiene que representar bien ese español técnico-mixto. Dos caminos razonables, ninguno descartado todavía:

- **Workers AI multilingüe** (p. ej. una variante `bge-m3` o similar disponible en el catálogo de Cloudflare) — se queda dentro del mismo proveedor que Vectorize/D1, cero llaves nuevas.
- **Un proveedor externo de embeddings multilingües** de mayor calidad, si en pruebas reales el de Workers AI no distingue bien matices de la jerga LoL en español.

Esto se decide con un **experimento pequeño y barato antes de construir nada más**: tomar 20-30 preguntas reales que Tidusss espere recibir, y dos o tres modelos de embeddings candidatos, y comprobar a mano cuál recupera el fragmento correcto con más consistencia. No se elige a priori.

### 3.3 Dominio nuevo: `domain/knowledge-assistant` (solo lectura, sin estado)

Siguiendo la misma disciplina que `league-laboratory` y `content-graph` (cero dependencias de Astro/DOM/`fetch`, funciones puras), se propone un dominio pequeño y estrictamente de solo lectura:

```
src/domain/knowledge-assistant/
├── index.ts             barrel
├── types.ts             KnowledgeChunk, ChunkSource, AskResponse, ConfidenceBand...
├── chunking.ts           funciones puras: LabChampion/Build/RunePage/... → KnowledgeChunk[]
└── scope-gate.ts         función pura: clasifica si un set de scores de similitud
                          indica "dentro de alcance" o no (sin llamar a ningún LLM)
```

Este dominio **no sabe nada** de Vectorize, D1, Cloudflare ni HTTP — igual que `league-laboratory/registry.ts` no sabe nada de Astro. Las Functions (`functions/api/ask.ts`, `scripts/knowledge/build-index.mjs`) son las que conectan este dominio puro con el mundo real (llamadas a la API de embeddings, a Vectorize, a Claude). Este límite es el que ya ha funcionado bien en el resto del proyecto y no hay razón para romperlo aquí.

---

## 4. El sistema RAG

### 4.1 Qué se indexa (y qué se excluye explícitamente)

| Entidad de origen | ¿Se indexa? | Granularidad del fragmento |
|---|---|---|
| `ChampionProfile` (identidad, fortalezas, debilidades, power spikes, errores comunes, quick tips) | Sí | Un fragmento por cada fortaleza/debilidad/power spike/error/tip individual — nunca el perfil entero como un solo bloque |
| `Build` (+ `BuildItemChoice.reasoning`, `EditorialTake`) | Sí | Un fragmento por elección de objeto con su razonamiento; un fragmento aparte por el `EditorialTake` del build completo |
| `RunePage` (+ `RuneChoice.reasoning`, `EditorialTake`) | Sí | Un fragmento por elección de runa con razonamiento; uno por el `EditorialTake` |
| `Matchup` (cuando exista contenido real) | Sí | Un fragmento por matchup (dificultad + explicación + tips) |
| `Synergy` | Sí | Un fragmento por sinergia |
| `Concept` | Sí | Un fragmento por concepto (ya son atómicos por diseño) |
| Entradas de `TierList` (+ `EditorialTake`) | Sí | Un fragmento por entrada |
| `EditorialHistoryEntry` | Sí, con tratamiento especial | Se indexa para responder "¿ha cambiado algo recientemente sobre X?", pero se marca con `esHistorico: true` para que el motor de respuesta lo cite como contexto temporal, no como el estado actual si hay una entidad más reciente que lo contradiga |
| `KnowledgeArticle` (guías, cuando existan) | Sí | Por secciones del artículo, no el artículo completo |
| **Contenido con `reviewStatus: 'placeholder'` o `'draft'`** | **No, nunca** | Es texto de sistema ("Placeholder editorial — pendiente de revisión"), no una opinión real de Tidusss. Indexarlo haría que el asistente "citara a Tidusss" diciendo algo que Tidusss no ha dicho. Esto es la aplicación directa del principio §1.5 al pipeline técnico. |
| Datos de Riot/Twitch/YouTube en vivo (rango actual, directo activo, últimos vídeos) | No | Son datos operativos en tiempo real, no conocimiento editorial. Cambian cada minuto; indexarlos generaría respuestas caducadas en segundos. Si un usuario pregunta "¿está en directo ahora?", eso no pasa la puerta de alcance como pregunta de *conocimiento* — se redirige a `/live` (ver §6.6) |
| Comentarios de vídeos, chat de Twitch, redes sociales | No | Nunca ha sido "conocimiento editorial publicado por Tidusss en tidusss.es" — es contenido de terceros o efímero |

**Regla general, explícita:** solo se indexa lo que ya pasa el filtro `resolveChampionEditorialStatus` / `EditorialReviewStatus !== 'placeholder'` que el propio dominio `league-laboratory` ya usa para decidir qué mostrar como contenido real en las páginas públicas. El índice de búsqueda no puede saber más ni distinto de lo que un visitante humano ve como "contenido real" navegando el sitio.

### 4.2 Por qué "chunking semántico por campo" y no "trocear texto cada N caracteres"

La alternativa obvia y más simple —coger todo el texto publicado y trocearlo en bloques de tamaño fijo con solape— se descarta explícitamente. Motivo: el dominio **ya está estructurado** en unidades de sentido (una razón de por qué elegir un objeto, un veredicto editorial, un consejo rápido). Trocear por caracteres rompería esas unidades a la mitad de una frase y perdería la metadata que cada campo ya lleva encima (a qué build pertenece, con qué confianza, de qué parche). Cada `KnowledgeChunk` es:

```
KnowledgeChunk {
  id                    identificador estable (para poder decir "esto no ha cambiado,
                         no hace falta recalcular su embedding" en reindexaciones futuras)
  text                  el texto exacto a embedar e insertar en el contexto del LLM
  sourceType            'build-item' | 'build-take' | 'rune-choice' | 'rune-take' |
                         'matchup' | 'synergy' | 'concept' | 'tier-entry' |
                         'profile-trait' | 'quick-tip' | 'editorial-history' | 'guide-section'
  sourceEntityId         id de la entidad real en league-laboratory (trazabilidad)
  championId             si aplica
  patchId                si aplica
  confidence             heredada del EditorialTake más cercano, si existe
  url                    ruta real + ancla exacta de la página pública (p. ej.
                         /campeones/lucian#build-heading)
  editorialDate          fecha del EditorialHistoryEntry más reciente que toca esta entidad,
                         o la fecha de publicación del patch si no hay entrada de historial
}
```

> **Nota de estado (2026-08-03):** la parte de este diseño que produce documentos estructurados a partir del contenido editorial real ya tiene una primera versión implementada en `src/domain/knowledge-index/` (tipos `KnowledgeDocument`, productores puros, invariantes y validación) — ver [`docs/knowledge-index.md`](knowledge-index.md) para el detalle exacto. Esa implementación cubre, con nombres ligeramente distintos a los de este documento pero el mismo espíritu, lo descrito en §4.1 y §4.2: `KnowledgeDocument` ocupa el lugar de `KnowledgeChunk` (documentos semánticos por campo, no trozos de tamaño fijo), con `sourceEntityId`, `patchId`, `date`, `confidence` heredada y `url` con ancla real verificada automáticamente contra `[slug].astro`. Lo que sigue **sin implementar** es todo lo que depende de un motor de recuperación real: `sourceType` como vocabulario cerrado de producción, cálculo de hash de contenido, embeddings, Vectorize, D1, el pipeline de actualización de §4.3 y el enlazado en vivo de §4.4 — estas secciones siguen siendo diseño, no código.

### 4.3 Actualización del índice

El conocimiento editorial de Tidusss cambia **cuando él publica**, no continuamente. Esto permite un modelo de actualización simple y barato, coherente con el resto del proyecto (todo se genera en build time, nada se sincroniza en segundo plano):

1. `scripts/knowledge/build-index.mjs` se ejecuta como un paso más del pipeline de build/deploy (igual que hoy se regenera el catálogo de campeones).
2. Recorre `league-laboratory` completo, produce todos los `KnowledgeChunk[]` con `chunking.ts`.
3. Para cada fragmento, calcula su hash de contenido. Si el hash coincide con el de la última publicación del índice, **reutiliza el embedding ya calculado** (no vuelve a pagar la llamada a la API de embeddings) — solo recalcula lo que cambió de verdad.
4. Publica la versión nueva del índice en Vectorize + D1, con un número de versión. La caché de respuestas (§3.2, tabla) usa ese número de versión como parte de la clave, así que en cuanto se publica contenido nuevo, las respuestas cacheadas del contenido antiguo dejan de servirse automáticamente sin necesidad de purgar nada a mano.
5. No hay actualización incremental en producción "en caliente" — cada publicación de contenido implica un nuevo despliegue del sitio, y el índice se reconstruye como parte de ese mismo despliegue. Esto es intencional: mantiene el sistema tan predecible y depurable como el resto del sitio (nada de estado mutable en producción entre despliegues).

### 4.4 Cómo se enlaza el contenido de vuelta a la web real

Cada `KnowledgeChunk.url` no es una URL inventada — se calcula con las **mismas funciones de resolución de rutas** que ya usa el resto del sitio (`campeon-${slug}`, `#build-heading`, `#runas-heading`, etc., los mismos anclajes por los que ya navega `/campeones/[slug].astro`). Esto garantiza que "ver la fuente completa" lleve siempre a una sección real, existente y ya probada de la web — nunca a un enlace roto o a una página que el sistema de indexado "cree" que existe.

---

## 5. El contrato de respuesta

Toda respuesta que el motor genera — sin excepción, incluidas las de "no lo sé" — se ajusta a esta forma. La interfaz **no sabe renderizar** ninguna otra forma de respuesta; si el motor no puede rellenar el contrato, no hay respuesta que mostrar (se cae al estado de "sin cobertura", §7).

```
AskResponse {
  status              'answered' | 'out-of-scope' | 'no-coverage' | 'error'
  answer               texto de la respuesta (solo si status === 'answered')
  confidence           'alta' | 'media' | 'baja'   (solo si status === 'answered', §10)
  sources              KnowledgeChunk[] realmente citados (nunca vacío si status === 'answered')
  relatedConcepts      Concept[] enlazados, si el/los fragmento(s) fuente los referencian
  relatedChampions     campeones mencionados o comparados, con enlace a su ficha
  relatedVideos        vídeos ya etiquetados a la entidad fuente en el Content Graph, si existen
  relatedMatches       partidas reales ya vinculadas a esa entidad, si existen
  editorialDate        la fecha editorial más reciente entre todas las fuentes citadas
  query                la pregunta original, normalizada (para mostrarla junto a la respuesta)
}
```

Los cuatro elementos que el encargo pide explícitamente que **toda** respuesta muestre —confianza, fuentes, fecha editorial, enlaces relacionados— no son un adorno de la interfaz: son **campos obligatorios de este contrato**. Si el motor de respuesta no puede rellenar `sources` con al menos un elemento real, el `status` no puede ser `'answered'` — se convierte automáticamente en `'no-coverage'`. Esto hace estructuralmente imposible una respuesta "flotante" sin evidencia detrás, de la misma forma que `EditorialTake` obligatorio en el dominio hace estructuralmente imposible una build sin razonamiento.

---

## 6. UX completa y flujo del usuario

### 6.1 ¿Cómo llega el usuario?

Dos caminos de entrada, con tratamiento distinto:

**A. Entrada directa — un lugar propio, no una burbuja flotante.** Una ruta nueva, `/pregunta`, con presencia en la navegación principal (junto a "Directo", "Centro de Campeones", "Tier List"). Se descarta explícitamente el patrón de "burbuja de chat flotante en la esquina" — ese patrón comunica "asistente de soporte genérico de SaaS", exactamente lo que el encargo pide evitar. `/pregunta` se diseña con la misma solemnidad editorial que `/tier-list`: un hero propio, una tesis del producto explicada antes de la caja de input (ver 6.2), no un widget.

**B. Entrada contextual — desde donde ya está la duda.** En la ficha de cada campeón curado (`/campeones/[slug]`), al final de la guía (después de "Historial editorial", antes del pie de página) aparece un bloque de invitación: *"¿Tienes una duda sobre Lucian que la guía no responde? Pregúntaselo a Tidusss."* Este bloque enlaza a `/pregunta?campeon=lucian`, que preselecciona ese campeón como contexto de la conversación (ver 6.2) — el usuario no tiene que volver a escribir "de Lucian" en su pregunta.

No se propone una entrada desde `/live` ni desde Home: esas superficies son de datos en tiempo real o de marca, no de conocimiento editorial — mezclar el asistente allí diluiría su propósito (ver §12 para el detalle completo de integración).

### 6.2 ¿Cómo escribe el usuario?

Se descarta deliberadamente la caja de texto genérica con placeholder "Escribe tu pregunta..." y un historial de chat que crece hacia abajo. En su lugar:

- **Un input de una sola línea**, con la sensación de una barra de búsqueda de intención más que de un chat — refuerza que esto es "encontrar el criterio de Tidusss sobre algo", no "conversar con una IA".
- **Chips de sugerencia** justo debajo del input, generados a partir de lo que **realmente existe indexado** (nunca preguntas de relleno inventadas): "¿Qué build llevo con Lucian?", "¿Cuál es el power spike de Lucian?", "¿Qué runas usa Tidusss?". Estos chips se generan en build time a partir de las entidades reales con contenido (mismo patrón que hoy alimenta "Analizados por Tidusss" en `/campeones`) — si mañana solo Lucian tiene contenido real, solo aparecen chips sobre Lucian; en cuanto se publique contenido de otro campeón, aparecen chips nuevos automáticamente, sin tocar copy a mano.
- **Si llega con contexto de campeón** (desde la entrada B de 6.1), el input muestra una etiqueta fija no editable a la izquierda ("Sobre: Lucian ✕") y los chips de sugerencia se filtran a ese campeón. El usuario puede quitar la etiqueta si quiere preguntar algo más general.
- **Sigue habiendo hilo, pero acotado y visible como tal.** Una pregunta de seguimiento es habitual y legítima ("¿y en la línea contra un tirador agresivo?" tras preguntar por power spikes). Se permite, pero con límites explícitos de producto: máximo de intercambios visibles a la vez (por ejemplo 3), sin scroll infinito, y cada respuesta nueva **sustituye visualmente** a la anterior en vez de apilarse indefinidamente hacia abajo — la sensación debe seguir siendo "estoy afinando una pregunta", no "estoy manteniendo una conversación larga".
- **Nunca autocompletar con relleno del propio LLM mientras el usuario escribe** — nada de sugerencias tipo "seguro que quieres preguntar...". Los únicos textos sugeridos son los chips curados de arriba.

### 6.3 ¿Cómo se muestran las respuestas?

Ni burbuja de chat ni bloque de texto plano. La respuesta se presenta como una **tarjeta editorial**, reutilizando el lenguaje visual que ya existe en el sitio para este propósito exacto (`EditorialTakeBlock`: barde izquierdo dorado, fondo ligeramente realzado) — de forma que una respuesta de Pregunta a Tidusss se sienta visualmente **igual** de familiar que un veredicto editorial dentro de la guía de un campeón, porque conceptualmente es lo mismo, solo que recuperado por una pregunta en vez de por scroll.

Estructura de la tarjeta de respuesta, de arriba abajo:

1. La pregunta formulada (para que quede claro qué se está respondiendo, especialmente tras varias preguntas de seguimiento).
2. El **badge de confianza** (§10), siempre visible, nunca opcional.
3. El texto de la respuesta — tono editorial, no conversacional-genérico ("Tidusss recomienda..." en vez de "¡Claro! Aquí tienes...").
4. La **fecha editorial** de la fuente más reciente citada, en formato discreto (igual que `PatchBadge`/`EditorialHistoryTimeline` ya muestran en el resto del sitio).
5. Bloque de **fuentes** (§11) — tarjetas pequeñas, cada una con tipo de fuente, título y enlace.
6. Bloque de **relacionados** — conceptos, otros campeones, vídeos y partidas, cada uno con su propio icono/tratamiento ya existente en el sistema (`ConceptCard`, `ChampionCatalogRow`, miniaturas de vídeo, `MatchCard`).
7. Un pie discreto de feedback: "¿Esto ha respondido a tu duda?" con dos opciones simples (sí/no) — ver 6.7.

### 6.4 ¿Cómo se enlazan los vídeos?

Solo se enlazan vídeos que **ya** están etiquetados a la entidad fuente en el Content Graph (la misma relación que hoy permitiría, en teoría, una sección "Vídeos relacionados" real en la guía de un campeón — hoy vacía porque esa relación todavía no existe para ningún vídeo, según la auditoría de la Fase 5). Mientras esa relación no exista, `relatedVideos` en el contrato de respuesta (§5) simplemente viene vacío, y la interfaz **no muestra el bloque** en absoluto (nunca un bloque vacío o un "próximamente" dentro de una respuesta — eso rompería el ritmo de la tarjeta; el "todavía no hay vídeos etiquetados" es un problema de cobertura de datos, no algo que el usuario necesite que se le explique dentro de cada respuesta puntual).

### 6.5 ¿Cómo se enlazan las partidas?

Igual que los vídeos: solo si la entidad fuente (por ejemplo, un `Matchup` o un `Build`) ya tiene una partida real vinculada (el campo `matchHref` que ya existe en el modelo de `Matchup`, o vía el mismo mecanismo que alimenta "Partidas donde aparece" en la guía del campeón, que consulta datos reales de Riot en tiempo de petición). Nunca se inventa ni se busca una partida "parecida" — si no hay una vinculación editorial explícita, no se muestra ninguna partida.

### 6.6 ¿Cómo se enlazan los conceptos?

Cada vez que un fragmento fuente pertenece a un `Concept` (o lo referencia, vía el mismo mecanismo de `coreConceptIds`/`getRelatedConceptsFor` que ya usa la guía de campeón para su sección "Conceptos importantes"), ese concepto aparece como una `ConceptCard` en miniatura dentro del bloque de relacionados — mismo componente visual que ya existe, sin reinventar una tarjeta de concepto nueva para el asistente.

### 6.7 ¿Cómo se indica que todavía no existe conocimiento?

Este es el estado más importante de todo el producto — el que demuestra que el sistema tiene disciplina. Se trata en detalle en §7, pero el principio de interacción es: la ausencia de conocimiento se comunica con **el mismo tono y el mismo tratamiento visual** que ya usa el resto del sitio para "Pendiente de análisis" / "Todavía no hay..." (la familia `EmptyLaboratoryState`), nunca con un tono de disculpa genérico de chatbot ("Lo siento, no tengo información sobre eso 😔"). El asistente habla con la misma voz editorial que el resto del sitio, incluso cuando dice que no sabe algo.

---

## 7. Estados vacíos

| Situación | Qué ve el usuario | Qué NO se hace |
|---|---|---|
| Primera visita a `/pregunta`, sin ninguna pregunta escrita todavía | El hero explica en una frase qué es esto ("el criterio de Tidusss, no un chatbot") + los chips de sugerencia reales (6.2) + un enlace pequeño "¿Qué sabe Pregunta a Tidusss hoy?" que despliega, honestamente, sobre qué campeones/temas hay contenido real indexado ahora mismo (reutilizando el mismo dato que ya alimenta `LaboratoryCoverageSummary` en `/campeones`) | No se muestra una caja vacía con solo un placeholder — la cobertura real del producto se declara por adelantado, igual que `/campeones` ya declara "1 revisado, 3 en borrador, 169 pendientes" en vez de ocultarlo |
| Pregunta dentro de alcance (LoL/ADC/Tidusss) pero sin cobertura real en el corpus (p. ej. "¿cuál es el matchup de Lucian contra Draven?" cuando `matchups.ts` sigue vacío) | Tarjeta de "sin cobertura": *"Tidusss todavía no ha publicado un análisis sobre esto."* +, si aplica, un enlace a la sección más cercana que sí existe (p. ej. "Sí tiene un veredicto general sobre matchups fáciles/difíciles en la guía de Lucian: ver guía completa") | Nunca se rellena con una respuesta genérica de LoL. Nunca se dice "no lo sé" a secas sin ofrecer el contenido relacionado más cercano que sí exista |
| Pregunta fuera de alcance (no es de LoL/ADC/Tidusss) | Tarjeta fija de "esto no es lo mío", con un tono breve y con personalidad de marca, y una redirección a los chips de sugerencia | Nunca se intenta responder "por si acaso". Nunca se le explica al usuario por qué el sistema decidió que está fuera de alcance (eso es un detalle interno, no una conversación) |
| Campeón preseleccionado (llegada contextual, 6.1) sin ningún contenido real todavía (p. ej. un campeón en estado `draft`) | Se comunica de entrada, antes incluso de que el usuario escriba nada: *"Tidusss todavía no ha analizado a fondo a este campeón — puedes preguntar igualmente, pero es probable que la respuesta sea 'todavía no hay análisis'."* | No se deja que el usuario descubra la falta de cobertura solo después de escribir y esperar |

---

## 8. Estados de carga

El ciclo completo (puerta de alcance → recuperación → generación → validación de citas) tarda varios segundos reales, no lo instantáneo a lo que el resto del sitio (estático) tiene acostumbrado al usuario. Esto se diseña como una secuencia con **pasos visibles**, no como un spinner genérico — coherente con cómo el resto del sitio ya trata la espera de datos reales (el shimmer de `RiotSkeleton`, nunca un spinner desnudo):

1. Nada más enviar la pregunta, la tarjeta de respuesta aparece inmediatamente en su forma final (mismo layout que una respuesta real) pero con los bloques de texto en estado shimmer — así el usuario ve de entrada la forma que va a tomar el resultado, sin sorpresas de layout al llegar la respuesta real.
2. Una única línea de estado, discreta, va cambiando por fases con lenguaje editorial, no técnico: *"Buscando en el criterio de Tidusss..."* → *"Comprobando las fuentes..."* — nunca "Generando respuesta con IA..." ni jerga de producto de IA.
3. Si la puerta de alcance ya determinó en un primer paso rapidísimo que la pregunta está fuera de alcance, se salta directamente al estado de "esto no es lo mío" (§7) sin pasar por el resto de la secuencia de carga — no tiene sentido simular una búsqueda que nunca se va a hacer.

---

## 9. Estados de error

| Error | Copy | Tratamiento |
|---|---|---|
| Fallo de la API de generación (Claude no responde / timeout) | *"No hemos podido procesar tu pregunta ahora mismo. El resto de la web sigue funcionando con normalidad."* | Mismo patrón exacto que `RiotUnavailable` ya usa hoy — reutilizar el componente, no inventar uno nuevo |
| Fallo de recuperación (Vectorize no responde) | Mismo copy que el anterior — el usuario no necesita saber en qué capa técnica falló algo | — |
| Límite de uso alcanzado (rate limit) | *"Se han hecho muchas preguntas en poco tiempo. Vuelve a intentarlo en unos minutos."* | Copy neutro, sin culpar al usuario ni sonar punitivo |
| El modelo cita una fuente que no estaba entre los fragmentos recuperados (fallo de validación de citas, §13) | El usuario nunca ve este caso — se reintenta una vez de forma transparente; si el reintento también falla la validación, se degrada al estado de error genérico de arriba, nunca se muestra una respuesta sin validar | Este es un error interno de control de calidad, no un error de infraestructura — se trata de forma distinta en logs/monitorización, pero igual de cara al usuario |
| JavaScript deshabilitado / entorno sin soporte | El input sigue existiendo como un formulario normal que envía y recarga la página con la respuesta ya renderizada en el HTML de vuelta (mejora progresiva, coherente con que el resto del sitio no depende de un framework de UI en cliente) | — |

---

## 10. Sistema de confianza

Se define en dos capas, combinadas en un único badge visible siempre:

**Capa 1 — Confianza editorial (heredada, no inventada).** Cada `EditorialTake` en el dominio ya tiene un campo `confidence: 'alta' | 'media' | 'baja'`, decidido por Tidusss al escribir el contenido (por ejemplo, la ruta de build "sólida" tiene confianza alta; la ruta "personal" de Navori tiene confianza media, según ya está codificado en `builds.ts`). Cuando una respuesta cita una única fuente, hereda directamente su confianza.

**Capa 2 — Confianza de cobertura (calculada, no editorial).** Cuando una respuesta combina varias fuentes, o cuando la mejor fuente recuperada tiene una similitud de búsqueda solo moderada con la pregunta (la pregunta "casi" encaja pero no perfectamente), la confianza mostrada se ajusta a la baja respecto a la confianza editorial individual de las fuentes — nunca al alza. Es decir: la confianza final mostrada es **el mínimo** entre la confianza editorial de las fuentes usadas y la confianza de cobertura calculada, nunca el máximo. Esto es deliberado: en caso de duda, el sistema subestima su propia certeza en vez de sobreestimarla.

Presentación visual: se reutiliza el componente `ConfidenceIndicator` ya existente (tres puntos + etiqueta de texto explícita — nunca solo color, coherente con la auditoría de accesibilidad ya aplicada al resto del sitio), con una cuarta posición nueva y visualmente distinta para "sin cobertura" (que no es un nivel de confianza bajo — es la ausencia total de una respuesta, y debe leerse como algo cualitativamente distinto, no como "un poco menos seguro").

---

## 11. Sistema de fuentes

Cada fuente citada se muestra como una tarjeta pequeña y homogénea (no un simple enlace de texto azul subrayado — coherente con que en el resto del sitio toda referencia a contenido real es una tarjeta con identidad, nunca un link suelto). Cada tarjeta de fuente muestra:

- **Tipo de fuente**, con la misma etiqueta y color que ya usa el badge de estado editorial en el resto del sitio (Build / Runas / Matchup / Sinergia / Concepto / Tier List / Perfil / Historial editorial).
- **Título** de la entidad exacta (p. ej. "Ruta más sólida — Lucian ADC (parche 26.14)", no solo "Build").
- **Parche o fecha**, si la entidad lo tiene (`PatchBadge`, reutilizado tal cual).
- **Enlace directo** a la sección exacta de la página real donde vive ese contenido — no a la página en general, al fragmento concreto (usando el ancla ya definida en `KnowledgeChunk.url`, §4.2).

Si una respuesta cita más de tres fuentes, solo se muestran las tres más relevantes por defecto, con un "ver todas las fuentes (N)" expandible — igual que `<details>`/"Ver razonamiento" ya se usa en `EditorialTakeCard` para no sobrecargar la tarjeta con todo el detalle de golpe.

---

## 12. Integración con el resto de la web

| Superficie | Tipo de integración | Detalle |
|---|---|---|
| Navegación principal | Enlace nuevo | "Pregunta" (o el nombre final que se decida, ver §17) junto a Inicio / Sobre mí / Contenido / Trayectoria / Contacto / Directo |
| `/campeones/[slug]` (guía de campeón) | Bloque de invitación contextual | Al final de la guía, antes del pie — enlaza con el campeón preseleccionado (6.1) |
| `/campeones` (Centro de Campeones) | Ninguna integración directa | Es un índice de navegación, no un lugar de duda puntual — forzar el asistente aquí diluiría su propósito |
| `/tier-list` | Ninguna integración directa en v1, revisar en v2 | Podría tener sentido más adelante ("¿por qué está Lucian en S?" enlazando directamente al veredicto de esa entrada), pero se pospone para no dispersar el foco de la v1 en un solo campeón real con contenido |
| `/live` | Ninguna integración | Es la superficie de datos en tiempo real — mezclar aquí el asistente de conocimiento editorial confundiría las dos naturalezas de dato (ver principio §1 y exclusión en §4.1) |
| Home | Ninguna integración en el Hero/plegado principal; posible mención breve en el footer junto al resto de enlaces de navegación | Home es una portada de marca — no es el lugar para introducir un producto que requiere su propia explicación |
| Content Graph | Consumidor de lectura, nunca escritor | El asistente **lee** relaciones ya existentes (vídeos/partidas/conceptos vinculados a una entidad) para rellenar "relacionados" — nunca crea relaciones nuevas en el grafo. Las preguntas de los usuarios no se convierten en entidades del grafo |
| SEO | La página `/pregunta` en sí (hero + chips + explicación de cobertura) es indexable y estática | Las respuestas generadas dinámicamente **no** se pre-renderizan como páginas indexables en v1 — evita contenido de calidad variable indexado por buscadores. Se revisa en v2 si tiene sentido publicar estáticamente las 10-20 preguntas más frecuentes con respuesta ya validada a mano, como un "Preguntas frecuentes" real (ver §16) |

---

## 13. Guardrails anti-alucinación (control del LLM)

Esta sección es el corazón técnico de "no será un LLM sin control". Cinco capas independientes, no una sola:

1. **Puerta de alcance previa a cualquier generación (§2.1).** Si la similitud de la pregunta contra todo el corpus indexado está por debajo de un umbral, ni siquiera se llama al modelo de generación — se devuelve directamente el estado "fuera de alcance". Esto no es solo una protección de coste: es la garantía más fuerte, porque un modelo que nunca se invoca no puede alucinar.
2. **Contexto cerrado, sin conocimiento previo permitido.** El prompt de sistema instruye explícitamente al modelo a responder únicamente con los fragmentos recuperados que se le adjuntan, y a declarar explícitamente cuando la información no está en ellos — nunca a rellenar con lo que "sabe" de LoL en general.
3. **Salida estructurada obligatoria, no texto libre.** El modelo se fuerza (vía tool-use / structured output) a devolver el contrato de §5 completo, incluyendo la lista de IDs de fragmento que ha usado como fuente — no puede "olvidarse" de citar, porque citar es un campo obligatorio de la estructura de salida, no una petición dentro del texto.
4. **Validación de citas posterior, en servidor, sin confiar en el modelo.** Antes de devolver la respuesta al navegador, se comprueba mecánicamente que cada ID de fuente que el modelo dice haber usado estaba **de verdad** entre los fragmentos recuperados en el paso 2.1. Si el modelo cita algo que no estaba ahí, la respuesta se descarta (un reintento; si vuelve a fallar, error genérico — §9), nunca se muestra tal cual.
5. **Nivel de confianza que nunca sube, solo baja (§10).** Aunque el modelo generase un texto muy seguro de sí mismo, el badge de confianza mostrado está acotado por la confianza editorial real de las fuentes — el texto generado no puede "inflar" la confianza percibida.

---

## 14. Métricas de éxito

Antes de construir, definir qué significa que esto funcione — para no descubrirlo a posteriori:

- **Tasa de "sin cobertura" sobre el total de preguntas dentro de alcance.** Alta al principio (solo Lucian tiene contenido real) es **esperable y correcto**, no un fallo — pero es la métrica que justifica priorizar qué campeón/tema documentar a continuación (retroalimenta directamente el backlog editorial de `league-laboratory`, igual que ya se documentó como pendiente para matchups/rune tree completo).
- **Tasa de feedback positivo** ("¿esto ha respondido a tu duda?", 6.3) sobre las respuestas con `status: 'answered'`.
- **Tasa de preguntas fuera de alcance** — si es muy alta, indica que la puerta de entrada (chips, copy del hero) no está comunicando bien los límites del producto.
- **Nunca** una métrica de "número de preguntas respondidas" a secas sin cruzarla con confianza/cobertura — optimizar por volumen de respuestas incentivaría justo lo que el producto existe para evitar.

---

## 15. Riesgos y mitigaciones

| Riesgo | Mitigación de diseño ya incorporada arriba |
|---|---|
| El corpus real hoy es pequeño (esencialmente, solo Lucian) — el producto puede sentirse vacío al lanzar | Se declara la cobertura real por adelantado (§7) en vez de ocultarla; el propio producto se convierte en el mejor argumento para seguir documentando más campeones |
| Coste de API de LLM si el uso crece | Caché por pregunta normalizada (§3.2), rate limiting explícito, puerta de alcance que evita llamadas innecesarias |
| El modelo "se cuela" y responde con conocimiento general de LoL de todas formas | Cinco capas de guardrails independientes (§13), no solo un prompt bien escrito |
| Los usuarios lo tratan como un chatbot genérico y prueban a "romperlo" con preguntas absurdas | El propio tono de marca y el diseño de "no es un chat" (input de una sola línea, sin historial largo) desalienta ese uso desde la interacción, no solo desde el backend |
| Contenido `draft`/`placeholder` se filtra al índice por error y el asistente "cita" una opinión que Tidusss no ha dado de verdad | Exclusión explícita y verificable en el pipeline de indexado (§4.1) — es exactamente el mismo tipo de comprobación que ya existe como test automatizado en el dominio (`el contenido real de Lucian no aparece en la ficha de otro campeón`); se propone un test equivalente para el índice ("ningún fragmento indexado proviene de una entidad en estado placeholder/draft") |

---

## 16. Roadmap de construcción por fases

Solo tras aprobar este documento. Ninguna fase implica escribir código todavía.

- **Fase 0 (previa a construir):** experimento de embeddings (§3.2.1) sobre 20-30 preguntas reales; decidir el modelo. Esbozo del prompt de sistema y validación manual contra 10 preguntas conocidas (dentro y fuera de alcance) para calibrar el umbral de la puerta de alcance.
- **Fase 1 (v1 mínima defendible):** indexado del contenido real de Lucian únicamente (todo lo que ya existe: perfil, dos builds, runas, sinergias, tier list, historial editorial, quick tips). Página `/pregunta` con entrada directa y contextual desde la guía de Lucian. Sin caché todavía (volumen bajo no lo justifica aún). Guardrails completos desde el primer commit — no se pospone el control por ser "solo una v1".
- **Fase 2:** caché de respuestas, feedback de usuario (§6.3/§14), panel/reporte simple para que Tidusss vea qué preguntas quedan sin cobertura (esto se convierte en el input más valioso para decidir qué campeón documentar después).
- **Fase 3:** ampliación de cobertura a medida que se documenten más campeones (sin cambios de arquitectura — el sistema ya está diseñado para escalar exactamente igual que el catálogo de 173 campeones escaló sin rediseñar nada). Revisión de si publicar estáticamente las preguntas frecuentes más validadas (§12, SEO).

---

## 17. Decisiones pendientes antes de construir

Preguntas reales que este documento deja abiertas a propósito, para decidir contigo antes de tocar código:

1. **Nombre público del producto y de la entrada de navegación** — ¿"Pregunta a Tidusss" tal cual, o una etiqueta de nav más corta ("Pregunta", "Asistente")?
2. **Modelo de embeddings** (§3.2.1) — requiere el experimento con preguntas reales antes de fijarlo.
3. **Umbral exacto de la puerta de alcance** — cuánta similitud mínima se exige antes de considerar una pregunta "dentro de tema"; se calibra con preguntas reales, no a priori.
4. **Límite de preguntas de seguimiento visibles** (§6.2) — se propone 3, pero es una cifra de partida, no una certeza.
5. **¿Se permite feedback textual libre** ("cuéntanos qué esperabas") o solo sí/no (§6.3, §14)? Un campo libre añade valor de producto pero también superficie de moderación.
6. **Tono exacto de las respuestas** — ¿primera persona ("Yo, Tidusss, recomiendo...") o tercera persona editorial ("Tidusss recomienda...", como ya usa el resto del sitio)? Se recomienda tercera persona por coherencia con el resto de la web, pero es una decisión de marca que corresponde a Tidusss.
