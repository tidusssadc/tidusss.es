import type {
  LabChampionId,
  MetaState,
  ReviewedTierListEntry,
  TierGrade,
  TierList,
  TierListEntry,
} from '../../domain/league-laboratory';
import { patch2616, patch2617 } from './patches';

/**
 * Un pequeño helper local, no un sistema nuevo: cada entrada de la Tier
 * List real de Tidusss, tal y como la explicó en su vídeo de la edición
 * 26.16 (vigente sin cambios en 26.17 — ver `officialAdcTierList` más
 * abajo). Todo lo que aparece aquí procede directamente de su valoración;
 * nada se ha inventado ni derivado de estadísticas externas.
 */
const entry = (
  championId: LabChampionId,
  tier: TierGrade,
  data: Omit<ReviewedTierListEntry, 'championId' | 'reviewStatus' | 'tier'>,
): TierListEntry => ({
  championId,
  reviewStatus: 'reviewed',
  tier,
  ...data,
});

const lastReviewedPatch = patch2617.id;

export const officialAdcTierListEntries: TierListEntry[] = [
  // --- S · el núcleo superior del meta, según Tidusss ---
  entry('champion:zeri', 'S', {
    editorialTake: {
      verdict:
        'Uno de los ADC que más se beneficia del meta actual. Escala de maravilla y con Yuntal se vuelve una locura de rápida.',
      reasoning:
        'El ecosistema de velocidad de ataque de este parche le sienta especialmente bien: mucha movilidad, mucho escalado y capacidad de convertir cualquier ventaja en snowball. Para mí es top del meta ahora mismo.',
      confidence: 'high',
      lastReviewedPatch,
    },
  }),
  entry('champion:jinx', 'S', {
    editorialTake: {
      verdict:
        'Hipercarry claro de este parche. La velocidad de ataque y Yuntal la potencian muchísimo.',
      reasoning:
        'Tiene menos movilidad que otros hipercarries como Zeri, así que es más fácil de castigar en línea si te adelantas. Pero cuando consigue objetos, el daño sostenido y los resets son brutales.',
      confidence: 'high',
      lastReviewedPatch,
    },
    strengths: [
      'Daño sostenido enorme con velocidad de ataque',
      'Gran potencial de reset en peleas',
    ],
    weaknesses: [
      'Poca movilidad',
      'Más castigable en línea que otros hipercarries',
    ],
  }),
  entry('champion:tristana', 'S', {
    editorialTake: {
      verdict:
        'Muy fuerte. A diferencia de otros hipercarries, puede empezar a crear jugadas agresivas mucho antes.',
      reasoning:
        'No tiene que esperar tanto para ser relevante: puede buscar jugadas desde pronto y luego seguir escalando con sus resets, así que combina lo mejor de un pick agresivo y de un hipercarry.',
      confidence: 'high',
      lastReviewedPatch,
    },
  }),
  entry('champion:ashe', 'S', {
    editorialTake: {
      verdict: 'La considero de las mejores opciones del meta ahora mismo.',
      reasoning:
        'No depende obligatoriamente de Yuntal como otros hipercarries, pero igualmente aprovecha muy bien el ecosistema actual de velocidad de ataque. Para mí está entre los mejores picks de ADC este parche.',
      confidence: 'high',
      lastReviewedPatch,
    },
  }),

  // --- A · fuertes, un peldaño por debajo del núcleo superior ---
  entry('champion:caitlyn', 'A', {
    editorialTake: {
      verdict:
        'Confirmada en la Tier List de Tidusss para este parche, en tier A.',
      reasoning:
        'Su posición se ha verificado directamente contra la grabación original del vídeo — Tidusss todavía no ha detallado en el canal por qué la valora así, así que este veredicto se limita a la clasificación confirmada, sin inventar un razonamiento que no ha dado.',
      confidence: 'low',
      lastReviewedPatch,
    },
  }),
  entry('champion:kaisa', 'A', {
    editorialTake: {
      verdict: 'Sigue siendo una opción sólida.',
      reasoning:
        'Tiene muy buen escalado y mucha flexibilidad de build — puedes ir AD o AP según cómo venga la partida. Se la puede castigar en línea, y ahora mismo no la veo tanto como en otros metas, pero sigue siendo una opción fiable.',
      confidence: 'high',
      lastReviewedPatch,
    },
  }),
  entry('champion:lucian', 'A', {
    editorialTake: {
      verdict:
        'Uno de mis campeones favoritos, y sí, mi valoración tiene un punto personal que prefiero reconocer directamente.',
      reasoning:
        'El meta actual no le favorece especialmente frente a los hipercarries que aprovechan mejor Yuntal. Aun así, con un dúo agresivo y una línea donde pueda generar ventaja sigue teniendo muchísimo potencial de snowball. Lo mantengo alto, pero no lo voy a vender como uno de los mejores ADC absolutos de este parche.',
      confidence: 'medium',
      lastReviewedPatch,
    },
    idealIf: 'Puedes jugar una botlane agresiva y generar ventaja desde línea.',
    watchFor:
      'Partidas donde los hipercarries del meta puedan escalar sin que nadie los castigue.',
  }),
  entry('champion:sivir', 'A', {
    editorialTake: {
      verdict: 'La considero una ADC fuerte ahora mismo.',
      reasoning:
        'Yuntal le sienta muy bien, y sus rebotes aprovechan de maravilla el ecosistema actual de velocidad de ataque.',
      confidence: 'high',
      lastReviewedPatch,
    },
  }),
  entry('champion:corki', 'A', {
    editorialTake: {
      verdict: 'Sigue pareciéndome bastante fuerte.',
      reasoning:
        'Con objetos hace muchísimo daño. Para mí sigue siendo una opción sólida este parche.',
      confidence: 'high',
      lastReviewedPatch,
    },
  }),

  // --- B · jugables y decentes, sin estar en el grupo superior ---
  entry('champion:yunara', 'B', {
    editorialTake: {
      verdict:
        'Escala bien y puede pegar muchísimo más adelante, pero personalmente no me convence tanto como otros hipercarries que tengo disponibles.',
      reasoning: 'No la considero de las mejores opciones del meta actual.',
      confidence: 'medium',
      lastReviewedPatch,
    },
  }),
  entry('champion:kalista', 'B', {
    editorialTake: {
      verdict:
        'Bastante decente, aunque no forma parte del grupo superior del meta para mí.',
      reasoning: 'Puede volverse muy potente cuando consigue varios objetos.',
      confidence: 'medium',
      lastReviewedPatch,
    },
  }),
  entry('champion:varus', 'B', {
    editorialTake: {
      verdict:
        'Bastante fuerte y decente. No la metería necesariamente en Tier A.',
      reasoning: 'Es una buena opción general este parche, sin más.',
      confidence: 'high',
      lastReviewedPatch,
    },
  }),
  entry('champion:jhin', 'B', {
    editorialTake: {
      verdict:
        'Está bastante fuerte y puede hacer muchísimo daño, pero tampoco lo meto en el grupo superior del meta.',
      reasoning:
        'Es un pick sólido, simplemente no de los que más domina este parche.',
      confidence: 'medium',
      lastReviewedPatch,
    },
  }),
  entry('champion:twitch', 'B', {
    editorialTake: {
      verdict: 'Lo considero decente, no top.',
      reasoning:
        'Tiene escalado y Yuntal puede favorecerle, pero su fase de líneas, la falta de movilidad y lo vulnerable que es limitan mucho el pick.',
      confidence: 'high',
      lastReviewedPatch,
    },
    weaknesses: [
      'Fase de líneas débil',
      'Poca movilidad',
      'Muy vulnerable si lo cogen',
    ],
  }),
  entry('champion:draven', 'B', {
    editorialTake: {
      verdict: 'Jugable y decente, pero no top para mí.',
      reasoning:
        'Con objetos puede ser una auténtica locura de daño. El problema es que también es fácil de castigar.',
      confidence: 'high',
      lastReviewedPatch,
    },
  }),
  entry('champion:kog-maw', 'B', {
    editorialTake: {
      verdict: 'En SoloQ general prefiero otros hipercarries.',
      reasoning:
        'Los objetos de velocidad de ataque pueden favorecerle, pero sigue teniendo problemas claros de movilidad. Con una composición pensada para jugar a su alrededor puede ser muy fuerte, pero eso no es lo habitual en solo/duo.',
      confidence: 'medium',
      lastReviewedPatch,
    },
    weaknesses: ['Problemas claros de movilidad'],
  }),
  entry('champion:samira', 'B', {
    editorialTake: {
      verdict:
        'No está mal, es jugable, pero ahora mismo no destaca especialmente.',
      reasoning: 'No la veo entre las opciones que más definen este meta.',
      confidence: 'medium',
      lastReviewedPatch,
    },
  }),
  entry('champion:aphelios', 'B', {
    editorialTake: {
      verdict:
        'Puede hacer auténticas barbaridades cuando consigue varios objetos y una buena definitiva. Aun así, no lo recomendaría ahora mismo.',
      reasoning:
        'El techo es altísimo, pero llegar hasta ahí es demasiado exigente para lo que pide el meta actual.',
      confidence: 'medium',
      lastReviewedPatch,
    },
  }),

  // --- C · su potencial no compensa lo que pide el meta actual ---
  entry('champion:miss-fortune', 'C', {
    editorialTake: {
      verdict:
        'Jugable, y capaz de snowballear muchísimo si la partida se pone de su lado.',
      reasoning:
        'Puede funcionar especialmente bien con determinadas sinergias de engage. Pero el meta actual no es el que más le favorece, y no la considero de las mejores opciones ahora mismo.',
      confidence: 'medium',
      lastReviewedPatch,
    },
  }),
  entry('champion:vayne', 'C', {
    editorialTake: {
      verdict: 'No la recomendaría ahora mismo.',
      reasoning:
        'Su fase de líneas es demasiado castigable y necesita demasiado tiempo y objetos para empezar a hacer magia. La veo más justificable en otros contextos que como ADC general de SoloQ.',
      confidence: 'high',
      lastReviewedPatch,
    },
  }),
  entry('champion:ezreal', 'C', {
    editorialTake: {
      verdict: 'Uno de mis favoritos, pero el meta actual no le favorece.',
      reasoning:
        'Los objetos que se llevan ahora mismo no le benefician especialmente. Un especialista puede sacarle muchísimo rendimiento, pero eso no significa que el campeón esté fuerte — cuando juego contra un Ezreal ahora mismo no suele ser algo que me preocupe especialmente desde línea.',
      confidence: 'high',
      lastReviewedPatch,
    },
  }),

  // --- D · no las recomienda ahora mismo ---
  entry('champion:smolder', 'D', {
    editorialTake: {
      verdict:
        'Lo considero una opción muy débil actualmente. No lo recomendaría.',
      reasoning:
        'Puede escalar y tiene herramientas para facilitarlo, pero ahora mismo no lo veo como un pick que valga la pena en SoloQ.',
      confidence: 'high',
      lastReviewedPatch,
    },
  }),
  entry('champion:senna', 'D', {
    editorialTake: {
      verdict: 'La considero muy débil actualmente como ADC. No la recomiendo.',
      reasoning: 'No cumple lo que necesito de un ADC en este meta.',
      confidence: 'high',
      lastReviewedPatch,
    },
  }),

  // --- Counter · su valor depende del matchup, no de la escalera general ---
  entry('champion:xayah', 'A', {
    editorialTake: {
      verdict: 'Muy fuerte actualmente. Yuntal le sienta genial.',
      reasoning:
        'Con Rakan al lado puede ser especialmente potente. Se puede jugar a ciegas sin problema, aunque no la considero necesariamente el mejor blind pick que hay.',
      confidence: 'high',
      lastReviewedPatch,
    },
    pickType: 'counter',
  }),
  entry('champion:nilah', 'A', {
    editorialTake: {
      verdict:
        'Muy potente como counter, especialmente contra botlanes o composiciones con melee.',
      reasoning:
        'Cuando las condiciones son las adecuadas es muy fuerte, pero es demasiado situacional como para tratarla como un pick general.',
      confidence: 'high',
      lastReviewedPatch,
    },
    idealIf: 'Vas contra una botlane o composición con mucho melee.',
    pickType: 'counter',
  }),
];

