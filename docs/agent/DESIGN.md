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

- **Densidad de Match History:** fila densa escaneable en < 2 s (no una card gigante por partida) + detalle expandible + timeline on-demand. 3 niveles de profundidad, sin duplicar información entre ellos. 10 partidas iniciales.
- **Jerarquía de /competitivo:** `01 Ahora` (rango/LP con peso real) → `02 Rendimiento` → `03 Campeones` (Champion Pool con protagonismo, campeón dominante data-driven, **nunca** hardcodeado a Lucian) → `04 Patrones` (de-enfatizado) → `05 Historial`.
- **"Partida en curso" es protagonista cuando existe**, discreta cuando no.
- **Charts ligeros:** SVG/CSS a mano (`buildSparklinePath`, barras CSS). **Sin librería de charting.** El eje de un chart de rango usa un ordinal monótono interno (`rankOrdinal`), nunca LP crudo, y ese número **no se muestra**.
- **Responsive = diseño propio por breakpoint**, no el desktop encogido. QA real en 375 / 768-820 / 1440.
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
