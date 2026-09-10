/**
 * Modo de QA VISUAL del rediseño de /competitivo (rama design/competitive-v3).
 *
 * Por qué existe: el deployment Preview de Cloudflare de la rama abre, pero
 * las Pages Functions `/api/riot/*` responden 503 porque `RIOT_API_KEY` (y
 * el binding D1) solo están configurados para el entorno **Production**, no
 * para **Preview**. Sin datos, /competitivo se queda casi vacío y no se
 * puede evaluar el rediseño.
 *
 * Qué hace: SOLO cuando se cumplen los TRES candados de abajo, sustituye
 * `window.fetch` para las rutas `/api/riot/*` (+ `/api/youtube`,
 * `/api/twitch/status`) por un fixture completo y realista, con la forma
 * EXACTA de los tipos del proyecto (por eso se tipa aquí — si un tipo
 * cambia, `tsc` rompe este fichero). Es QA visual: los valores no son
 * datos públicos reales de Tidusss y nunca deben presentarse como tales.
 *
 * NUNCA en producción:
 *  1. Build: `import.meta.env.QA_FIXTURE_ALLOWED` es `false` en el build de
 *     producción (`astro.config.mjs`, `CF_PAGES_BRANCH === 'main'`). Con esa
 *     constante en `false`, `installCompetitiveQaIfRequested` queda como
 *     `if (!false) return;` y rollup elimina `activate` y TODO lo que
 *     construye el fixture (funciones puras sin referencias vivas).
 *  2. Host: aunque estuviera en el bundle, no se activa si el host es
 *     `tidusss.es` / `www.tidusss.es`.
 *  3. Opt-in explícito: requiere `?qa=competitive-v3` en la URL.
 *
 * Sub-parámetros (solo QA, no documentados de cara al público):
 *  - `&evo=multi`   → Rank Evolution con varios snapshots (sparkline)
 *  - `&evo=none`    → Rank Evolution sin storage (columna oculta)
 *  - `&live=1`      → "Partida en curso" con 10 jugadores
 *  - `&today=0`     → estado "sin clasificatorias hoy"
 *  - `&riot=down`   → estado "Riot no disponible"
 */

import type { RiotPublicResponse, RecentMatch, MatchParticipant } from '../riot';
import type { MatchTimelinePublicResponse } from '../riot';
import type { RankHistoryPublicResponse } from '../../../functions/api/riot/rank-history';
import type { LiveGameResult } from '../riot/live-types';
import type { YouTubeFeedResponse } from '../../types/content';
import type { TwitchStatusResponse } from '../../types/platforms';
import { matchVideoLinks } from '../../config/match-video-links';

/**
 * Punto de entrada. Idempotente. No hace absolutamente nada salvo que se
 * cumplan los tres candados descritos en la cabecera. En el build de
 * producción, `QA_FIXTURE_ALLOWED` es `false` y todo lo demás se elimina.
 */
export const installCompetitiveQaIfRequested = (): void => {
  if (!import.meta.env.QA_FIXTURE_ALLOWED) return;
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  if (params.get('qa') !== 'competitive-v3') return;
  const host = window.location.hostname;
  if (host === 'tidusss.es' || host === 'www.tidusss.es') return;
  activate(params);
};

// --- Todo lo de aquí abajo solo es alcanzable desde `activate`, que solo
//     es alcanzable si `QA_FIXTURE_ALLOWED` es `true`. En producción, muerto. ---

const DDV = '15.14.1';
const champIcon = (key: string) =>
  `https://ddragon.leagueoflegends.com/cdn/${DDV}/img/champion/${key}.png`;
const itemIcon = (id: number) =>
  `https://ddragon.leagueoflegends.com/cdn/${DDV}/img/item/${id}.png`;
const spellIcon = (name: string) =>
  `https://ddragon.leagueoflegends.com/cdn/${DDV}/img/spell/${name}.png`;
