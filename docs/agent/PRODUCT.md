# PRODUCT — tidusss.es

Qué es el producto y para quién. Contexto de intención — no de implementación (eso está en
`ARCHITECTURE.md`). Detalle histórico y de roadmap en `docs/PLATFORM_BIBLE.md` §1–§2, §6.

---

## Identidad

**Tidusss** (Jesús) — jugador **Master en EUW**, **main ADC**, **SoloQ activo**, creador de
contenido español de League of Legends (YouTube + Twitch).

Hilo editorial (literal en `src/components/BrandManifesto.astro`):
> _"Juego para competir. Reviso para entender. Publico para compartirlo."_

`src/data/site.ts`: _"Master ADC y creador de contenido"_ · _"Aprende ADC con Tidusss"_ ·
`ROL / ADC · RANGO / MASTER · REGIÓN / EUW`.

### Lucian

Es su campeón **principal / favorito / signature**, y tiene el contenido editorial más
profundo del sitio (guía completa con build, runas, sinergias de parche real).

**Pero Tidusss NO es, a nivel global:**
- un "OTP Lucian" / "One Trick",
- un jugador exclusivamente de Lucian.

Su identidad pública gira alrededor de **ADC + Competitivo + conocimiento propio + contenido**.
Lucian es el primer caso de uso a fondo de la arquitectura editorial, no la arquitectura misma.
En código esto ya es explícito (p. ej. `src/lib/riot/performance.ts`: _"Tidusss es ADC main, no
OTP de un único campeón"_). No hardcodees nada específico de Lucian como si fuera el eje del producto.

---

## Qué ES el producto

La plataforma personal de Tidusss, con dos pilares públicos:

1. **Conocimiento ADC** — la valoración, el criterio y el contenido de Tidusss sobre los ADC:
   Tier List de 25 ADC, fichas de campeón, "Aprende ADC" (Academia), "Pregunta a Tidusss"
   (sistema de respuesta determinista sobre su contenido curado).
2. **Actividad competitiva real** — `/competitivo`: rango y LP actuales, forma reciente,
   Champion Pool, patrones, historial de partidas con detalle y timeline on-demand. Datos
   reales de Riot para `Tidusss#FFX`, nunca inventados.

Más una capa editorial de marca (Home reactiva, Soul Engine, easter eggs FFX/LoL) y un ecosistema
que conecta web ↔ YouTube ↔ Twitch ↔ Riot con relaciones **verificadas**, no inferidas.

---

## Qué NO es (y no debe llegar a ser sin una ADR / decisión de producto)

| No es | Por qué importa |
|---|---|
| Una wiki general de LoL | El contenido es el criterio de Tidusss, no una enciclopedia. |
| Un clon de OP.GG / DeepLoL / U.GG / Mobalytics | Se toma de ellos la **densidad y escaneabilidad**, nunca el diseño ni el rol de "buscador de invocadores". |
| Una base de datos pública de 173 campeones | El catálogo Data Dragon existe **internamente** (`/campeones/[slug]`, `noindex` salvo Lucian). El **universo público es la Tier List de 25 ADC**. |
| Un SaaS / panel de administración / CMS | El sitio es estático + Functions. El contenido no se edita dinámicamente. |
| Un buscador público de cuentas de terceros | El endpoint Riot está cerrado a `Tidusss#FFX` y **no acepta parámetros de cuenta**. |
| Una SPA con framework de UI | No hay React/Vue/Svelte. Introducir uno es cambio de arquitectura (ADR), no una PR. |
| Una fuente de datos inventados | Ver `RULES.md` §DATOS. |
| Estética "gaming" genérica (neón/RGB/cyberpunk) | La identidad visual es editorial y oscura. Ver `DESIGN.md`. |

---

## Audiencia

Jugadores de ADC de habla hispana que quieren mejorar y seguir a Tidusss. No es para
profesionales del análisis de datos ni para "buscar mi cuenta".

---

## Principio rector

**League data ≠ conocimiento de Tidusss.** El sitio puede mostrar hechos de Riot (rango,
partidas, winrates de campeón). Solo es "de Tidusss" lo que él ha curado y firmado
editorialmente. No confundas las dos cosas en la UI ni en ningún texto generado.
