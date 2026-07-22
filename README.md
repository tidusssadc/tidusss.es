# Tidusss.es

Web oficial de Tidusss, creador de contenido español de League of Legends y jugador Master ADC especializado en Lucian.

La portada presenta la marca y `/live` reúne la actividad actual de YouTube, Twitch y SoloQ en una vista ligera construida con Astro y JavaScript nativo.

## Requisitos

- Node.js 24 LTS o una versión compatible con Astro 7
- npm 11 o posterior

## Instalación

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

Astro mostrará la URL local, normalmente `http://localhost:4321`.

Las rutas de `functions/` son Cloudflare Pages Functions y no las ejecuta el servidor de Astro. Para probar la experiencia completa en local:

```bash
npm run build
npx wrangler pages dev dist
```

## Verificación

```bash
npm run check
npm run lint
npm run format:check
```

Para aplicar automáticamente el formato:

```bash
npm run format
```

## Compilación y previsualización

```bash
npm run build
npm run preview
```

La compilación estática se genera en `dist/`.

## Cloudflare Pages

El proyecto genera HTML estático y no necesita adaptador. Al conectar el repositorio en Cloudflare Pages, usa:

- Comando de compilación: `npm run build`
- Directorio de salida: `dist`
- Versión de Node.js: `24`

## Estructura

```text
src/
├── assets/       Recursos procesados por Astro
├── config/       Plataformas e integraciones externas
├── components/   Componentes reutilizables
├── data/         Contenido y configuración tipados
├── layouts/      Plantillas de página
├── pages/        Rutas del sitio
├── services/     Proveedores de datos reemplazables
└── styles/       Estilos globales
```

## Contenido dinámico de YouTube

Define `YOUTUBE_API_KEY` y, opcionalmente, `YOUTUBE_CHANNEL_ID` en `.dev.vars`
para Wrangler y como variables privadas de Cloudflare Pages. Nunca uses el
prefijo `PUBLIC_`: la clave solo se consume dentro de Pages Functions. La
renderización inicial usa RSS como fallback y no evalúa secretos durante el build.

La integración resuelve `@tidussstwitch` y realiza tres consultas agrupadas:

1. `channels.list` obtiene la playlist de publicaciones del canal.
2. `playlistItems.list` obtiene las ocho publicaciones más recientes.
3. `videos.list?part=contentDetails` obtiene todas sus duraciones en una única
   petición.

Cada consulta cuesta aproximadamente una unidad de cuota de YouTube Data API;
una actualización completa cuesta unas tres unidades, independientemente de
que se muestren ocho contenidos. La respuesta de Cloudflare se conserva 30
minutos en caché compartida y puede servirse durante 24 horas mientras se
revalida o si YouTube falla temporalmente.

La duración se normaliza desde ISO 8601. Debido a que la API no ofrece una
propiedad oficial y estable para identificar Shorts, los contenidos de 60
segundos o menos se clasifican como candidatos a Short. Si falla la consulta de
detalles, se conservan los datos básicos del RSS sin inventar duración ni tipo.

## Estado de Twitch

El módulo de directo necesita `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` y
`TWITCH_USER_LOGIN`. Las credenciales se leen únicamente en la Function. Si no
están configuradas, la interfaz muestra un estado no disponible y mantiene el
enlace oficial al canal, sin simular que está offline.

## Página Live

`/live` consulta los endpoints propios del proyecto y actualiza los módulos en
paralelo. Si un proveedor falla, los demás siguen funcionando y los últimos
datos renderizados se conservan. El resumen diario usa partidas Solo/Duo (cola 420) según la fecha de Madrid. La variación de LP queda explícitamente sin dato
hasta disponer de snapshots persistentes; no se estima con datos inventados.

## Datos competitivos de Riot

La portada incluye una integración server-side limitada a `Tidusss#FFX`. La
configuración, endpoints, caché, seguridad, cálculos y requisitos de producción
se documentan en [`docs/riot-api.md`](docs/riot-api.md).
