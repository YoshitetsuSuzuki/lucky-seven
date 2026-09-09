import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useRoom } from '../hooks/useRoom';
import { clearSession, loadSession } from '../lib/session';
import { ActError, act } from '../lib/api';
import JoinForm from '../components/JoinForm';
import Lobby from '../components/Lobby';
import Table from '../components/Table';
import Result from '../components/Result';

export default function Room() {
  const code = (useParams().code ?? '').toUpperCase();
  const { room, players, error, loading, refresh } = useRoom(code);
  const [session, setSession] = useState(() => loadSession(code));
  const [checked, setChecked] = useState(false);
  const [reconnectError, setReconnectError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  // code が変わったらセッションと確認状態をやり直す（描画中リセット：effect にすると
  // 初回マウントでも走ってしまい join が二重に飛ぶ）
  const [sessionCode, setSessionCode] = useState(code);
  if (sessionCode !== code) {
    setSessionCode(code);
    setSession(loadSession(code));
    setChecked(false);
  }

  // 保存済みセッションの有効性確認（再接続）。
  // 通信エラーなど一時的な失敗ではセッションを消さない。
  useEffect(() => {
    if (!session) { setChecked(true); return; }
    if (checked) return;
    let cancelled = false;
    act('join', { code })
      .then(() => {
        if (cancelled) return;
        setReconnectError(null);
        setChecked(true);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ActError && e.code === 'AUTH_INVALID') {
          clearSession(code);
          setSession(null);
          setReconnectError(null);
        } else {
          setReconnectError(e instanceof Error ? e.message : String(e));
        }
        setChecked(true);
      });
    return () => { cancelled = true; };
  }, [code, session, checked, retry]);

  const recheck = useCallback(() => {
    setReconnectError(null);
    setChecked(false);
    setRetry((n) => n + 1);
  }, []);

  const rejoin = useCallback(() => {
    clearSession(code);
    setSession(null);
    setReconnectError(null);
    setChecked(true);
  }, [code]);

  if (error) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-rose">{error}</p>
        <button onClick={() => { void refresh(); }} className="lacquer rounded-2xl px-5 py-2.5 font-bold">再試行</button>
        <Link className="text-sm text-muted underline" to="/">ホームへ</Link>
      </div>
    );
  }
  if (loading || !room || !checked) return <div className="p-6 text-muted">読み込み中…</div>;
  if (!session) {
    // JoinForm での参加は成功済みなので、再確認（join の再送）は不要
    return <JoinForm code={code} onJoined={() => { setSession(loadSession(code)); setChecked(true); void refresh(); }} />;
  }

  const notice = reconnectError && (
    <div className="flex flex-wrap items-center justify-center gap-3 px-3 py-1.5 text-sm">
      <span className="text-rose">再接続できません：{reconnectError}</span>
      <button onClick={recheck} className="rounded-full border border-white/10 bg-ink3 px-3 py-2 text-cream/85">再試行</button>
      <button onClick={rejoin} className="rounded-full border border-white/10 bg-ink3 px-3 py-2 text-cream/85">参加し直す</button>
    </div>
  );

  const me = players.find((p) => p.id === session.playerId);
  if (!me) return <div className="p-6 text-muted">{notice}参加処理中…</div>;
  const isHost = room.host_player_id === me.id;

  let screen;
  if (room.status === 'lobby') screen = <Lobby room={room} players={players} me={me} isHost={isHost} />;
  else if (room.status === 'finished' && room.state?.phase === 'game_end') {
    screen = <Result room={room} players={players} me={me} isHost={isHost} />;
  } else screen = <Table room={room} players={players} me={me} isHost={isHost} />;

  return <>{notice}{screen}</>;
}
