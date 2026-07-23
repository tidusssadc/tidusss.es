# Home State Engine

El Home State Engine permite que la portada reaccione a datos ya disponibles
sin realizar nuevas peticiones ni repartir condiciones entre componentes.

## Qué permanece estático

- El titular principal.
- La identidad y el posicionamiento.
- El orden general de la Home.
- El método editorial.
- El cierre de marca.

## Estados y prioridades

| Estado           | Prioridad | Fuente actual  |
| ---------------- | --------: | -------------- |
| Directo activo   |       100 | Twitch         |
| Nuevo vídeo      |        80 | YouTube        |
| Objetivo cercano |        60 | YouTube o Riot |
| Día normal       |        20 | Contexto local |

Estados preparados:

- nuevo parche;
- nuevo récord;
- objetivo alcanzado;
- nuevo hito.

Estos estados solo se activarán cuando una integración publique un
`future-event` real. No contienen datos provisionales.

## Flujo

1. Los componentes existentes consultan sus endpoints habituales.
2. Después de procesar una respuesta, publican una señal de dominio.
3. `signals.ts` conserva el último valor de cada fuente.
4. `engine.ts` evalúa todas las definiciones y selecciona la prioridad mayor.
5. `HomeStateEngine.astro` aplica el estado a la presentación.

El motor no conoce endpoints, respuestas HTTP ni componentes concretos.

## Reacciones actuales

- Contexto editorial secundario dentro del hero.
- CTA contextual resuelto mediante el Content Graph.
- Prioridad visual tenue para Twitch, YouTube o la credencial.
- Variación mínima de niebla, luz o contraste.
- Copy offline de Twitch convertido en invitación.

## Content Graph

Los estados persistentes usan identificadores del Content Graph:

- `channel:twitch`
- `achievement:master-euw`
- objetivos reales registrados

Los vídeos dinámicos se convierten mediante `videoToContentEntity`. De esta
forma el motor no necesita conocer URLs oficiales ni estructuras de YouTube.

## Soul Engine

Cada cambio emite `tidusss:home-state-changed`. El Soul Engine ya escucha ese
contrato y puede convertir estados poco frecuentes en Moments. Actualmente
queda preparado el caso de un nuevo récord, que solo podrá aparecer cuando
exista una señal real.

## Añadir una Tier List por nuevo parche

1. Registrar la Tier List disponible en el Content Graph.
2. Cuando exista una fuente fiable de parche, publicar:

```ts
publishHomeSignal({
  type: 'future-event',
  event: 'new-patch',
  label: 'Nuevo parche',
  text: 'Ya está disponible el nuevo análisis.',
  entity: tierListEntity,
});
```

El motor aplicará automáticamente la prioridad preparada sin modificar el Hero,
el layout, Twitch, YouTube o Riot.
