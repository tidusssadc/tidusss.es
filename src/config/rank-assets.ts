export interface RankAsset {
  src: string;
  width: number;
  height: number;
}

export const rankAssets: Partial<Record<string, RankAsset>> = {
  MASTER: {
    src: '/images/brand/ranks/master-emblem.webp',
    width: 640,
    height: 512,
  },
};

export const rankAssetFor = (tier?: string) =>
  tier ? rankAssets[tier.toUpperCase()] : undefined;
