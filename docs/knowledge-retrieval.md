# Recuperación de Conocimiento — experimento técnico de evaluación

> **Naturaleza de este documento:** describe un experimento técnico aislado (`src/domain/knowledge-retrieval/`), v1. Comprueba si los `KnowledgeDocument` del [Índice de Conocimiento](knowledge-index.md) pueden recuperarse correctamente a partir de preguntas reales de usuarios. **No implementa "Pregunta a Tidusss"**: no genera respuestas, no expone ningún endpoint ni ruta pública, no usa modelos de lenguaje. Es la capa que se necesita auditar y medir ANTES de construir el motor de respuesta descrito en [`pregunta-a-tidusss.md`](pregunta-a-tidusss.md) §3-§4.
> **Relación con los otros dos dominios:** el [Content Graph](content-graph.md) describe relaciones entre entidades. El [Índice de Conocimiento](knowledge-index.md) describe documentos editoriales recuperables. Este dominio, `knowledge-retrieval`, describe **cómo se recupera** un documento dada una pregunta. A diferencia de la separación Content Graph / Índice de Conocimiento (que no se importan entre sí), aquí SÍ hay una dependencia real y deliberada: la recuperación no existe sin documentos que recuperar. Lo que este dominio nunca hace es reinterpretar o mutar un `KnowledgeDocument` — solo lee, puntúa y filtra.
> **Estado:** v1 construida y validada. Sin commit todavía.

---

## Índice

