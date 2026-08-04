import { getContentEntity } from '../content-graph';
import { selectPrimaryGoal } from '../goals';
import type { ResolvedGoal } from '../goals/types';
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

/**
 * Mismo algoritmo determinista que decide el objetivo principal en
 * Comunidad (`domain/goals/resolve.ts`) — nunca un segundo criterio ad
 * hoc solo para Home. Cada `HomeGoalSignal` publicado ya es un objetivo
 * `active` real (los publicadores nunca emiten uno ya completado aquí:
 * eso es un hito, no "sigue el progreso"), así que basta con adaptarlo a
 * la forma `ResolvedGoal` que espera `selectPrimaryGoal`.
 */
const closestGoal = (signals: readonly HomeSignal[]): HomeGoalSignal | undefined => {
  // Este estado narrativo concreto ("casi lo consigues") solo tiene sentido
  // cuando el objetivo elegido está realmente cerca — el umbral no decide
  // CUÁL mostrar (eso lo hace `selectPrimaryGoal`), solo SI hay alguno lo
  // bastante próximo como para merecer protagonismo en Home.
  const NEAR_COMPLETION_THRESHOLD = 80;
  const goals = signals
    .flatMap((candidate) => ('goals' in candidate ? candidate.goals : []))
    .filter((goal) => goal.progress >= NEAR_COMPLETION_THRESHOLD);
  const resolved: ResolvedGoal[] = goals.map((goal) => ({
    id: goal.id,
    category: goal.category,
    title: goal.label,
    current: goal.current,
    target: goal.target,
    unit: '',
    progress: goal.progress,
    status: 'active',
    source: goal.category === 'competitive-lp' ? 'riot' : goal.category.startsWith('editorial') ? 'editorial' : 'youtube',
    href: goal.href,
  }));
  const primary = selectPrimaryGoal(resolved);
  return primary ? goals.find((goal) => goal.id === primary.id) : undefined;
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
      const details = [
        twitch.category,
        twitch.viewerCount !== undefined
          ? `${new Intl.NumberFormat('es-ES').format(twitch.viewerCount)} espectadores`
          : undefined,
      ]
        .filter(Boolean)
        .join(' · ');
      return {
        id: 'live',
        priority: 100,
        target: 'twitch',
        label: twitch.title ?? 'Ahora en directo',
        text: details || 'La partida está ocurriendo en Twitch, ahora mismo.',
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
        image: video.thumbnailUrl,
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
        target:
          goal.category === 'competitive-lp'
            ? 'competitive'
            : goal.category.startsWith('editorial')
              ? 'editorial'
              : 'youtube',
        label: 'Siguiente objetivo',
        text: goalCopy(goal),
        action: {
          label: 'Seguir el progreso',
          href: goal.href,
        },
      };
    },
  },
  futureState('new-record', 90),
  futureState('goal-achieved', 90),
  futureState('new-patch', 70),
  futureState('milestone', 65),
  {
    id: 'latest-update',
    priority: 30,
    status: 'active',
    evaluate(signals) {
      const update = signal(signals, 'editorial-update');
      if (update?.type !== 'editorial-update') return null;
      return {
        id: 'latest-update',
        priority: 30,
        target: 'editorial',
        label: update.title,
        text: update.text,
        action: { label: 'Ver la actualización', href: update.href },
      };
    },
  },
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
