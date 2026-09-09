import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LANE_CHECKPOINT_MS,
  MIN_COMPLETED_ITEM_GOLD,
  buildParticipantChampionMap,
  computeLaneCheckpoint,
  computeLaneComparison,
  extractCurve,
  extractItemPurchaseEvents,
  extractKillEvents,
  extractObjectiveEvents,
  isCompletedItem,
  normalizeMatchTimeline,
  resolveEnemyAdcParticipantId,
  resolveParticipantId,
} from '../../../src/lib/riot/timeline-normalize.ts';
import type {
  DataDragonItemIndex,
  RiotTimelineDto,
  RiotTimelineFrameDto,
} from '../../../src/lib/riot/timeline-types.ts';
import type { RiotMatchDto, RiotParticipantDto } from '../../../src/lib/riot/types.ts';

/**
 * Todas las pruebas de este fichero son puras — nunca contra Riot real
 * (encargo §37). Cubren exactamente la lista pedida: normalización,
 * resolución de participante/ADC rival, CS/oro/XP@10 y sus diffs, rival
 * ausente, eventos de objetos/kills/objetivos, Timeline malformado,
 * partidas cortas/remakes.
 */

const M = 60_000;

// --- Fixtures reutilizables ---

const SELF_PUUID = 'puuid-tidusss';
const RIVAL_PUUID = 'puuid-rival-adc';
const SUPPORT_PUUID = 'puuid-rival-support';

const matchParticipant = (
  overrides: Partial<RiotParticipantDto>,
): RiotParticipantDto => ({
  puuid: 'puuid-x',
  championName: 'Champion',
  teamId: 100,
  teamPosition: 'BOTTOM',
  ...overrides,
});

const baseMatchParticipants = (): RiotParticipantDto[] => [
  matchParticipant({ puuid: SELF_PUUID, championName: 'Jinx', teamId: 100, teamPosition: 'BOTTOM' }),
  matchParticipant({ puuid: 'puuid-support', championName: 'Nami', teamId: 100, teamPosition: 'UTILITY' }),
  matchParticipant({ puuid: RIVAL_PUUID, championName: 'Draven', teamId: 200, teamPosition: 'BOTTOM' }),
  matchParticipant({ puuid: SUPPORT_PUUID, championName: 'Thresh', teamId: 200, teamPosition: 'UTILITY' }),
];

const timelineParticipants = () => [
  { participantId: 1, puuid: SELF_PUUID },
  { participantId: 2, puuid: 'puuid-support' },
  { participantId: 6, puuid: RIVAL_PUUID },
  { participantId: 7, puuid: SUPPORT_PUUID },
];

const participantFrame = (
  minionsKilled: number,
  totalGold: number,
  xp: number,
  jungleMinionsKilled = 0,
) => ({ minionsKilled, jungleMinionsKilled, totalGold, xp, currentGold: totalGold });

/** Frames cada minuto durante `minutes` minutos, con progresión lineal simple para ambos participantId. */
const buildFrames = (
  minutes: number,
  selfParticipantId: number,
  rivalParticipantId: number,
  events: Record<number, RiotTimelineFrameDto['events']> = {},
): RiotTimelineFrameDto[] =>
  Array.from({ length: minutes + 1 }, (_, minute) => ({
    timestamp: minute * M,
    participantFrames: {
      [String(selfParticipantId)]: participantFrame(
        minute * 8,
        500 + minute * 400,
        minute * 500,
      ),
      [String(rivalParticipantId)]: participantFrame(
        minute * 7,
        500 + minute * 350,
        minute * 450,
      ),
    },
    events: events[minute] ?? [],
  }));

const itemIndex: DataDragonItemIndex = {
  '3031': { name: 'Filo Infinito', goldTotal: 3400, purchasable: true, buildsInto: [], tags: ['Damage'] },
  '3006': { name: 'Botas de Berserker', goldTotal: 1100, purchasable: true, buildsInto: [], tags: ['Boots'] },
  '1042': { name: 'Puñal de Filo Doran', goldTotal: 450, purchasable: true, buildsInto: [], tags: ['Damage'] },
  '1001': { name: 'Botas', goldTotal: 300, purchasable: true, buildsInto: ['3006'], tags: ['Boots'] },
  '3086': { name: 'Filo Zephyr', goldTotal: 2900, purchasable: true, buildsInto: ['3087'], tags: ['Damage'] },
  '2003': { name: 'Poción de salud', goldTotal: 50, purchasable: true, buildsInto: [], tags: ['Consumable'] },
  '3340': { name: 'Baliza de exploración', goldTotal: 0, purchasable: true, buildsInto: [], tags: ['Trinket'] },
};
const itemImageUrl = (id: number) => `https://ddragon/item/${id}.png`;