/**
 * ¿Qué está definiendo el meta? — la lectura de Tidusss, no una nota
 * técnica de parche. Usa la entidad `MetaState` ya modelada en el dominio
 * en vez de inventar un campo nuevo solo para esta página.
 */
export const adcMetaState2617: MetaState = {
  id: 'meta-state:adc-26-17',
  patchId: patch2617.id,
  summary:
    'Lo que más está marcando este parche para mí es la fuerza del ecosistema de velocidad de ataque y, sobre todo, de Yuntal. Favorece mucho a los ADC que escalan bien, aprovechan la velocidad de ataque y pueden incorporar Yuntal con eficacia — por eso varios hipercarries están tan arriba en esta Tier List.',
  risingChampionIds: [
    'champion:zeri',
    'champion:jinx',
    'champion:tristana',
    'champion:ashe',
    'champion:sivir',
  ],
};

/**
 * "¿Y los magos en bot?" — una nota secundaria del mismo vídeo, deliberadamente
 * pequeña: el producto principal de esta página sigue siendo la Tier List
 * ADC. Solo se nombran los dos campeones que el propio Tidusss confirma con
 * seguridad — la transcripción automática del vídeo contiene errores en
 * otros nombres que no se pueden verificar contra el catálogo real, así que
 * no se listan.
 */
