import 'dotenv/config';
import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { existsSync } from 'fs';
import { RoomManager } from './room-manager';
import type { Lang } from './types';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY is not set in .env');
  process.exit(1);
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';

const GAME_HOST = process.env.GAME_HOST ?? '127.0.0.1';
const GAME_PORT = parseInt(process.env.GAME_PORT ?? '8082');
const GAME_HTTP = process.env.GAME_HTTP ?? 'http://127.0.0.1:4000';
const PORT = parseInt(process.env.PORT ?? '3030');

const roomManager = new RoomManager(apiKey, GAME_HOST, GAME_PORT);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json());

// Serve built React app only in production (in dev, Vite handles the frontend on port 5173)
const clientDist = path.join(__dirname, '../client');
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && existsSync(clientDist)) {
  app.use(express.static(clientDist));
}

// List active commentary sessions
app.get('/api/rooms', (_req, res) => {
  res.json(roomManager.getRoomList());
});

// Proxy game server's room list so the frontend can show all active game rooms
app.get('/api/game-rooms', async (_req, res) => {
  try {
    const r = await fetch(`${GAME_HTTP}/room/list`);
    const json = await r.json() as { result: unknown };
    res.json(json.result ?? []);
  } catch {
    res.json([]);
  }
});

// Start commentary for a room
app.post('/api/rooms/:roomId/start', (req, res) => {
  const { roomId } = req.params;
  const lang = (req.body?.lang ?? 'en') as Lang;
  const analyze = req.body?.analyze !== false;
  roomManager.startRoom(roomId, { lang, analyze });
  res.json({ success: true, roomId });
});

// Stop commentary for a room
app.delete('/api/rooms/:roomId', (req, res) => {
  roomManager.stopRoom(req.params.roomId);
  res.json({ success: true });
});

// TTS proxy: keeps OpenAI key on the server
app.post('/api/tts', async (req, res) => {
  const { text, lang } = req.body as { text?: string; lang?: string };
  if (!text || !OPENAI_API_KEY) {
    res.status(400).json({ error: 'Missing text or OPENAI_API_KEY' });
    return;
  }
  try {
    const voice = lang === 'zh' ? 'shimmer' : 'alloy';
    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'tts-1', input: text, voice, response_format: 'mp3', speed: 1.3 }),
    });
    if (!r.ok) {
      const err = await r.text();
      res.status(r.status).json({ error: err });
      return;
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    const buf = await r.arrayBuffer();
    res.end(Buffer.from(buf));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

if (isProduction && existsSync(clientDist)) {
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// Frontend WebSocket: clients subscribe to room commentary
wss.on('connection', (ws: WebSocket, req) => {
  const rawUrl = req.url ?? '';
  const url = new URL(rawUrl, `http://localhost`);
  const roomId = url.searchParams.get('room');

  if (!roomId) {
    ws.close(1008, 'Missing room parameter');
    return;
  }

  roomManager.addClient(roomId, ws);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      roomManager.handleClientMessage(roomId, msg);
    } catch { /* ignore malformed */ }
  });

  ws.on('close', () => {
    roomManager.removeClient(roomId, ws);
  });
});

server.listen(PORT, () => {
  console.log(`\nMahjong AI Commentator`);
  console.log(`  UI:          http://localhost:${PORT}`);
  console.log(`  Game server: ws://${GAME_HOST}:${GAME_PORT}`);
  console.log(`  API key:     ${apiKey.slice(0, 8)}...\n`);
});
