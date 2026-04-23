export type Lang = 'en' | 'zh';

export interface RoomPlayer {
  id?: string;
  name: string;
  handCards: number[];
  playedCards: number[];
  pengCards: number[];
  gangCards: number[];
  roomId?: string;
}

export interface GameInfo {
  remainingNum: number;
  tableIds: string[];
  optionPos: number;
}

export interface GameEvent {
  type: string;
  roomId: string;
  playerId: string | null;
  data: {
    cardNum?: number;
    pengArr?: number[];
    gangArr?: number[];
  };
  roomInfo: Record<string, RoomPlayer>;
  gameInfo: GameInfo;
  timestamp: number;
  message?: string;
}

export interface LLMPrompt {
  system: string;
  user: string;
}

export interface EventSegments {
  actionLine: string;
  stateLine: string;
  promptStateLine?: string;
  analysisPlayer: unknown;
}

export interface EventFact {
  moveIndex: number;
  type: string;
  playerLabel: string;
  description: string;
  actorShantenAfter: number;
  remainingTiles: number;
}

export interface GameSnapshot {
  moveCount: number;
  allMoves: EventFact[];
  recentMoves: EventFact[];
  narrativeSummary: string;
  summaryUpToMove: number;
}

export interface PendingItem {
  event: GameEvent;
  actionLine: string;
  stateLine: string;
  prompt: LLMPrompt;
  shouldAnalyze: boolean;
}

export interface PlayerDebugState {
  id: string;
  label: string;
  handTiles: string[];
  pengTiles: string[];
  gangTiles: string[];
  shantenText: string;
}

export interface DebugSnapshot {
  moveCount: number;
  allMoves: EventFact[];
  recentMoves: EventFact[];
  narrativeSummary: string;
  summaryUpToMove: number;
  playerStates: PlayerDebugState[];
}

export interface CommentaryMessage {
  type: 'commentary' | 'system' | 'connected' | 'error' | 'status';
  roomId: string;
  eventType?: string;
  playerLabel?: string;
  actionLine?: string;
  analysis?: string;
  stateLine?: string;
  isKeyEvent?: boolean;
  timestamp: number;
  settings?: RoomSettings;
  rooms?: RoomInfo[];
  // status message fields
  isAnalyzing?: boolean;
  isSummarizing?: boolean;
  debugSnapshot?: DebugSnapshot;
}

export interface RoomInfo {
  roomId: string;
  startedAt: number;
  lang: Lang;
  analyze: boolean;
  clientCount: number;
  isActive: boolean;
}

export interface RoomSettings {
  lang: Lang;
  analyze: boolean;
}
