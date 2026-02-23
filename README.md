# Majiang (麻将)

An online multiplayer Mahjong game with AI-powered commentary.

## Architecture

```
┌──────────────┐     WebSocket     ┌────────────────┐
│   majiang    │◄──────────────────►│ majiang-server │
│  (Frontend)  │                   │   (Backend)    │
└──────────────┘                   └───────┬────────┘
                                           │ WebSocket
                                   ┌───────▼──────────────┐
                                   │ majiang-commentator   │
                                   │  (AI Commentary)      │
                                   └───────────────────────┘
```

| Project | Description | Tech Stack |
|---------|-------------|------------|
| `majiang/` | Game client | TypeScript, Laya Engine 3.x |
| `majiang-server/` | Game backend | Node.js, Koa, MySQL, Redis |
| `majiang-commentator/` | AI live commentary | Node.js, Google Gemini |

## Getting Started

### Prerequisites

- Node.js
- Docker & Docker Compose (for MySQL and Redis)

### 1. Start the database services

```bash
cd majiang-server
docker compose up -d
```

### 2. Start the backend server

```bash
cd majiang-server
npm install
npm start
```

### 3. Run the game client

Open `majiang/` project in Laya IDE.

### 4. (Optional) Start AI commentator

```bash
cd majiang-commentator
cp .env.example .env
# Edit .env and add your Gemini API key
npm install
node index.js --room <room_id>
```
