// --- Match Timeline (Match-V5 Timeline) — Sprint "Timeline + cierre de
// arquitectura competitiva". Tipos propios: el DTO de Riot nunca llega al
// componente, solo lo que `timeline-normalize.ts` extrae realmente. ---

// --- DTOs crudos de Riot (Timeline-V5) ---

export interface RiotTimelineParticipantDto {
  participantId?: number;
  puuid?: string;
}

export interface RiotTimelineParticipantFrameDto {
  participantId?: number;
  currentGold?: number;
  totalGold?: number;
  minionsKilled?: number;
  jungleMinionsKilled?: number;
  xp?: number;
  level?: number;
}

export interface RiotTimelineEventDto {
  type?: string;
  timestamp?: number;
  // ITEM_PURCHASED / ITEM_SOLD / ITEM_DESTROYED
  itemId?: number;
  // ITEM_UNDO
  beforeId?: number;
  afterId?: number;
  participantId?: number;
  // CHAMPION_KILL
  killerId?: number;
  victimId?: number;
  assistingParticipantIds?: number[];
  // CHAMPION_SPECIAL_KILL
  killType?: string;
  multiKillLength?: number;
  // ELITE_MONSTER_KILL
  monsterType?: string;
  monsterSubType?: string;
  killerTeamId?: number;
  // BUILDING_KILL
  teamId?: number;
  buildingType?: string;
}

export interface RiotTimelineFrameDto {
  timestamp?: number;
  participantFrames?: Record<string, RiotTimelineParticipantFrameDto>;
  events?: RiotTimelineEventDto[];
}

export interface RiotTimelineDto {
  metadata?: { matchId?: string };
  info?: {
    frameInterval?: number;
    participants?: RiotTimelineParticipantDto[];
    frames?: RiotTimelineFrameDto[];
  };
}

// --- Data Dragon: solo los campos de `item.json` que realmente se usan
// para decidir "¿es un objeto completado?" y para mostrar su nombre real. ---

export interface DataDragonItemInfo {
  name: string;
  goldTotal: number;
  purchasable: boolean;
  /** IDs (como string, igual que las claves del JSON de Riot) de los objetos en los que este se puede convertir — si tiene alguno, es un componente, no un objeto completado. */
  buildsInto: string[];
  tags: string[];
}

export type DataDragonItemIndex = Record<string, DataDragonItemInfo>;

// --- Dominio normalizado ---

export interface TimelineCurvePoint {
  timestampMs: number;
  value: number;
}

/** Estado real de un participante en el frame más cercano (sin pasarse) al instante pedido — nunca un valor interpolado o inventado. */
export interface LaneCheckpoint {
  /** Timestamp real del frame usado — puede no coincidir exactamente con el instante pedido si Riot no muestreó justo ahí. */
  atMs: number;
  cs: number;
  gold: number;
  xp: number;
}

export interface LaneComparison {
  csDiff: number;
  goldDiff: number;
  xpDiff: number;
}

export interface ItemPurchaseEvent {
  type: 'item-purchase';
  timestampMs: number;
  itemId: number;
  itemName: string;
  itemImageUrl: string;
}

export type MultiKillLabel = 'double' | 'triple' | 'quadra' | 'penta';

export interface ChampionKillEvent {
  type: 'champion-kill';
  timestampMs: number;
  outcome: 'kill' | 'death' | 'assist';
  /** Nombre del otro campeón implicado (víctima en kill/assist, verdugo en death) — ausente si Riot no permite identificarlo con certeza. */
  otherChampionName?: string;
  /** Solo en `outcome: 'kill'`, y solo cuando Riot emite el evento `CHAMPION_SPECIAL_KILL` real — nunca inferido por ventana temporal. */
  multiKill?: MultiKillLabel;
}

export type ObjectiveKind =
  | 'dragon'
  | 'herald'
  | 'baron'
  | 'atakhan'
  | 'grubs'
  | 'tower';

export interface ObjectiveEvent {
  type: 'objective';
  timestampMs: number;
  objective: ObjectiveKind;
  /** true si el objetivo lo consiguió el equipo de Tidusss. */
  teamParticipated: boolean;
  label: string;
}

export type TimelineEvent = ItemPurchaseEvent | ChampionKillEvent | ObjectiveEvent;

export interface MatchTimeline {
  matchId: string;
  frameIntervalMs: number;
  /** Timestamp del último frame real — duración de la partida según el propio Timeline. */
  durationMs: number;
  tidussParticipantId: number;
  tidussChampionName: string;
  /** Ausente si Riot no da una posición BOTTOM enemiga inequívoca — nunca se adivina. */
  enemyAdcParticipantId?: number;
  enemyAdcChampionName?: string;
  laneCheckpoint10?: LaneCheckpoint;
  enemyAdcCheckpoint10?: LaneCheckpoint;
  /** Solo presente cuando AMBOS checkpoints existen (encargo §10). */
  laneComparison10?: LaneComparison;
  goldCurve: TimelineCurvePoint[];
  csCurve: TimelineCurvePoint[];
  /** Ausentes si no hay ADC rival identificado con certeza — nunca una curva rival inventada. */
  enemyAdcGoldCurve?: TimelineCurvePoint[];
  enemyAdcCsCurve?: TimelineCurvePoint[];
  /** Cronológico: compras de objetos completados, kills/muertes/asistencias de Tidusss, objetivos del equipo. */
  events: TimelineEvent[];
  updatedAt: string;
}

export type MatchTimelinePublicResponse =
  | { ok: true; data: MatchTimeline }
  | { ok: false; error: { code: string; message: string } };
