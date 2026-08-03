export const site = {
  name: 'TIDUSSS',
  title: 'Tidusss — Master ADC y especialista en Lucian',
  description:
    'Aprende ADC con Tidusss: partidas comentadas, análisis y decisiones explicadas por un jugador Master especializado en Lucian.',
} as const;

export const brandPrinciple = {
  lead: 'Precisión para ejecutar.',
  conclusion: 'Criterio para saber cuándo.',
  code: 'ROL / ADC · RANGO / MASTER · REGIÓN / EUW',
} as const;

export const navigation = [
  { label: 'Inicio', href: '#inicio' },
  { label: 'Explorar', href: '/explorar' },
  { label: 'Campeones', href: '/campeones' },
  { label: 'Tier List', href: '/tier-list' },
  { label: 'Directo', href: '/live' },
  { label: 'Pregunta', href: '/pregunta' },
  { label: 'Comunidad', href: '/comunidad' },
] as const;