const runeIcon = (path: string) =>
  `https://ddragon.leagueoflegends.com/cdn/img/${path}`;
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

const QA_VIDEO_ID = 'dQw4w9WgXcQ';
const QA_VIDEO_MATCH_ID = 'EUW1_7000000003';
const ADC_KEYS = ['Lucian', 'Jhin', 'Caitlyn', 'Kaisa', 'Ashe', 'Xayah', 'Ezreal', 'Samira', 'Zeri', 'Jinx'];

type QaIdentity = MatchParticipant['identity'];
const identityFor = (i: number): QaIdentity => {
  if (i === 0) return { displayName: 'Rekkles', team: 'KC', role: 'ADC', isPro: true, isStreamer: true };
  if (i === 1) return { displayName: 'Caps', team: 'G2', role: 'MID', isPro: true, isStreamer: false };
  if (i === 2)
    return { displayName: 'Thebausffs', role: 'TOP', isPro: false, isStreamer: true, streamUrl: 'https://twitch.tv/thebausffs' };
  return undefined;
};

const buildParticipant = (
  over: Partial<MatchParticipant> & Pick<MatchParticipant, 'championName' | 'teamId'>,
): MatchParticipant => ({
  displayName: over.displayName ?? 'Invocador',
  championImageUrl: champIcon(over.championName),
  win: over.win ?? true,
  kills: over.kills ?? 4,
  deaths: over.deaths ?? 4,
  assists: over.assists ?? 6,
  cs: over.cs ?? 180,
  damageToChampions: over.damageToChampions ?? 18000,
  goldEarned: over.goldEarned ?? 11500,
  visionScore: over.visionScore ?? 18,
  items: over.items ?? [],
  itemImageUrls: over.itemImageUrls ?? [],
  position: over.position,
  identity: over.identity,
  ...over,
});

const buildMatch = (i: number): RecentMatch => {
  const win = i % 3 !== 1; // 7W / 3L sobre 10
  const key = ADC_KEYS[i % ADC_KEYS.length]!;
  const k = 5 + (i % 6);
  const d = 2 + (i % 4);
  const a = 4 + (i % 8);
  const durationSeconds = 1500 + i * 95;
  const items = [3006, 6672, 3031, 3072, 3036, 3363, i % 2 ? 3340 : 0];
  const enemyKey = ADC_KEYS[(i + 3) % ADC_KEYS.length]!;
  const enemyIdentityIndex = i % 4 === 0 ? 0 : i % 4 === 1 ? 1 : i % 4 === 2 ? 2 : -1;

  const ally = (pos: string, champ: string, self = false) =>
    buildParticipant({
      displayName: self ? 'Tidusss' : `Aliado ${pos}`,
      championName: champ,
      teamId: 100,
      win,
      position: pos,
      kills: self ? k : 3 + (i % 4),
      deaths: self ? d : 4,
      assists: self ? a : 7,
      cs: self ? 180 + i * 4 : 150,
      damageToChampions: self ? 22000 + i * 900 : 15000,
      goldEarned: self ? 12500 + i * 300 : 10500,
      items: self ? items : [],
      itemImageUrls: self ? items.filter(Boolean).map(itemIcon) : [],
    });
  const foe = (pos: string, champ: string, identityIdx?: number) =>
    buildParticipant({
      displayName: `Rival ${pos}`,
      championName: champ,
      teamId: 200,
      win: !win,
      position: pos,
      kills: 4,
      deaths: 5,
      assists: 5,
      identity: pos === 'BOTTOM' ? identityFor(identityIdx ?? -1) : undefined,
    });

  return {
    matchId: `EUW1_700000000${i}`,
    championId: 200 + i,
    championName: key,
    championImageUrl: champIcon(key),
    win,
    kills: k,
    deaths: d,
    assists: a,
    kda: Number(((k + a) / Math.max(1, d)).toFixed(2)),
    cs: 180 + i * 4,
    csPerMinute: Number((7 + (i % 5) * 0.2).toFixed(1)),
    durationSeconds,
    durationLabel: `${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2, '0')}`,
    queueId: 420,
    queueLabel: 'Solo/Duo',
    playedAt: iso(i * 3.5 * 3600e3),
    items,
    itemImageUrls: items.filter(Boolean).map(itemIcon),
    damageToChampions: 22000 + i * 900,
    goldEarned: 12500 + i * 300,
    visionScore: 18 + i,
    position: 'BOTTOM',
    summonerSpells: [
      { id: 4, name: 'Destello', imageUrl: spellIcon('SummonerFlash') },
      { id: 7, name: 'Curar', imageUrl: spellIcon('SummonerHeal') },
    ],
    runes: [
      { id: 8000, name: 'Precisión', imageUrl: runeIcon('perk-images/Styles/7201_Precision.png') },
      { id: 8100, name: 'Dominación', imageUrl: runeIcon('perk-images/Styles/7200_Domination.png') },
    ],
    teams: [
      {
        teamId: 100,
        win,
        participants: [
          ally('TOP', 'Aatrox'),
          ally('JUNGLE', 'Viego'),
          ally('MIDDLE', 'Ahri'),
          ally('BOTTOM', key, true),
          ally('UTILITY', 'Nautilus'),
        ],
        objectives: { towers: win ? 8 : 3, dragons: win ? 3 : 1, barons: win ? 1 : 0 },
      },
      {
        teamId: 200,
        win: !win,
        participants: [
          foe('TOP', 'Garen', 2),
          foe('JUNGLE', 'LeeSin'),
          foe('MIDDLE', 'Syndra', 1),
          foe('BOTTOM', enemyKey, enemyIdentityIndex),
          foe('UTILITY', 'Thresh'),
        ],
        objectives: { towers: win ? 3 : 8, dragons: win ? 1 : 3, barons: win ? 0 : 1 },
      },
    ],
    teamId: 100,
    lpDelta: i === 0 ? undefined : win ? 15 + (i % 4) : -(14 + (i % 5)),
    badges: [],
    remake: false,
  };
};

