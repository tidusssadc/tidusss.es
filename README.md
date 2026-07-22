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
├── components/   Componentes reutilizables
├── data/         Contenido y configuración tipados
├── layouts/      Plantillas de página
├── pages/        Rutas del sitio
└── styles/       Estilos globales
```
