import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';

interface Msg {
  type: string;
  eventType?: string;
  actionLine?: string;
  analysis?: string;
  stateLine?: string;
  isKeyEvent?: boolean;
  settings?: { lang: string; analyze: boolean };
  timestamp: number;
}

const EVENT_BADGE: Record<string, { label: string; cls: string }> = {
  startGame: { label: 'Game Start', cls: 'badge-green'  },
  roomState:  { label: 'Sync',       cls: 'badge-muted'  },
  playCard:   { label: 'Discard',    cls: 'badge-muted'  },
  peng:       { label: 'Peng 碰',    cls: 'badge-green'  },
  gang:       { label: 'Gang 杠',    cls: 'badge-green'  },
  win:        { label: 'Win 胡牌！', cls: 'badge-red'    },
};

const KEY_EVENTS = new Set(['startGame', 'roomState', 'playCard', 'peng', 'gang', 'win']);

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function Bubble({ msg, verbose }: { msg: Msg; verbose: boolean }) {
  if (msg.type === 'system') {
    return <div className="chat-system">{msg.actionLine}</div>;
  }
  if (msg.type === 'connected') return null;
  if (msg.type !== 'commentary') return null;

  const isKey = KEY_EVENTS.has(msg.eventType ?? '');
  if (!verbose && !isKey) return null;

  const badge = EVENT_BADGE[msg.eventType ?? ''] ?? { label: msg.eventType, cls: 'badge-muted' };
  const bubbleCls = ['bubble', msg.eventType === 'win' ? 'win' : '', ['peng', 'gang'].includes(msg.eventType ?? '') ? msg.eventType : ''].filter(Boolean).join(' ');

  return (
    <div className="chat-row">
      <div className="chat-avatar">🎙️</div>
      <div className="chat-col">
        <div className="chat-meta">
          <span className="chat-name">AI Commentator</span>
          <span className="chat-time">{fmt(msg.timestamp)}</span>
        </div>
        <div className={bubbleCls}>
          <div className="bubble-event">
            <span className={`badge ${badge.cls}`}>{badge.label}</span>
          </div>
          {msg.actionLine && <div className="bubble-action">{msg.actionLine}</div>}
          {msg.analysis   && <div className="bubble-analysis">{msg.analysis}</div>}
          {msg.stateLine  && (
            <>
              <div className="bubble-divider" />
              <div className="bubble-state">{msg.stateLine}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

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

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [connected, setConnected] = useState(false);
  const [verbose, setVerbose] = useState(true);
  const [analyze, setAnalyze] = useState(true);
  const [audio, setAudio] = useState(false);
  const audioEnabledRef = useRef(false);
  const [lang, setLang] = useState('en');

  const wsRef = useRef<WebSocket | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const speechQueueRef = useRef<string[]>([]);
  const speechBusyRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = audio.onerror = () => {
          URL.revokeObjectURL(url);
          speechBusyRef.current = false;
          process();
        };
        audio.play();
      } catch {
        speechBusyRef.current = false;
        process();
      }
    };
    process();
  }, [lang]);

  const sendWs = useCallback((obj: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(obj));
    }
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
        setMsgs((prev) => [...prev, msg]);
        if (audioEnabledRef.current && msg.type === 'commentary' && msg.analysis) {
          speak(msg.analysis);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (shouldReconnect) retryTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      shouldReconnect = false;
      clearTimeout(retryTimer);
      wsRef.current?.close();
    };
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [msgs]);

  const handleAnalyze = (v: boolean) => { setAnalyze(v); sendWs({ type: 'setAnalyze', analyze: v }); };
  const handleLang    = (v: boolean) => { const l = v ? 'zh' : 'en'; setLang(l); sendWs({ type: 'setLang', lang: l }); };
  const handleAudio   = (v: boolean) => {
    setAudio(v);
    audioEnabledRef.current = v;
    if (!v) {
      audioRef.current?.pause();
      speechQueueRef.current = [];
      speechBusyRef.current = false;
    }
  };

  return (
    <div className="page-room">
      <div className="header">
        <Link className="header-back" to="/">← Back</Link>
        <span className="header-logo" style={{ fontSize: 28 }}>🀄</span>
        <div>
          <div className="header-title">Room #{roomId}</div>
          <div className="header-sub">{connected ? 'Live commentary' : 'Reconnecting…'}</div>
        </div>
      </div>

      <div className="settings-bar">
        <Toggle label="Verbose"     checked={verbose} onChange={setVerbose} />
        <div className="settings-divider" />
        <Toggle label="AI Analysis" checked={analyze} onChange={handleAnalyze} />
        <div className="settings-divider" />
        <Toggle label="Audio"       checked={audio}   onChange={handleAudio} />
        <div className="settings-divider" />
        <Toggle label={lang.toUpperCase()} checked={lang === 'zh'} onChange={handleLang} />
        <div className="conn-status">
          <span className={`dot ${connected ? 'dot-green' : 'dot-yellow'}`} />
          <span>{connected ? 'Connected' : 'Reconnecting'}</span>
        </div>
      </div>

      <div className="feed" ref={feedRef}>
        {msgs.length === 0 && (
          <div className="empty-state">Waiting for the game to begin…</div>
        )}
        {msgs.map((msg, i) => (
          <Bubble key={i} msg={msg} verbose={verbose} />
        ))}
      </div>
    </div>
  );
}
