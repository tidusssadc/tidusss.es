import { riotDefaults } from '../../config/riot';
import { championPerformance } from './analytics';
import { safePercentage } from './normalize';
import type {
  ActivityBucket,
  AdcMatchupEntry,
  ChampionDistribution,
  ChampionPerformance,
  DurationBucketEntry,
  DurationSummary,
  PerformanceWindow,
  ProfilePerformance,
  RecentMatch,
  RoleDistributionEntry,
  SideSplitEntry,
  SupportSynergyEntry,
  TrendPoint,
} from './types';

/**
 * "Perfil competitivo avanzado" — todo lo de este módulo es DIRECTA
 * (viene tal cual de Match-V5, ya normalizado en `RecentMatch`) o DERIVADA
 * (una cuenta/promedio/agrupación sobre esos mismos datos). Nada aquí usa
 * Timeline-V5 ni persistencia propia — por eso no hay "peak", no hay
 * evolución de LP pasada y no hay ninguna puntuación propietaria (ni
 * "ADC score" ni nada parecido, ver el encargo §36). Si un dato no está
 * disponible con fiabilidad, el campo queda `undefined` — nunca se rellena
 * con una estimación.
 */

// Umbral mínimo para presentar una sinergia de support o un matchup de ADC
// rival como dato con sentido — una sola partida con 100% WR no es un
// insight (encargo §31/§32).
const MIN_RELATION_SAMPLE = 3;

// Tamaño de la ventana "reciente" que se compara contra la muestra completa
// (encargo §5) — 20 si hay suficientes partidas, si no, la muestra real.
export const RECENT_WINDOW_SIZE = 20;

// Ventanas rodantes para la tendencia (encargo §12) — solo se incluye una
// ventana cuando hay partidas suficientes para llenarla entera, así nunca se
// etiqueta "últimas 20" una muestra de 7.
const TREND_WINDOW_SIZES = [5, 10, 20];

const average = (values: number[]): number | undefined =>
  values.length
    ? Number(
        (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2),
      )
    : undefined;

const perMinute = (total: number, durationSeconds: number) =>
  Number((total / (Math.max(1, durationSeconds) / 60)).toFixed(1));

