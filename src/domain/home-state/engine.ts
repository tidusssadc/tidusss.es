import { getContentEntity } from '../content-graph';
import { subscribeHomeSignals } from './signals';
import type {
  HomeGoalSignal,
  HomeSignal,
  HomeState,
  HomeStateDefinition,
} from './types';

const signal = (signals: readonly HomeSignal[], type: HomeSignal['type']) =>
  signals.find((candidate) => candidate.type === type);

const recentVideo = (publishedAt: string) => {
  const published = Date.parse(publishedAt);
  return (
    Number.isFinite(published) &&
    Date.now() - published >= 0 &&
    Date.now() - published <= 7 * 24 * 60 * 60 * 1000
  );
};

const closestGoal = (signals: readonly HomeSignal[]) => {
  const goals = signals.flatMap((candidate) =>
    'goals' in candidate ? candidate.goals : [],
  );
  return goals
    .filter(({ progress }) => progress >= 80 && progress < 100)
    .sort((a, b) => b.progress - a.progress)[0];
};

const goalCopy = ({ current, target, label }: HomeGoalSignal) =>
  `${new Intl.NumberFormat('es-ES').format(current)} de ${new Intl.NumberFormat(
    'es-ES',
  ).format(target)} ${label}.`;

const futureState = (
  event: 'new-patch' | 'new-record' | 'goal-achieved' | 'milestone',
  priority: number,
): HomeStateDefinition => ({
  id: event,
  priority,
  status: 'prepared',
  evaluate(signals) {
    const future = signal(signals, 'future-event');
    if (future?.type !== 'future-event' || future.event !== event) return null;
    return {
      id: event,
      priority,
      target: event === 'new-patch' ? 'patch' : 'competitive',
      label: future.label,
      text: future.text,
      action: {
        label: 'Seguir explorando',
        entityId: future.entity?.id,
        href: future.entity?.href,
        external: future.entity?.external,
      },
    };
  },
});

export const homeStateDefinitions: readonly HomeStateDefinition[] = [
  {
    id: 'live',
    priority: 100,
    status: 'active',
    evaluate(signals) {
      const twitch = signal(signals, 'twitch');
      if (twitch?.type !== 'twitch' || twitch.state !== 'online') return null;
      return {
        id: 'live',
        priority: 100,
        target: 'twitch',
        label: 'Ahora en directo',
        text: 'La partida está ocurriendo en Twitch.',
        action: {
          label: 'Entrar al directo',
          entityId: 'channel:twitch',
        },
      };
    },
  },
  {
    id: 'new-video',
    priority: 80,
    status: 'active',
    evaluate(signals) {
      const video = signal(signals, 'latest-video');
      if (video?.type !== 'latest-video' || !recentVideo(video.publishedAt))
        return null;
      return {
        id: 'new-video',
        priority: 80,
        target: 'youtube',
        label: 'Nuevo vídeo',
        text: video.entity.title,
        action: {
          label: 'Ver el último análisis',
          entityId: video.entity.id,
          href: video.entity.href,
          external: true,
        },
      };
    },
  },
  {
    id: 'near-goal',
    priority: 60,
    status: 'active',
    evaluate(signals) {
      const goal = closestGoal(signals);
      if (!goal) return null;
      return {
        id: 'near-goal',
        priority: 60,
        target: goal.id === 'goal:soloqueue-700' ? 'competitive' : 'youtube',
        label: 'Siguiente objetivo',
        text: goalCopy(goal),
        action: {
          label: 'Seguir el progreso',
          entityId: goal.id,
        },
      };
    },
  },
  futureState('new-record', 90),
  futureState('goal-achieved', 90),
  futureState('new-patch', 70),
  futureState('milestone', 65),
  {
    id: 'default',
    priority: 20,
    status: 'active',
    evaluate() {
      const hour = new Date().getHours();
      const text =
        hour >= 6 && hour < 13
          ? 'Buenos días. Hoy toca seguir mejorando.'
          : hour >= 20 || hour < 2
            ? 'Buenas noches. Todavía queda una decisión más.'
            : 'Preparando la siguiente partida y el próximo análisis.';
      return {
        id: 'default',
        priority: 20,
        target: 'competitive',
        label: 'Hoy en Tidusss',
        text,
        action: {
          label: 'Ver la actividad',
          entityId: 'achievement:master-euw',
        },
      };
    },
  },
];

export const resolveHomeState = (signals: readonly HomeSignal[]) =>
  homeStateDefinitions
    .map((definition) => definition.evaluate(signals))
    .filter((state): state is HomeState => state !== null)
    .sort((a, b) => b.priority - a.priority)[0];

const resolveAction = (state: HomeState): HomeState => {
  if (state.action.href || !state.action.entityId) return state;
  const entity = getContentEntity(state.action.entityId);
  return {
    ...state,
    action: {
      ...state.action,
      href: entity?.href,
      external: entity?.external,
    },
  };
};

export const startHomeStateEngine = (onState: (state: HomeState) => void) => {
  let currentId: string | undefined;
  return subscribeHomeSignals((signals) => {
    const next = resolveHomeState(signals);
    if (!next) return;
    const resolved = resolveAction(next);
    onState(resolved);
    if (currentId !== resolved.id) {
      currentId = resolved.id;
      window.dispatchEvent(
        new CustomEvent('tidusss:home-state-changed', {
          detail: resolved,
        }),
      );
    }
  });
};
