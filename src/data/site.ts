export const site = {
  name: 'TIDUSSS',
  title: 'Tidusss — Master ADC y creador de contenido',
  description:
    'Aprende ADC con Tidusss: jugador Master en EUW, partidas de SoloQ comentadas y análisis reales para jugadores de ADC.',
} as const;

export const brandPrinciple = {
  lead: 'Precisión para ejecutar.',
  conclusion: 'Criterio para saber cuándo.',
  code: 'ROL / ADC · RANGO / MASTER · REGIÓN / EUW',
} as const;

/**
 * Navegación principal — arquitectura de producto, no de código: 4 grandes
 * áreas en primer nivel. "Inicio" se retiró de aquí (el logo ya lleva al
 * mismo sitio en todas las páginas) y "Pregunta a Tidusss" pasó a vivir
 * dentro de "El Laboratorio" (es una herramienta de conocimiento ADC más,
 * junto a Campeones/Tier List/Academia/Herramientas) — ninguna ruta
 * desaparece, solo su peso en el primer nivel.
 */
export const navigation = [
  { label: 'Explorar', href: '/explorar' },
  {
    label: 'El Laboratorio',
    items: [
      { label: 'Centro de Campeones', href: '/campeones' },
      { label: 'Tier List', href: '/tier-list' },
      { label: 'Academia ADC', href: '/academia' },
      { label: 'Herramientas', href: '/herramientas' },
      { label: 'Pregunta a Tidusss', href: '/pregunta' },
    ],
  },
  { label: 'Competitivo', href: '/competitivo' },
  {
    label: 'Comunidad',
    items: [
      { label: 'Estado del proyecto', href: '/comunidad' },
      { label: 'Roadmap', href: '/roadmap' },
      { label: 'Actualizaciones', href: '/actualizaciones' },
    ],
  },
] as const;