1. [Filosofía y alcance](#1-filosofía-y-alcance)
2. [Arquitectura de módulos](#2-arquitectura-de-módulos)
3. [Fase 1 — El conjunto de evaluación](#3-fase-1--el-conjunto-de-evaluación)
4. [Fase 2 — Recuperación local por términos (línea base)](#4-fase-2--recuperación-local-por-términos-línea-base)
5. [Fase 3 — El contrato `RetrievalResult`](#5-fase-3--el-contrato-retrievalresult)
6. [Fase 4 — Métricas y comando reproducible](#6-fase-4--métricas-y-comando-reproducible)
7. [Fase 5 — El experimento de espacio vectorial (y por qué no son embeddings reales)](#7-fase-5--el-experimento-de-espacio-vectorial-y-por-qué-no-son-embeddings-reales)
8. [Qué haría falta para un proveedor de embeddings real](#8-qué-haría-falta-para-un-proveedor-de-embeddings-real)
9. [Fase 6 — Guardrails](#9-fase-6--guardrails)
10. [Resultados reales de la evaluación](#10-resultados-reales-de-la-evaluación)
11. [Límites conocidos, encontrados evaluando (no ocultados)](#11-límites-conocidos-encontrados-evaluando-no-ocultados)
12. [Lo que esta v1 no hace](#12-lo-que-esta-v1-no-hace)

---

## 1. Filosofía y alcance

Antes de construir un motor de respuesta con IA, hace falta saber si el paso previo —encontrar los documentos correctos dada una pregunta real— funciona. Este experimento aísla exactamente esa pregunta, sin contaminarla con generación de lenguaje: cada proveedor de recuperación (`RetrievalProvider`) recibe texto y devuelve documentos reales del Índice de Conocimiento, nunca texto generado.

Tres principios, heredados de `content-graph.md` y `knowledge-index.md`, que este dominio no relaja:

1. **Nunca se inventa un documento.** Un resultado de recuperación es siempre un `KnowledgeDocument` real, idéntico al que ya existe en `knowledgeDocuments` — nunca una copia modificada, resumida o reescrita.
2. **La puntuación de recuperación y la confianza editorial son conceptos distintos que nunca se mezclan.** `RetrievedDocument.score` mide cuánto se parece la pregunta al documento. `KnowledgeDocument.confidence` mide cuánto confía Tidusss en su propio criterio. Un documento con `confidence: 'high'` puede tener `score` bajo si la pregunta no se parece a su contenido, y viceversa — ver los tests dedicados en `test/knowledge-retrieval/local-provider.test.ts`.
3. **Reconocer una entidad no es lo mismo que tener contenido real sobre ella.** Draven y Jinx son campeones reales del catálogo (~170), reconocibles por nombre — pero el Laboratorio no tiene contenido editorial real sobre ellos. El sistema debe distinguir "no te entiendo" de "te entiendo, pero no tengo nada que decir" (ver §9).

---

## 2. Arquitectura de módulos

```
src/domain/knowledge-retrieval/
├── types.ts                  contrato RetrievalQuery/RetrievalResult/RetrievalProvider — Fase 3
├── normalize.ts               normalización + tokenización determinista, sin dependencias
├── corpus-index.ts            reconocimiento de campeones/parches reales mencionados en el texto
├── filters.ts                 resolución y aplicación de filtros — compartida por TODOS los proveedores
├── local-provider.ts          recuperación local por términos — Fase 2 (línea base real)
├── vector-space-provider.ts   experimento TF-IDF + coseno — Fase 5
└── evaluation/
    ├── types.ts                EvaluationCase / CaseEvaluation / EvaluationSummary
    ├── cases.ts                 el conjunto de evaluación real — Fase 1
    └── run.ts                   runner de métricas, puro — Fase 4

scripts/knowledge-retrieval/evaluate.ts   comando reproducible (`npm run eval:retrieval`)
```

`filters.ts` es deliberadamente compartido: el guardrail "nunca mezclar campeones" (§9) debe comportarse exactamente igual sea cual sea el motor de puntuación por debajo — el local por términos, el experimento de espacio vectorial, o un futuro proveedor de embeddings reales. Ningún proveedor decide sus propios filtros de forma independiente.

---

## 3. Fase 1 — El conjunto de evaluación

`evaluation/cases.ts` define 15 preguntas reales, cada una con:

- `expectedDocumentIds` — la respuesta ideal (usada para `recall`).
- `acceptableDocumentIds` — no es el ideal, pero tampoco sería un error (cuenta en `precisionAt1`/`precisionAt3`).
- `forbiddenDocumentIds` — documentos que nunca deberían aparecer.
- `expectedCoverage` / `expectInsufficientInformation` — el resultado esperado del contrato de Fase 3.
- `isOutOfScope` — marca las preguntas deliberadamente fuera del corpus, para una métrica aparte.
- `note` — por qué se espera ese resultado, escrito ANTES de ejecutar nada contra ningún proveedor.

Cubre exactamente la lista pedida: Navori, Filo Infinito vs. Navori, combos rápidos, cuándo es fuerte Lucian, la runa de Tidusss, supports, sufrir en late, intercambios, errores de los jugadores, qué cambió en el parche 26.14, el matchup inexistente contra Draven, la build inexistente de Jinx, quién ganó el Mundial, una pregunta vacía y una pregunta ambigua. Ningún caso contiene una respuesta generada — solo qué documentos serían la recuperación correcta.

---

## 4. Fase 2 — Recuperación local por términos (línea base)

`local-provider.ts` implementa recuperación determinista, sin modelos externos ni dependencias nuevas:

1. **Normalización** (`normalize.ts`): minúsculas, sin diacríticos, sin puntuación, con una lista corta de palabras vacías en español (más una específica de este corpus: "Tidusss", la firma editorial que aparece en casi todo el contenido y no discrimina nada — ver §11).
2. **Búsqueda por términos** + **coincidencia de título** (peso 3) y de contenido (peso 1).
3. **Etiquetas/tipo**: un diccionario corto de palabra clave → `KnowledgeDocumentType[]` (p. ej. "runa"/"runas" → tipos de runas, "sinergia"/"support" → sinergias).
4. **Campeón**: si la pregunta nombra a un campeón real (reconocido contra el catálogo completo, no solo los curados), se aplica como filtro obligatorio — nunca se mezcla contenido de otro campeón — y como una bonificación de puntuación separada.
5. **Parche**: igual que campeón, pero con las etiquetas reales de `leagueLaboratoryPatches` ("26.14", "15.14").
6. **Entidades relacionadas**: si la pregunta nombra explícitamente a una entidad relacionada distinta del campeón principal (un socio de sinergia, un concepto), se bonifica — nunca al revés (nunca porque el documento ya traiga dos nombres en su título sin que la pregunta mencione el segundo).
7. **Ponderación básica de campos**: la puntuación final es la suma ponderada de las señales anteriores, normalizada por el máximo posible para esa pregunta concreta.

**Guardrail de diseño, encontrado evaluando la Fase 1 contra el corpus real (§11):** reconocer el nombre de un campeón (o un parche) en la pregunta nunca es, por sí solo, señal suficiente de que un documento responde a la pregunta. Se exige al menos una coincidencia real de título, contenido o tipo/etiqueta antes de contar la bonificación de campeón/parche — de lo contrario, cualquier pregunta que solo mencionara a Lucian (aunque no tuviera ninguna relación real con el resto del contenido) habría reclamado cobertura parcial solo por reconocer su nombre.

Esta es la línea base real contra la que se compara el experimento de Fase 5 — no una implementación de relleno.

---

## 5. Fase 3 — El contrato `RetrievalResult`

```ts
interface RetrievalResult {
  query: string;
  documents: readonly RetrievedDocument[];   // { document: KnowledgeDocument; score: number; reasons: MatchReason[] }
  coverage: 'full' | 'partial' | 'none';
  retrievalConfidence: number;                // SIEMPRE de recuperación, nunca editorial
  insufficientInformation: boolean;
  filtersApplied: { championId?; patchId?; type? };
}
```

`score` y `retrievalConfidence` describen exclusivamente qué tan bien se recuperó algo — nunca cuánto confía Tidusss en su propio criterio (eso es `KnowledgeDocument.confidence`, un campo completamente distinto que el recuperador nunca lee para puntuar). Cualquier proveedor —local, espacio vectorial, o un futuro proveedor de embeddings reales— implementa exactamente esta interfaz (`RetrievalProvider`), lo que permite que el runner de evaluación (§6) sea agnóstico a cuál se está midiendo.

---

## 6. Fase 4 — Métricas y comando reproducible

`evaluation/run.ts` calcula, por proveedor:

- **Precisión@1 / Precisión@3**: de los documentos devueltos en las primeras 1 o 3 posiciones, ¿cuántos pertenecen a `expectedDocumentIds ∪ acceptableDocumentIds`? `null` (excluido de la media) para preguntas de rechazo puro, donde no hay nada positivo que medir.
- **Recall**: de `expectedDocumentIds`, ¿cuántos aparecen entre los primeros `EVAL_RETRIEVAL_LIMIT` (10) resultados?
- **Rechazos correctos**: de las preguntas que deberían declarar información insuficiente, ¿cuántas lo hacen?
- **Fuera de alcance detectado**: el mismo recuento, restringido a las preguntas marcadas `isOutOfScope`.
- **Documentos prohibidos recuperados**: cuenta total — debe ser siempre 0.

Comando reproducible:

```bash
npm run eval:retrieval
```

Ejecuta el conjunto de evaluación completo contra ambos proveedores sobre el índice de conocimiento real, e imprime una comparación legible. No escribe a disco, no requiere red ni credenciales.

---

## 7. Fase 5 — El experimento de espacio vectorial (y por qué no son embeddings reales)

`vector-space-provider.ts` implementa **TF-IDF + similitud del coseno** — la técnica clásica de espacio vectorial disperso, calculada enteramente en local, sin red, sin credenciales, sin dependencias nuevas. Es honesto llamarla por su nombre real: **no es un embedding neuronal**. No captura sinónimos ni parafraseo semántico — "sufre en late" no se relaciona automáticamente con "pierde impacto si la partida se alarga" a menos que compartan literalmente algún término (ver §11, el caso de "intercambios"/"trading" falla en ambos proveedores por el mismo motivo).

Es, en cambio, exactamente lo que pedía la Fase 5 del encargo: el experimento local que **se puede ejecutar hoy**, sin cuenta, clave, coste ni binding de Cloudflare, y que sirve para una comparación real contra la línea base sobre el mismo conjunto de evaluación (§10).

---

## 8. Qué haría falta para un proveedor de embeddings real

Documentado, deliberadamente **sin activar**:

| Opción | Qué requiere | Coste/cuenta | Estado |
|---|---|---|---|
| Cloudflare Workers AI (`@cf/baai/bge-*`) | Binding `AI` en `wrangler.toml`, disponible solo en Cloudflare Workers/Pages Functions (nunca en `astro dev` local) | Incluido en el plan de Cloudflare, con límites de uso | No activado |
| Cloudflare Vectorize | Un índice de Vectorize creado y su binding correspondiente, más el paso anterior para generar los vectores | Cuenta de Cloudflare con Vectorize habilitado | No activado |
| API de embeddings externa (p. ej. OpenAI) | Una clave de API gestionada como secreto de Cloudflare Pages, llamadas de red en build time o en un Worker | De pago por token | No activado |

Cualquiera de las tres, el día que se autorice, se conecta implementando `RetrievalProvider` (§5 de Fase 3) — el conjunto de evaluación (`evaluation/cases.ts`) y el runner (`evaluation/run.ts`) no cambian ni una línea: se ejecutan igual contra el proveedor nuevo. Esa es la razón de ser de la interfaz desacoplada.

---

## 9. Fase 6 — Guardrails

Verificados con tests reales (`test/knowledge-retrieval/`):

- **Excluye drafts y placeholders**: heredado de `knowledge-index` (Kai'Sa, Jinx, Ezreal sin perfil, y las 3 entradas placeholder de la Tier List, nunca generan documentos que recuperar).
- **Nunca mezcla campeones**: si la pregunta nombra a un campeón, el filtro se aplica antes de puntuar — probado contra un corpus sintético de dos campeones, porque el corpus real de hoy solo tiene contenido curado de uno.
- **Respeta el parche**: si la pregunta nombra un parche, ningún documento con `patchId` de otro parche se recupera (los documentos sin `patchId` propio — identidad, conceptos — no se excluyen: no pertenecen a ningún parche).
- **Rechaza preguntas sin cobertura**: `insufficientInformation: true` cuando ningún documento supera el umbral mínimo de puntuación.
- **No usa datos en vivo**: el dominio solo lee `knowledgeDocuments`, que a su vez solo indexa contenido editorial — nunca datos de Riot/Twitch/YouTube en tiempo real.
- **Nunca inventa un documento**: cada resultado es idéntico (`deepEqual`) al documento real correspondiente en `knowledgeDocuments`.
- **Conserva URLs y anclas citables**: la URL devuelta es exactamente la del documento real, nunca reescrita.
- **No transforma una coincidencia débil en confianza alta**: reconocer solo el nombre de un campeón, sin ninguna otra señal de contenido, nunca basta para declarar cobertura (ver §4 y §11).

---

## 10. Resultados reales de la evaluación

Última ejecución de `npm run eval:retrieval` sobre el índice real (60 documentos, 15 preguntas):

| Métrica | Local (línea base) | Espacio vectorial (TF-IDF) |
|---|---|---|
| Precisión@1 | 90% | 70% |
| Precisión@3 | 73% | 62% |
| Recall | 70% | 47% |
| Rechazos correctos | 5/5 | 5/5 |
| Fuera de alcance detectado | 3/3 | 3/3 |
| Documentos prohibidos recuperados | 0 | 0 |

**La línea base local supera al experimento de espacio vectorial en este corpus.** No es el resultado "esperado" de un experimento de embeddings — y es exactamente lo que hace valioso medir en vez de asumir. La explicación real: el corpus de hoy (60 documentos, prácticamente todos sobre un único campeón) es demasiado pequeño y homogéneo para que las estadísticas de frecuencia de documento (IDF) aporten la señal que aportarían sobre un corpus grande y diverso — mientras que la línea base explota señales explícitas (campeón, parche, tipo) que el espacio vectorial no modela en absoluto. Ver §11 para el detalle caso por caso.

---

## 11. Límites conocidos, encontrados evaluando (no ocultados)

> **Actualización (2026-08-03):** los dos primeros límites de esta lista —lematización de "intercambio(s)" y la confusión "fuerte"/power spike— se corrigieron en una Fase 1 de mejora léxica (`synonyms.ts`), como preparación del [motor de respuesta](knowledge-answering.md). Recall pasó de 70% a 90% (proveedor local) y de 47% a 57% (espacio vectorial) sobre el mismo conjunto de 15 preguntas. Se dejan documentados tal cual (sin editar el relato original) porque son la evidencia real de por qué se aplicó esa mejora — ver `docs/knowledge-answering.md` §2 para la tabla completa de sinónimos y las cifras exactas de antes/después.

- **Sin lematización (corregido, ver nota arriba)**: "intercambios" (pregunta) nunca coincidía con "intercambio" (contenido real del concepto Trading, en singular) — ambos proveedores fallaban este caso (`intercambios-lucian` en la evaluación) por el mismo motivo exacto: coincidían por token exacto, no por raíz de palabra.
- **Jerga bilingüe ausente del corpus**: "burst" (inglés) no aparece nunca en el contenido editorial real de Tidusss (que usa "ventana de daño explosiva"/"daño explosivo"); "rotaciones" solo existe dentro del concepto Wave Management, que no está indexado por no tener relación real todavía. Ambas preguntas se rechazan correctamente como información insuficiente — un límite real de vocabulario, no un fallo silencioso, y todavía sin corregir (no había justificación de corpus suficiente para añadir un sinónimo de "burst").
- **Confusión léxica cuando dos conceptos comparten una palabra clave (corregido, ver nota arriba)**: "¿Cuándo empieza a ser fuerte Lucian?" activaba la palabra clave de tipo de `champion-strength` ("fuerte") en vez de `champion-power-spike`, aunque el power spike de nivel 2 sería la respuesta más precisa a una pregunta temporal.
- **El proveedor local necesitó dos correcciones tras evaluar contra el corpus real** (documentadas para que quien lea este archivo entienda por qué el diseño final no es el primero que se escribió):
  1. Contar el nombre del campeón mencionado dos veces (una como coincidencia de título/contenido trivial, otra como bonificación explícita de campeón) inflaba por igual a todos los documentos de ese campeón y ahogaba el término realmente distintivo de la pregunta.
  2. "Tidusss" (la firma editorial, presente en casi todo el contenido) se trata como palabra vacía específica de este corpus — de lo contrario generaba empates artificiales entre documentos sin relación real con la pregunta.
- **Umbral de cobertura calibrado sobre la escala del proveedor local**: el mismo umbral absoluto (0.55 para "cobertura completa") se reutiliza en el experimento de espacio vectorial por simplicidad, pero las similitudes de coseno de TF-IDF corren estructuralmente más bajas que la puntuación ponderada por campos de la línea base — esto hace que el espacio vectorial clasifique como "parcial" algunos casos que en la práctica son tan precisos como el "completo" de la línea base (p. ej. `runa-tidusss`, `sufre-en-late`). No es un defecto de recuperación: es un umbral compartido entre dos escalas distintas, un punto de calibración pendiente si se decide invertir más en el experimento de espacio vectorial.

---

## 12. Lo que esta v1 no hace

Explícitamente fuera de alcance, por instrucción directa del encargo:

- Ninguna respuesta generada por IA, ningún endpoint, ninguna interfaz, ninguna ruta `/pregunta`.
- Ninguna conversación, streaming, historial de usuario ni analítica.
- D1, Vectorize en producción, o cualquier escritura remota.
- Activar cualquiera de las opciones de embeddings reales documentadas en §8 — quedan documentadas y con el adaptador preparado (`RetrievalProvider`), no conectadas.

> **Actualización (2026-08-03):** el motor de respuesta determinista (sin IA generativa) ya existe — `src/domain/knowledge-answering/` y [`docs/knowledge-answering.md`](knowledge-answering.md). Consume este dominio a través de `RetrievalProvider` sin modificarlo; ninguna de las exclusiones de esta lista cambia — el motor de respuesta tampoco genera texto libre, tampoco expone un endpoint público.