const sortByPlayedAtDesc = (matches: RecentMatch[]) =>
  [...matches].sort(
    (a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime(),
  );

/** Solo partidas de Solo/Duo reales — un remake (rendición temprana) no representa rendimiento y no debe contaminar ningún promedio. */
export const soloQueueMatches = (matches: RecentMatch[]): RecentMatch[] =>
  sortByPlayedAtDesc(
    matches.filter(
      (match) => match.queueId === riotDefaults.soloQueueId && !match.remake,
    ),
  );

const teamOf = (match: RecentMatch) =>
  match.teams.find((team) => team.teamId === match.teamId);

const enemyTeamOf = (match: RecentMatch) =>
  match.teams.find((team) => team.teamId !== match.teamId);

/** % de kills del equipo en las que participó Tidusss (kill o assist) — `undefined` si el equipo no registró ninguna kill (división por cero, no un 0% real). */
const killParticipation = (match: RecentMatch): number | undefined => {
  const teamKills = teamOf(match)?.participants.reduce(
    (sum, participant) => sum + participant.kills,
    0,
  );
  if (!teamKills) return undefined;
  return Number((((match.kills + match.assists) / teamKills) * 100).toFixed(1));
};

export const buildPerformanceWindow = (matches: RecentMatch[]): PerformanceWindow => {
  const wins = matches.filter((match) => match.win).length;
  const killParticipationValues = matches
    .map(killParticipation)
    .filter((value): value is number => value !== undefined);
  return {
    sampleSize: matches.length,
    wins,
    losses: matches.length - wins,
    winRate: safePercentage(wins, matches.length - wins),
    averageKills: average(matches.map((match) => match.kills)),
    averageDeaths: average(matches.map((match) => match.deaths)),
    averageAssists: average(matches.map((match) => match.assists)),
    averageKda: average(matches.map((match) => match.kda)),
    averageKillParticipation: average(killParticipationValues),
    averageCsPerMinute: average(matches.map((match) => match.csPerMinute)),
    averageGoldPerMinute: average(
      matches.map((match) => perMinute(match.goldEarned, match.durationSeconds)),
    ),
    averageDamagePerMinute: average(
      matches.map((match) => perMinute(match.damageToChampions, match.durationSeconds)),
    ),
    averageDurationSeconds: average(matches.map((match) => match.durationSeconds)),
  };
};

export const computeTrend = (matchesDesc: RecentMatch[]): TrendPoint[] =>
  TREND_WINDOW_SIZES.filter((size) => matchesDesc.length >= size).map((size) => {
    const window = buildPerformanceWindow(matchesDesc.slice(0, size));
    return {
      windowSize: size,
      sampleSize: window.sampleSize,
      winRate: window.winRate,
      averageKda: window.averageKda,
      averageCsPerMinute: window.averageCsPerMinute,
      averageDamagePerMinute: window.averageDamagePerMinute,
    };
  });

export const computeChampionBreakdown = (
  matches: RecentMatch[],
): ChampionPerformance[] => {
  const names = [...new Set(matches.map((match) => match.championName))];
  return names
    .map((name) => championPerformance(name, matches))
    .filter((value): value is ChampionPerformance => Boolean(value))
    .sort(
      (a, b) =>
        b.games - a.games ||
        b.winRate - a.winRate ||
        a.championName.localeCompare(b.championName),
    );
};

export const computeChampionDistribution = (
  matches: RecentMatch[],
): ChampionDistribution => {
  const total = matches.length;
  const byChampion = new Map<string, { games: number; imageUrl?: string }>();
  matches.forEach((match) => {
    const entry = byChampion.get(match.championName) ?? {
      games: 0,
      imageUrl: match.championImageUrl,
    };
    entry.games += 1;
    byChampion.set(match.championName, entry);
  });
  const entries = [...byChampion.entries()]
    .map(([championName, value]) => ({
      championName,
      championImageUrl: value.imageUrl,
      games: value.games,
      percentage: total ? Math.round((value.games / total) * 100) : 0,
    }))
    .sort((a, b) => b.games - a.games || a.championName.localeCompare(b.championName));
  const topPercentage = (count: number) =>
    total
      ? Math.round(
          (entries.slice(0, count).reduce((sum, entry) => sum + entry.games, 0) /
            total) *
            100,
        )
      : undefined;
  return {
    entries,
    top1Percentage: entries.length ? topPercentage(1) : undefined,
    top3Percentage: entries.length ? topPercentage(3) : undefined,
    top5Percentage: entries.length ? topPercentage(5) : undefined,
  };
};

export const computeRoleDistribution = (
  matches: RecentMatch[],
): RoleDistributionEntry[] => {
  const total = matches.length;
  const byPosition = new Map<string, number>();
  matches.forEach((match) => {
    const position = match.position || 'Sin posición';
    byPosition.set(position, (byPosition.get(position) ?? 0) + 1);
  });
  return [...byPosition.entries()]
    .map(([position, games]) => ({
      position,
      games,
      percentage: total ? Math.round((games / total) * 100) : 0,
    }))
    .sort((a, b) => b.games - a.games || a.position.localeCompare(b.position));
};

// Europe/Madrid explícito (encargo §10) — nunca UTC sin convertir. El
// runtime (Node en build, Cloudflare Workers en producción) trae ICU
// completo, así que `Intl` con `timeZone` resuelve esto sin ninguna
// dependencia nueva.
const weekdayFormatter = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  weekday: 'long',
});
const hourFormatter = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  hour: 'numeric',
  hourCycle: 'h23',
});
const WEEKDAY_ORDER = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
];
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const bucketBy = (
  matches: RecentMatch[],
  keyOf: (match: RecentMatch) => string,
): Map<string, { games: number; wins: number }> => {
  const byKey = new Map<string, { games: number; wins: number }>();
  matches.forEach((match) => {
    const key = keyOf(match);
    const entry = byKey.get(key) ?? { games: 0, wins: 0 };
    entry.games += 1;
    if (match.win) entry.wins += 1;
    byKey.set(key, entry);
  });
  return byKey;
};

