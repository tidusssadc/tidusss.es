# Environment Engine

El Environment Engine convierte el fondo global en una composición atmosférica
dependiente de la ruta. Es decorativo, no comunica información y siempre se
renderiza detrás del contenido.

## Ambientes disponibles

- `home`: portada editorial azul y dorada, con una firma visual muy tenue.
- `live`: centro de control más frío, técnico y estructurado.
- `match`: base preparada para incorporar la imagen del campeón jugado.
- `tier-list`: mesa de análisis preparada para una escena contextual.
- `about`: ambiente editorial preparado para una futura fotografía.
- `youtube`: estudio sobrio, sin depender del rojo de la plataforma.
- `twitch`: emisión ligeramente más viva, sin estética gaming recargada.

## Capas

Cada ambiente selecciona solo las capas que necesita:

- `grid`
- `noise`
- `mist`
- `image`
- `glow`
- `rays`
- `particles`

Las definiciones viven en `src/data/environments.ts`. El componente
`src/components/Environment.astro` interpreta esas definiciones y
`src/layouts/BaseLayout.astro` elige el ambiente correspondiente a la ruta.

## Añadir un ambiente

1. Añadir el identificador a `EnvironmentId`.
2. Crear su definición en `environments`, indicando las capas necesarias.
3. Añadir su ruta a `resolveEnvironment`.
4. Personalizar únicamente lo necesario con
   `[data-environment='identificador']` en `src/styles/global.css`.

Si necesita una imagen contextual, se define mediante `image.src`,
`image.position` e `image.opacity`. La composición debe conservar siempre
contraste suficiente y no depender del fondo para transmitir información.

## Movimiento y hora

El movimiento ambiental está limitado a desplazamientos de uno a tres píxeles.
Se desactiva por completo con `prefers-reduced-motion`. El motor distingue entre
día y noche mediante `data-atmosphere`: durante el día prioriza limpieza y azul;
por la noche aumenta ligeramente la profundidad, la niebla y el dorado.
