import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPerformanceWindow,
  buildProfilePerformance,
  computeActivityByHourBand,
  computeActivityByWeekday,
  computeAdcMatchups,
  computeChampionBreakdown,
  computeChampionDistribution,
  computeDuration,
  computeRoleDistribution,
  computeSideSplit,
  computeSupportSynergy,
  computeTrend,
  soloQueueMatches,
} from '../../../src/lib/riot/performance.ts';
import type { MatchParticipant, MatchTeam, RecentMatch } from '../../../src/lib/riot/types.ts';

const SOLO_QUEUE_ID = 420;

const teamParticipant = (
  overrides: Partial<MatchParticipant> = {},
): MatchParticipant => ({
  displayName: 'Compañero#EUW',
  championName: 'Nautilus',
  teamId: 100,
  win: true,
  kills: 2,
  deaths: 3,
  assists: 10,
  cs: 40,
  damageToChampions: 8000,
  goldEarned: 9000,
  visionScore: 30,
  items: [],
  itemImageUrls: [],
  ...overrides,
});

const teamsFor = (
  match: Partial<RecentMatch>,
  {
    selfKills = 6,
    ally = [],
    enemy = [],
  }: {
    selfKills?: number;
    ally?: MatchParticipant[];
    enemy?: MatchParticipant[];
  } = {},
): MatchTeam[] => {
  const teamId = match.teamId ?? 100;
  const enemyTeamId = teamId === 100 ? 200 : 100;
  const self: MatchParticipant = {
    displayName: 'Tidusss#FFX',
    championName: match.championName ?? 'Lucian',
    teamId,
    win: match.win ?? true,
    kills: match.kills ?? selfKills,
    deaths: match.deaths ?? 2,
    assists: match.assists ?? 4,
    cs: match.cs ?? 180,
    damageToChampions: match.damageToChampions ?? 18000,
    goldEarned: match.goldEarned ?? 12000,
    visionScore: match.visionScore ?? 20,
    items: [],
    itemImageUrls: [],
    position: match.position ?? 'BOTTOM',
  };
  return [
    { teamId, win: Boolean(match.win), participants: [self, ...ally], objectives: { towers: 0, dragons: 0, barons: 0 } },
    { teamId: enemyTeamId, win: !match.win, participants: enemy, objectives: { towers: 0, dragons: 0, barons: 0 } },
  ];
};

let matchSeq = 0;
const match = (overrides: Partial<RecentMatch> = {}): RecentMatch => {
  matchSeq += 1;
  const base: RecentMatch = {
    matchId: `EUW1_${matchSeq}`,
    championId: 236,
    championName: 'Lucian',
    win: true,
    kills: 6,
    deaths: 2,
    assists: 4,
    kda: 5,
    cs: 180,
    csPerMinute: 7.2,
    durationSeconds: 1500,
    durationLabel: '25:00',
    queueId: SOLO_QUEUE_ID,
    queueLabel: 'Solo Queue',
    playedAt: new Date(Date.UTC(2026, 0, 5 + matchSeq, 18, 0, 0)).toISOString(),
    items: [],
    itemImageUrls: [],
    damageToChampions: 18000,
    goldEarned: 12000,
    visionScore: 20,
    position: 'BOTTOM',
    summonerSpells: [],
    runes: [],
    teams: [],
    teamId: 100,
    remake: false,
  };
  const merged = { ...base, ...overrides };
  merged.teams = overrides.teams ?? teamsFor(merged);
  return merged;
};

// --- soloQueueMatches: filtra cola y remakes, ordena por fecha desc ---

test('soloQueueMatches descarta partidas fuera de Solo/Duo y remakes, y ordena de más a menos reciente', () => {
  const flex = match({ queueId: 440 });
  const remake = match({ remake: true });
  const older = match({ playedAt: new Date(Date.UTC(2026, 0, 1)).toISOString() });
  const newer = match({ playedAt: new Date(Date.UTC(2026, 0, 20)).toISOString() });
  const result = soloQueueMatches([flex, remake, older, newer]);
  assert.deepEqual(
    result.map((m) => m.matchId),
    [newer.matchId, older.matchId],
  );
});

