# Tidusss.es

Web oficial de Tidusss, creador de contenido español de League of Legends y jugador Master ADC especializado en Lucian.

Esta primera versión contiene la base técnica del sitio: Astro, TypeScript estricto, Tailwind CSS, ESLint y Prettier. La landing completa se desarrollará posteriormente.

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

Define `YOUTUBE_API_KEY` en un archivo `.env` local y como variable privada de
Cloudflare Pages. Nunca uses el prefijo `PUBLIC_`: la clave solo se consume
durante la compilación y dentro de la Function de Cloudflare.

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

## Datos competitivos de Riot

La portada incluye una integración server-side limitada a `Tidusss#FFX`. La
configuración, endpoints, caché, seguridad, cálculos y requisitos de producción
se documentan en [`docs/riot-api.md`](docs/riot-api.md).
