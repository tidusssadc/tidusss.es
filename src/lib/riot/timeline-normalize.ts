import type { RiotMatchDto, RiotParticipantDto } from './types';
import type {
  ChampionKillEvent,
  DataDragonItemIndex,
  ItemPurchaseEvent,
  LaneCheckpoint,
  LaneComparison,
  MatchTimeline,
  MultiKillLabel,
  ObjectiveEvent,
  RiotTimelineDto,
  RiotTimelineFrameDto,
  RiotTimelineParticipantDto,
  TimelineCurvePoint,
} from './timeline-types';

/**
 * Instante de referencia para el "resumen de línea" (encargo §11: 10 min es
 * la prioridad — laning; 15/20 min quedan fuera de este primer Timeline).
 */
export const LANE_CHECKPOINT_MS = 10 * 60 * 1000;

/** Mínimo de oro (Data Dragon `gold.total`) para tratar un objeto sin
 * upgrade como "completado" en la vista principal — descarta objetos de
 * inicio (Arco/Espada de Doran, ~400-500 oro), botas básicas y trinkets,
 * sin descartar botas mejoradas (~1000-1300) ni ningún legendario real. */
export const MIN_COMPLETED_ITEM_GOLD = 1000;

const monsterLabel = (monsterType: string) =>
  (
    ({
      DRAGON: 'Dragón',
      RIFTHERALD: 'Heraldo',
      BARON_NASHOR: 'Barón',
      ATAKHAN: 'Atakhan',
      HORDE: 'Enjambre del Vacío',
    }) as Record<string, string>
  )[monsterType] ?? monsterType;

const monsterObjectiveKind = (monsterType: string) => {
  if (monsterType === 'RIFTHERALD') return 'herald' as const;
  if (monsterType === 'BARON_NASHOR') return 'baron' as const;
  if (monsterType === 'ATAKHAN') return 'atakhan' as const;
  if (monsterType === 'HORDE') return 'grubs' as const;
  return 'dragon' as const;
};

const MULTI_KILL_LABELS: Record<number, MultiKillLabel> = {
  2: 'double',
  3: 'triple',
  4: 'quadra',
  5: 'penta',
};
const multiKillLabel = (length: number): MultiKillLabel | undefined =>
  MULTI_KILL_LABELS[length];

/**
 * Un objeto cuenta como "completado" para la vista principal cuando: es
 * comprable, Riot no lo marca como componente de nada más (`into` vacío),
 * no es un consumible/trinket, y su coste total supera el umbral — así se
 * excluyen objetos de inicio y trinkets sin excluir botas mejoradas ni
 * ningún legendario real. Nunca se inventa "primer objeto" si el objeto no
 * está en el índice de Data Dragon: se omite, no se adivina.
 */
export const isCompletedItem = (
  itemId: number,
  index: DataDragonItemIndex,
): boolean => {
  const item = index[String(itemId)];
  if (!item) return false;
  if (!item.purchasable) return false;
  if (item.buildsInto.length > 0) return false;
  if (item.tags.some((tag) => tag === 'Consumable' || tag === 'Trinket'))
    return false;
  return item.goldTotal >= MIN_COMPLETED_ITEM_GOLD;
};

/** PUUID → participantId real de esta partida — nunca se asume participantId === 1 ni ningún orden fijo. */
export const resolveParticipantId = (
  timeline: RiotTimelineDto,
  puuid: string,
): number | undefined =>
  timeline.info?.participants?.find((entry) => entry.puuid === puuid)
    ?.participantId;

/**
 * ADC rival: `teamPosition === 'BOTTOM'` en el equipo contrario. Si Riot no
 * da una posición BOTTOM enemiga inequívoca (0 o >1 candidatos), se
 * degrada a `undefined` — nunca se adivina cuál de los cinco rivales era
 * el ADC.
 */
export const resolveEnemyAdcParticipantId = (
  matchParticipants: readonly RiotParticipantDto[],
  timelineParticipants: readonly RiotTimelineParticipantDto[],
  selfTeamId: number,
): { participantId: number; championName: string } | undefined => {
  const candidates = matchParticipants.filter(
    (participant) =>
      participant.teamId !== undefined &&
      participant.teamId !== selfTeamId &&
      participant.teamPosition === 'BOTTOM',
  );
  if (candidates.length !== 1) return undefined;
  const candidate = candidates[0]!;
  const mapped = timelineParticipants.find(
    (entry) => entry.puuid === candidate.puuid,
  );
  if (mapped?.participantId === undefined || !candidate.championName)
    return undefined;
  return {
    participantId: mapped.participantId,
    championName: candidate.championName,
  };
};