const toActivityBucket = (
  label: string,
  entry?: { games: number; wins: number },
): ActivityBucket | undefined =>
  entry
    ? {
        label,
        games: entry.games,
        wins: entry.wins,
        winRate: safePercentage(entry.wins, entry.games - entry.wins),
      }
    : undefined;

export const computeActivityByWeekday = (matches: RecentMatch[]): ActivityBucket[] => {
  const byDay = bucketBy(matches, (match) =>
    weekdayFormatter.format(new Date(match.playedAt)),
  );
  return WEEKDAY_ORDER.map((day) => toActivityBucket(capitalize(day), byDay.get(day)))
    .filter((entry): entry is ActivityBucket => Boolean(entry));
};

/** Franjas horarias en español, más legibles en la UI que "00-06h" (encargo §10). */
const hourBand = (hour: number): string => {
  if (hour < 6) return 'Madrugada';
  if (hour < 12) return 'Mañana';
  if (hour < 20) return 'Tarde';
  return 'Noche';
};
const HOUR_BAND_ORDER = ['Madrugada', 'Mañana', 'Tarde', 'Noche'];

export const computeActivityByHourBand = (matches: RecentMatch[]): ActivityBucket[] => {
  const byBand = bucketBy(matches, (match) =>
    hourBand(Number(hourFormatter.format(new Date(match.playedAt)))),
  );
  return HOUR_BAND_ORDER.map((band) => toActivityBucket(band, byBand.get(band))).filter(
    (entry): entry is ActivityBucket => Boolean(entry),
  );
};

/**
 * Support aliado — solo se calcula en partidas donde Tidusss jugó de
 * BOTTOM (ADC) y Riot marcó a un compañero de equipo como UTILITY. Si esa
 * posición no está disponible (Riot la devuelve vacía) la partida
 * simplemente no cuenta para esta métrica, nunca se adivina quién fue el
 * support (encargo §9/§31).
 */
export const computeSupportSynergy = (matches: RecentMatch[]): SupportSynergyEntry[] => {
  const byName = new Map<string, RecentMatch[]>();
  matches.forEach((match) => {
    if (match.position !== 'BOTTOM') return;
    const support = teamOf(match)?.participants.find(
      (participant) => participant.position === 'UTILITY',
    );
    if (!support) return;
    byName.set(support.displayName, [...(byName.get(support.displayName) ?? []), match]);
  });
  return [...byName.entries()]
    .map(([supportName, list]) => {
      const wins = list.filter((match) => match.win).length;
      return {
        supportName,
        games: list.length,
        wins,
        winRate: safePercentage(wins, list.length - wins),
        averageKda: average(list.map((match) => match.kda)),
      };
    })
    .filter((entry) => entry.games >= MIN_RELATION_SAMPLE)
    .sort((a, b) => b.games - a.games || a.supportName.localeCompare(b.supportName));
};

/**
 * Matchup de ADC rival — agrupado por CAMPEÓN enemigo (no por invocador:
 * un mismo rival rara vez se repite, un mismo campeón enfrente sí). Mismo
 * criterio de fiabilidad de posición que `computeSupportSynergy` (encargo
 * §32).
 */
