import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';

interface PlayerDebugState {
  id: string;
  label: string;
  handTiles: string[];
  pengTiles: string[];
  gangTiles: string[];
  shantenText: string;
}

interface EventFact {
  moveIndex: number;
  type: string;
  playerLabel: string;
  description: string;
  actorShantenAfter: number;
  remainingTiles: number;
}

interface DebugSnapshot {
  moveCount: number;
  allMoves: EventFact[];
  recentMoves: EventFact[];
  narrativeSummary: string;
  summaryUpToMove: number;
  playerStates: PlayerDebugState[];
}

interface Msg {
  type: string;
  eventType?: string;
  playerLabel?: string;
  actionLine?: string;
  analysis?: string;
  stateLine?: string;
  isKeyEvent?: boolean;
  settings?: { lang: string; analyze: boolean };
  isAnalyzing?: boolean;
  isSummarizing?: boolean;
  debugSnapshot?: DebugSnapshot;
  timestamp: number;
}

const EVENT_LABEL: Record<string, string> = {
  startGame: 'Game Start',
  roomState:  'Sync',
  playCard:   'Discard',
  peng:       'Peng 碰',
  gang:       'Gang 杠',
  win:        'Win 胡牌！',
};

const KEY_EVENTS = new Set(['startGame', 'roomState', 'playCard', 'peng', 'gang', 'win']);

const MOVE_TYPE_COLOR: Record<string, string> = {
  playCard:  '#6b7280',
  peng:      '#16a34a',
  gang:      '#2563eb',
  win:       '#dc2626',
  startGame: '#7c3aed',
  roomState: '#9ca3af',
};

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function Spinner({ blue }: { blue?: boolean }) {
  return <span className={`spinner${blue ? ' spinner-blue' : ''}`} />;
}

/* ── Commentary bubble — only shows analysis ── */
function Bubble({ msg, verbose }: { msg: Msg; verbose: boolean }) {
  if (msg.type === 'system') return <div className="chat-system">{msg.actionLine}</div>;
  if (msg.type === 'connected') return null;
  if (msg.type !== 'commentary') return null;

  const isKey = KEY_EVENTS.has(msg.eventType ?? '');
  if (!verbose && !isKey) return null;
  if (!msg.analysis) return null;

  const isWin  = msg.eventType === 'win';
  const isMeld = ['peng', 'gang'].includes(msg.eventType ?? '');
  const bubbleCls = ['bubble', isWin ? 'win' : '', isMeld ? msg.eventType : ''].filter(Boolean).join(' ');
  const label = EVENT_LABEL[msg.eventType ?? ''] ?? msg.eventType;

  return (
    <div className="chat-row">
      <div className="chat-avatar">🎙️</div>
      <div className="chat-col">
        <div className="chat-meta">
          <span className="chat-tag">{label}</span>
          <span className="chat-time">{fmt(msg.timestamp)}</span>
        </div>
        <div className={bubbleCls}>
          <div className="bubble-analysis">{msg.analysis}</div>
        </div>
      </div>
    </div>
  );
}

function CommentingBubble() {
  return (
    <div className="chat-row">
      <div className="chat-avatar">🎙️</div>
      <div className="chat-col">
        <div className="chat-meta"><span className="chat-tag">—</span></div>
        <div className="bubble bubble-loading">
          <Spinner />
          <span className="bubble-loading-text">Commenting…</span>
        </div>
      </div>
    </div>
  );
}

/* ── Toggle ── */
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle-group">
      <span className="toggle">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="toggle-track" />
        <span className="toggle-thumb" />
      </span>
      <span className="toggle-label">{label}</span>
    </label>
  );
}

/* ── Player card ── */
function PlayerCard({ p }: { p: PlayerDebugState }) {
  const isTenpai = p.shantenText.toLowerCase().includes('tenpai') || p.shantenText.includes('听牌');
  const isWin    = p.shantenText.toLowerCase().includes('win')    || p.shantenText.includes('胡');
  return (
    <div className={`player-card ${isTenpai ? 'player-tenpai' : ''} ${isWin ? 'player-win' : ''}`}>
      <div className="player-header">
        <span className="player-name">{p.label}</span>
        <span className={`player-shanten ${isTenpai ? 'shanten-tenpai' : ''}`}>{p.shantenText}</span>
      </div>
      {p.handTiles.length > 0 && (
        <div className="player-tiles">
          {p.handTiles.map((t, i) => <span key={i} className="tile-chip">{t}</span>)}
        </div>
      )}
      {(p.pengTiles.length > 0 || p.gangTiles.length > 0) && (
        <div className="player-tiles player-melds">
          {p.pengTiles.map((t, i) => <span key={`p${i}`} className="tile-chip tile-peng">{t}</span>)}
          {p.gangTiles.map((t, i) => <span key={`g${i}`} className="tile-chip tile-gang">{t}</span>)}
        </div>
      )}
    </div>
  );
}

