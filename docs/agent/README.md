# docs/agent/ — contexto persistente para agentes

Documentación pensada para que un agente (Claude Code) entienda tidusss.es **sin necesidad de
pegar contexto en cada conversación**. Corta, current-state, una fuente de verdad por tema.

## Orden de lectura

1. **`/CLAUDE.md`** (raíz) — router + reglas críticas. Siempre.
2. **`CURRENT_STATE.md`** — qué existe / está cerrado / en progreso / bloqueado. `Last verified commit` + `date` en la cabecera. **El documento más importante.**
3. **`RULES.md`** — reglas duras (datos, editorial, Riot, producto, git) y cuándo parar.
4. **`tasks/current.md`** (raíz `tasks/`) — la tarea concreta.

Bajo demanda, según la tarea:

| Doc | Para qué |
|---|---|
| `PRODUCT.md` | qué es / qué no es el producto, identidad de Tidusss, por qué Lucian ≠ OTP global |
| `ARCHITECTURE.md` | stack real, fronteras de capas, familia Riot + coste por endpoint, almacenamiento (D1 = en código / no aprovisionado) |
| `DESIGN.md` | lenguaje visual, patrones aprobados, qué evitar |
| `WORKFLOW.md` | flujo estándar, "Claude no es product owner", protocolo Night Shift, visión de automatización futura |

## Relación con el resto de `docs/`

Estos documentos **no duplican** la documentación técnica existente, la **enrutan**:

- `docs/PLATFORM_BIBLE.md` — visión de producto + arquitectura + ADR log **histórico y profundo**. Parcialmente desactualizado a partir de mediados de 2026 (ver su cabecera). Úsalo para "por qué" y detalle; usa `CURRENT_STATE.md` para "qué hay hoy".
- `docs/riot-api.md` — integración Riot en detalle.
- `docs/operations/rank-history.md` — runbook para aprovisionar D1 + activar el scheduler.
- `docs/content-graph.md`, `docs/league-laboratory.md`, `docs/pregunta-a-tidusss.md`, `docs/environment-engine.md`, `docs/home-state-engine.md`, `docs/knowledge-*.md` — sistemas concretos.
- `docs/night-shift/YYYY-MM-DD.md` — journal de cada sesión autónoma.

## Mantenimiento

- Si un cambio afecta al estado, actualiza `CURRENT_STATE.md` y su `Last verified commit`/`date` en el mismo PR.
- No metas aquí datos que cambian a diario (LP, subs, "última partida", nº exacto de tests).
- Los enlaces internos de estos docs y de `CLAUDE.md` los valida `test/docs/agent-docs.test.ts`.
