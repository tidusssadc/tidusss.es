import type { ContentEntity, ContentEntityId } from '../content-graph/types';

export type HomeStateId =
  | 'live'
  | 'new-video'
  | 'near-goal'
  | 'default'
  | 'new-patch'
  | 'new-record'
  | 'goal-achieved'
  | 'milestone';

export type HomePriorityTarget = 'twitch' | 'youtube' | 'competitive' | 'patch';

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