// --- buildPerformanceWindow: matemática base (WR, KDA, KP, CSM, GPM, DPM) ---

test('buildPerformanceWindow calcula WR/KDA/CSM/GPM/DPM correctamente sobre una muestra mixta', () => {
  const win = match({ win: true, kills: 8, deaths: 2, assists: 6, kda: 7, csPerMinute: 8, goldEarned: 15000, damageToChampions: 20000, durationSeconds: 1500 });
  const loss = match({ win: false, kills: 2, deaths: 6, assists: 2, kda: 0.67, csPerMinute: 6, goldEarned: 9000, damageToChampions: 12000, durationSeconds: 1800 });
  const stats = buildPerformanceWindow([win, loss]);
  assert.equal(stats.sampleSize, 2);
  assert.equal(stats.wins, 1);
  assert.equal(stats.losses, 1);
  assert.equal(stats.winRate, 50);
  assert.equal(stats.averageKda, Number(((7 + 0.67) / 2).toFixed(2)));
  assert.equal(stats.averageCsPerMinute, 7);
  // 15000/25min = 600 GPM; 9000/30min = 300 GPM -> media 450
  assert.equal(stats.averageGoldPerMinute, 450);
  // 20000/25min = 800 DPM; 12000/30min = 400 DPM -> media 600
  assert.equal(stats.averageDamagePerMinute, 600);
});

test('buildPerformanceWindow con muestra vacía no calcula nada (evita división por cero)', () => {
  const stats = buildPerformanceWindow([]);
  assert.equal(stats.sampleSize, 0);
  assert.equal(stats.winRate, undefined);
  assert.equal(stats.averageKda, undefined);
  assert.equal(stats.averageKillParticipation, undefined);
});

test('kill participation se omite (undefined) cuando el equipo no registró ninguna kill, en vez de mostrar un 0% falso', () => {
  const noTeamKills = match({
    kills: 0,
    assists: 0,
    teams: teamsFor({ teamId: 100, win: true }, { selfKills: 0, ally: [teamParticipant({ kills: 0 })] }),
  });
  const stats = buildPerformanceWindow([noTeamKills]);
  assert.equal(stats.averageKillParticipation, undefined);
});

test('kill participation se calcula sobre las kills reales del equipo (self + aliados)', () => {
  const m = match({
    kills: 4,
    assists: 2,
    teams: teamsFor({ teamId: 100, win: true, kills: 4, assists: 2 }, { ally: [teamParticipant({ kills: 6 })] }),
  });
  const stats = buildPerformanceWindow([m]);
  // team kills = 4 (self) + 6 (ally) = 10; KP = (4+2)/10 = 60%
  assert.equal(stats.averageKillParticipation, 60);
});

// --- trend: ventanas rodantes 5/10/20 ---

test('computeTrend solo incluye una ventana cuando hay partidas suficientes para llenarla entera', () => {
  const sevenMatches = Array.from({ length: 7 }, () => match());
  const trend = computeTrend(sevenMatches);
  assert.deepEqual(trend.map((point) => point.windowSize), [5]);
});

test('computeTrend con 25 partidas incluye las tres ventanas 5/10/20', () => {
  const matches = Array.from({ length: 25 }, () => match());
  const trend = computeTrend(matches);
  assert.deepEqual(trend.map((point) => point.windowSize), [5, 10, 20]);
  assert.equal(trend[2]?.sampleSize, 20);
});

// --- champion grouping ---

test('computeChampionBreakdown agrupa por campeón, ordena por partidas desc y no fuerza a ningún campeón concreto primero', () => {
  const matches = [
    match({ championName: 'Ashe', win: true }),
    match({ championName: 'Ashe', win: false }),
    match({ championName: 'Lucian', win: true }),
    match({ championName: 'Lucian', win: true }),
    match({ championName: 'Lucian', win: true }),
  ];
  const champions = computeChampionBreakdown(matches);
  assert.deepEqual(champions.map((c) => c.championName), ['Lucian', 'Ashe']);
  assert.equal(champions[0]?.games, 3);
  assert.equal(champions[0]?.winRate, 100);
});

