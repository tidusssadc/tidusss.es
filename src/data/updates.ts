/**
 * Historial editorial real de tidusss.es — única fuente de verdad,
 * compartida entre `/actualizaciones` y el bloque "Qué ha cambiado" de
 * Home, para no mantener dos listas que puedan divergir.
 */
export type UpdateKind = 'guía' | 'build' | 'tier-list' | 'concepto' | 'mejora-web';

export interface UpdateEntry {
  date: string;
  kind: UpdateKind;
  title: string;
  description: string;
  href: string;
}

export const siteUpdates: UpdateEntry[] = [
  {
    date: '2026-08-03',
    kind: 'mejora-web',
    title: 'Nuevas secciones: Academia ADC, Herramientas y Roadmap',
    description:
      'Academia ADC, Herramientas, Roadmap y Actualizaciones, además de un centro competitivo propio y navegación contextual en las páginas principales — todo enlazado para que siempre tengas algo más que explorar.',
    href: '/explorar',
  },
  {
    date: '2026-08-03',
    kind: 'mejora-web',
    title: 'Home renovada, con Explorar, Comunidad y Actividad',
    description:
      'Rediseño del Home, nuevo showcase de vídeos, tarjetas de redes sociales y tres páginas nuevas para descubrir todo el contenido del sitio.',
    href: '/',
  },
  {
    date: '2026-08-03',
    kind: 'guía',
    title: 'Se publica Pregunta a Tidusss',
    description:
      'Resuelve dudas sobre Lucian y ADC con el contenido editorial ya publicado, sin esperar a un vídeo.',
    href: '/pregunta',
  },
  {
    date: '2026-07-26',
    kind: 'build',
    title: 'Guía de Lucian ampliada: build personal, sinergias y biblioteca de conceptos',
    description:
      'Ruta de objetos personal, 6 sinergias confirmadas, consejos rápidos, historial editorial y los primeros 6 conceptos fundamentales de ADC (spacing, power spike, snowball, trading, tempo y wave management).',
    href: '/campeones/lucian',
  },
  {
    date: '2026-07-24',
    kind: 'tier-list',
    title: 'Se publican la Tier List oficial ADC y el Centro de Campeones',
    description:
      'Clasificación editorial del meta actual y catálogo completo explorable, con búsqueda y filtros por estado.',
    href: '/tier-list',
  },
  {
    date: '2026-07-24',
    kind: 'guía',
    title: 'Lucian entra en la Tier List como S',
    description: 'La única entrada revisada de la primera edición de la Tier List.',
    href: '/tier-list',
  },
  {
    date: '2026-07-24',
    kind: 'guía',
    title: 'Se publica el perfil editorial completo de Lucian',
    description:
      'Resumen, fortalezas, debilidades, errores comunes y power spikes en el Explorador de Campeones.',
    href: '/campeones/lucian',
  },
];

export const updateKindLabel: Record<UpdateKind, string> = {
  guía: 'Guía',
  build: 'Build',
  'tier-list': 'Tier List',
  concepto: 'Concepto',
  'mejora-web': 'Mejora de la web',
};
