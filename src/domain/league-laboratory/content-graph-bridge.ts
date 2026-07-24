import type { ContentEntity, ContentRelation } from '../content-graph/types';
import type { Build, Guide, LabChampion, Matchup, Patch, TierList } from './types';

const guideEntityId = (guide: Guide): ContentEntity['id'] =>
  `guide:${guide.id.slice('knowledge-article:'.length)}`;

export const championToContentEntity = (
  champion: LabChampion,
): ContentEntity => ({
  id: champion.id,
  kind: 'champion',
  title: champion.name,
  description: champion.signatureNote,
  source: 'editorial',
  status: 'available',
});

export const patchToContentEntity = (patch: Patch): ContentEntity => ({
  id: patch.id,
  kind: 'patch',
  title: `Parche ${patch.label}`,
  description: patch.editorialSummary,
  source: 'editorial',
  status: 'available',
});

export const buildToContentEntity = (build: Build): ContentEntity => ({
  id: build.id,
  kind: 'build',
  title: build.title,
  description: build.editorialTake.verdict,
  source: 'editorial',
  status: 'available',
});

export const guideToContentEntity = (guide: Guide): ContentEntity => ({
  id: guideEntityId(guide),
  kind: 'guide',
  title: guide.title,
  description: guide.keyTakeaway,
  source: 'editorial',
  status: guide.status === 'published' ? 'available' : 'planned',
});

export const matchupToContentEntity = (
  matchup: Matchup,
  championName: string,
  opponentName: string,
): ContentEntity => ({
  id: matchup.id,
  kind: 'matchup',
  title: `${championName} vs ${opponentName}`,
  description: matchup.editorialTake.verdict,
  source: 'editorial',
  status: 'available',
});

export const tierListToContentEntity = (tierList: TierList): ContentEntity => ({
  id: tierList.id,
  kind: 'tier-list',
  title: tierList.title,
  source: 'editorial',
  status: tierList.status === 'published' ? 'available' : 'planned',
});

export const buildDocumentsChampionRelation = (
  build: Build,
): ContentRelation => ({
  from: buildToContentEntity(build).id,
  to: build.championId,
  kind: 'documents',
  label: `Cómo jugar ${build.championId.slice('champion:'.length)} con esta build`,
  priority: 80,
  source: 'editorial',
});

export const guideDocumentsChampionRelation = (guide: Guide): ContentRelation => ({
  from: guideToContentEntity(guide).id,
  to: guide.scope.championId,
  kind: 'documents',
  label: `Guía: ${guide.title}`,
  priority: 90,
  source: 'editorial',
});

export const tierListFeaturesChampionRelation = (
  tierList: TierList,
  championId: Build['championId'],
  label = 'Ver el perfil completo del campeón',
): ContentRelation => ({
  from: tierListToContentEntity(tierList).id,
  to: championId,
  kind: 'features',
  label,
  priority: 70,
  source: 'editorial',
});

export const tierListTracksPatchRelation = (
  tierList: TierList,
): ContentRelation => ({
  from: tierListToContentEntity(tierList).id,
  to: tierList.patchId,
  kind: 'tracks',
  label: `Parche de referencia`,
  priority: 50,
  source: 'editorial',
});

export const championAppearsInTierListRelation = (
  tierList: TierList,
  championId: Build['championId'],
): ContentRelation => ({
  from: championId,
  to: tierListToContentEntity(tierList).id,
  kind: 'tracks',
  label: 'Ver en la Tier List oficial',
  priority: 65,
  source: 'editorial',
});

export const matchupRelatedToChampionRelation = (
  matchup: Matchup,
  championName: string,
  opponentName: string,
): ContentRelation => ({
  from: matchupToContentEntity(matchup, championName, opponentName).id,
  to: matchup.championId,
  kind: 'related-to',
  label: 'Matchup analizado',
  priority: 60,
  source: 'editorial',
});