test('computeChampionDistribution calcula % por campeón y concentración top1/top3', () => {
  const matches = [
    ...Array.from({ length: 6 }, () => match({ championName: 'Lucian' })),
    ...Array.from({ length: 3 }, () => match({ championName: 'Ashe' })),
    match({ championName: 'Jhin' }),
  ];
  const distribution = computeChampionDistribution(matches);
  assert.equal(distribution.entries[0]?.championName, 'Lucian');
  assert.equal(distribution.entries[0]?.percentage, 60);
  assert.equal(distribution.top1Percentage, 60);
  assert.equal(distribution.top3Percentage, 100);
});

// --- roles ---

test('computeRoleDistribution respeta posiciones mixtas reales y no inventa un rol cuando falta', () => {
  const matches = [
    match({ position: 'BOTTOM' }),
    match({ position: 'BOTTOM' }),
    match({ position: '' }),
  ];
  const roles = computeRoleDistribution(matches);
  const missing = roles.find((r) => r.position === 'Sin posición');
  assert.ok(missing);
  assert.equal(missing?.games, 1);
  assert.equal(roles.find((r) => r.position === 'BOTTOM')?.games, 2);
});

// --- actividad: día de la semana / franja horaria, Europe/Madrid ---

test('computeActivityByWeekday agrupa por día real en Europe/Madrid y omite días sin partidas', () => {
  // 2026-01-05 18:00 UTC es lunes en Madrid (UTC+1 en enero).
  const monday = match({ playedAt: '2026-01-05T18:00:00.000Z', win: true });
  const activity = computeActivityByWeekday([monday]);
  assert.equal(activity.length, 1);
  assert.equal(activity[0]?.label, 'Lunes');
  assert.equal(activity[0]?.games, 1);
});

test('computeActivityByHourBand clasifica correctamente Madrugada/Mañana/Tarde/Noche en hora de Madrid', () => {
  // 2026-01-05T23:30:00Z -> 00:30 en Madrid (UTC+1) -> Madrugada.
  const lateNight = match({ playedAt: '2026-01-05T23:30:00.000Z' });
  const bands = computeActivityByHourBand([lateNight]);
  assert.equal(bands[0]?.label, 'Madrugada');
});

// --- support synergy ---

test('computeSupportSynergy exige >=3 partidas y solo cuenta partidas de BOTTOM con un UTILITY identificado', () => {
  const withSupport = (support: string) =>
    match({
      position: 'BOTTOM',
      teams: teamsFor(
        { teamId: 100, win: true },
        { ally: [teamParticipant({ displayName: support, position: 'UTILITY' })] },
      ),
    });
  const twoGames = [withSupport('Support A#EUW'), withSupport('Support A#EUW')];
  const threeGames = [withSupport('Support B#EUW'), withSupport('Support B#EUW'), withSupport('Support B#EUW')];
  const synergy = computeSupportSynergy([...twoGames, ...threeGames]);
  assert.equal(synergy.length, 1);
  assert.equal(synergy[0]?.supportName, 'Support B#EUW');
  assert.equal(synergy[0]?.games, 3);
});

test('computeSupportSynergy no cuenta partidas donde no se pudo identificar un UTILITY aliado', () => {
  const noSupport = match({
    position: 'BOTTOM',
    teams: teamsFor({ teamId: 100, win: true }, { ally: [teamParticipant({ position: undefined })] }),
  });
  const synergy = computeSupportSynergy([noSupport, noSupport, noSupport]);
  assert.deepEqual(synergy, []);
});

// --- ADC matchups ---

