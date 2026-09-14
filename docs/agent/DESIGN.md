# DESIGN — tidusss.es

Lenguaje visual y reglas de composición. Detalle exhaustivo (paleta exacta, tipografía,
sombras, animaciones) en `docs/PLATFORM_BIBLE.md` §4. Aquí: lo que un agente necesita para no
romper la coherencia.

---

## Dirección

**Premium · oscuro · editorial · esports · data-rich · compacto.**

No es un "dashboard de esports" genérico ni una landing de creador de plantilla. Es una
publicación: tipografía Inter, fondo negro-azulado profundo (`#060913`), acento **dorado**
(`#d6b56b`) para "esto importa / actúa aquí" (CTA, LP, rango, credenciales) y **azul**
(`#278cff`) para "esto es interactivo / brilla". Los roles de esos dos colores **nunca se intercambian**.

## Evitar

- **Card spam** — cuestiona cada rectángulo con fondo + borde + radio. Sobre todo en listas densas (Match History).
- **Glassmorphism**, blur decorativo como estilo.
- **Neón / RGB / cyberpunk / "casino gaming"**, púrpura Twitch como acento general (solo en contexto Twitch).
- **Glow spam** — las sombras llevan el color del elemento, nunca `rgba(0,0,0,…)` genérico, y son puntuales.
- **Dashboard SaaS genérico** — seis KPIs idénticos en cajas iguales.
- **Landing vertical infinita** — /competitivo es un perfil competitivo, no una sucesión de secciones de marketing.

## Principio

**Composición > decoración.** Jerarquía → composición → legibilidad → personalidad → detalle.
Más pulido no es más cajas ni más efectos.

---

## Patrones aprobados (respétalos si tocas su zona)

- **Densidad de Match History:** fila densa escaneable en < 2 s (no una card gigante por partida) + detalle expandible + timeline on-demand. 3 niveles de profundidad, sin duplicar información entre ellos. 10 partidas iniciales + "cargar anteriores" hasta 20 (client-side, sin llamadas nuevas).
- **Composición de /competitivo ("Tidusss Competitive Editorial", Art Direction Ultimate):** command bar sticky (HUD compacto: rango/LP/pico/Δ sesión/racha/última/estado live) → **hero panel** (identidad de rango + sesión de hoy + evolución de LP como UN sistema con divisores internos, nunca dos módulos sueltos) → grid asimétrico (forma por campeón, campeón dominante data-driven, **nunca** hardcodeado a Lucian ← → rendimiento reciente como tendencia, "trend lanes") → historial a ancho completo. No hay una jerarquía numerada 01-05: el HUD + hero panel responden "¿cómo voy?", el resto responde "¿por qué?" y "¿qué ha pasado?".
- **Sistema de tokens de `/competitivo`** (`--lp-*` en `.live-page`, `src/styles/global.css`): superficies (`--lp-surface`, `--lp-surface-raised`), victoria/derrota desaturados (`--lp-win`/`--lp-loss` y sus variantes `-strong`/`-wash`) — reconocibles al instante, nunca verde fosforito/rojo alarma. Reutilízalos en vez de inventar un tono nuevo.
- **Victoria/derrota con presencia real:** veladura de gradiente sutil desde el borde de la fila (`.match-row-wash`), anillo de color en el retrato, chip de LP con fondo — no solo un texto coloreado de 3px.
- **"Partida en curso" es un evento** cuando existe (franja superior dorada, cabecera con chip, Tidusss con retrato/anillo propio) y hace receder el resto del Control Room (opacity, nunca oculto — se recupera al pasar el ratón/foco); discreta (oculta) cuando no hay partida.
- **Arte de campeón como material visual:** el campeón dominante (Champion Pool/Forma por campeón) usa el loading art de Data Dragon con máscara de degradado — nunca a página completa, siempre data-driven, nunca hardcodeado.
- **Charts ligeros:** SVG/CSS a mano (`buildSparklinePath`, `buildRankChartPoints`, barras CSS). **Sin librería de charting.** El eje de un chart de rango usa un ordinal monótono interno (`rankOrdinal`), nunca LP crudo, y ese número **no se muestra**. La evolución de LP lleva área de degradado + marca de pico + tooltip al pasar el ratón; nunca chartjunk ni datos inventados entre snapshots.
- **Halos puntuales, no glow spam:** como mucho un halo por página (hoy, el crest de rango en el hero panel) — nunca por elemento.
- **Responsive = diseño propio por breakpoint**, no el desktop encogido. QA real en 375 / 768-820 / 1440 / 1920.
- **Estados por `data-*`** en el HTML; el CSS reacciona, el JS solo conmuta. Clases de estado semánticas toleradas: `.is-visible` `.is-ready` `.is-victory` `.is-defeat`.
- **Skeletons explícitos** por familia; nunca un spinner genérico ni un hueco en blanco.
- **Todo movimiento respeta `prefers-reduced-motion: reduce`** — sin excepción.
- **Contadores numéricos:** `requestAnimationFrame` + easing cúbico a mano, sin librería.
- Radios: **2px** estándar; 50% solo círculos reales; pill (999px) solo para insignias puntuales. No hay radio "grande de app".

## Sobre números CSS

No documentes aquí valores de píxeles frágiles (altura exacta de una fila, un `gap`) salvo que
sean una **restricción de producto real**. Ejemplos de restricción real:
- Match History: fila densa, objetivo orientativo ~90–140 px en desktop, ~5–7 partidas visibles por pantalla (guía, no dogma).
- /competitivo no crece de altura sin ganar densidad de información.

Un número que solo existe porque "quedaba bien" no va en la documentación: va en el CSS con un
comentario si hace falta.

---

## Zonas cerradas visualmente

Home, Navbar, Tier List, `/campeones`, contenido de campeón: **no rediseñar** sin tarea
explícita. Un pase de "pulido visual" a /competitivo tampoco es una invitación permanente —
para cuando el objetivo de la tarea está cumplido.
