# Content Graph

El Content Graph es la capa de dominio que relaciona las piezas del ecosistema
de Tidusss sin convertir a Riot, YouTube, Twitch o Astro en propietarios de la
arquitectura.

## Auditoría inicial

Entidades que ya existían:

- vídeos y canales;
- partidas, campeones, perfil y rango;
- objetivos y logros;
- hitos, momentos y referencias;
- portada y centro de actividad.

Relaciones reales que ya existían, pero estaban dispersas:

- una partida contiene el campeón jugado;
- un vídeo pertenece al canal de YouTube;
- una partida puede tener un vídeo verificado mediante `match-video-links`;
- el centro de actividad agrega Riot, YouTube y Twitch;
- la portada conduce al centro de actividad.

Faltaban identificadores de dominio comunes, tipos de relación y una consulta
central para obtener el siguiente paso sin conocer el proveedor o componente.

## Estructura

`src/domain/content-graph/types.ts`

Define `ContentEntity`, `ContentRelation`, sus identificadores y el contrato del
grafo. Incluye entidades actuales y futuras como `Video`, `Match`, `Champion`,
`Patch`, `TierList`, `Build`, `Guide`, `Goal`, `Achievement`, `Moment`,
`Reference`, `Tool`, `Game` y `CreatorProject`.

`src/domain/content-graph/registry.ts`

Contiene únicamente entidades disponibles y relaciones verificables. También
expone consultas ordenadas por prioridad y elimina destinos duplicados.

`src/domain/content-graph/adapters.ts`

Convierte modelos existentes de Riot y YouTube en entidades de dominio. No
realiza peticiones y no duplica los datos originales.

`src/components/ExploreNext.astro`

Representa relaciones navegables. No decide qué mostrar: recibe una entidad de
origen y consulta el grafo.

## Relaciones actuales

- portada → centro de actividad;
- portada → biblioteca de vídeos;
- portada → especialidad en Lucian;
- Live → vídeos y análisis;
- Live → Twitch;
- Live → YouTube;
- Live → credencial Master;
- Live → objetivos existentes;
- partida → campeón, mediante adaptador;
- vídeo → partida, solo cuando exista una asociación verificada.

No se generan relaciones por coincidencias de texto ni se inventan asociaciones
entre vídeos y partidas.

## Añadir una Tier List

1. Crear la página, por ejemplo `src/pages/tier-list/[slug].astro`.
2. Registrar una entidad disponible:

```ts
{
  id: 'tier-list:adc-14-15',
  kind: 'tier-list',
  title: 'Tier List ADC · 14.15',
  href: '/tier-list/adc-14-15/',
  source: 'editorial',
  status: 'available'
}
```

3. Registrar solamente relaciones comprobables, por ejemplo con el parche,
   campeones incluidos o una guía publicada.
4. Renderizar `ExploreNext` al final de la página usando el identificador de la
   Tier List.

No es necesario modificar el componente, los modelos de Riot, los servicios de
YouTube, el layout ni las demás páginas.

## Extensión futura

Los nodos `planned` permiten documentar capacidad futura sin exponer enlaces
inexistentes. Las consultas navegables solo devuelven entidades `available` con
`href`. Las relaciones dinámicas podrán combinarse con el registro estático
después de que Riot o YouTube hayan entregado datos, sin añadir nuevas llamadas.

Riesgos que deben evitarse:

- duplicar datos de proveedores dentro del grafo;
- inferir relaciones por títulos o nombres parecidos;
- convertir el registro en un CMS;
- publicar entidades `planned`;
- acoplar los identificadores de dominio a una ruta concreta.
