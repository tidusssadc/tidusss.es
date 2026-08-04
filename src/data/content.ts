export const stats = [
  { value: 'EUW', label: 'Servidor' },
  { value: '2.000+', label: 'Suscriptores' },
  { value: 'ADC', label: 'Rol principal' },
  { value: 'Lucian', label: 'Especialidad' },
] as const;

export const recognition = {
  label: 'Credenciales',
  headline: 'Resultados que ponen contexto.',
  description:
    'Juego, reviso y explico mis partidas. Estas credenciales ayudan a situar desde qué nivel lo hago.',
  updatedLabel: 'Logros verificados',
  disclaimer:
    'Los puestos en rankings externos pueden variar con el tiempo y dependen de los criterios de cada plataforma.',
  entries: [
    { value: '#2', subject: 'DPM.LOL', source: 'Rendimiento por campeón' },
    {
      value: 'Top 10',
      subject: 'Onetricks.gg',
      source: 'Clasificación de especialistas',
    },
    {
      value: 'Lucian',
      subject: 'Especialidad',
      source: 'Rol: ADC',
    },
  ],
} as const;

export const authorityMethod = {
  label: 'Cómo juego',
  title: 'Leer. Decidir. Ejecutar.',
  description:
    'No se trata de jugar rápido todo el tiempo, sino de reconocer la ventana y ejecutar sin dudar.',
  principles: [
    { number: '01', label: 'Leer', detail: 'Medir espacio y recursos.' },
    { number: '02', label: 'Decidir', detail: 'Encontrar la ventana.' },
    { number: '03', label: 'Ejecutar', detail: 'Entrar limpio y a tiempo.' },
  ],
} as const;

export const creatorMedia = {
  portraitSrc: null as string | null,
  portraitAlt: 'Retrato profesional de Tidusss',
} as const;

export const contentCards = [
  {
    number: '01',
    title: 'Gameplays de alto elo',
    description:
      'Partidas comentadas sin esconder los errores: qué hago, qué veo y por qué tomo cada decisión.',
  },
  {
    number: '02',
    title: 'Guías y análisis',
    description:
      'Fase de líneas, combos y posicionamiento explicados para que puedas llevarlos a tus partidas.',
  },
  {
    number: '03',
    title: 'Mentalidad y toma de decisiones',
    description:
      'Cómo reconocer una ventana, cuándo esperar y qué errores puedes castigar como ADC.',
  },
] as const;

export const milestones = [
  { label: 'Inicio del canal', detail: 'Empiezo a compartir mis partidas.' },
  {
    label: '500 suscriptores',
    detail: 'Primeros jugadores siguiendo el canal.',
  },
  {
    label: '1.000 suscriptores',
    detail: 'La comunidad alcanza cuatro cifras.',
  },
  {
    label: '2.000 suscriptores',
    detail: 'Más de dos mil personas siguen el contenido.',
  },
  { label: 'Master', detail: 'El trabajo en Solo Queue da otro paso.' },
] as const;
