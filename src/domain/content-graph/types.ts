export type ContentEntityKind =
  | 'achievement'
  | 'build'
  | 'champion'
  | 'channel'
  | 'creator-project'
  | 'game'
  | 'goal'
  | 'guide'
  | 'library'
  | 'match'
  | 'matchup'
  | 'moment'
  | 'patch'
  | 'reference'
  | 'tier-list'
  | 'tool'
  | 'video';

export type ContentEntityId = `${ContentEntityKind}:${string}`;

export type ContentRelationKind =
  | 'continues-with'
  | 'documents'
  | 'features'
  | 'played-with'
  | 'published-on'
  | 'related-to'
  | 'specializes-in'
  | 'tracks'
  | 'uses';

export interface ContentEntity {
  id: ContentEntityId;
  kind: ContentEntityKind;
  title: string;
  description?: string;
  href?: string;
  external?: boolean;
  source?: 'editorial' | 'riot' | 'youtube' | 'twitch' | 'manual';
  status: 'available' | 'planned';
}

export interface ContentRelation {
  from: ContentEntityId;
  to: ContentEntityId;
  kind: ContentRelationKind;
  label: string;
  context?: string;
  priority: number;
  source: 'editorial' | 'provider' | 'verified-manual';
}

export interface ContentConnection {
  relation: ContentRelation;
  target: ContentEntity;
}

export interface ContentGraph {
  entities: readonly ContentEntity[];
  relations: readonly ContentRelation[];
}