// --- isCompletedItem ---

test('isCompletedItem: acepta un legendario real (Filo Infinito)', () => {
  assert.equal(isCompletedItem(3031, itemIndex), true);
});
test('isCompletedItem: acepta botas mejoradas (>= umbral)', () => {
  assert.equal(isCompletedItem(3006, itemIndex), true);
});
test('isCompletedItem: rechaza un objeto de inicio barato sin upgrade (Puñal de Filo Doran)', () => {
  assert.equal(isCompletedItem(1042, itemIndex), false);
});
test('isCompletedItem: rechaza un componente (tiene `into`)', () => {
  assert.equal(isCompletedItem(1001, itemIndex), false);
  assert.equal(isCompletedItem(3086, itemIndex), false);
});
test('isCompletedItem: rechaza un consumible', () => {
  assert.equal(isCompletedItem(2003, itemIndex), false);
});
test('isCompletedItem: rechaza un trinket', () => {
  assert.equal(isCompletedItem(3340, itemIndex), false);
});
test('isCompletedItem: un itemId ausente del índice nunca se inventa como completado', () => {
  assert.equal(isCompletedItem(999999, itemIndex), false);
});
test('MIN_COMPLETED_ITEM_GOLD es el umbral real usado (documentado, no mágico)', () => {
  assert.equal(MIN_COMPLETED_ITEM_GOLD, 1000);
});

// --- resolveParticipantId ---

test('resolveParticipantId: resuelve el participantId real por PUUID, nunca asume participantId=1 salvo que sea real', () => {
  const timeline: RiotTimelineDto = {
    info: { participants: [{ participantId: 4, puuid: SELF_PUUID }, { participantId: 1, puuid: 'otro' }] },
  };
  assert.equal(resolveParticipantId(timeline, SELF_PUUID), 4);
});
test('resolveParticipantId: PUUID ausente del Timeline devuelve undefined, nunca un valor por defecto', () => {
  const timeline: RiotTimelineDto = { info: { participants: [{ participantId: 1, puuid: 'otro' }] } };
  assert.equal(resolveParticipantId(timeline, SELF_PUUID), undefined);
});

// --- resolveEnemyAdcParticipantId ---

test('resolveEnemyAdcParticipantId: identifica al ADC rival real por teamPosition BOTTOM en el equipo contrario', () => {
  const result = resolveEnemyAdcParticipantId(baseMatchParticipants(), timelineParticipants(), 100);
  assert.deepEqual(result, { participantId: 6, championName: 'Draven' });
});
test('resolveEnemyAdcParticipantId: nunca asume "blue bot = posición fija" — funciona igual si Tidusss es el equipo 200', () => {
  const result = resolveEnemyAdcParticipantId(baseMatchParticipants(), timelineParticipants(), 200);
  assert.deepEqual(result, { participantId: 1, championName: 'Jinx' });
});
test('resolveEnemyAdcParticipantId: sin ninguna posición BOTTOM enemiga real, se degrada a undefined (nunca se adivina)', () => {
  const participants = baseMatchParticipants().map((p) =>
    p.puuid === RIVAL_PUUID ? { ...p, teamPosition: undefined } : p,
  );
  assert.equal(resolveEnemyAdcParticipantId(participants, timelineParticipants(), 100), undefined);
});
test('resolveEnemyAdcParticipantId: con DOS candidatos BOTTOM ambiguos en el rival, se degrada a undefined en vez de elegir uno al azar', () => {
  const participants = baseMatchParticipants().map((p) =>
    p.puuid === SUPPORT_PUUID ? { ...p, teamPosition: 'BOTTOM' } : p,
  );
  assert.equal(resolveEnemyAdcParticipantId(participants, timelineParticipants(), 100), undefined);
});

// --- buildParticipantChampionMap ---