const matchesFixture = (): RecentMatch[] => Array.from({ length: 10 }, (_v, i) => buildMatch(i));

const champPerf = (name: string, games: number, winRate: number, kda: number, dpm: number, csm: number) => ({
  championName: name,
  championImageUrl: champIcon(name),
  games,
  wins: Math.round((games * winRate) / 100),
  losses: games - Math.round((games * winRate) / 100),
  winRate,
  averageKills: 7,
  averageDeaths: 3,
  averageAssists: 8,
  averageKda: kda,
  averageCsPerMinute: csm,
  averageGoldPerMinute: Math.round(dpm * 0.55),
  averageDamagePerMinute: dpm,
});

const poolFixture = () => [
  champPerf('Lucian', 41, 57, 3.2, 790, 8.3),
  champPerf('Jhin', 14, 50, 2.7, 650, 7.7),
  champPerf('Caitlyn', 9, 61, 3.1, 705, 8.1),
  champPerf('Kaisa', 6, 66, 3.6, 740, 7.8),
  champPerf('Ashe', 4, 38, 2.0, 520, 7.0),
];

const wrEntry = <T extends { games: number; winRate: number }>(entry: T): T & { wins: number } => ({
  ...entry,
  wins: Math.round((entry.games * entry.winRate) / 100),
});

const perfWindow = (n: number, wrPct: number, kda: number, kp: number, csm: number, gpm: number, dpm: number, dur: number) => ({
  sampleSize: n,
  wins: Math.round((n * wrPct) / 100),
  losses: n - Math.round((n * wrPct) / 100),
  winRate: wrPct,
  averageKills: 7,
  averageDeaths: 3,
  averageAssists: 8,
  averageKda: kda,
  averageKillParticipation: kp,
  averageCsPerMinute: csm,
  averageGoldPerMinute: gpm,
  averageDamagePerMinute: dpm,
  averageDurationSeconds: dur,
});