/* ── Right sidebar ── */
const SUMMARY_INTERVAL = 8;

function Sidebar({ snapshot, isCommenting, isSummarizing }: {
  snapshot: DebugSnapshot | null;
  isCommenting: boolean;
  isSummarizing: boolean;
}) {
  const traceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (traceRef.current) traceRef.current.scrollTop = traceRef.current.scrollHeight;
  }, [snapshot?.allMoves.length]);

  const moveCount   = snapshot?.moveCount ?? 0;
  const summary     = snapshot?.narrativeSummary ?? '';
  const summaryMove = snapshot?.summaryUpToMove ?? 0;
  const allMoves    = snapshot?.allMoves ?? [];
  const players     = snapshot?.playerStates ?? [];

  return (
    <div className="sidebar">

      {/* Players */}
      <div className="sb-section">
        <div className="sb-heading">
          Players
          <span className="sb-chip">{moveCount} moves</span>
        </div>
        {players.length > 0
          ? <div className="sb-players">{players.map(p => <PlayerCard key={p.id} p={p} />)}</div>
          : <span className="sb-placeholder">Waiting for game…</span>}
      </div>

      {/* Status */}
      <div className="sb-section">
        <div className="sb-heading">Status</div>
        <div className="sb-status-row">
          <div className={`sb-status-pill ${isCommenting ? 'pill-active' : 'pill-idle'}`}>
            {isCommenting && <Spinner />}
            <span>{isCommenting ? 'Commenting…' : 'Commentator idle'}</span>
          </div>
          <div className={`sb-status-pill ${isSummarizing ? 'pill-summarizing' : 'pill-idle'}`}>
            {isSummarizing && <Spinner blue />}
            <span>{isSummarizing ? 'Summarizing…' : 'Summarizer idle'}</span>
          </div>
        </div>
      </div>

      {/* Narrative summary */}
      <div className="sb-section">
        <div className="sb-heading">
          Narrative Summary
          {summaryMove > 0
            ? <span className="sb-chip">up to #{summaryMove}</span>
            : moveCount > 0
              ? <span className="sb-chip">triggers at #{SUMMARY_INTERVAL}</span>
              : null}
        </div>
        <div className="sb-text-box">
          {isSummarizing && !summary
            ? <span className="sb-placeholder"><Spinner blue /> Generating…</span>
            : summary || <span className="sb-placeholder">
                {moveCount > 0 ? `First summary after ${SUMMARY_INTERVAL} moves` : 'No moves yet'}
              </span>}
        </div>
      </div>

      {/* Event trace */}
      <div className="sb-section sb-section-grow">
        <div className="sb-heading">
          Event Trace
          <span className="sb-chip">{allMoves.length}</span>
        </div>
        <div className="sb-trace" ref={traceRef}>
          {allMoves.length === 0
            ? <span className="sb-placeholder">No events yet</span>
            : allMoves.map((f) => (
              <div key={f.moveIndex} className="trace-row">
                <span className="trace-idx">#{f.moveIndex}</span>
                <span className="trace-type" style={{ color: MOVE_TYPE_COLOR[f.type] ?? '#6b7280' }}>
                  {f.type}
                </span>
                <span className="trace-player">{f.playerLabel}</span>
                <span className="trace-desc">{f.description}</span>
                <span className="trace-meta">
                  s:{f.actorShantenAfter === -1 ? 'win' : f.actorShantenAfter}·{f.remainingTiles}↓
                </span>
              </div>
            ))}
        </div>
      </div>

    </div>
  );
}

