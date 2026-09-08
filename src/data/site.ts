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
 * Navegación principal — arquitectura de producto, no de código: 2 grandes
 * áreas en primer nivel. "Inicio" se retiró de aquí (el logo ya lleva al
 * mismo sitio en todas las páginas) y "Pregunta a Tidusss" pasó a vivir
 * dentro de "El Laboratorio" (es una herramienta de conocimiento ADC más,
 * junto a Campeones/Tier List/Academia/Herramientas).
 *
 * "Comunidad" se retiró del primer nivel: sus 3 páginas (/comunidad,
 * /roadmap, /actualizaciones) son estado del proyecto/changelog de la
 * propia web — legítimas, pero no navegación primaria. Siguen accesibles
 * desde Home ("Sigue explorando" ya enlaza directamente a /comunidad, y
 * desde ahí a /roadmap y /actualizaciones — las 3 páginas ya se enlazan
 * entre sí).
 *
 * "Explorar" también se retiró: es un índice/mapa de superficies que ya
 * tienen su propia vía razonable (El Laboratorio, Competitivo, Home,
 * búsqueda) — ningún producto principal dependía de /explorar como único
 * camino. La página sigue existiendo y funcionando igual, solo deja de
 * ocupar navegación primaria; Home ya enlaza a ella directamente.
 */
export const navigation = [
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
] as const;