export const adcSecondaryMageNote = {
  title: '¿Y los magos en bot?',
  body: 'Ahora mismo muchos magos son extremadamente fuertes jugados en bot en SoloQ. Entre los que considero especialmente potentes están Seraphine, Vel\'Koz y otras opciones AP del mismo estilo.',
  championIds: ['champion:seraphine', 'champion:velkoz'] as LabChampionId[],
};

export const officialAdcTierList: TierList = {
  id: 'tier-list:official-adc',
  title: 'Tier List Oficial ADC · Tidusss',
  patchId: patch2617.id,
  basedOnPatchId: patch2616.id,
  role: 'BOTTOM',
  queue: 'solo-duo',
  methodologyNote:
    'Esta clasificación refleja el criterio personal de Tidusss como jugador Master ADC en EUW, grabada originalmente durante el parche 26.16 y vigente sin cambios en el 26.17: prioriza lo que funciona en su propia experiencia de Solo Queue, no un promedio estadístico de win rate.',
  status: 'published',
  publishedAt: '2026-07-24',
  video: {
    title:
      '🏆 La TIER LIST de ADCs que jugaría para SUBIR ELO en el parche 26.17',
    url: 'https://youtu.be/TeFT1Gpe4dM',
  },
  entries: officialAdcTierListEntries,
};

/**
 * Preparado para el histórico por parche (§17 del encargo): un array, no
 * una constante suelta. Hoy solo tiene una edición publicada — cuando
 * exista una segunda con cambios reales, se añade aquí y
 * `getCurrentTierList` empieza a devolverla automáticamente por tener el
 * `Patch.sequence` más alto, sin selector ni ruta nueva.
 */
export const adcTierListEditions: TierList[] = [officialAdcTierList];
