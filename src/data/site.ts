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
 * áreas en primer nivel, reflejando los 2 pilares públicos de tidusss.es
 * (conocimiento ADC / actividad competitiva real). "Inicio" no está aquí
 * (el logo ya lleva al mismo sitio en todas las páginas).
 *
 * "El Laboratorio" (naming interno de la fase anterior) se retira como
 * naming PÚBLICO: el grupo pasa a llamarse "ADCs", que es lo que
 * realmente representa — el conocimiento, la valoración y el contenido de
 * Tidusss sobre los ADC de su Tier List. "Centro de Campeones" pasa a
 * "Todos los ADCs" y "Academia ADC" a "Aprende ADC" por el mismo motivo:
 * el nombre debe decir qué es, no cómo se llamaba el módulo internamente
 * (las carpetas/tipos internos como `league-laboratory` no cambian).
 *
 * "Herramientas" se retira del dropdown: auditado, el 100% de su contenido
 * "disponible" son enlaces puros a páginas ya alcanzables desde este mismo
 * dropdown (Todos los ADCs/Tier List/Pregunta) — cero funcionalidad
 * propia. La página sigue existiendo en /herramientas (no se borra ni se
 * rompe su URL), simplemente deja de tener acceso privilegiado.
 *
 * "Comunidad" se retiró del primer nivel: sus 3 páginas (/comunidad,
 * /roadmap, /actualizaciones) son estado del proyecto/changelog de la
 * propia web — legítimas, pero no navegación primaria. Siguen accesibles
 * desde Home ("Sigue explorando" ya enlaza directamente a /comunidad, y
 * desde ahí a /roadmap y /actualizaciones — las 3 páginas ya se enlazan
 * entre sí).
 *
 * "Explorar" también se retiró: es un índice/mapa de superficies que ya
 * tienen su propia vía razonable (ADCs, Competitivo, Home, búsqueda) —
 * ningún producto principal dependía de /explorar como único camino. La
 * página sigue existiendo y funcionando igual, solo deja de ocupar
 * navegación primaria; Home ya enlaza a ella directamente.
 */
export const navigation = [
  {
    label: 'ADCs',
    items: [
      { label: 'Todos los ADCs', href: '/campeones' },
      { label: 'Tier List', href: '/tier-list' },
      { label: 'Aprende ADC', href: '/academia' },
      { label: 'Pregunta a Tidusss', href: '/pregunta' },
    ],
  },
  { label: 'Competitivo', href: '/competitivo' },
] as const;
