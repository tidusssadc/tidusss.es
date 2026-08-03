# Motor de Respuesta — ensamblaje determinista, sin IA generativa

> **Naturaleza de este documento:** describe un experimento técnico (`src/domain/knowledge-answering/`), v1. Demuestra que, usando únicamente el [Índice de Conocimiento](knowledge-index.md) y el [recuperador local](knowledge-retrieval.md), se puede producir una respuesta estructurada, honesta y citable — **sin ningún LLM**. No implementa "Pregunta a Tidusss" como producto: no hay endpoint público, no hay `/pregunta`, no hay interfaz, no hay conversación.
> **Relación con los otros dominios:** el [Content Graph](content-graph.md) aporta relaciones reales para los enlaces "relacionados" (Fase 5). El [Índice de Conocimiento](knowledge-index.md) aporta los documentos. La [Recuperación](knowledge-retrieval.md) decide cuáles son relevantes para una pregunta. Este dominio, `knowledge-answering`, es el primero que **consume los tres a la vez** — es la capa de más alto nivel de las cuatro, y la única con licencia para importar de todas las demás.
> **Estado:** v1 construida y validada. Sin commit todavía.

---

## Índice

1. [Filosofía](#1-filosofía)
2. [Mejora léxica (Fase 1)](#2-mejora-léxica-fase-1)
3. [Arquitectura del motor de respuesta](#3-arquitectura-del-motor-de-respuesta)
4. [El contrato `AnswerResult`](#4-el-contrato-answerresult)
5. [Estados obligatorios](#5-estados-obligatorios)
6. [Reglas de ensamblaje (Fase 3)](#6-reglas-de-ensamblaje-fase-3)
7. [Fuentes (Fase 4)](#7-fuentes-fase-4)
8. [Relacionados (Fase 5)](#8-relacionados-fase-5)
9. [Conjunto de evaluación de respuestas y métricas (Fases 6-7)](#9-conjunto-de-evaluación-de-respuestas-y-métricas-fases-6-7)
10. [Un defecto real encontrado evaluando (y su corrección)](#10-un-defecto-real-encontrado-evaluando-y-su-corrección)
11. [Lo que esta v1 no hace](#11-lo-que-esta-v1-no-hace)

---

## 1. Filosofía

El motor de respuesta no redacta. Cada palabra que aparece en `answer` es el `content` verbatim de uno o más `KnowledgeDocument` reales, unidos por reglas explícitas — nunca una paráfrasis, nunca una síntesis nueva. Tres principios, heredados de `content-graph.md`/`knowledge-index.md`/`knowledge-retrieval.md`:

1. **Nunca se afirma algo que no esté en una fuente citada.** Verificado automáticamente: `findAnswersWithUnsupportedText` (`invariants.ts`) descompone `answer` en frases y comprueba que cada una existe, literalmente, en el `excerpt` de alguna fuente citada.
2. **Confianza editorial, confianza de recuperación y cobertura son tres cosas distintas.** `editorialConfidence` viene de `EditorialTake.confidence` (heredada, nunca inventada); `retrievalConfidence` viene de la puntuación de recuperación; `coverage` describe cuán completa es la respuesta. Los tres se exponen por separado — nunca se combinan en un único número.
3. **Reconocer una entidad no es tener contenido sobre ella.** Draven es un campeón real; no tener un matchup analizado sobre él no es lo mismo que "no entiendo la pregunta" (`quién ganó el Mundial`) — son dos estados distintos (§5).

---

## 2. Mejora léxica (Fase 1)

Antes de construir el motor de respuesta, se corrigieron dos límites reales que la evaluación de recuperación había detectado (`docs/knowledge-retrieval.md` §11): `src/domain/knowledge-retrieval/synonyms.ts` añade un paso de canonicalización a `tokenize()` — 10 grupos de sinónimos, cada uno justificado con la cita textual del corpus real o del caso de evaluación que lo motivó (nunca añadido "porque sí"):

| Grupo canónico | Variantes | Justificación real |
|---|---|---|
| `intercambio` | intercambios, tradear, trading, trade, trades | `concepts.ts`: "El intercambio de daño..." — fallo real de recall (0% → 100%) |
| `poder` | fuerte, pico, spike, spikes | `concepts.ts`: "una ventaja de poder desproporcionada" — fallo real de recall (0% → 100%) |
| `enfriamiento` | cd, cooldown | `builds.ts` ("reducción de enfriamiento") y `concepts.ts` ("cooldown") ya usan ambas formas |
| `basico` | basicos, autoataque, auto, aa | `champions.ts`: "ataques básicos" |
| `soporte` | support, supports, soportes | Pregunta real del conjunto de evaluación ("¿Con qué supports...?") |
| `late` | tardio, tardia | `champions.ts` ya usa "late" literalmente |
| `temprana` | early, temprano | `champions.ts`: "fases temprana y media" |
| `build` | objeto, objetos | Omnipresentes en el corpus con dos palabras para la misma idea |
| `runa` | runas | Título vs. contenido — mismo caso de número gramatical que "intercambio" |
| `sinergia` | sinergias | Título vs. ancla `#sinergias-heading` |

**Mejora real, medida (`npm run eval:retrieval`, mismo conjunto de 15 preguntas):**

| Métrica | Antes de Fase 1 | Después de Fase 1 |
|---|---|---|
| Recall (local) | 70% | **90%** |
| Precisión@1 (local) | 90% | 90% (sin cambios) |
| Recall (espacio vectorial) | 47% | **57%** |
| Precisión@1 (espacio vectorial) | 70% | **80%** |

El caso `intercambios-lucian` (antes recall 0%) y `cuando-fuerte` (antes recall 0%) pasan ambos a recall 100% en el proveedor local. Nota deliberada sobre "fuerte": tras esta mejora, canonicaliza a `poder` (agrupado con power spike), no a `fortaleza` — una pregunta temporal ("¿cuándo es fuerte?") ahora apunta al power spike real; las fortalezas del campeón se siguen encontrando por su propia palabra, que no participa en este grupo.

---

## 3. Arquitectura del motor de respuesta

```
src/domain/knowledge-answering/
├── types.ts        AnswerStatus, AnswerSource, RelatedLink, AnswerResult
├── assemble.ts       assembleAnswer(RetrievalResult): AnswerResult — el núcleo puro
├── invariants.ts     validadores puros — mismo patrón que los otros tres dominios
└── evaluation/
    ├── types.ts        AnswerEvaluationCase / AnswerCaseEvaluation / AnswerEvaluationSummary
    ├── cases.ts         el conjunto de evaluación de respuestas real — Fase 6
    └── run.ts           runner de métricas del motor de respuesta — Fase 7

scripts/knowledge-answering/evaluate.ts   comando reproducible (`npm run eval:answering`)
```

`assembleAnswer` recibe un `RetrievalResult` de **cualquier** `RetrievalProvider` (local, espacio vectorial, o un futuro proveedor de embeddings reales) — no sabe ni le importa cuál generó el resultado. Esto es la razón de ser de la interfaz desacoplada de `docs/knowledge-retrieval.md`: el motor de respuesta ya se prueba, hoy, contra dos proveedores distintos (§10).

---

## 4. El contrato `AnswerResult`

```ts
interface AnswerResult {
  query: string;
  status: AnswerStatus;                        // §5
  answer?: string;                               // solo si sufficient/partial
  editorialConfidence?: EditorialConfidence;      // heredada, nunca inventada
  retrievalConfidence: number;                    // de RetrievalResult, nunca mezclada con la anterior
  coverage: RetrievalCoverage;
  sources: readonly AnswerSource[];               // §7
  editorialDate?: string;
  patchId?: string;
  relatedLinks: readonly RelatedLink[];           // §8
  insufficientInformation: boolean;
  rejectionReasons: readonly string[];
}
```

Cada campo responde a uno de los que pide el encargo explícitamente: pregunta, estado, respuesta, confianza editorial, confianza de recuperación, cobertura, fuentes, fecha editorial, parche, enlaces relacionados, información insuficiente, motivos de rechazo.

---

## 5. Estados obligatorios

| Estado | Cuándo | `answer`/`sources` |
|---|---|---|
| `sufficient` | `RetrievalResult.coverage === 'full'` | presentes |
| `partial` | `coverage === 'partial'` | presentes |
| `insufficient-information` | sin cobertura, pero se reconoce un campeón o parche real (`filtersApplied`) | ausentes |
| `out-of-scope` | sin cobertura y sin ningún filtro reconocido | ausentes |
| `empty-question` | `query.trim() === ''` — se comprueba antes que nada | ausentes |
| `internal-error` | el ensamblador lanza una excepción inesperada (`try`/`catch` alrededor de todo `assembleAnswer`) | ausentes |

`insufficient-information` y `out-of-scope` son deliberadamente estados distintos: Draven es un campeón real (se reconoce, `filtersApplied.championId` existe) sin matchup analizado — "entiendo la pregunta, no tengo contenido". "¿Quién ganó el Mundial?" no reconoce nada del corpus — "esto no es lo mío". El `rejectionReason` de cada uno lo dice explícitamente, con el nombre real de la entidad reconocida cuando aplica.

---

## 6. Reglas de ensamblaje (Fase 3)

`selectAnswerDocuments` (`assemble.ts`) decide qué se funde en el texto y qué se cita:

1. **Compañero de razonamiento.** Si el documento principal es un `build-item`/`rune-choice`, se busca su propio `build-editorial-take`/`rune-editorial-take` (misma `sourceEntityId` — pertenecen al mismo `Build`/`RunePage` real) y se funden ambos.
2. **Empate, no relleno.** Si no hay compañero, se funde el documento principal más todo lo que empate **exactamente** con su puntuación (hasta 3) — nunca se rellena con un documento de menor relevancia solo para alcanzar un número. Una pregunta con una única respuesta clara (sin empate) produce un texto de una sola fuente, no tres diluidas.
3. **Nunca se mezclan parches distintos.** Un documento con `patchId` propio distinto al del documento principal se excluye por completo — ni del texto, ni de las fuentes citadas. Un documento sin `patchId` (identidad, conceptos) nunca entra en conflicto.
4. **Confianza editorial = mínimo entre lo fundido en el texto**, ignorando documentos sin `confidence` propia (p. ej. un `Concept`) — nunca al alza.
5. **Toda fuente fundida en el texto SIEMPRE se cita** (ver §10 — esto no era cierto en la primera versión).

---

## 7. Fuentes (Fase 4)

Cada `AnswerSource` incluye título, URL con ancla real, tipo de documento, parche si existe, fecha editorial si existe, y el fragmento/evidencia exacto (`excerpt`, el `content` verbatim). Invariantes verificados (`test/knowledge-answering/`):

- Ninguna fuente aparece si no fue recuperada — `sources` se construye exclusivamente a partir de `RetrievalResult.documents`.
- Sin duplicados (`findAnswersWithDuplicateSources`).
- Máximo 5 fuentes por respuesta (`SOURCES_LIMIT`).

---

## 8. Relacionados (Fase 5)

`collectRelatedLinks` resuelve enlaces reales de dos formas, ambas contra el Content Graph real:

1. `getContentConnections(sourceEntityId)` — las relaciones "sigue explorando" ya curadas del grafo para la entidad de cada fuente citada.
2. `getContentEntity(id)` para cada `relatedEntityId` que el propio `KnowledgeDocument` ya declara (un socio de sinergia, un concepto).

Ambos pasos usan `getContentEntity`/`getContentConnections` reales (`domain/content-graph`) — si un id no resuelve a una entidad real, navegable y disponible, simplemente no aparece (nunca se inventa un enlace). Esto cubre, sin código adicional, la lista completa que pedía el encargo: guía del campeón, build, runas, sinergias, conceptos, historial editorial, Tier List — todos ya modelados como entidades y relaciones reales del Content Graph.

---

## 9. Conjunto de evaluación de respuestas y métricas (Fases 6-7)

`evaluation/cases.ts` cubre las 14 preguntas del encargo (incluidas Draven, Jinx, el Mundial, vacía y ambigua) con: estado esperado, fuentes mínimas, documentos prohibidos, cobertura y (cuando es predecible con los datos reales de hoy) confianza editorial esperada.

Comando reproducible:

```bash
npm run eval:answering
```

**Resultado real, última ejecución:** 100% de estados correctos (14/14), 100% de citas válidas, 0 documentos prohibidos usados, 0 mezclas de parche, 0 afirmaciones sin fuente.

---

## 10. Un defecto real encontrado evaluando (y su corrección)

Probar el motor de respuesta con el experimento de espacio vectorial (además del proveedor local) reveló un defecto real: el compañero de razonamiento (`build-editorial-take`) se fundía en el texto de la respuesta (regla 1, §6) pero `citedDocs` se calculaba de forma independiente (los primeros 5 documentos por puntuación) — si el proveedor de turno rankeaba al compañero por debajo de la posición 5, la respuesta citaba una frase que **no aparecía en ninguna fuente listada**. Detectado automáticamente por `findAnswersWithUnsupportedText` al ejecutar el conjunto de evaluación de recuperación completo contra el proveedor de espacio vectorial, no contra el local (donde nunca se manifestaba, por eso no se detectó antes).

**Corrección:** `citedDocs` se construye ahora como `textMergeDocs` (siempre incluido primero) más documentos adicionales hasta el límite — nunca al revés. Test de regresión añadido (`test/knowledge-answering/assemble.test.ts`, "un compañero de razonamiento fundido en el texto SIEMPRE aparece entre las fuentes"). Este es exactamente el tipo de defecto que la interfaz desacoplada de proveedores (`docs/knowledge-retrieval.md`) está diseñada para exponer: un motor probado contra un solo proveedor no lo habría encontrado.

---

## 11. Lo que esta v1 no hace

Explícitamente fuera de alcance, por instrucción directa del encargo:

- Ningún LLM (Claude, OpenAI u otro) — el texto de la respuesta es concatenación verbatim, nunca generación.
- Ningún embedding real, Vectorize, D1.
- Ningún endpoint público, ninguna ruta `/pregunta`, ninguna interfaz.
- Ninguna conversación, streaming, historial de usuario, autenticación ni analítica.

> **Actualización (2026-08-03):** existe ya una capa OPCIONAL de reformulación con Claude — `src/domain/knowledge-generation/` y [`docs/knowledge-generation.md`](knowledge-generation.md). Consume `AnswerResult` sin modificarlo: Claude solo puede cambiar la redacción de `answer`, nunca el estado, la cobertura, la confianza, el parche ni las fuentes — esos campos ni siquiera existen en lo que Claude puede devolver. Sin configuración (o si algo falla), se usa automáticamente el generador determinista que ya describe este documento.
>
> **Actualización (2026-08-03):** `AnswerResult` tiene ahora un consumidor público real: `POST /api/pregunta` (`functions/api/pregunta.ts`), detrás de la ruta pública `/pregunta`. El endpoint nunca envía `AnswerResult` directamente al cliente — lo traduce mediante un DTO nuevo, `domain/knowledge-answering/public.ts` (`toPublicAnswer` → `PublicAnswer`), que omite los campos internos (ids de documento, `sourceEntityId`, motivos de rechazo) y banda la confianza de recuperación (`'high'|'medium'|'low'`) en vez de exponer la puntuación cruda. Ver ADR-018 en [`PLATFORM_BIBLE.md`](PLATFORM_BIBLE.md) y [`docs/pregunta-a-tidusss.md`](pregunta-a-tidusss.md).