test('buildParticipantChampionMap: cruza puuid→participantId (Timeline) con puuid→championName (match detail) para los 4 jugadores reales', () => {
  const map = buildParticipantChampionMap(baseMatchParticipants(), timelineParticipants());
  assert.deepEqual(map, { 1: 'Jinx', 2: 'Nami', 6: 'Draven', 7: 'Thresh' });
});

// --- computeLaneCheckpoint ---

test('computeLaneCheckpoint: CS/oro/XP reales en el frame del minuto 10 exacto', () => {
  const frames = buildFrames(20, 1, 6);
  const checkpoint = computeLaneCheckpoint(frames, 1, LANE_CHECKPOINT_MS);
  assert.deepEqual(checkpoint, { atMs: 10 * M, cs: 80, gold: 500 + 10 * 400, xp: 10 * 500 });
});
test('computeLaneCheckpoint: partida corta/remake que no llega al minuto 10 → undefined, nunca el último frame disponible disfrazado de "minuto 10"', () => {
  const frames = buildFrames(4, 1, 6); // termina en el minuto 4
  assert.equal(computeLaneCheckpoint(frames, 1, LANE_CHECKPOINT_MS), undefined);
});
test('computeLaneCheckpoint: participantId sin frame propio (Timeline malformado) → undefined', () => {
  const frames: RiotTimelineFrameDto[] = [{ timestamp: 12 * M, participantFrames: {} }];
  assert.equal(computeLaneCheckpoint(frames, 1, LANE_CHECKPOINT_MS), undefined);
});
test('computeLaneCheckpoint: frames sin timestamp se ignoran en vez de romper el cálculo', () => {
  const frames: RiotTimelineFrameDto[] = [
    { participantFrames: { '1': participantFrame(10, 1000, 500) } }, // sin timestamp
    { timestamp: 10 * M, participantFrames: { '1': participantFrame(80, 4500, 5000) } },
  ];
  const checkpoint = computeLaneCheckpoint(frames, 1, LANE_CHECKPOINT_MS);
  assert.deepEqual(checkpoint, { atMs: 10 * M, cs: 80, gold: 4500, xp: 5000 });
});
test('computeLaneCheckpoint: gold/xp ausentes en el frame real → undefined (nunca 0 inventado)', () => {
  const frames: RiotTimelineFrameDto[] = [
    { timestamp: 10 * M, participantFrames: { '1': { minionsKilled: 80 } } },
  ];
  assert.equal(computeLaneCheckpoint(frames, 1, LANE_CHECKPOINT_MS), undefined);
});

// --- computeLaneComparison ---

test('computeLaneComparison: diff real solo cuando AMBOS checkpoints existen', () => {
  const self = { atMs: 10 * M, cs: 86, gold: 4120, xp: 5200 };
  const rival = { atMs: 10 * M, cs: 77, gold: 3690, xp: 4900 };
  assert.deepEqual(computeLaneComparison(self, rival), { csDiff: 9, goldDiff: 430, xpDiff: 300 });
});
test('computeLaneComparison: sin ADC rival identificado, nunca hay un diff a medias', () => {
  const self = { atMs: 10 * M, cs: 86, gold: 4120, xp: 5200 };
  assert.equal(computeLaneComparison(self, undefined), undefined);
  assert.equal(computeLaneComparison(undefined, undefined), undefined);
});

// --- extractCurve ---

test('extractCurve: curva de oro real punto a punto para el participante pedido', () => {
  const frames = buildFrames(3, 1, 6);
  const curve = extractCurve(frames, 1, 'gold');
  assert.deepEqual(curve, [
    { timestampMs: 0, value: 500 },
    { timestampMs: M, value: 900 },
    { timestampMs: 2 * M, value: 1300 },
    { timestampMs: 3 * M, value: 1700 },
  ]);
});
test('extractCurve: curva de CS suma minions de línea + de jungla', () => {
  const frames: RiotTimelineFrameDto[] = [
    { timestamp: M, participantFrames: { '1': participantFrame(10, 500, 100, 2) } },
  ];
  assert.deepEqual(extractCurve(frames, 1, 'cs'), [{ timestampMs: M, value: 12 }]);
});
test('extractCurve: frames sin el participante pedido se omiten, nunca un punto a 0 inventado', () => {
  const frames: RiotTimelineFrameDto[] = [{ timestamp: M, participantFrames: {} }];
  assert.deepEqual(extractCurve(frames, 1, 'gold'), []);
});