/* ── Room page ── */
export default function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const [msgs, setMsgs]           = useState<Msg[]>([]);
  const [connected, setConnected] = useState(false);
  const [verbose, setVerbose]     = useState(true);
  const [analyze, setAnalyze]     = useState(true);
  const [audio, setAudio]         = useState(false);
  const [lang, setLang]           = useState('en');
  const [showDebug, setShowDebug] = useState(true);

  const [isCommenting, setIsCommenting]   = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [debugSnapshot, setDebugSnapshot] = useState<DebugSnapshot | null>(null);

  const audioEnabledRef = useRef(false);
  const wsRef           = useRef<WebSocket | null>(null);
  const feedRef         = useRef<HTMLDivElement>(null);
  const speechQueueRef  = useRef<string[]>([]);
  const speechBusyRef   = useRef(false);
  const audioRef        = useRef<HTMLAudioElement | null>(null);

  const speak = useCallback((text: string) => {
    speechQueueRef.current.push(text);
    const process = async () => {
      if (speechBusyRef.current || !speechQueueRef.current.length) return;
      speechBusyRef.current = true;
      const t = speechQueueRef.current.shift()!;
      try {
        const r = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: t, lang }),
        });
        if (!r.ok) throw new Error(`TTS ${r.status}`);
        const blob = await r.blob();
        const url  = URL.createObjectURL(blob);
        const a    = new Audio(url);
        audioRef.current = a;
        a.onended = a.onerror = () => { URL.revokeObjectURL(url); speechBusyRef.current = false; process(); };
        a.play();
      } catch { speechBusyRef.current = false; process(); }
    };
    process();
  }, [lang]);

  const sendWs = useCallback((obj: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(obj));
  }, []);

  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout>;
    let shouldReconnect = true;

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws?room=${roomId}`);
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onmessage = (e) => {
        const msg: Msg = JSON.parse(e.data);
        if (msg.type === 'connected' && msg.settings) {
          setLang(msg.settings.lang);
          setAnalyze(msg.settings.analyze);
        }
        if (msg.type === 'status') {
          setIsCommenting(msg.isAnalyzing ?? false);
          setIsSummarizing(msg.isSummarizing ?? false);
          if (msg.debugSnapshot) setDebugSnapshot(msg.debugSnapshot);
          return;
        }
        setMsgs((prev) => [...prev, msg]);
        if (audioEnabledRef.current && msg.type === 'commentary' && msg.analysis) speak(msg.analysis);
      };
      ws.onclose = () => {
        setConnected(false);
        if (shouldReconnect) retryTimer = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
    };

    connect();
    return () => { shouldReconnect = false; clearTimeout(retryTimer); wsRef.current?.close(); };
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [msgs, isCommenting]);

  const handleAnalyze = (v: boolean) => { setAnalyze(v); sendWs({ type: 'setAnalyze', analyze: v }); };
  const handleLang    = (v: boolean) => { const l = v ? 'zh' : 'en'; setLang(l); sendWs({ type: 'setLang', lang: l }); };
  const handleAudio   = (v: boolean) => {
    setAudio(v); audioEnabledRef.current = v;
    if (!v) { audioRef.current?.pause(); speechQueueRef.current = []; speechBusyRef.current = false; }
  };

  return (
    <div className="page-room">

      <div className="room-header">
        <Link className="header-back" to="/">← Back</Link>
        <span style={{ fontSize: 26 }}>🀄</span>
        <div>
          <div className="header-title">Room #{roomId}</div>
          <div className="header-sub">{connected ? 'Live commentary' : 'Reconnecting…'}</div>
        </div>
        <div className="conn-status">
          <span className={`dot ${connected ? 'dot-green' : 'dot-yellow'}`} />
          <span>{connected ? 'Connected' : 'Reconnecting'}</span>
        </div>
      </div>

      <div className="settings-bar">
        <Toggle label="Verbose"      checked={verbose}   onChange={setVerbose} />
        <div className="settings-divider" />
        <Toggle label="AI Analysis"  checked={analyze}   onChange={handleAnalyze} />
        <div className="settings-divider" />
        <Toggle label="Audio"        checked={audio}     onChange={handleAudio} />
        <div className="settings-divider" />
        <Toggle label={lang.toUpperCase()} checked={lang === 'zh'} onChange={handleLang} />
        <div className="settings-divider" />
        <Toggle label="Debug"        checked={showDebug} onChange={setShowDebug} />
      </div>

      <div className="room-body">
        <div className="feed" ref={feedRef}>
          {msgs.length === 0 && <div className="empty-state">Waiting for the game to begin…</div>}
          {msgs.map((msg, i) => <Bubble key={i} msg={msg} verbose={verbose} />)}
          {isCommenting && <CommentingBubble />}
        </div>

        {showDebug && (
          <Sidebar
            snapshot={debugSnapshot}
            isCommenting={isCommenting}
            isSummarizing={isSummarizing}
          />
        )}
      </div>
    </div>
  );
}
