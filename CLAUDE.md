# CLAUDE.md — tidusss.es

Instrucciones persistentes para Claude Code. **Léelo entero antes de tocar nada.**
Es corto a propósito: es un router hacia `docs/agent/`, no la documentación completa.

## Antes de empezar cualquier tarea

1. Lee este archivo.
2. Lee **`docs/agent/CURRENT_STATE.md`** — qué existe, qué está cerrado, qué está bloqueado, qué NO tocar.
3. Lee **`docs/agent/RULES.md`** — reglas duras (datos, editorial, Riot, producto, git).
4. Lee la tarea actual en **`tasks/current.md`**.
5. Audita el repo real (`git status`, `git log`, el código relevante). **No confíes en informes anteriores como verdad absoluta.**
6. Si la tarea no debería hacerse (ver "Cuándo parar" abajo), dilo **antes** de construirla.

Contexto más profundo, solo si la tarea lo pide:
`docs/agent/PRODUCT.md` · `docs/agent/ARCHITECTURE.md` · `docs/agent/DESIGN.md` · `docs/agent/WORKFLOW.md`.
Documentación técnica de sistemas concretos: `docs/riot-api.md`, `docs/operations/rank-history.md`, `docs/content-graph.md`, `docs/league-laboratory.md`, `docs/pregunta-a-tidusss.md`, y `docs/PLATFORM_BIBLE.md` (histórico y profundo — parcialmente desactualizado, ver su cabecera).

## Identidad del producto (nunca la contradigas)

**Tidusss** (Jesús) — jugador **Master en EUW**, **main ADC**, **SoloQ activo**, creador de contenido español de League of Legends.

**Lucian** es su campeón principal/favorito/_signature_, con el contenido editorial más profundo del sitio. **Tidusss NO es, a nivel global, un "OTP Lucian" / "One Trick" / jugador exclusivamente de Lucian.** Su identidad pública es **ADC + Competitivo + conocimiento propio + contenido**. No hardcodees arquitectura específica de Lucian ni marques el producto como "solo Lucian".

## Qué es y qué no es el producto

- **Es:** la plataforma personal de Tidusss — conocimiento ADC, actividad competitiva real de SoloQ, contenido.
- **No es:** una wiki general de LoL, un clon de OP.GG / DeepLoL / U.GG, una base de datos pública de 173 campeones, un SaaS, un panel de administración.
- **Universo público ADC = la Tier List de 25 ADC.** El catálogo completo de Data Dragon puede existir _internamente_ (fichas `/campeones/[slug]` en `noindex`), pero la superficie de producto son esos 25.

## Reglas críticas (resumen — detalle en `docs/agent/RULES.md`)

- **Nunca inventes datos.** LP, peak, MMR, delta de LP, "lane domination", grados de partida: si no hay dato real, se dice "sin dato", nunca un `0` ni una estimación. El histórico de rango **empieza con el primer snapshot real**, nunca se reconstruye hacia atrás.
- **Datos de League ≠ conocimiento de Tidusss.** No generes consejos de matchup/build/runas "como si fuera Tidusss". Una fuente externa/reference no es su opinión.
- **Riot = autoridad de identidad.** Matching por **PUUID exacto**, nunca por parecido de nombre. `STREAMER` no significa `LIVE`.
- **Coste Riot:** justifica cualquier llamada nueva. Timeline es siempre _on-demand_. Nunca N×jugadores / N×partidas para un dato agregado. Reutiliza claves de caché. La caché en memoria **no** es una caché de borde global garantizada.
- **Producto:** cuestiona si una sección merece existir. No añadas páginas por defecto. No conviertas todo en navbar. No dupliques contenido ya desplazado. No "optimización infinita".
- **Git:** nunca `push --force`, nunca `reset --hard` destructivo, nunca merges automáticos salvo instrucción explícita. **Working tree con cambios humanos sin commitear → PARA y pregunta.**

## Zonas cerradas (CLOSED — no tocar salvo bug crítico de build/runtime)

Home, Navbar global, Tier List, `/campeones`, contenido de Lucian/Jhin/Jinx, Academia, Pregunta, Search, grafo de contenido de YouTube, **el dataset del Identity Registry** (`src/config/known-players.generated.ts`), sitemap.
Lista viva y motivos en `docs/agent/CURRENT_STATE.md`.

## Infraestructura

**D1 (histórico de rango): APROVISIONADA en Production** (D1 `tidusss-competitive` + binding `DB`). Primer snapshot real observado: `MASTER 554 LP`, 2026-09-10 — el histórico **empieza ahí**, nada anterior se reconstruye. Sin `DB` (p. ej. un preview de rama), `src/lib/rank-history` sigue degradando solo (`available:false`, el bloque de UI no aparece). Pendiente: `RANK_SNAPSHOT_CRON_SECRET` para activar el cron de `.github/workflows/rank-snapshot.yml` (hasta entonces el histórico crece con las visitas reales a `/api/riot/overview`). Guía: `docs/operations/rank-history.md`.

## Metodología

Flujo estándar y protocolo Night Shift en **`docs/agent/WORKFLOW.md`**.
Claude **no es product owner**: si una tarea no merece existir, duplica algo, sube costes sin justificación, exige inventar datos, contradice la arquitectura, o depende de una decisión humana → **dilo antes de construirla**.

## Puerta de validación (siempre, antes de commitear)

```bash
npx astro check
npx tsc --noEmit
npx eslint .
npm test
npm run build
```

Prettier **no** es parte de la puerta (el repo tiene estilo propio consistente pero no prettier-limpio). No ejecutes `prettier --write` sobre archivos que no tocas.