// --- extractItemPurchaseEvents ---

test('extractItemPurchaseEvents: solo objetos completados, cronológicos, con nombre real', () => {
  const frames: RiotTimelineFrameDto[] = [
    {
      timestamp: 8 * M,
      events: [
        { type: 'ITEM_PURCHASED', participantId: 1, itemId: 1042, timestamp: 8 * M }, // objeto de inicio: no cuenta
        { type: 'ITEM_PURCHASED', participantId: 1, itemId: 2003, timestamp: 8 * M }, // consumible: no cuenta
      ],
    },
    {
      timestamp: 14 * M,
      events: [
        { type: 'ITEM_PURCHASED', participantId: 1, itemId: 3031, timestamp: 14 * M },
        { type: 'ITEM_PURCHASED', participantId: 6, itemId: 3031, timestamp: 14 * M }, // otro participante: no cuenta
      ],
    },
    { timestamp: 20 * M, events: [{ type: 'ITEM_PURCHASED', participantId: 1, itemId: 3006, timestamp: 20 * M }] },
  ];
  const events = extractItemPurchaseEvents(frames, 1, itemIndex, itemImageUrl);
  assert.deepEqual(events, [
    { type: 'item-purchase', timestampMs: 14 * M, itemId: 3031, itemName: 'Filo Infinito', itemImageUrl: 'https://ddragon/item/3031.png' },
    { type: 'item-purchase', timestampMs: 20 * M, itemId: 3006, itemName: 'Botas de Berserker', itemImageUrl: 'https://ddragon/item/3006.png' },
  ]);
});
test('extractItemPurchaseEvents: un ITEM_UNDO real deshace la compra que nunca llegó a ocurrir', () => {
  const frames: RiotTimelineFrameDto[] = [
    {
      timestamp: 9 * M,
      events: [
        { type: 'ITEM_PURCHASED', participantId: 1, itemId: 3031, timestamp: 9 * M },
        { type: 'ITEM_UNDO', participantId: 1, beforeId: 3031, afterId: 0, timestamp: 9 * M + 500 },
      ],
    },
  ];
  assert.deepEqual(extractItemPurchaseEvents(frames, 1, itemIndex, itemImageUrl), []);
});
test('extractItemPurchaseEvents: una venta posterior (ITEM_SOLD) NO borra el hecho real de que el objeto estuvo completado', () => {
  const frames: RiotTimelineFrameDto[] = [
    { timestamp: 10 * M, events: [{ type: 'ITEM_PURCHASED', participantId: 1, itemId: 3031, timestamp: 10 * M }] },
    { timestamp: 25 * M, events: [{ type: 'ITEM_SOLD', participantId: 1, itemId: 3031, timestamp: 25 * M }] },
  ];
  const events = extractItemPurchaseEvents(frames, 1, itemIndex, itemImageUrl);
  assert.equal(events.length, 1);
  assert.equal(events[0]!.itemId, 3031);
});
test('extractItemPurchaseEvents: sin ninguna compra completada real, la lista queda vacía (nunca "primer objeto" inventado)', () => {
  const frames: RiotTimelineFrameDto[] = [
    { timestamp: M, events: [{ type: 'ITEM_PURCHASED', participantId: 1, itemId: 1042, timestamp: M }] },
  ];
  assert.deepEqual(extractItemPurchaseEvents(frames, 1, itemIndex, itemImageUrl), []);
});

// --- extractKillEvents ---

const championMap = { 1: 'Jinx', 6: 'Draven', 7: 'Thresh' };

