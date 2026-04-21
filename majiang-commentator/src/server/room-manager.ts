import { WebSocket } from 'ws';
import { GameClient } from './game-client';
import { Context } from './context';
import { Commentator } from './commentator';
import { StateManager } from './state-manager';
import type { GameEvent, Lang, PendingItem, RoomInfo, RoomSettings, CommentaryMessage } from './types';

const KEY_EVENTS = new Set(['startGame', 'roomState', 'playCard', 'peng', 'gang', 'win']);
const HISTORY_SIZE = 50;

interface RoomSession {
  roomId: string;
  gameClient: GameClient;
  context: Context;
  commentator: Commentator;
  stateManager: StateManager;
  settings: RoomSettings;
  clients: Set<WebSocket>;
  startedAt: number;
  isConnected: boolean;
  pendingItems: PendingItem[];
  processing: boolean;
  history: CommentaryMessage[];
}

export class RoomManager {
  private rooms = new Map<string, RoomSession>();
  private apiKey: string;
  private gameHost: string;
  private gamePort: number;

  constructor(apiKey: string, gameHost: string, gamePort: number) {
    this.apiKey = apiKey;
    this.gameHost = gameHost;
    this.gamePort = gamePort;
  }

  startRoom(roomId: string, settings: Partial<RoomSettings> = {}): void {
    if (this.rooms.has(roomId)) return;

    const resolvedSettings: RoomSettings = { lang: settings.lang ?? 'en', analyze: settings.analyze ?? true };
    const context = new Context();
    const commentator = new Commentator(this.apiKey);
    const stateManager = new StateManager();

    const session: RoomSession = {
      roomId,
      gameClient: null!,
      context,
      commentator,
      stateManager,
      settings: resolvedSettings,
      clients: new Set(),
      startedAt: Date.now(),
      isConnected: false,
      pendingItems: [],
      processing: false,
      history: [],
    };

    const gameClient = new GameClient(
      this.gameHost,
      this.gamePort,
      roomId,
      (event) => this.handleGameEvent(session, event),
      (connected) => {
        session.isConnected = connected;
        this.broadcast(session, {
          type: 'system',
          roomId,
          actionLine: connected ? 'Connected to game server.' : 'Disconnected from game server. Reconnecting...',
          timestamp: Date.now(),
        });
      },
    );

    session.gameClient = gameClient;
    this.rooms.set(roomId, session);
    gameClient.connect();
    console.log(`[RoomManager] Started commentary for room ${roomId}`);
  }

  stopRoom(roomId: string): void {
    const session = this.rooms.get(roomId);
    if (!session) return;
    session.gameClient.destroy();
    this.broadcast(session, { type: 'system', roomId, actionLine: 'Commentary stopped.', timestamp: Date.now() });
    session.clients.forEach((ws) => ws.close());
    this.rooms.delete(roomId);
    console.log(`[RoomManager] Stopped room ${roomId}`);
  }

  addClient(roomId: string, ws: WebSocket, autoStart = true): void {
    if (!this.rooms.has(roomId) && autoStart) {
      this.startRoom(roomId);
    }
    const session = this.rooms.get(roomId);
    if (!session) {
      ws.send(JSON.stringify({ type: 'error', roomId, actionLine: 'Room not found.', timestamp: Date.now() }));
      return;
    }
    session.clients.add(ws);

    // Send welcome + current settings + recent history
    ws.send(JSON.stringify({
      type: 'connected',
      roomId,
      settings: session.settings,
      timestamp: Date.now(),
    } satisfies CommentaryMessage));

    session.history.forEach((msg) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    });
  }

  removeClient(roomId: string, ws: WebSocket): void {
    const session = this.rooms.get(roomId);
    if (!session) return;
    session.clients.delete(ws);
  }

  handleClientMessage(roomId: string, msg: { type: string; lang?: Lang; analyze?: boolean }): void {
    const session = this.rooms.get(roomId);
    if (!session) return;
    if (msg.type === 'setLang' && (msg.lang === 'en' || msg.lang === 'zh')) {
      session.settings.lang = msg.lang;
      this.broadcast(session, { type: 'system', roomId, settings: session.settings, actionLine: `Language changed to ${msg.lang}.`, timestamp: Date.now() });
    }
    if (msg.type === 'setAnalyze' && typeof msg.analyze === 'boolean') {
      session.settings.analyze = msg.analyze;
      this.broadcast(session, { type: 'system', roomId, settings: session.settings, actionLine: `AI Analysis ${msg.analyze ? 'enabled' : 'disabled'}.`, timestamp: Date.now() });
    }
  }

  getRoomList(): RoomInfo[] {
    return Array.from(this.rooms.values()).map((s) => ({
      roomId: s.roomId,
      startedAt: s.startedAt,
      lang: s.settings.lang,
      analyze: s.settings.analyze,
      clientCount: s.clients.size,
      isActive: s.isConnected,
    }));
  }

  private handleGameEvent(session: RoomSession, event: GameEvent): void {
    if (event.type === 'commentatorConnected') return;

    const { context, stateManager, settings } = session;
    context.updateFromEvent(event);
    stateManager.updateFromEvent(event);
    context.addEvent(event, settings.lang);

    if (!KEY_EVENTS.has(event.type)) return;

    const segments = stateManager.buildEventSegments(event, settings.lang);
    const actionLine = segments.actionLine ?? '';
    const stateLine = segments.stateLine ?? context.buildSpokenLine(event, settings.lang, stateManager);

    session.pendingItems.push({
      event,
      actionLine,
      stateLine,
      prompt: context.buildPrompt(event, settings.lang, stateManager, segments),
      shouldAnalyze: settings.analyze && Boolean(actionLine),
    });

    this.processQueue(session);
  }

  private async processQueue(session: RoomSession): Promise<void> {
    if (session.processing) return;
    session.processing = true;

    while (session.pendingItems.length > 0) {
      const item = session.pendingItems.shift()!;
      try {
        let analysis = '';
        if (item.shouldAnalyze) {
          const raw = await session.commentator.commentate(item.prompt);
          analysis = session.context.finalizeAnalysis(raw, session.settings.lang);
        }

        const msg: CommentaryMessage = {
          type: 'commentary',
          roomId: session.roomId,
          eventType: item.event.type,
          actionLine: item.actionLine,
          analysis,
          stateLine: item.stateLine,
          isKeyEvent: KEY_EVENTS.has(item.event.type),
          timestamp: Date.now(),
        };

        session.history.push(msg);
        if (session.history.length > HISTORY_SIZE) session.history.shift();

        this.broadcast(session, msg);
      } catch (e) {
        console.error('[RoomManager] Queue error:', (e as Error).message);
      }
    }

    session.processing = false;
  }

  private broadcast(session: RoomSession, msg: CommentaryMessage): void {
    const payload = JSON.stringify(msg);
    session.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    });
  }
}
