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

export interface PendingItem {
  event: GameEvent;
  actionLine: string;
  stateLine: string;
  prompt: LLMPrompt;
  shouldAnalyze: boolean;
}

export interface CommentaryMessage {
  type: 'commentary' | 'system' | 'connected' | 'error';
  roomId: string;
  eventType?: string;
  actionLine?: string;
  analysis?: string;
  stateLine?: string;
  isKeyEvent?: boolean;
  timestamp: number;
  settings?: RoomSettings;
  rooms?: RoomInfo[];
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