test('extractKillEvents: kill real de Tidusss con el nombre real de la víctima', () => {
  const frames: RiotTimelineFrameDto[] = [
    { timestamp: 12 * M, events: [{ type: 'CHAMPION_KILL', killerId: 1, victimId: 6, timestamp: 12 * M }] },
  ];
  assert.deepEqual(extractKillEvents(frames, 1, championMap), [
    { type: 'champion-kill', timestampMs: 12 * M, outcome: 'kill', otherChampionName: 'Draven', multiKill: undefined },
  ]);
});
test('extractKillEvents: muerte real de Tidusss con el nombre real del verdugo', () => {
  const frames: RiotTimelineFrameDto[] = [
    { timestamp: 15 * M, events: [{ type: 'CHAMPION_KILL', killerId: 6, victimId: 1, timestamp: 15 * M }] },
  ];
  assert.deepEqual(extractKillEvents(frames, 1, championMap), [
    { type: 'champion-kill', timestampMs: 15 * M, outcome: 'death', otherChampionName: 'Draven' },
  ]);
});
test('extractKillEvents: asistencia real de Tidusss', () => {
  const frames: RiotTimelineFrameDto[] = [
    { timestamp: 16 * M, events: [{ type: 'CHAMPION_KILL', killerId: 7, victimId: 6, assistingParticipantIds: [1], timestamp: 16 * M }] },
  ];
  assert.deepEqual(extractKillEvents(frames, 1, championMap), [
    { type: 'champion-kill', timestampMs: 16 * M, outcome: 'assist', otherChampionName: 'Draven' },
  ]);
});
test('extractKillEvents: una kill donde Tidusss no participa no genera ningún evento (centrado en Tidusss, nunca las ~40 kills de la partida)', () => {
  const frames: RiotTimelineFrameDto[] = [
    { timestamp: 12 * M, events: [{ type: 'CHAMPION_KILL', killerId: 6, victimId: 7, timestamp: 12 * M }] },
  ];
  assert.deepEqual(extractKillEvents(frames, 1, championMap), []);
});
test('extractKillEvents: un multi-kill se marca SOLO cuando Riot emite CHAMPION_SPECIAL_KILL real, nunca inferido por ventana temporal', () => {
  const frames: RiotTimelineFrameDto[] = [
    {
      timestamp: 18 * M,
      events: [
        { type: 'CHAMPION_KILL', killerId: 1, victimId: 6, timestamp: 18 * M },
        { type: 'CHAMPION_SPECIAL_KILL', killType: 'KILL_MULTI', killerId: 1, multiKillLength: 3, timestamp: 18 * M },
      ],
    },
  ];
  const events = extractKillEvents(frames, 1, championMap);
  assert.equal(events.length, 1);
  assert.equal(events[0]!.multiKill, 'triple');
});
test('extractKillEvents: sin evento CHAMPION_SPECIAL_KILL real, una kill nunca lleva multiKill aunque haya varias kills seguidas', () => {
  const frames: RiotTimelineFrameDto[] = [
    { timestamp: 18 * M, events: [{ type: 'CHAMPION_KILL', killerId: 1, victimId: 6, timestamp: 18 * M }] },
    { timestamp: 18 * M + 5000, events: [{ type: 'CHAMPION_KILL', killerId: 1, victimId: 7, timestamp: 18 * M + 5000 }] },
  ];
  const events = extractKillEvents(frames, 1, championMap);
  assert.ok(events.every((event) => event.multiKill === undefined));
});
test('extractKillEvents: víctima sin campeón identificable (mapa incompleto) omite el nombre en vez de inventarlo', () => {
  const frames: RiotTimelineFrameDto[] = [
    { timestamp: 12 * M, events: [{ type: 'CHAMPION_KILL', killerId: 1, victimId: 99, timestamp: 12 * M }] },
  ];
  assert.deepEqual(extractKillEvents(frames, 1, championMap), [
    { type: 'champion-kill', timestampMs: 12 * M, outcome: 'kill', otherChampionName: undefined, multiKill: undefined },
  ]);
});

// --- extractObjectiveEvents ---

