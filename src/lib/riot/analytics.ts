import { riotDefaults } from '../../config/riot';
import { safePercentage } from './normalize';
import type {
  ChampionPerformance,
  RecentMatch,
  RecentPerformance,
  TodaySoloQueue,
} from './types';
import { isToday, millisecondsSince } from '../time';

const average = (values: number[]) =>
  values.length
    ? Number(
        (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(
          1,
        ),
      )
    : undefined;

export const championPerformance = (
  championName: string,
  matches: RecentMatch[],
): ChampionPerformance | undefined => {
  const championMatches = matches.filter(
    (match) => match.championName.toLowerCase() === championName.toLowerCase(),
  );
  if (!championMatches.length) return undefined;
  const wins = championMatches.filter((match) => match.win).length;
  const games = championMatches.length;
  return {
    championName: championMatches[0]?.championName || championName,
    games,
    wins,
    losses: games - wins,
    winRate: safePercentage(wins, games - wins) ?? 0,
    averageKills: average(championMatches.map((match) => match.kills)) ?? 0,
    averageDeaths: average(championMatches.map((match) => match.deaths)) ?? 0,
    averageAssists: average(championMatches.map((match) => match.assists)) ?? 0,
    averageKda: average(championMatches.map((match) => match.kda)) ?? 0,
    averageCsPerMinute:
      average(championMatches.map((match) => match.csPerMinute)) ?? 0,
  };
};

export const analyzeRecentSoloQueue = (
  allMatches: RecentMatch[],
): RecentPerformance => {
  const matches = allMatches
    .filter(
      (match) => match.queueId === riotDefaults.soloQueueId && !match.remake,
    )
    .slice(0, riotDefaults.recentSoloSample);
  const wins = matches.filter((match) => match.win).length;
  const byChampion = new Map<string, number>();
  matches.forEach((match) =>
    byChampion.set(
      match.championName,
      (byChampion.get(match.championName) ?? 0) + 1,
    ),
  );
  const mostPlayedName = [...byChampion.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0];
  return {
    sampleSize: matches.length,
    wins,
    losses: matches.length - wins,
    winRate: safePercentage(wins, matches.length - wins),
    averageKda: average(matches.map((match) => match.kda)),
    averageCsPerMinute: average(matches.map((match) => match.csPerMinute)),
    mostPlayedChampion: mostPlayedName
      ? championPerformance(mostPlayedName, matches)
      : undefined,
    lucian: championPerformance('Lucian', matches),
    matches,
  };
};

export const analyzeTodaySoloQueue = (
  allMatches: RecentMatch[],
): TodaySoloQueue => {
  const matches = allMatches.filter(
    (match) =>
      match.queueId === riotDefaults.soloQueueId &&
      !match.remake &&
      isToday(match.playedAt),
  );
  const wins = matches.filter((match) => match.win).length;
  const performance = analyzeRecentSoloQueue(matches);
  const first = matches[0];
  const streakGames = first
    ? matches.findIndex((match) => match.win !== first.win)
    : -1;
  const streakLength = first
    ? streakGames === -1
      ? matches.length
      : streakGames
    : 0;
  const elapsed = millisecondsSince(first?.playedAt) ?? Infinity;
  return {
    games: matches.length,
    wins,
    losses: matches.length - wins,
    winRate: performance.winRate,
    averageKda: performance.averageKda,
    mostPlayedChampion: performance.mostPlayedChampion,
    streak:
      first && streakLength
        ? { result: first.win ? 'win' : 'loss', games: streakLength }
        : undefined,
    lastPlayedAt: first?.playedAt,
    activity: !first
      ? 'no-games'
      : elapsed <= 3 * 60 * 60_000
        ? 'recent'
        : 'inactive',
    lpDelta: undefined,
    lpDeltaEstimated: true,
    matches,
  };
};