const performanceFixture = () => {
  const pool = poolFixture();
  return {
    sampleSize: 74,
    windowRecent: perfWindow(20, 60, 3.1, 62, 8.2, 415, 775, 1710),
    windowFull: perfWindow(74, 55, 2.8, 59, 7.9, 402, 720, 1755),
    trend: [
      { windowSize: 5, sampleSize: 5, winRate: 80, averageKda: 3.9, averageCsPerMinute: 8.5, averageDamagePerMinute: 830 },
      { windowSize: 10, sampleSize: 10, winRate: 60, averageKda: 3.2, averageCsPerMinute: 8.2, averageDamagePerMinute: 780 },
      { windowSize: 20, sampleSize: 20, winRate: 60, averageKda: 3.0, averageCsPerMinute: 8.0, averageDamagePerMinute: 760 },
    ],
    champions: pool,
    championDistribution: {
      entries: pool.map((c) => ({
        championName: c.championName,
        championImageUrl: c.championImageUrl,
        games: c.games,
        percentage: Math.round((c.games / 74) * 100),
      })),
      top1Percentage: 55,
      top3Percentage: 86,
      top5Percentage: 100,
    },
    roles: [{ position: 'BOTTOM', games: 71, percentage: 96 }],
    activityByWeekday: [
      wrEntry({ label: 'Lun', games: 8, winRate: 50 }),
      wrEntry({ label: 'Mié', games: 13, winRate: 62 }),
      wrEntry({ label: 'Vie', games: 17, winRate: 53 }),
      wrEntry({ label: 'Sáb', games: 21, winRate: 61 }),
      wrEntry({ label: 'Dom', games: 11, winRate: 45 }),
    ],
    activityByHourBand: [
      wrEntry({ label: 'Tarde', games: 24, winRate: 54 }),
      wrEntry({ label: 'Noche', games: 38, winRate: 58 }),
      wrEntry({ label: 'Madrugada', games: 8, winRate: 44 }),
    ],
    supportSynergy: [
      wrEntry({ supportName: 'Nautilus', games: 13, winRate: 64 }),
      wrEntry({ supportName: 'Milio', games: 8, winRate: 55 }),
      wrEntry({ supportName: 'Rell', games: 5, winRate: 40 }),
    ],
    adcMatchups: [
      wrEntry({ enemyChampionName: 'Caitlyn', enemyChampionImageUrl: champIcon('Caitlyn'), games: 9, winRate: 61 }),
      wrEntry({ enemyChampionName: 'Jhin', enemyChampionImageUrl: champIcon('Jhin'), games: 6, winRate: 50 }),
      wrEntry({ enemyChampionName: 'Ezreal', enemyChampionImageUrl: champIcon('Ezreal'), games: 4, winRate: 75 }),
    ],
    sideSplit: [
      wrEntry({ side: 'blue' as const, games: 39, winRate: 58 }),
      wrEntry({ side: 'red' as const, games: 35, winRate: 52 }),
    ],
    duration: {
      averageSeconds: 1755,
      averageWinSeconds: 1610,
      averageLossSeconds: 1930,
      buckets: [
        wrEntry({ label: '<25 min', games: 16, winRate: 72 }),
        wrEntry({ label: '25-32 min', games: 36, winRate: 57 }),
        wrEntry({ label: '>32 min', games: 22, winRate: 43 }),
      ],
    },
  };
};

