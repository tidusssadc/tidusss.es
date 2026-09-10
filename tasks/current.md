# Task

_(Plantilla neutra. El product owner rellena esto antes de cada sesión. Si está sin rellenar,
no hay tarea activa — no empieces nada.)_

## Objective

_Qué hay que conseguir, en 1–3 frases. Concreto y verificable._

## Why

_Por qué ahora. Qué problema real resuelve. Qué pasa si no se hace._

## Allowed scope

_Archivos / carpetas / sistemas que esta tarea PUEDE tocar._

## Forbidden scope

_Lo que NO se toca aunque parezca relacionado. Por defecto: todo lo marcado CLOSED en
`docs/agent/CURRENT_STATE.md`, más lo que se liste aquí._

## Constraints

- Rama: _`night-shift/AAAA-MM-DD` / `feat/slug` / …_
- Coste Riot: _sin llamadas nuevas / justificar cualquiera / +0._
- Datos: _no inventar (siempre). Especificar si hay algún matiz._
- Diseño: _sin rediseño / cambio acotado a X._
- Otros: _…_

## Acceptance criteria

_Lista concreta de "está hecho cuando…". Cada punto comprobable._

- [ ] …
- [ ] …

## Validation

- [ ] `npx astro check` limpio
- [ ] `npx tsc --noEmit` limpio
- [ ] `npx eslint .` limpio
- [ ] `npm test` verde
- [ ] `npm run build` sin errores
- [ ] Browser QA _(si aplica: qué rutas, qué breakpoints)_
- [ ] Mobile QA _(si aplica)_

## Stop conditions

_Cuándo Claude debe PARAR y reportar en vez de seguir:_

- Working tree con cambios humanos sin commitear al empezar.
- La tarea exige inventar datos, tocar una zona CLOSED, o subir el coste Riot sin justificación.
- Ambigüedad de producto que no se resuelve con `docs/agent/`.
- 2 loops de corrección sin converger en una fase.
- _(otras específicas de esta tarea)_

## Handoff

_Al terminar, el report debe cubrir:_ qué cambió · por qué · impacto de producto · delta de
llamadas Riot · infraestructura nueva · tests · Browser/Mobile QA · riesgos · qué se dejó sin
tocar a propósito · qué decisión humana queda pendiente.