/** participantId → nombre de campeón real, cruzando el Timeline (puuid→participantId) con el match detail (puuid→championName). */
export const buildParticipantChampionMap = (
  matchParticipants: readonly RiotParticipantDto[],
  timelineParticipants: readonly RiotTimelineParticipantDto[],
): Record<number, string> => {
  const map: Record<number, string> = {};
  for (const entry of timelineParticipants) {
    if (entry.participantId === undefined || !entry.puuid) continue;
    const match = matchParticipants.find((p) => p.puuid === entry.puuid);
    if (match?.championName) map[entry.participantId] = match.championName;
  }
  return map;
};

/**
 * CS/oro/XP reales en el frame más cercano SIN PASARSE del instante
 * pedido. Honestidad ante partidas cortas/remakes: si la partida ni
 * siquiera llegó a ese instante, no hay checkpoint — nunca se usa el
 * último frame disponible de una partida de 3 minutos como si fuera "el
 * minuto 10".
 */
export const computeLaneCheckpoint = (
  frames: readonly RiotTimelineFrameDto[],
  participantId: number,
  atMs: number,
): LaneCheckpoint | undefined => {
  const withTimestamp = frames.filter((frame) => frame.timestamp !== undefined);
  const lastFrame = withTimestamp[withTimestamp.length - 1];
  if (!lastFrame || (lastFrame.timestamp ?? 0) < atMs) return undefined;
  const eligible = withTimestamp.filter(
    (frame) => (frame.timestamp ?? Infinity) <= atMs,
  );
  const frame = eligible[eligible.length - 1];
  if (!frame) return undefined;
  const participantFrame = frame.participantFrames?.[String(participantId)];
  if (!participantFrame) return undefined;
  const { totalGold: gold, xp } = participantFrame;
  if (gold === undefined || xp === undefined) return undefined;
  const cs =
    (participantFrame.minionsKilled ?? 0) +
    (participantFrame.jungleMinionsKilled ?? 0);
  return { atMs: frame.timestamp ?? atMs, cs, gold, xp };
};

/** Solo cuando AMBOS checkpoints existen (encargo §10) — nunca un diff a medias. */
export const computeLaneComparison = (
  self: LaneCheckpoint | undefined,
  rival: LaneCheckpoint | undefined,
): LaneComparison | undefined => {
  if (!self || !rival) return undefined;
  return {
    csDiff: self.cs - rival.cs,
    goldDiff: self.gold - rival.gold,
    xpDiff: self.xp - rival.xp,
  };
};

export const extractCurve = (
  frames: readonly RiotTimelineFrameDto[],
  participantId: number,
  metric: 'gold' | 'cs',
): TimelineCurvePoint[] =>
  frames.flatMap((frame) => {
    if (frame.timestamp === undefined) return [];
    const participantFrame = frame.participantFrames?.[String(participantId)];
    if (!participantFrame) return [];
    const value =
      metric === 'gold'
        ? participantFrame.totalGold
        : (participantFrame.minionsKilled ?? 0) +
          (participantFrame.jungleMinionsKilled ?? 0);
    if (value === undefined) return [];
    return [{ timestampMs: frame.timestamp, value }];
  });

/**
 * Compras de objetos completados, cronológicas. Procesa `ITEM_UNDO` real
 * (deshacer una compra que no llegó a ocurrir) — nunca resta objetos por
 * una venta posterior (`ITEM_SOLD`): un objeto vendido a los 25 min sí
 * estuvo completado antes, eso sigue siendo un hecho real.
 */
