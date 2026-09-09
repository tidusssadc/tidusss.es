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

/** Total / minutos de partida — mismo criterio que `csPerMinute` en `normalize.ts` (mínimo 1s para no dividir por cero en un remake). */
const perMinute = (total: number, durationSeconds: number) =>
  Number((total / (Math.max(1, durationSeconds) / 60)).toFixed(1));

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
    championImageUrl: championMatches[0]?.championImageUrl,
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
    averageGoldPerMinute: average(
      championMatches.map((match) => perMinute(match.goldEarned, match.durationSeconds)),
    ),
    averageDamagePerMinute: average(
      championMatches.map((match) =>
        perMinute(match.damageToChampions, match.durationSeconds),
      ),
    ),
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
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0]?.[0];
  const champions = [...byChampion.keys()]
    .map((champion) => championPerformance(champion, matches))
    .filter((value): value is ChampionPerformance => Boolean(value))
    .sort(
      (a, b) =>
        b.games - a.games ||
        b.winRate - a.winRate ||
        a.championName.localeCompare(b.championName),
    );
  const positionCounts = new Map<string, number>();
  matches.forEach((match) => {
    const position = match.position || 'Sin posición';
    positionCounts.set(position, (positionCounts.get(position) ?? 0) + 1);
  });
  const positions = [...positionCounts.entries()]
    .map(([position, games]) => ({
      position,
      games,
      percentage: matches.length
        ? Math.round((games / matches.length) * 100)
        : 0,
    }))
    .sort((a, b) => b.games - a.games || a.position.localeCompare(b.position));
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60_000;
  const gamesLastSevenDays = matches.filter(
    (match) => new Date(match.playedAt).getTime() >= sevenDaysAgo,
  ).length;
  const averageCsPerMinute = average(matches.map((match) => match.csPerMinute));
  const editorialSummary: string[] = [];
  const bottomGames = positionCounts.get('BOTTOM') ?? 0;
  if (matches.length && bottomGames)
    editorialSummary.push(
      `${bottomGames} de las últimas ${matches.length} partidas fueron como ADC.`,
    );
  if (mostPlayedName)
    editorialSummary.push(
      `${mostPlayedName} es el campeón más jugado de la muestra (${byChampion.get(mostPlayedName)} partidas).`,
    );
  if (averageCsPerMinute !== undefined)
    editorialSummary.push(
      `Promedio de ${String(averageCsPerMinute).replace('.', ',')} CS/min en las últimas partidas.`,
    );
  return {
    sampleSize: matches.length,
    wins,
    losses: matches.length - wins,
    winRate: safePercentage(wins, matches.length - wins),
    averageKda: average(matches.map((match) => match.kda)),
    averageCsPerMinute,
    averageDamageToChampions: average(
      matches.map((match) => match.damageToChampions),
    ),
    mostPlayedChampion: mostPlayedName
      ? championPerformance(mostPlayedName, matches)
      : undefined,
    lucian: championPerformance('Lucian', matches),
    champions,
    positions,
    primaryPosition: positions[0]?.position,
    gamesLastSevenDays,
    lastPlayedAt: matches[0]?.playedAt,
    editorialSummary,
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