test('extractObjectiveEvents: dragón real conseguido por el equipo de Tidusss', () => {
  const frames: RiotTimelineFrameDto[] = [
    { timestamp: 14 * M, events: [{ type: 'ELITE_MONSTER_KILL', monsterType: 'DRAGON', killerTeamId: 100, timestamp: 14 * M }] },
  ];
  assert.deepEqual(extractObjectiveEvents(frames, 100), [
    { type: 'objective', timestampMs: 14 * M, objective: 'dragon', teamParticipated: true, label: 'Dragón' },
  ]);
});
test('extractObjectiveEvents: barón conseguido por el equipo rival se marca como tal, no se oculta', () => {
  const frames: RiotTimelineFrameDto[] = [
    { timestamp: 25 * M, events: [{ type: 'ELITE_MONSTER_KILL', monsterType: 'BARON_NASHOR', killerTeamId: 200, timestamp: 25 * M }] },
  ];
  assert.deepEqual(extractObjectiveEvents(frames, 100), [
    { type: 'objective', timestampMs: 25 * M, objective: 'baron', teamParticipated: false, label: 'Barón' },
  ]);
});
test('extractObjectiveEvents: heraldo/atakhan/enjambre se etiquetan con su tipo real', () => {
  const frames: RiotTimelineFrameDto[] = [
    { timestamp: 8 * M, events: [{ type: 'ELITE_MONSTER_KILL', monsterType: 'RIFTHERALD', killerTeamId: 100, timestamp: 8 * M }] },
  ];
  const [event] = extractObjectiveEvents(frames, 100);
  assert.equal(event!.objective, 'herald');
  assert.equal(event!.label, 'Heraldo');
});
test('extractObjectiveEvents: torre destruida — `teamId` es el dueño de la torre perdida, no quien la destruye', () => {
  const frames: RiotTimelineFrameDto[] = [
    { timestamp: 10 * M, events: [{ type: 'BUILDING_KILL', buildingType: 'TOWER_BUILDING', teamId: 200, timestamp: 10 * M }] },
  ];
  assert.deepEqual(extractObjectiveEvents(frames, 100), [
    { type: 'objective', timestampMs: 10 * M, objective: 'tower', teamParticipated: true, label: 'Torre' },
  ]);
});
test('extractObjectiveEvents: sin ningún objetivo real en el Timeline, la lista queda vacía', () => {
  assert.deepEqual(extractObjectiveEvents([{ timestamp: M, events: [] }], 100), []);
});

// --- normalizeMatchTimeline (composición completa) ---

const buildTimelineDto = (minutes: number, events: Record<number, RiotTimelineFrameDto['events']> = {}): RiotTimelineDto => ({
  metadata: { matchId: 'EUW1_1' },
  info: {
    frameInterval: 60_000,
    participants: timelineParticipants(),
    frames: buildFrames(minutes, 1, 6, events),
  },
});
const buildMatchDto = (): RiotMatchDto => ({
  metadata: { matchId: 'EUW1_1' },
  info: { participants: baseMatchParticipants() },
});