export const extractItemPurchaseEvents = (
  frames: readonly RiotTimelineFrameDto[],
  participantId: number,
  itemIndex: DataDragonItemIndex,
  itemImageUrl: (id: number) => string,
): ItemPurchaseEvent[] => {
  const pending: ItemPurchaseEvent[] = [];
  for (const frame of frames) {
    for (const event of frame.events ?? []) {
      if (event.participantId !== participantId) continue;
      if (
        event.type === 'ITEM_PURCHASED' &&
        event.itemId !== undefined &&
        event.timestamp !== undefined &&
        isCompletedItem(event.itemId, itemIndex)
      ) {
        const item = itemIndex[String(event.itemId)]!;
        pending.push({
          type: 'item-purchase',
          timestampMs: event.timestamp,
          itemId: event.itemId,
          itemName: item.name,
          itemImageUrl: itemImageUrl(event.itemId),
        });
      } else if (event.type === 'ITEM_UNDO' && event.beforeId !== undefined) {
        const index = [...pending]
          .reverse()
          .findIndex((purchase) => purchase.itemId === event.beforeId);
        if (index !== -1) pending.splice(pending.length - 1 - index, 1);
      }
    }
  }
  return pending;
};

/**
 * Kills/muertes/asistencias reales de Tidusss, centrado en él — nunca las
 * ~40 kills de toda la partida. Los multi-kills solo se marcan cuando Riot
 * emite el evento `CHAMPION_SPECIAL_KILL` real (`killType: 'KILL_MULTI'`),
 * nunca por inferencia de ventana temporal.
 */
export const extractKillEvents = (
  frames: readonly RiotTimelineFrameDto[],
  participantId: number,
  championMap: Record<number, string>,
): ChampionKillEvent[] => {
  const events: ChampionKillEvent[] = [];
  for (const frame of frames) {
    const rawEvents = frame.events ?? [];
    const multiKillAt = new Map<number, MultiKillLabel | undefined>();
    for (const event of rawEvents) {
      if (
        event.type === 'CHAMPION_SPECIAL_KILL' &&
        event.killType === 'KILL_MULTI' &&
        event.killerId === participantId &&
        event.timestamp !== undefined &&
        event.multiKillLength !== undefined
      ) {
        multiKillAt.set(event.timestamp, multiKillLabel(event.multiKillLength));
      }
    }
    for (const event of rawEvents) {
      if (event.type !== 'CHAMPION_KILL' || event.timestamp === undefined)
        continue;
      if (event.killerId === participantId) {
        events.push({
          type: 'champion-kill',
          timestampMs: event.timestamp,
          outcome: 'kill',
          otherChampionName:
            event.victimId !== undefined
              ? championMap[event.victimId]
              : undefined,
          multiKill: multiKillAt.get(event.timestamp),
        });
      } else if (event.victimId === participantId) {
        events.push({
          type: 'champion-kill',
          timestampMs: event.timestamp,
          outcome: 'death',
          otherChampionName:
            event.killerId !== undefined
              ? championMap[event.killerId]
              : undefined,
        });
      } else if (event.assistingParticipantIds?.includes(participantId)) {
        events.push({
          type: 'champion-kill',
          timestampMs: event.timestamp,
          outcome: 'assist',
          otherChampionName:
            event.victimId !== undefined
              ? championMap[event.victimId]
              : undefined,
        });
      }
    }
  }
  return events;
};

/**
 * Dragón/Heraldo/Barón/Atakhan/Enjambre + torres — priorizando de forma
 * visible los objetivos del propio equipo (`teamParticipated`), sin
 * convertirlo en un replay completo (encargo §19).
 */
export const extractObjectiveEvents = (
  frames: readonly RiotTimelineFrameDto[],
  selfTeamId: number,
): ObjectiveEvent[] => {
  const events: ObjectiveEvent[] = [];
  for (const frame of frames) {
    for (const event of frame.events ?? []) {
      if (
        event.type === 'ELITE_MONSTER_KILL' &&
        event.timestamp !== undefined &&
        event.monsterType
      ) {
        events.push({
          type: 'objective',
          timestampMs: event.timestamp,
          objective: monsterObjectiveKind(event.monsterType),
          teamParticipated: event.killerTeamId === selfTeamId,
          label: monsterLabel(event.monsterType),
        });
      }
      if (
        event.type === 'BUILDING_KILL' &&
        event.timestamp !== undefined &&
        event.buildingType === 'TOWER_BUILDING'
      ) {
        events.push({
          type: 'objective',
          timestampMs: event.timestamp,
          objective: 'tower',
          // `teamId` en BUILDING_KILL es el equipo DUEÑO de la torre
          // destruida (el que la pierde), no quien la destruye.
          teamParticipated: event.teamId !== selfTeamId,
          label: 'Torre',
        });
      }
    }
  }
  return events;
};