test('computeAdcMatchups agrupa por campeón rival BOTTOM y exige muestra mínima de 3', () => {
  const vsChampion = (enemyChampion: string) =>
    match({
      position: 'BOTTOM',
      teams: teamsFor(
        { teamId: 100, win: true },
        { enemy: [teamParticipant({ championName: enemyChampion, teamId: 200, position: 'BOTTOM' })] },
      ),
    });
  const matches = [vsChampion('Caitlyn'), vsChampion('Caitlyn'), vsChampion('Caitlyn'), vsChampion('Ezreal')];
  const matchups = computeAdcMatchups(matches);
  assert.equal(matchups.length, 1);
  assert.equal(matchups[0]?.enemyChampionName, 'Caitlyn');
  assert.equal(matchups[0]?.games, 3);
});

// --- blue/red side ---

test('computeSideSplit separa por teamId real (100 azul / 200 rojo)', () => {
  const blueWin = match({ teamId: 100, win: true, teams: teamsFor({ teamId: 100, win: true }) });
  const redLoss = match({ teamId: 200, win: false, teams: teamsFor({ teamId: 200, win: false }) });
  const split = computeSideSplit([blueWin, redLoss]);
  const blue = split.find((s) => s.side === 'blue');
  const red = split.find((s) => s.side === 'red');
  assert.equal(blue?.games, 1);
  assert.equal(blue?.winRate, 100);
  assert.equal(red?.games, 1);
  assert.equal(red?.winRate, 0);
});

// --- duración / buckets ---

test('computeDuration agrupa por rango de minutos y omite buckets vacíos', () => {
  const short = match({ durationSeconds: 18 * 60, win: true });
  const long = match({ durationSeconds: 40 * 60, win: false });
  const duration = computeDuration([short, long]);
  assert.equal(duration.buckets.length, 2);
  assert.ok(duration.buckets.some((bucket) => bucket.label === '< 20 min' && bucket.games === 1));
  assert.ok(duration.buckets.some((bucket) => bucket.label === '35+ min' && bucket.games === 1));
  assert.equal(duration.averageWinSeconds, 18 * 60);
  assert.equal(duration.averageLossSeconds, 40 * 60);
});

// --- partida corta / remake no contamina ninguna sección ---

test('una partida remake (rendición temprana) no cuenta en ninguna métrica del perfil', () => {
  const real = match();
  const remake = match({ remake: true, kills: 0, deaths: 0, assists: 0, durationSeconds: 180 });
  const performance = buildProfilePerformance([real, remake]);
  assert.equal(performance.sampleSize, 1);
});

// --- muestra pequeña: nunca revienta, nunca inventa datos ---

test('con una única partida, buildProfilePerformance no revienta y deja vacías las secciones sin muestra suficiente', () => {
  const performance = buildProfilePerformance([match()]);
  assert.equal(performance.sampleSize, 1);
  assert.equal(performance.windowRecent.sampleSize, 1);
  assert.equal(performance.trend.length, 0);
  assert.deepEqual(performance.supportSynergy, []);
  assert.deepEqual(performance.adcMatchups, []);
});

test('con cero partidas, buildProfilePerformance devuelve un perfil completamente vacío sin lanzar', () => {
  const performance = buildProfilePerformance([]);
  assert.equal(performance.sampleSize, 0);
  assert.deepEqual(performance.champions, []);
  assert.deepEqual(performance.championDistribution.entries, []);
  assert.equal(performance.championDistribution.top1Percentage, undefined);
  assert.deepEqual(performance.duration.buckets, []);
});

// --- ventana reciente (20) vs muestra completa ---

test('windowRecent se limita a las últimas 20 partidas aunque la muestra completa sea mayor', () => {
  const matches = Array.from({ length: 25 }, (_, index) =>
    match({ playedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString() }),
  );
  const performance = buildProfilePerformance(matches);
  assert.equal(performance.sampleSize, 25);
  assert.equal(performance.windowRecent.sampleSize, 20);
  assert.equal(performance.windowFull.sampleSize, 25);
});
