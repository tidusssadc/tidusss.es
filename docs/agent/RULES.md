# RULES — tidusss.es

Reglas duras. No son sugerencias. Si una tarea te pide romper una de estas, **para y dilo**
antes de construir nada. Verificadas contra el código el 2026-09-10 (commit `10575c4`).

---

## DATOS

- **Nunca inventes LP, rango, peak, MMR, delta de LP, "MVP/ACE", grados de línea, ni un "score" propio.** Si no hay dato real → "sin dato" / campo ausente, **nunca `0`, nunca una estimación**. El tipo puede llamarse `lpDeltaEstimated`, pero jamás se calcula un valor falso.
- **El histórico de rango empieza con el primer snapshot real.** Prohibido reconstruirlo hacia atrás desde match history, delta de LP, capturas, memoria o datos manuales. (`src/lib/rank-history/dedupe.ts`, `types.ts`.)
- **"Peak" = el rango más alto realmente observado por el sistema**, nunca "peak de temporada" ni nada que no venga de un snapshot guardado.
- **Transición de rango = cambio real de tier/división entre dos snapshots consecutivos.** Una fluctuación de LP dentro de la misma división **no** es una transición (`compareTierDivision`, no `compareRank`, en `rank-order.ts`).
- **No infieras "dominación de línea" ni causalidad por compartir partida.** Que dos jugadores coincidieran en una partida no dice quién ganó la línea.
- **`STREAMER` ≠ `LIVE`.** Que alguien esté en el Identity Registry como streamer no significa que esté emitiendo ahora.
- **Riot es la autoridad de identidad.** Matching **por PUUID exacto** (Riot ID como fallback controlado, nunca por parecido de nombre ni coincidencia parcial). `findKnownPlayerIdentity` ya lo implementa así — reutilízalo, no escribas otro matcher.

## EDITORIAL

- **Datos de League ≠ conocimiento de Tidusss.** Un winrate de Data Dragon o una relación de Match-V5 es un hecho de Riot, no la opinión de Tidusss.
- **No generes consejo de matchup / build / runas "como si fuera Tidusss".** Solo es "de Tidusss" lo que él ha curado editorialmente (contenido con `EditorialTake` / `source: 'verified-manual'`).
- **Una fuente externa o de referencia no es su opinión.** Cítala como lo que es.
- **El copy visible es en español; el código en inglés.** Los mensajes de error públicos salen de un catálogo cerrado de frases, nunca el código interno (`RIOT_RATE_LIMITED`, etc.).

## RIOT / COSTE DE API

- **Justifica por escrito cualquier llamada Riot nueva** (en el PR y en el comentario del código).
- **Match Timeline es siempre on-demand.** Nunca en la ruta crítica de `/api/riot/overview` ni `/api/riot/live`.
- **Nunca N×jugadores o N×partidas** para producir un dato agregado. Si necesitas datos de 10 rivales, es una señal de alarma: replantéalo.
- **Reutiliza las claves de caché existentes** (`riot:account:*` 24h, `riot:ranked:{puuid}` 10min, `riot:match:{id}` 24h/7d, …). No inventes una clave nueva para el mismo dato.
- **La caché en memoria (`src/lib/riot/cache.ts`) NO es una caché de borde global garantizada.** Es por isolate, no persistente, no compartida entre PoPs. Nunca lo describas como "cacheado globalmente" en docs ni en el código.
- **Guardrail vigente:** `POST /api/riot/rank-snapshot-cron` usa el camino ligero `getRiotRankObservation` (solo ACCOUNT-V1 + LEAGUE-V4). Hay tests de aislamiento que fallan si una regresión reintroduce Match-V5 / Timeline / Summoner-V4 / Data Dragon: `test/api/rank-snapshot-cron.test.ts` ("AISLAMIENTO") y `test/lib/riot/rank-observation.test.ts`. Si tocas ese camino, **esos tests deben seguir pasando**.
- Familias y coste: ver `docs/agent/ARCHITECTURE.md` §"Coste Riot".

## PRODUCTO

- **Cuestiona si una sección/página merece existir** antes de construirla. Si el 100% de su valor son enlaces a páginas ya alcanzables, no merece existir (así se retiró "Herramientas" del navbar).
- **No añadas páginas ni entradas de navbar por defecto.** El navbar tiene 2 áreas a propósito.
- **No conviertas todo en navegación.** Estado del proyecto / changelog no es navegación primaria.
- **No dupliques contenido ya desplazado a otra sección.**
- **No "optimización infinita":** un pase de pulido no justifica el siguiente. Para cuando el objetivo de la tarea está cumplido.
- **El universo público ADC son los 25 de la Tier List.** El catálogo Data Dragon completo puede existir internamente (`noindex`), no es superficie de producto.

## GIT

- **Nunca `push --force`.** Nunca `reset --hard` / rebase destructivo / borrado de historial.
- **Nunca mergees a `main`** salvo instrucción explícita del product owner.
- **Working tree con cambios humanos sin commitear al empezar → PARA y pregunta.** No los incluyas en tu trabajo ni los descartes.
- Ramas de trabajo dedicadas (`night-shift/*`, `feat/*`, …). `main` se mantiene desplegable.
- Commits semánticos. Sin `--no-verify`, sin saltarse hooks.
- No toques secretos, no imprimas claves, no rotes claves.

## DOCUMENTACIÓN

- Una fuente de verdad por tema. Antes de crear un doc, comprueba si ya existe uno que cubra esa función y **enlázalo o consolídalo**.
- `docs/agent/CURRENT_STATE.md` lleva `Last verified commit` + `Last verified date`. Si haces un cambio que lo afecte, actualízalo.
- No guardes en docs datos que cambian a diario (LP, subs, "última partida", nº exacto de tests).
- Los enlaces internos de `docs/agent/**` y `CLAUDE.md` deben resolver — hay un test: `test/docs/agent-docs.test.ts`.

## CUÁNDO PARAR (antes de construir)

Di que la tarea no debería ejecutarse tal cual si:
- no merece existir / duplica algo que ya existe;
- aumenta el coste de API sin justificación proporcional;
- exige inventar datos o conocimiento editorial;
- contradice la arquitectura documentada;
- depende de una decisión de producto o de infraestructura que aún no está tomada.

Claude **no es product owner**. Señalar esto **es** hacer bien la tarea.
