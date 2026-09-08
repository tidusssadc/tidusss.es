import type { LabChampion } from '../../domain/league-laboratory';

/**
 * Capa editorial: SOLO campeones de los que el Laboratorio dice algo. No
 * duplica nombre/título/imagen — eso vive en el catálogo generado
 * (`catalog/champions.generated.ts`). Añadir un campeón nuevo aquí no
 * requiere que exista ya en ningún otro sitio del dominio: si el catálogo
 * lo tiene (los ~170 lo tienen), esto solo aporta la curación de Tidusss.
 */

export const lucian: LabChampion = {
  id: 'champion:lucian',
  roles: ['BOTTOM'],
  signatureRole: 'BOTTOM',
  isSignatureChampion: true,
  playstyleTags: ['agresivo', 'combos', 'movilidad'],
  signatureNote: 'Especialidad competitiva actual de Tidusss.',
  profile: {
    summary:
      'Lucian es el campeón que define a Tidusss como jugador: velocidad de ejecución, combos precisos y una ventana de daño que hay que aprovechar sin dudar.',
    appeal:
      'Recompensa exactamente lo que Tidusss valora al jugar: leer la partida, decidir rápido y ejecutar sin errores. No es un campeón que perdone la indecisión — y esa exigencia es buena parte de por qué se ha convertido en su especialidad.',
    editorialTake: {
      verdict:
        'Es, con diferencia, el campeón que mejor conoce Tidusss: la base de su nivel Master y de la mayoría de su contenido.',
      reasoning:
        'No es una preferencia pasajera. Es la especialidad competitiva declarada de Tidusss, respaldada por años de partidas y de contenido del canal construidos en torno a este campeón.',
      confidence: 'high',
    },
    strengths: [
      'Ventana de daño explosiva con el combo pasivo.',
      'Movilidad para reposicionarse dentro de la pelea.',
      'Presión de línea alta cuando el trade se ejecuta bien.',
      'Genera presión y ventaja en las fases temprana y media, antes de que otros tiradores completen su escalado.',
    ],
    weaknesses: [
      'Los objetos y las runas exigen precisión de ejecución.',
      'Vulnerable si pierde la ventana de daño inicial.',
      'Pierde parte de su impacto relativo en el late si la partida se alarga demasiado y otros tiradores llegan a completar su escalado.',
    ],
    commonMistakes: [
      'Buscar el combo pasivo fuera de rango en vez de esperar la ventana correcta.',
      'Usar Culebrina para posicionarse sin haber comprobado antes el daño disponible.',
      'Ejecutar los combos con demasiada lentitud: se pierde fluidez entre habilidades y ataques básicos, y con ello buena parte del daño que la pasiva permite aprovechar.',
      'No extraer suficiente valor de la definitiva: muchos jugadores no la aprovechan del todo.',
      'Jugar con menos agresividad de la que Lucian necesita: no hay que forzar cada jugada sin información, pero quedarse pasivo reduce buena parte de su identidad.',
    ],
    powerSpikes: [
      'Nivel 2: uno de los primeros momentos clave para buscar presión y castigar errores — pero la agresividad depende de la posición, las habilidades disponibles, el estado de la oleada, el apoyo del support y los errores del rival, nunca de entrar sin criterio.',
      'Al completar el primer objeto de daño, cuando el trade en línea empieza a doler de verdad.',
    ],
    difficulty: 'medium',
    quickTips: [
      'Busca presión desde nivel 2.',
      'Prioriza Segador de Esencia como primer objeto.',
      'Intenta comprar Brillo pronto cuando el back lo permita.',
      'Diferencia entre la ruta más sólida con Filo Infinito y la preferencia personal por Navori.',
      'No ralentices los combos.',
      'Aprovecha la pasiva entre habilidades.',
      'No guardes la definitiva sin propósito.',
      'Juega agresivo, pero no sin criterio.',
      'Intenta generar ventaja antes de que los ADC de mayor escalado lleguen al late.',
    ],
  },
  /**
   * Solo los conceptos genuinamente evidenciados por el `profile` de
   * arriba: Spacing y Trading por las debilidades/errores comunes sobre la
   * ventana de daño y el rango de combo; Power Spike porque el propio
   * perfil ya enumera sus power spikes explícitos; Snowball por la
   * fortaleza de presión de línea que, bien ejecutada, se convierte en
   * ventaja. No se enlaza Tempo ni Wave Management: el perfil actual no
   * dice nada específico sobre ellos todavía.
   */
  coreConceptIds: [
    'concept:spacing',
    'concept:power-spike',
    'concept:trading',
    'concept:snowball',
  ],
  editorialHistory: [
    {
      date: '2026-07-24',
      patchId: 'patch:15-14',
      title: 'Lucian entra en la Tier List como S',
      summary:
        'Lucian entra en la Tier List oficial ADC de Tidusss como S, la única entrada revisada de su primera edición.',
    },
    {
      date: '2026-07-24',
      patchId: 'patch:15-14',
      title: 'Se publica el perfil editorial completo de Lucian',
      summary:
        'Se publica el perfil editorial completo (resumen, fortalezas, debilidades, errores comunes, power spikes) en el Explorador de Campeones.',
    },
    {
      date: '2026-07-26',
      title: 'La ficha de Lucian se rediseña como guía completa',
      summary:
        'Se rediseña la ficha de Lucian como guía editorial completa, lista para reunir build, runas, matchups, sinergias y conceptos. El contenido de esas secciones todavía está pendiente de redacción.',
    },
    {
      date: '2026-07-26',
      patchId: 'patch:26-14',
      title: 'Guía de Lucian ampliada: build personal, sinergias y biblioteca de conceptos',
      summary:
        'Se publica el criterio real de Tidusss para el parche 26.14: build principal y ruta personal, runa principal, orden de habilidades, power spikes, sinergias, errores frecuentes y consejos rápidos. Matchups y el resto del árbol de runas siguen pendientes de análisis.',
    },
  ],
};

export const kaisa: LabChampion = {
  id: 'champion:kaisa',
  roles: ['BOTTOM'],
  isSignatureChampion: false,
  playstyleTags: ['escalado', 'evolución de habilidades'],
};

export const jinx: LabChampion = {
  id: 'champion:jinx',
  roles: ['BOTTOM'],
  isSignatureChampion: false,
  playstyleTags: ['daño sostenido', 'rango'],
};

export const ezreal: LabChampion = {
  id: 'champion:ezreal',
  roles: ['BOTTOM'],
  isSignatureChampion: false,
  playstyleTags: ['poke', 'movilidad'],
};

/** Los campeones ADC curados — los mismos 4 de siempre, ahora sin duplicar datos del catálogo. */
export const adcLabChampions: LabChampion[] = [lucian, kaisa, jinx, ezreal];
