import type { ContentEntity, ContentEntityId } from '../content-graph/types';

export type HomeStateId =
  | 'live'
  | 'new-video'
  | 'near-goal'
  | 'latest-update'
  | 'default'
  | 'new-patch'
  | 'new-record'
  | 'goal-achieved'
  | 'milestone';

export type HomePriorityTarget =
  | 'twitch'
  | 'youtube'
  | 'competitive'
  | 'patch'
  | 'editorial';

export interface HomeGoalSignal {
  id: ContentEntityId;
  label: string;
  current: number;
  target: number;
  progress: number;
}

export type HomeSignal =
  | {
      type: 'twitch';
      state: 'online' | 'offline' | 'not-configured';
      title?: string;
      category?: string;
      viewerCount?: number;
    }
  | {
      type: 'latest-video';
      entity: ContentEntity;
      publishedAt: string;
    }
  | {
      type: 'youtube-progress';
      goals: HomeGoalSignal[];
    }
  | {
      type: 'competitive';
      rank?: string;
      leaguePoints?: number;
      goals: HomeGoalSignal[];
    }
  | {
      type: 'future-event';
      event: 'new-patch' | 'new-record' | 'goal-achieved' | 'milestone';
      label: string;
      text: string;
      entity?: ContentEntity;
    }
  | {
      /** El cambio editorial real más reciente (guía, build, Tier List...) —
       * el suelo por defecto de "Hoy en Tidusss" cuando no hay nada más
       * urgente (directo, vídeo nuevo, objetivo cerca) que mostrar. */
      type: 'editorial-update';
      title: string;
      text: string;
      href: string;
    };

export interface HomeStateAction {
  label: string;
  entityId?: ContentEntityId;
  href?: string;
  external?: boolean;
}

export interface HomeState {
  id: HomeStateId;
  priority: number;
  target: HomePriorityTarget;
  label: string;
  text: string;
  action: HomeStateAction;
}

export interface HomeStateDefinition {
  id: HomeStateId;
  priority: number;
  status: 'active' | 'prepared';
  evaluate(signals: readonly HomeSignal[]): HomeState | null;
}