const overviewResponse = (today0: boolean): RiotPublicResponse => {
  const matches = matchesFixture();
  const pool = poolFixture();
  return {
    ok: true,
    data: {
      profile: { riotId: 'Tidusss#FFX', gameName: 'Tidusss', tagLine: 'FFX', region: 'EUW', summonerLevel: 431 },
      ranked: { available: true, queueType: 'RANKED_SOLO_5x5', tier: 'MASTER', rank: 'I', leaguePoints: 554, wins: 322, losses: 281, winRate: 53 },
      recent: {
        sampleSize: 10,
        wins: 7,
        losses: 3,
        winRate: 70,
        averageKda: 3.2,
        averageCsPerMinute: 8.0,
        averageDamageToChampions: 24000,
        mostPlayedChampion: pool[0],
        champions: pool,
        positions: [{ position: 'BOTTOM', games: 10, percentage: 100 }],
        primaryPosition: 'BOTTOM',
        gamesLastSevenDays: 26,
        lastPlayedAt: matches[0]!.playedAt,
        editorialSummary: [],
        matches,
      },
      today: today0
        ? { games: 0, wins: 0, losses: 0, activity: 'no-games', lpDeltaEstimated: true, matches: [] }
        : {
            games: 4,
            wins: 3,
            losses: 1,
            winRate: 75,
            averageKda: 3.6,
            mostPlayedChampion: pool[0],
            streak: { result: 'win', games: 3 },
            lastPlayedAt: matches[0]!.playedAt,
            activity: 'recent',
            lpDelta: 34,
            lpDeltaEstimated: true,
            matches: matches.slice(0, 4),
          },
      performance: performanceFixture(),
      updatedAt: iso(45_000),
      stale: false,
      state: 'available',
      source: 'Riot Games API',
    },
  };
};

const rankHistoryResponse = (mode: string): RankHistoryPublicResponse => {
  if (mode === 'none') return { ok: true, data: { available: false, sampleCount: 0, transitions: [], points: [] } };
  if (mode === 'multi') {
    const seq: Array<{ tier: string; rank?: string; leaguePoints: number }> = [
      { tier: 'DIAMOND', rank: 'II', leaguePoints: 40 },
      { tier: 'DIAMOND', rank: 'I', leaguePoints: 15 },
      { tier: 'DIAMOND', rank: 'I', leaguePoints: 78 },
      { tier: 'MASTER', leaguePoints: 20 },
      { tier: 'MASTER', leaguePoints: 96 },
      { tier: 'MASTER', leaguePoints: 154 },
      { tier: 'MASTER', leaguePoints: 402 },
      { tier: 'MASTER', leaguePoints: 554 },
    ];
    const points = seq.map((p, idx) => ({ ...p, observedAt: iso((seq.length - idx) * 3 * 86400e3) }));
    return {
      ok: true,
      data: {
        available: true,
        sampleCount: points.length,
        firstObservedAt: points[0]!.observedAt,
        latest: points[points.length - 1]!,
        peak: points[points.length - 1]!,
        transitions: [
          { observedAt: points[3]!.observedAt, direction: 'up', fromTier: 'DIAMOND', fromRank: 'I', toTier: 'MASTER', toRank: undefined },
        ],
        points,
      },
    };
  }
  const p = { tier: 'MASTER', leaguePoints: 554, observedAt: iso(2 * 86400e3) };
  return {
    ok: true,
    data: { available: true, sampleCount: 1, firstObservedAt: p.observedAt, latest: p, peak: p, transitions: [], points: [p] },
  };
};

