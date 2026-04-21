import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface CommentaryRoom {
  roomId: string;
  startedAt: number;
  lang: string;
  clientCount: number;
  isActive: boolean;
}

interface GameRoom {
  roomId: string;
  playerCount: number;
  players: { name: string; status: number }[];
}

function formatAge(startedAt: number) {
  const s = Math.floor((Date.now() - startedAt) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`;
}

export default function Hall() {
  const [commentaryRooms, setCommentaryRooms] = useState<CommentaryRoom[]>([]);
  const [gameRooms, setGameRooms] = useState<GameRoom[]>([]);
  const [lang, setLang] = useState('en');
  const [error, setError] = useState('');
  const [starting, setStarting] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const poll = () => {
      fetch('/api/rooms').then(r => r.json()).then(setCommentaryRooms).catch(() => {});
      fetch('/api/game-rooms').then(r => r.json()).then(setGameRooms).catch(() => {});
    };
    poll();
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, []);

  const startRoom = async (roomId: string) => {
    setError('');
    setStarting(roomId);
    try {
      await fetch(`/api/rooms/${roomId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang }),
      });
      navigate(`/room/${roomId}`);
    } catch {
      setError(`Failed to start commentary for room ${roomId}.`);
      setStarting(null);
    }
  };

  const stopRoom = async (roomId: string) => {
    await fetch(`/api/rooms/${roomId}`, { method: 'DELETE' });
    setCommentaryRooms(r => r.filter(x => x.roomId !== roomId));
  };

  const commentingIds = new Set(commentaryRooms.map(r => r.roomId));

  return (
    <div className="page">
      <div className="header">
        <span className="header-logo">🀄</span>
        <div>
          <div className="header-title">Mahjong AI Commentator</div>
          <div className="header-sub">Real-time AI commentary for your games</div>
        </div>
      </div>

      {/* Start form */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 16 }}>Start Commentary</div>
        <div className="start-form">
          <div className="form-group" style={{ maxWidth: 140 }}>
            <label className="form-label">Language</label>
            <select className="input" value={lang} onChange={e => setLang(e.target.value)}>
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
          </div>
        </div>
      </div>

      {error && <div className="error-msg" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Active game rooms from game server */}
      <div className="section-title">Game Rooms</div>
      {gameRooms.length === 0 ? (
        <div className="empty-state" style={{ marginBottom: 24 }}>No active game rooms on the server.</div>
      ) : (
        <>
          {gameRooms.map(room => {
            const isCommenting = commentingIds.has(room.roomId);
            const isStarting = starting === room.roomId;
            return (
              <div className="room-card" key={room.roomId}>
                <div>
                  <div className="room-id">#{room.roomId}</div>
                  <div className="room-meta">
                    <span className="dot dot-green" />
                    <span>{room.playerCount} / 4 players</span>
                    <span>·</span>
                    <span>{room.players.map(p => p.name).join(', ')}</span>
                  </div>
                </div>
                <div className="room-actions">
                  {isCommenting ? (
                    <button className="btn" onClick={() => navigate(`/room/${room.roomId}`)}>
                      Watch
                    </button>
                  ) : (
                    <button className="btn" onClick={() => startRoom(room.roomId)} disabled={isStarting}>
                      {isStarting ? 'Starting…' : 'Start Commentary'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Active commentary sessions */}
      {commentaryRooms.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 24 }}>Active Commentary Sessions</div>
          {commentaryRooms.map(room => (
            <div className="room-card" key={room.roomId}>
              <div>
                <div className="room-id">#{room.roomId}</div>
                <div className="room-meta">
                  <span className={`dot ${room.isActive ? 'dot-green' : 'dot-yellow'}`} />
                  <span>{room.isActive ? 'Live' : 'Reconnecting'}</span>
                  <span>·</span>
                  <span className="badge badge-gold">{room.lang.toUpperCase()}</span>
                  <span>·</span>
                  <span>{room.clientCount} viewer{room.clientCount !== 1 ? 's' : ''}</span>
                  <span>·</span>
                  <span>{formatAge(room.startedAt)}</span>
                </div>
              </div>
              <div className="room-actions">
                <button className="btn btn-ghost" onClick={() => stopRoom(room.roomId)}>Stop</button>
                <button className="btn" onClick={() => navigate(`/room/${room.roomId}`)}>Watch</button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