test('normalizeMatchTimeline: compone un MatchTimeline real con checkpoint@10, diff y curvas', () => {
  const timeline = normalizeMatchTimeline({
    matchId: 'EUW1_1',
    timelineDto: buildTimelineDto(20),
    matchDto: buildMatchDto(),
    selfPuuid: SELF_PUUID,
    itemIndex,
    itemImageUrl,
    updatedAt: '2026-09-09T00:00:00.000Z',
  });
  assert.ok(timeline);
  assert.equal(timeline!.tidussParticipantId, 1);
  assert.equal(timeline!.tidussChampionName, 'Jinx');
  assert.equal(timeline!.enemyAdcParticipantId, 6);
  assert.equal(timeline!.enemyAdcChampionName, 'Draven');
  assert.ok(timeline!.laneCheckpoint10);
  assert.ok(timeline!.enemyAdcCheckpoint10);
  assert.ok(timeline!.laneComparison10);
  assert.equal(timeline!.goldCurve.length, 21);
  assert.ok(timeline!.enemyAdcGoldCurve && timeline!.enemyAdcGoldCurve.length === 21);
  assert.equal(timeline!.durationMs, 20 * M);
});
test('normalizeMatchTimeline: Tidusss no resoluble (PUUID ausente del Timeline) → undefined, nunca un timeline a medias', () => {
  const timeline = normalizeMatchTimeline({
    matchId: 'EUW1_1',
    timelineDto: buildTimelineDto(20),
    matchDto: buildMatchDto(),
    selfPuuid: 'puuid-desconocido',
    itemIndex,
    itemImageUrl,
    updatedAt: '2026-09-09T00:00:00.000Z',
  });
  assert.equal(timeline, undefined);
});
test('normalizeMatchTimeline: sin ADC rival identificable, el timeline sigue siendo válido pero sin campos de rival', () => {
  const matchDto = buildMatchDto();
  matchDto.info!.participants = matchDto.info!.participants!.map((p) =>
    p.puuid === RIVAL_PUUID ? { ...p, teamPosition: undefined } : p,
  );
  const timeline = normalizeMatchTimeline({
    matchId: 'EUW1_1',
    timelineDto: buildTimelineDto(20),
    matchDto,
    selfPuuid: SELF_PUUID,
    itemIndex,
    itemImageUrl,
    updatedAt: '2026-09-09T00:00:00.000Z',
  });
  assert.ok(timeline);
  assert.equal(timeline!.enemyAdcParticipantId, undefined);
  assert.equal(timeline!.enemyAdcChampionName, undefined);
  assert.equal(timeline!.enemyAdcCheckpoint10, undefined);
  assert.equal(timeline!.laneComparison10, undefined);
  assert.equal(timeline!.enemyAdcGoldCurve, undefined);
  // Los datos propios de Tidusss siguen presentes — un rival no identificable nunca bloquea el resto.
  assert.ok(timeline!.laneCheckpoint10);
  assert.ok(timeline!.goldCurve.length > 0);
});
test('normalizeMatchTimeline: partida corta/remake (no llega al minuto 10) sigue devolviendo curvas reales, solo sin checkpoint@10', () => {
  const timeline = normalizeMatchTimeline({
    matchId: 'EUW1_1',
    timelineDto: buildTimelineDto(3),
    matchDto: buildMatchDto(),
    selfPuuid: SELF_PUUID,
    itemIndex,
    itemImageUrl,
    updatedAt: '2026-09-09T00:00:00.000Z',
  });
  assert.ok(timeline);
  assert.equal(timeline!.laneCheckpoint10, undefined);
  assert.equal(timeline!.laneComparison10, undefined);
  assert.equal(timeline!.durationMs, 3 * M);
  assert.ok(timeline!.goldCurve.length > 0);
});
test('normalizeMatchTimeline: Timeline malformado (sin info.frames) no lanza, produce un timeline con listas vacías', () => {
  const timeline = normalizeMatchTimeline({
    matchId: 'EUW1_1',
    timelineDto: { metadata: { matchId: 'EUW1_1' }, info: { participants: timelineParticipants() } },
    matchDto: buildMatchDto(),
    selfPuuid: SELF_PUUID,
    itemIndex,
    itemImageUrl,
    updatedAt: '2026-09-09T00:00:00.000Z',
  });
  assert.ok(timeline);
  assert.deepEqual(timeline!.goldCurve, []);
  assert.deepEqual(timeline!.events, []);
  assert.equal(timeline!.laneCheckpoint10, undefined);
  assert.equal(timeline!.durationMs, 0);
});
test('normalizeMatchTimeline: los eventos finales quedan ordenados cronológicamente aunque combinen objetos/kills/objetivos', () => {
  const events: Record<number, RiotTimelineFrameDto['events']> = {
    5: [{ type: 'ELITE_MONSTER_KILL', monsterType: 'DRAGON', killerTeamId: 100, timestamp: 5 * M }],
    3: [{ type: 'ITEM_PURCHASED', participantId: 1, itemId: 3031, timestamp: 3 * M }],
    8: [{ type: 'CHAMPION_KILL', killerId: 1, victimId: 6, timestamp: 8 * M }],
  };
  const timeline = normalizeMatchTimeline({
    matchId: 'EUW1_1',
    timelineDto: buildTimelineDto(10, events),
    matchDto: buildMatchDto(),
    selfPuuid: SELF_PUUID,
    itemIndex,
    itemImageUrl,
    updatedAt: '2026-09-09T00:00:00.000Z',
  });
  assert.ok(timeline);
  const timestamps = timeline!.events.map((event) => event.timestampMs);
  assert.deepEqual(timestamps, [...timestamps].sort((a, b) => a - b));
  assert.deepEqual(timestamps, [3 * M, 5 * M, 8 * M]);
});
test('normalizeMatchTimeline: partida sin ningún participante identificado (dto completamente vacío) → undefined, sin lanzar', () => {
  const timeline = normalizeMatchTimeline({
    matchId: 'EUW1_1',
    timelineDto: {},
    matchDto: {},
    selfPuuid: SELF_PUUID,
    itemIndex,
    itemImageUrl,
    updatedAt: '2026-09-09T00:00:00.000Z',
  });
  assert.equal(timeline, undefined);
});