const liveGameResponse = (): LiveGameResult => {
  const p = (teamId: number, champ: string, isSelf: boolean, identity?: QaIdentity) => ({
    puuid: `qa-${champ}-${teamId}`,
    riotId: isSelf ? 'Tidusss#FFX' : `${champ}Main#EUW`,
    riotIdResolved: true,
    championId: 1,
    championName: champ,
    championImageUrl: champIcon(champ),
    teamId,
    summonerSpells: [
      { id: 4, name: 'Destello', imageUrl: spellIcon('SummonerFlash') },
      { id: 7, name: 'Curar', imageUrl: spellIcon('SummonerHeal') },
    ],
    isSelf,
    identity,
    ranked: { available: true, tier: 'MASTER', rank: 'I', leaguePoints: 320 + teamId, wins: 200, losses: 180, winRate: 53 },
    recentForm: isSelf ? { sampleSize: 5, wins: 3, losses: 2, winRate: 60, averageKda: 3.1 } : undefined,
  });
  return {
    status: 'in_game',
    updatedAt: iso(10_000),
    game: {
      gameId: 987654321,
      gameMode: 'CLASSIC',
      gameType: 'MATCHED_GAME',
      queueId: 420,
      queueLabel: 'Solo/Duo',
      mapId: 11,
      mapName: 'Grieta del Invocador',
      gameStartedAt: iso(14 * 60 * 1000),
      gameLengthSeconds: 14 * 60,
      platformId: 'EUW1',
      participants: [],
      teams: [
        {
          teamId: 100,
          participants: [
            p(100, 'Aatrox', false),
            p(100, 'Viego', false),
            p(100, 'Ahri', false),
            p(100, 'Lucian', true),
            p(100, 'Nautilus', false),
          ],
        },
        {
          teamId: 200,
          participants: [
            p(200, 'Garen', false, { displayName: 'Thebausffs', role: 'TOP', isPro: false, isStreamer: true, streamUrl: 'https://twitch.tv/thebausffs' }),
            p(200, 'LeeSin', false),
            p(200, 'Syndra', false, { displayName: 'Caps', team: 'G2', role: 'MID', isPro: true, isStreamer: false }),
            p(200, 'Caitlyn', false, { displayName: 'Rekkles', team: 'KC', role: 'ADC', isPro: true, isStreamer: true }),
            p(200, 'Thresh', false),
          ],
        },
      ],
      bannedChampions: [
        { championId: 1, championName: 'Zed', championImageUrl: champIcon('Zed'), teamId: 100, pickTurn: 1 },
        { championId: 2, championName: 'Kassadin', championImageUrl: champIcon('Kassadin'), teamId: 200, pickTurn: 2 },
      ],
      lobbyRank: { participantsWithRank: 10, totalParticipants: 10, predominantTier: 'MASTER' },
      source: 'spectator',
    },
  };
};

const timelineResponse = (matchId: string): MatchTimelinePublicResponse => {
  const gold: Array<{ timestampMs: number; value: number }> = [];
  const cs: Array<{ timestampMs: number; value: number }> = [];
  const egold: Array<{ timestampMs: number; value: number }> = [];
  const ecs: Array<{ timestampMs: number; value: number }> = [];
  for (let m = 0; m <= 28; m += 2) {
    const t = m * 60_000;
    gold.push({ timestampMs: t, value: 500 + m * 430 + (m > 12 ? (m - 12) * 120 : 0) });
    cs.push({ timestampMs: t, value: Math.round(m * 7.9) });
    egold.push({ timestampMs: t, value: 500 + m * 400 });
    ecs.push({ timestampMs: t, value: Math.round(m * 7.4) });
  }
  return {
    ok: true,
    data: {
      matchId,
      frameIntervalMs: 60_000,
      durationMs: 28 * 60_000,
      tidussParticipantId: 4,
      tidussChampionName: 'Lucian',
      enemyAdcParticipantId: 9,
      enemyAdcChampionName: 'Caitlyn',
      laneCheckpoint10: { atMs: 600_000, cs: 82, gold: 5100, xp: 6200 },
      enemyAdcCheckpoint10: { atMs: 600_000, cs: 74, gold: 4600, xp: 5800 },
      laneComparison10: { csDiff: 8, goldDiff: 500, xpDiff: 400 },
      goldCurve: gold,
      csCurve: cs,
      enemyAdcGoldCurve: egold,
      enemyAdcCsCurve: ecs,
      events: [
        { type: 'item-purchase', timestampMs: 65_000, itemId: 6672, itemName: 'Hoja del Rey Arruinado', itemImageUrl: itemIcon(6672) },
        { type: 'champion-kill', timestampMs: 240_000, outcome: 'kill', otherChampionName: 'Caitlyn' },
        { type: 'champion-kill', timestampMs: 505_000, outcome: 'assist', otherChampionName: 'Thresh' },
        { type: 'objective', timestampMs: 610_000, objective: 'dragon', teamParticipated: true, label: 'Dragón de fuego' },
        { type: 'champion-kill', timestampMs: 900_000, outcome: 'death', otherChampionName: 'LeeSin' },
        { type: 'champion-kill', timestampMs: 1_240_000, outcome: 'kill', otherChampionName: 'Syndra', multiKill: 'double' },
        { type: 'objective', timestampMs: 1_500_000, objective: 'baron', teamParticipated: true, label: 'Barón Nashor' },
      ],
      updatedAt: iso(60_000),
    },
  };
};

