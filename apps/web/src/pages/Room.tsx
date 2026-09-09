import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useRoom } from '../hooks/useRoom';
import { clearSession, loadSession } from '../lib/session';
import { act } from '../lib/api';
import JoinForm from '../components/JoinForm';
import Lobby from '../components/Lobby';
import Table from '../components/Table';
import Result from '../components/Result';

export default function Room() {
  const code = (useParams().code ?? '').toUpperCase();
  const { room, players, error, loading, refresh } = useRoom(code);
  const [session, setSession] = useState(() => loadSession(code));
  const [checked, setChecked] = useState(false);

  // 保存済みセッションの有効性確認（再接続）
  useEffect(() => {
    if (!session) { setChecked(true); return; }
    act('join', { code })
      .then(() => setChecked(true))
      .catch(() => { clearSession(code); setSession(null); setChecked(true); });
  }, [code, session]);

  if (error) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-rose-400">{error}</p>
        <Link className="underline" to="/">ホームへ</Link>
      </div>
    );
  }
  if (loading || !room || !checked) return <div className="p-6 text-slate-400">読み込み中…</div>;
  if (!session) {
    return <JoinForm code={code} onJoined={() => { setSession(loadSession(code)); void refresh(); }} />;
  }
  const me = players.find((p) => p.id === session.playerId);
  if (!me) return <div className="p-6 text-slate-400">参加処理中…</div>;
  const isHost = room.host_player_id === me.id;

  if (room.status === 'lobby') return <Lobby room={room} players={players} me={me} isHost={isHost} />;
  if (room.status === 'finished' && room.state?.phase === 'game_end') {
    return <Result room={room} players={players} me={me} isHost={isHost} />;
  }
  return <Table room={room} players={players} me={me} isHost={isHost} />;
}
