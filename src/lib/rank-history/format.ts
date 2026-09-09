/**
 * Formato de etiqueta legible para un tier/rank real de Riot ("DIAMOND"/"I"
 * -> "Diamond I", "MASTER"/undefined -> "Master"). Puramente cosmético —
 * nunca decide nada, nunca inventa un tier/rank que no venga de Riot.
 */
const titleCase = (value: string): string =>
  value.length === 0 ? value : value[0]!.toUpperCase() + value.slice(1).toLowerCase();

export const formatRankLabel = (tier?: string, rank?: string): string => {
  if (!tier) return 'Sin clasificar';
  const tierLabel = titleCase(tier);
  const isApex = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier.toUpperCase());
  if (isApex || !rank) return tierLabel;
  return `${tierLabel} ${rank.toUpperCase()}`;
};
