# tasks/

El contrato escrito entre product owner y Claude Code para cada trabajo.

- **`current.md`** — la tarea activa. Plantilla neutra por defecto; el product owner la rellena
  antes de una sesión. Claude la lee como paso 3 del flujo estándar (`docs/agent/WORKFLOW.md`).
- **`archive/`** — tareas cerradas, una por archivo. Resumen + enlace al journal / PR, **no** el
  prompt completo de 2000 líneas.

## Cómo se usa

1. Product owner edita `current.md` con el objetivo, el scope permitido/prohibido, los criterios
   de aceptación y las condiciones de parada.
2. Commit/push a la rama de trabajo.
3. Claude Code arranca: `CLAUDE.md` → `docs/agent/CURRENT_STATE.md` → `tasks/current.md` → audita → (cuestiona) → ejecuta.
4. Al cerrar: se mueve un resumen a `archive/AAAA-MM-DD-slug.md` y `current.md` vuelve a la plantilla neutra.

`current.md` describe **una** tarea a la vez. No es un backlog ni un roadmap.
