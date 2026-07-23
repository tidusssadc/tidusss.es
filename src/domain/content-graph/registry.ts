import { goals } from '../../config/goals';
import { platforms } from '../../config/platforms';
import type {
  ContentConnection,
  ContentEntity,
  ContentEntityId,
  ContentGraph,
  ContentRelation,
} from './types';

const coreEntities: ContentEntity[] = [
  {
    id: 'creator-project:tidusss',
    kind: 'creator-project',
    title: 'Tidusss',
    description: 'La portada y el punto de entrada al ecosistema.',
    href: '/',
    source: 'editorial',
    status: 'available',
  },
  {
    id: 'creator-project:live',
    kind: 'creator-project',
    title: 'Centro de actividad',
    description: 'Partidas, rango, objetivos y actividad reciente.',
    href: '/live/',
    source: 'editorial',
    status: 'available',
  },
  {
    id: 'library:videos',
    kind: 'library',
    title: 'Vídeos y análisis',
    description: 'Las partidas revisadas y convertidas en contenido.',
    href: '/#canales',
    source: 'youtube',
    status: 'available',
  },
  {
    id: 'channel:youtube',
    kind: 'channel',
    title: 'Canal de YouTube',
    description: 'Gameplays, análisis y decisiones explicadas.',
    href: platforms.youtube.url,
    external: true,
    source: 'youtube',
    status: 'available',
  },
  {
    id: 'channel:twitch',
    kind: 'channel',
    title: 'Directos en Twitch',
    description: 'SoloQ y decisiones en tiempo real.',
    href: platforms.twitch.url,
    external: true,
    source: 'twitch',
    status: 'available',
  },
  {
    id: 'champion:lucian',
    kind: 'champion',
    title: 'Lucian',
    description: 'Especialidad competitiva actual de Tidusss.',
    source: 'editorial',
    status: 'available',
  },
  {
    id: 'achievement:master-euw',
    kind: 'achievement',
    title: 'Master EUW',
    description: 'Credencial competitiva verificada mediante Riot.',
    href: '/live/#competitivo',
    source: 'riot',
    status: 'available',
  },
  ...goals.map<ContentEntity>((goal) => ({
    id: `goal:${goal.id}`,
    kind: 'goal',
    title: goal.label,
    description: goal.description,
    href: '/live/#objetivos',
    source: goal.source === 'riot' ? 'riot' : 'editorial',
    status: goal.status === 'active' ? 'available' : 'planned',
  })),
];

const relations: ContentRelation[] = [
  {
    from: 'creator-project:tidusss',
    to: 'creator-project:live',
    kind: 'continues-with',
    label: 'Explorar el centro de actividad',
    context: 'La evolución competitiva continúa después de la portada.',
    priority: 100,
    source: 'editorial',
  },
  {
    from: 'creator-project:tidusss',
    to: 'library:videos',
    kind: 'features',
    label: 'Ver vídeos y análisis',
    context: 'Partidas reales convertidas en contenido útil.',
    priority: 90,
    source: 'editorial',
  },
  {
    from: 'creator-project:tidusss',
    to: 'champion:lucian',
    kind: 'specializes-in',
    label: 'Especialidad actual',
    priority: 70,
    source: 'editorial',
  },
  {
    from: 'creator-project:live',
    to: 'library:videos',
    kind: 'continues-with',
    label: 'Entender las partidas',
    context: 'Vuelve al contenido para ver cómo se revisan las decisiones.',
    priority: 100,
    source: 'editorial',
  },
  {
    from: 'creator-project:live',
    to: 'channel:twitch',
    kind: 'related-to',
    label: 'Seguir la próxima sesión',
    context: 'La actividad competitiva empieza en directo.',
    priority: 90,
    source: 'editorial',
  },
  {
    from: 'creator-project:live',
    to: 'channel:youtube',
    kind: 'related-to',
    label: 'Ver el análisis completo',
    context: 'La partida continúa después de jugarla.',
    priority: 80,
    source: 'editorial',
  },
  {
    from: 'creator-project:live',
    to: 'achievement:master-euw',
    kind: 'documents',
    label: 'Consultar la credencial',
    priority: 60,
    source: 'provider',
  },
  ...goals.map<ContentRelation>((goal) => ({
    from: 'creator-project:live',
    to: `goal:${goal.id}`,
    kind: 'tracks',
    label: `Seguir: ${goal.label}`,
    priority: 40 - goal.order,
    source: 'editorial',
  })),
];

export const contentGraph: ContentGraph = {
  entities: coreEntities,
  relations,
};

const entityIndex = new Map(
  contentGraph.entities.map((entity) => [entity.id, entity]),
);

export const getContentEntity = (id: ContentEntityId) => entityIndex.get(id);

export const getContentConnections = (
  from: ContentEntityId,
  options: { limit?: number; navigableOnly?: boolean } = {},
): ContentConnection[] => {
  const { limit, navigableOnly = true } = options;
  const seenTargets = new Set<ContentEntityId>();
  const connections = contentGraph.relations
    .filter((relation) => relation.from === from)
    .sort((a, b) => b.priority - a.priority)
    .flatMap((relation) => {
      const target = entityIndex.get(relation.to);
      if (
        !target ||
        target.status !== 'available' ||
        (navigableOnly && !target.href) ||
        seenTargets.has(target.id)
      )
        return [];
      seenTargets.add(target.id);
      return [{ relation, target }];
    });
  return limit === undefined ? connections : connections.slice(0, limit);
};

export const getPrimaryConnection = (from: ContentEntityId) =>
  getContentConnections(from, { limit: 1 })[0];
