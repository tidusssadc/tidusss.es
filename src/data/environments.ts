export type EnvironmentId =
  | 'home'
  | 'live'
  | 'match'
  | 'tier-list'
  | 'champion'
  | 'about'
  | 'youtube'
  | 'twitch';

export type EnvironmentLayer =
  'grid' | 'noise' | 'mist' | 'image' | 'glow' | 'rays' | 'particles';

export interface EnvironmentDefinition {
  id: EnvironmentId;
  label: string;
  layers: readonly EnvironmentLayer[];
  image?: {
    src: string;
    position: string;
    opacity: number;
  };
}

export const environments: Record<EnvironmentId, EnvironmentDefinition> = {
  home: {
    id: 'home',
    label: 'Portada editorial',
    layers: ['noise', 'mist', 'image', 'glow', 'rays', 'particles'],
    image: {
      src: '/images/brand/lucian/lucian-high-noon-standing.webp',
      position: '78% 18%',
      opacity: 0.1,
    },
  },
  live: {
    id: 'live',
    label: 'Centro de control',
    layers: ['grid', 'noise', 'mist', 'glow', 'rays', 'particles'],
  },
  match: {
    id: 'match',
    label: 'Lectura de partida',
    layers: ['grid', 'noise', 'mist', 'image', 'glow'],
  },
  'tier-list': {
    id: 'tier-list',
    label: 'Mesa de análisis',
    layers: ['grid', 'noise', 'mist', 'image', 'glow', 'rays'],
  },
  champion: {
    id: 'champion',
    label: 'Estudio de campeón',
    layers: ['noise', 'mist', 'glow'],
  },
  about: {
    id: 'about',
    label: 'Retrato editorial',
    layers: ['noise', 'mist', 'image', 'glow'],
  },
  youtube: {
    id: 'youtube',
    label: 'Estudio',
    layers: ['grid', 'noise', 'mist', 'glow', 'rays'],
  },
  twitch: {
    id: 'twitch',
    label: 'Emisión',
    layers: ['grid', 'noise', 'mist', 'glow', 'particles'],
  },
};

export function resolveEnvironment(pathname: string): EnvironmentId {
  if (pathname.startsWith('/live')) return 'live';
  if (pathname.startsWith('/match')) return 'match';
  if (pathname.startsWith('/tier-list')) return 'tier-list';
  if (pathname.startsWith('/campeones')) return 'champion';
  if (pathname.startsWith('/about')) return 'about';
  if (pathname.startsWith('/youtube')) return 'youtube';
  if (pathname.startsWith('/twitch')) return 'twitch';
  return 'home';
}
