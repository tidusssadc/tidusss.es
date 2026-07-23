export type ReferenceCategory = 'tidusss' | 'league' | 'final-fantasy-x';

export type MomentType =
  | 'greeting-morning'
  | 'greeting-afternoon'
  | 'greeting-evening'
  | 'logo-hold'
  | 'twitch-live'
  | 'match-victory'
  | 'match-defeat'
  | 'scroll-final'
  | 'typed-tidus'
  | 'konami'
  | 'returning-visitor'
  | 'new-record';

export type ReferenceRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface BrandReference {
  id: string;
  category: ReferenceCategory;
  type: MomentType;
  text: string;
  rarity: ReferenceRarity;
  condition: string;
  priority: number;
  language: 'es' | 'en';
}

export const brandReferences: BrandReference[] = [
  {
    id: 'morning-next-decision',
    category: 'tidusss',
    type: 'greeting-morning',
    text: 'Buenos días. La siguiente decisión empieza aquí.',
    rarity: 'common',
    condition: 'hour:5-12',
    priority: 10,
    language: 'es',
  },
  {
    id: 'afternoon-review',
    category: 'tidusss',
    type: 'greeting-afternoon',
    text: 'Buenas tardes. Siempre queda algo por revisar.',
    rarity: 'common',
    condition: 'hour:12-20',
    priority: 10,
    language: 'es',
  },
  {
    id: 'evening-one-more',
    category: 'tidusss',
    type: 'greeting-evening',
    text: 'Buenas noches. Una partida más, una idea más.',
    rarity: 'common',
    condition: 'hour:20-5',
    priority: 10,
    language: 'es',
  },
  {
    id: 'logo-process',
    category: 'tidusss',
    type: 'logo-hold',
    text: 'Detrás del nombre hay años de partidas, decisiones y contenido.',
    rarity: 'common',
    condition: 'brand:hover-hold',
    priority: 10,
    language: 'es',
  },
  {
    id: 'logo-consistency',
    category: 'tidusss',
    type: 'logo-hold',
    text: 'La identidad también se construye partida a partida.',
    rarity: 'rare',
    condition: 'brand:hover-hold',
    priority: 8,
    language: 'es',
  },
  {
    id: 'live-now',
    category: 'tidusss',
    type: 'twitch-live',
    text: 'La partida está ocurriendo ahora.',
    rarity: 'common',
    condition: 'twitch:online',
    priority: 20,
    language: 'es',
  },
  {
    id: 'victory-decisions',
    category: 'tidusss',
    type: 'match-victory',
    text: 'Las decisiones marcaron la diferencia.',
    rarity: 'common',
    condition: 'match:victory:hover',
    priority: 10,
    language: 'es',
  },
  {
    id: 'victory-gg',
    category: 'league',
    type: 'match-victory',
    text: 'GG.',
    rarity: 'rare',
    condition: 'match:victory:hover',
    priority: 6,
    language: 'es',
  },
  {
    id: 'defeat-learn',
    category: 'tidusss',
    type: 'match-defeat',
    text: 'También se aprende aquí.',
    rarity: 'common',
    condition: 'match:defeat:hover',
    priority: 10,
    language: 'es',
  },
  {
    id: 'defeat-next',
    category: 'tidusss',
    type: 'match-defeat',
    text: 'No siempre se gana. La siguiente decisión sigue contando.',
    rarity: 'rare',
    condition: 'match:defeat:hover',
    priority: 8,
    language: 'es',
  },
  {
    id: 'end-thanks',
    category: 'tidusss',
    type: 'scroll-final',
    text: 'Gracias por llegar hasta aquí.',
    rarity: 'common',
    condition: 'page:end-dwell',
    priority: 10,
    language: 'es',
  },
  {
    id: 'tidus-story',
    category: 'final-fantasy-x',
    type: 'typed-tidus',
    text: 'The dream has ended. But the story continues.',
    rarity: 'legendary',
    condition: 'keyboard:tidus',
    priority: 100,
    language: 'en',
  },
  {
    id: 'lucian-mode',
    category: 'league',
    type: 'konami',
    text: 'Lucian Mode. Coming soon.',
    rarity: 'legendary',
    condition: 'keyboard:konami',
    priority: 100,
    language: 'en',
  },
  {
    id: 'visitor-home',
    category: 'tidusss',
    type: 'returning-visitor',
    text: 'Ya eres de la casa.',
    rarity: 'epic',
    condition: 'visits:25',
    priority: 50,
    language: 'es',
  },
  {
    id: 'new-record-next',
    category: 'tidusss',
    type: 'new-record',
    text: 'Nuevo máximo registrado. El siguiente objetivo ya está en marcha.',
    rarity: 'epic',
    condition: 'home-state:new-record',
    priority: 50,
    language: 'es',
  },
] as const;