export interface NormalizeMatchTimelineInput {
  matchId: string;
  timelineDto: RiotTimelineDto;
  matchDto: RiotMatchDto;
  selfPuuid: string;
  itemIndex: DataDragonItemIndex;
  itemImageUrl: (id: number) => string;
  updatedAt: string;
}

/**
 * Compositor único: cruza Timeline-V5 (frames/eventos por participantId)
 * con el detalle de partida ya cacheado (puuid/teamPosition/championName)
 * para producir un `MatchTimeline` centrado en Tidusss. Devuelve
 * `undefined` si Tidusss no puede resolverse con certeza en esta partida
 * (nunca se asume participantId=1 ni ninguna posición fija).
 */
export const normalizeMatchTimeline = (
  input: NormalizeMatchTimelineInput,
): MatchTimeline | undefined => {
  const {
    matchId,
    timelineDto,
    matchDto,
    selfPuuid,
    itemIndex,
    itemImageUrl,
    updatedAt,
  } = input;
  const frames = timelineDto.info?.frames ?? [];
  const timelineParticipants = timelineDto.info?.participants ?? [];
  const matchParticipants = matchDto.info?.participants ?? [];

  const tidussParticipantId = resolveParticipantId(timelineDto, selfPuuid);
  const tidussMatchParticipant = matchParticipants.find(
    (participant) => participant.puuid === selfPuuid,
  );
  if (
    tidussParticipantId === undefined ||
    !tidussMatchParticipant?.championName ||
    tidussMatchParticipant.teamId === undefined
  )
    return undefined;
  const selfTeamId = tidussMatchParticipant.teamId;

  const enemyAdc = resolveEnemyAdcParticipantId(
    matchParticipants,
    timelineParticipants,
    selfTeamId,
  );
  const championMap = buildParticipantChampionMap(
    matchParticipants,
    timelineParticipants,
  );

  const laneCheckpoint10 = computeLaneCheckpoint(
    frames,
    tidussParticipantId,
    LANE_CHECKPOINT_MS,
  );
  const enemyAdcCheckpoint10 = enemyAdc
    ? computeLaneCheckpoint(frames, enemyAdc.participantId, LANE_CHECKPOINT_MS)
    : undefined;
  const laneComparison10 = computeLaneComparison(
    laneCheckpoint10,
    enemyAdcCheckpoint10,
  );

  const goldCurve = extractCurve(frames, tidussParticipantId, 'gold');
  const csCurve = extractCurve(frames, tidussParticipantId, 'cs');
  const enemyAdcGoldCurve = enemyAdc
    ? extractCurve(frames, enemyAdc.participantId, 'gold')
    : undefined;
  const enemyAdcCsCurve = enemyAdc
    ? extractCurve(frames, enemyAdc.participantId, 'cs')
    : undefined;
  const itemEvents = extractItemPurchaseEvents(
    frames,
    tidussParticipantId,
    itemIndex,
    itemImageUrl,
  );
  const killEvents = extractKillEvents(frames, tidussParticipantId, championMap);
  const objectiveEvents = extractObjectiveEvents(frames, selfTeamId);
  const events = [...itemEvents, ...killEvents, ...objectiveEvents].sort(
    (a, b) => a.timestampMs - b.timestampMs,
  );

  const framesWithTimestamp = frames.filter(
    (frame) => frame.timestamp !== undefined,
  );
  const durationMs =
    framesWithTimestamp[framesWithTimestamp.length - 1]?.timestamp ?? 0;

  return {
    matchId,
    frameIntervalMs: timelineDto.info?.frameInterval ?? 60_000,
    durationMs,
    tidussParticipantId,
    tidussChampionName: tidussMatchParticipant.championName,
    enemyAdcParticipantId: enemyAdc?.participantId,
    enemyAdcChampionName: enemyAdc?.championName,
    laneCheckpoint10,
    enemyAdcCheckpoint10,
    laneComparison10,
    goldCurve,
    csCurve,
    enemyAdcGoldCurve,
    enemyAdcCsCurve,
    events,
    updatedAt,
  };
};