export const computeAdcMatchups = (matches: RecentMatch[]): AdcMatchupEntry[] => {
  const byChampion = new Map<
    string,
    { list: RecentMatch[]; imageUrl?: string }
  >();
  matches.forEach((match) => {
    if (match.position !== 'BOTTOM') return;
    const enemyAdc = enemyTeamOf(match)?.participants.find(
      (participant) => participant.position === 'BOTTOM',
    );
    if (!enemyAdc) return;
    const entry = byChampion.get(enemyAdc.championName) ?? {
      list: [],
      imageUrl: enemyAdc.championImageUrl,
    };
    entry.list.push(match);
    byChampion.set(enemyAdc.championName, entry);
  });
  return [...byChampion.entries()]
    .map(([enemyChampionName, { list, imageUrl }]) => {
      const wins = list.filter((match) => match.win).length;
      return {
        enemyChampionName,
        enemyChampionImageUrl: imageUrl,
        games: list.length,
        wins,
        winRate: safePercentage(wins, list.length - wins),
      };
    })
    .filter((entry) => entry.games >= MIN_RELATION_SAMPLE)
    .sort(
      (a, b) => b.games - a.games || a.enemyChampionName.localeCompare(b.enemyChampionName),
    );
};

export const computeSideSplit = (matches: RecentMatch[]): SideSplitEntry[] =>
  (
    [
      { side: 'blue' as const, teamId: 100 },
      { side: 'red' as const, teamId: 200 },
    ]
  )
    .map(({ side, teamId }) => {
      const list = matches.filter((match) => match.teamId === teamId);
      const wins = list.filter((match) => match.win).length;
      return {
        side,
        games: list.length,
        wins,
        winRate: list.length ? safePercentage(wins, list.length - wins) : undefined,
      };
    })
    .filter((entry) => entry.games > 0);

const DURATION_BUCKETS: Array<{ label: string; min: number; max: number }> = [
  { label: '< 20 min', min: 0, max: 20 },
  { label: '20-25 min', min: 20, max: 25 },
  { label: '25-30 min', min: 25, max: 30 },
  { label: '30-35 min', min: 30, max: 35 },
  { label: '35+ min', min: 35, max: Infinity },
];

export const computeDuration = (matches: RecentMatch[]): DurationSummary => {
  const wins = matches.filter((match) => match.win);
  const losses = matches.filter((match) => !match.win);
  const buckets: DurationBucketEntry[] = DURATION_BUCKETS.map(({ label, min, max }) => {
    const list = matches.filter((match) => {
      const minutes = match.durationSeconds / 60;
      return minutes >= min && minutes < max;
    });
    const bucketWins = list.filter((match) => match.win).length;
    return {
      label,
      games: list.length,
      wins: bucketWins,
      winRate: list.length
        ? safePercentage(bucketWins, list.length - bucketWins)
        : undefined,
    };
  }).filter((bucket) => bucket.games > 0);
  return {
    averageSeconds: average(matches.map((match) => match.durationSeconds)),
    averageWinSeconds: average(wins.map((match) => match.durationSeconds)),
    averageLossSeconds: average(losses.map((match) => match.durationSeconds)),
    buckets,
  };
};

/**
 * Punto de entrada único — recibe TODAS las partidas ya normalizadas que
 * `getRiotOverview` obtuvo de Match-V5 (mismo dataset que `recent`/`today`,
 * cero llamadas Riot adicionales) y calcula el perfil de rendimiento
 * completo. Nunca lanza: con una muestra vacía, cada sección degrada a
 * `sampleSize: 0` / listas vacías, y la UI decide qué omitir.
 */
export const buildProfilePerformance = (allMatches: RecentMatch[]): ProfilePerformance => {
  const matches = soloQueueMatches(allMatches);
  const recentSlice = matches.slice(0, RECENT_WINDOW_SIZE);
  return {
    sampleSize: matches.length,
    windowRecent: buildPerformanceWindow(recentSlice),
    windowFull: buildPerformanceWindow(matches),
    trend: computeTrend(matches),
    champions: computeChampionBreakdown(matches),
    championDistribution: computeChampionDistribution(matches),
    roles: computeRoleDistribution(matches),
    activityByWeekday: computeActivityByWeekday(matches),
    activityByHourBand: computeActivityByHourBand(matches),
    supportSynergy: computeSupportSynergy(matches),
    adcMatchups: computeAdcMatchups(matches),
    sideSplit: computeSideSplit(matches),
    duration: computeDuration(matches),
  };
};