const youtubeResponse = (): YouTubeFeedResponse => ({
  ok: true,
  data: {
    videos: [
      {
        id: QA_VIDEO_ID,
        title: '[QA] Cómo cerré la partida desde atrás — revisión',
        url: `https://www.youtube.com/watch?v=${QA_VIDEO_ID}`,
        thumbnailUrl: `https://i.ytimg.com/vi/${QA_VIDEO_ID}/hqdefault.jpg`,
        publishedAt: iso(30 * 3600e3),
        durationSeconds: 842,
        durationLabel: '14:02',
        isShort: false,
        contentType: 'video',
      },
    ],
    state: 'available',
    updatedAt: iso(60_000),
  },
  meta: { source: 'youtube-api', cached: true, updatedAt: iso(60_000) },
});

const twitchResponse = (): TwitchStatusResponse => ({
  ok: true,
  data: { isLive: false, state: 'offline', updatedAt: iso(60_000) },
  meta: { cached: true, updatedAt: iso(60_000), source: 'twitch' },
});

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let installed = false;

function activate(params: URLSearchParams): void {
  if (installed) return;
  installed = true;

  const today0 = params.get('today') === '0';
  const riotDown = params.get('riot') === 'down';
  const evoMode = params.get('evo') ?? '1';
  const live = params.get('live') === '1';

  // Asociación partida↔vídeo solo para QA (los tres candados ya pasaron;
  // este código no existe en el bundle de producción).
  if (!matchVideoLinks.some((l) => l.matchId === QA_VIDEO_MATCH_ID)) {
    matchVideoLinks.push({
      matchId: QA_VIDEO_MATCH_ID,
      youtubeVideoId: QA_VIDEO_ID,
      source: 'manual',
      confidence: 'verified',
      createdAt: iso(0),
    });
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/api/riot/overview')) {
      return Promise.resolve(
        riotDown
          ? jsonResponse({ ok: false, error: { code: 'RIOT_UNAVAILABLE', message: 'Riot no disponible.' } }, 503)
          : jsonResponse(overviewResponse(today0)),
      );
    }
    if (url.includes('/api/riot/rank-history')) return Promise.resolve(jsonResponse(rankHistoryResponse(evoMode)));
    if (url.includes('/api/riot/live')) {
      return Promise.resolve(jsonResponse(live && !riotDown ? liveGameResponse() : { status: 'not_in_game', updatedAt: iso(10_000) }));
    }
    if (/\/api\/riot\/matches\/[^/]+\/timeline/.test(url)) {
      const m = url.match(/\/matches\/([^/]+)\/timeline/);
      return Promise.resolve(jsonResponse(timelineResponse(m?.[1] ?? 'EUW1_7000000000')));
    }
    if (url.includes('/api/youtube')) return Promise.resolve(jsonResponse(youtubeResponse()));
    if (url.includes('/api/twitch/status')) return Promise.resolve(jsonResponse(twitchResponse()));
    return realFetch(input as RequestInfo, init);
  };

  document.documentElement.dataset.qaFixture = 'competitive-v3';
  console.info('[qa] competitive-v3 visual fixture ACTIVO — datos ficticios para revisión de diseño, no reales.');
}
