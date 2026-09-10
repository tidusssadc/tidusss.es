# WORKFLOW — cómo trabaja Claude Code en tidusss.es

---

## Flujo estándar

1. **Lee `CLAUDE.md`.**
2. **Lee `docs/agent/CURRENT_STATE.md`** — estado real, zonas cerradas, HEAD esperado, bloqueos.
3. **Lee `tasks/current.md`** — la tarea, su scope permitido/prohibido, criterios de aceptación, condiciones de parada.
4. **Audita el repo real:** `git branch --show-current`, `git status`, `git log -10 --oneline`, y el código relevante a la tarea. No confíes en informes anteriores como verdad absoluta.
5. **Cuestiona las premisas.** Si la tarea cae en cualquiera de los casos de "Cuándo parar" (`RULES.md` / abajo), **dilo ahora**, antes de escribir código.
6. **Plan mínimo.** El cambio más pequeño que cumple el objetivo. Nada de refactors de oportunidad.
7. **Implementa.**
8. **Tests.** Los relevantes primero; la suite completa antes de terminar. Añade tests para lo que construyes.
9. **Browser QA** cuando el cambio es observable en el navegador (UI, layout, endpoints servidos). Usa el dev server; reporta capturas de forma honesta (si una captura sale en blanco por el problema conocido del panel, verifica por DOM/CSS y dilo).
10. **Audita tu propio diff.** `git diff`. ¿Toca algo fuera del scope? ¿Deja código muerto? ¿Rompe una convención de `ARCHITECTURE.md`?
11. **Puerta de validación** (siempre): `npx astro check` · `npx tsc --noEmit` · `npx eslint .` · `npm test` · `npm run build`. Prettier no está en la puerta; no reformatees archivos que no tocas.
12. **Commit** semántico. Rama de trabajo, nunca `main` directo.
13. **Report** estructurado (ver `tasks/current.md` §Handoff y la plantilla de PR).

Actualiza `docs/agent/CURRENT_STATE.md` (y su `Last verified commit`/`date`) si tu cambio lo afecta.

---

## Claude NO es product owner

Si descubres que la tarea:

- **no merece existir** / duplica algo que ya existe,
- **aumenta el coste de API** sin justificación proporcional (p. ej. un cron que llama a `getRiotOverview` entero — pasó de verdad, ver `docs/night-shift/2026-09-09.md` §cierre),
- **exige inventar datos** o conocimiento editorial,
- **contradice la arquitectura** documentada,
- **depende de una decisión humana** (producto o infraestructura) que aún no está tomada,

→ **dilo antes de construirla.** Señalarlo es hacer bien la tarea, no incumplirla. Propón la
alternativa correcta y espera confirmación.

---

## Protocolo Night Shift

Una "Night Shift" es una sesión autónoma larga, con tareas delimitadas de antemano por el
product owner. Reglas:

- **Rama dedicada** (`night-shift/YYYY-MM-DD`). `main` intacto. Nunca merge, nunca `push --force`.
- **Auditoría de baseline** al empezar: confirma el HEAD esperado. **Si el working tree tiene cambios humanos sin commitear → PARA.**
- **Fases ordenadas**, delimitadas en la tarea. **Tests + `astro check` + `eslint` entre fases.** No se pasa a la fase siguiente si la anterior no está verde.
- **Máximo 2 loops de corrección por fase.** Si a la tercera sigue roto, para y reporta.
- **No roadmap autónomo.** Cuando las fases definidas terminan, **se acabó** — aunque sobre tiempo. No se inventan features para llenar horas. La prioridad es calidad y seguridad, no ocupar la sesión.
- **STOP conditions** explícitas en la tarea (working tree sucio, fallo irrecuperable, ambigüedad de producto, necesidad de tocar una zona cerrada, coste Riot que no cuadra).
- **Commits semánticos** después de cada bloque estable.
- **Journal** durante la sesión en `docs/night-shift/YYYY-MM-DD.md`.
- **Al terminar:** auditoría final integral, `push` de la rama (**sin merge**), y un **handoff estructurado** (ver plantilla de PR): qué se hizo, qué falta, qué decisión humana queda pendiente, qué NO se tocó.

Ejemplo real completo: `docs/night-shift/2026-09-09.md` (+ `tasks/archive/2026-09-09-night-shift.md`).

---

## Automatización futura (FUTURE — no existe hoy)

El objetivo a medio plazo es:

```
product owner (con ayuda de un LLM) → tarea estructurada (tasks/current.md)
   → commit/push a GitHub → sesión de Claude Code la ejecuta en una rama
   → PR con handoff → review humana → correcciones → merge
```

**Estado actual: manual.** Cada sesión la lanza una persona (Claude Code en local o en la
nube). No hay integración automática "LLM externo ↔ Claude", ni un webhook que dispare
sesiones, ni un bot que abra PRs. No lo simules ni lo documentes como existente. `tasks/` y las
plantillas de PR/issue son el primer paso hacia ese flujo: un contrato escrito estable entre
quien pide y quien ejecuta.
