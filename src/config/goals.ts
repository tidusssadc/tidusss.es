export const subscriberGoals = [
  2500, 3000, 5000, 10000, 25000, 50000, 100000,
] as const;

export type GoalSource = 'youtube' | 'youtube-videos' | 'riot' | 'manual';
export type GoalMode = 'automatic' | 'manual' | 'long-term';

export interface GoalDefinition {
  id: string;
  label: string;
  source: GoalSource;
  target?: number;
  unit: string;
  mode: GoalMode;
  status: 'active' | 'future';
  description?: string;
  manualValue?: number;
  order: number;
}

const goalDefinitions: GoalDefinition[] = [
  {
    id: 'youtube-next',
    label: 'Próximo hito del canal',
    source: 'youtube',
    unit: 'suscriptores',
    mode: 'automatic',
    status: 'active',
    description: 'Se ajusta automáticamente al siguiente hito.',
    order: 1,
  },
  {
    id: 'soloqueue-700',
    label: '700 LP',
    source: 'riot',
    target: 700,
    unit: 'LP',
    mode: 'automatic',
    status: 'active',
    order: 2,
  },
  {
    id: 'videos-300',
    label: '300 vídeos publicados',
    source: 'youtube-videos',
    target: 300,
    unit: 'vídeos',
    mode: 'automatic',
    status: 'active',
    order: 3,
  },
  {
    id: 'twitch-partner',
    label: 'Partner de Twitch',
    source: 'manual',
    unit: '',
    mode: 'long-term',
    status: 'future',
    description: 'Objetivo a largo plazo',
    order: 4,
  },
];

export const goals = goalDefinitions.sort((a, b) => a.order - b.order);

export const nextSubscriberGoal = (value?: number) =>
  value === undefined || value < 0
    ? undefined
    : subscriberGoals.find((goal) => goal > value);

export const goalProgress = (current?: number, target?: number) =>
  current === undefined || target === undefined || target <= 0
    ? undefined
    : Number(Math.min(100, (current / target) * 100).toFixed(1));
