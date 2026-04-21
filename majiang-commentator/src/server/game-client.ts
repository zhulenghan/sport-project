import WebSocket from 'ws';
import type { GameEvent } from './types';

export class GameClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private destroyed = false;

  constructor(
    private host: string,
    private port: number,
    private roomId: string,
    private onEvent: (event: GameEvent) => void,
    private onStatusChange?: (connected: boolean) => void,
  ) {}

  connect(): void {
    if (this.destroyed) return;
    const url = `ws://${this.host}:${this.port}?role=commentator&roomId=${this.roomId}`;
    console.log(`[GameClient] Connecting to room ${this.roomId}: ${url}`);

    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      console.log(`[GameClient] Connected to room ${this.roomId}`);
      this.onStatusChange?.(true);
    });

    this.ws.on('message', (data) => {
      try {
        const event = JSON.parse(data.toString()) as GameEvent;
        this.onEvent(event);
      } catch (e) {
        console.error('[GameClient] Failed to parse message:', (e as Error).message);
      }
    });

    this.ws.on('close', () => {
      console.log(`[GameClient] Room ${this.roomId} disconnected.`);
      this.onStatusChange?.(false);
      if (!this.destroyed) {
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      }
    });

    this.ws.on('error', (err) => {
      console.error(`[GameClient] Room ${this.roomId} error:`, err.message);
    });
  }

  destroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.terminate();
      this.ws = null;
    }
  }
}
