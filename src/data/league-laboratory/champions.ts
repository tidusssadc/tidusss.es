import type { LabChampion } from '../../domain/league-laboratory';

export const lucian: LabChampion = {
  id: 'champion:lucian',
  slug: 'lucian',
  name: 'Lucian',
  roles: ['BOTTOM'],
  signatureRole: 'BOTTOM',
  isSignatureChampion: true,
  playstyleTags: ['agresivo', 'combos', 'movilidad'],
  signatureNote: 'Especialidad competitiva actual de Tidusss.',
  dataDragonKey: 'Lucian',
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
      'Ventana de daño explosiva con el combo pasivo',
      'Movilidad para reposicionarse dentro de la pelea',
      'Presión de línea alta cuando el trade se ejecuta bien',
    ],
    weaknesses: [
      'Los objetos y las runas exigen precisión de ejecución',
      'Vulnerable si pierde la ventana de daño inicial',
    ],
    commonMistakes: [
      'Buscar el combo pasivo fuera de rango en vez de esperar la ventana correcta.',
      'Usar Culebrina para posicionarse sin haber comprobado antes el daño disponible.',
    ],
    powerSpikes: [
      'Nivel 2, en cuanto tiene el combo básico disponible.',
      'Al completar el primer objeto de daño, cuando el trade en línea empieza a doler de verdad.',
    ],
    difficulty: 'medium',
  },
};

export const kaisa: LabChampion = {
  id: 'champion:kaisa',
  slug: 'kaisa',
  name: "Kai'Sa",
  roles: ['BOTTOM'],
  isSignatureChampion: false,
  playstyleTags: ['escalado', 'evolución de habilidades'],
  dataDragonKey: 'Kaisa',
};

export const jinx: LabChampion = {
  id: 'champion:jinx',
  slug: 'jinx',
  name: 'Jinx',
  roles: ['BOTTOM'],
  isSignatureChampion: false,
  playstyleTags: ['daño sostenido', 'rango'],
  dataDragonKey: 'Jinx',
};

export const ezreal: LabChampion = {
  id: 'champion:ezreal',
  slug: 'ezreal',
  name: 'Ezreal',
  roles: ['BOTTOM'],
  isSignatureChampion: false,
  playstyleTags: ['poke', 'movilidad'],
  dataDragonKey: 'Ezreal',
};

export const adcTierListChampions: LabChampion[] = [lucian, kaisa, jinx, ezreal];
