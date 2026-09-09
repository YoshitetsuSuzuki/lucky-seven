import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useRoom } from '../hooks/useRoom';
import { clearSession, loadSession } from '../lib/session';
import { act } from '../lib/api';
import JoinForm from '../components/JoinForm';
import Lobby from '../components/Lobby';
import Table from '../components/Table';
import Result from '../components/Result';

/** サーバー側 authPlayer が返す「セッションが本当に無効」なメッセージ */
const AUTH_ERRORS = ['参加情報がありません', '参加情報が無効です', 'このルームの参加者ではありません'];

export default function Room() {
  const code = (useParams().code ?? '').toUpperCase();
  const { room, players, error, loading, refresh } = useRoom(code);
  const [session, setSession] = useState(() => loadSession(code));
  const [checked, setChecked] = useState(false);
  const [reconnectError, setReconnectError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  // code が変わったらセッションと確認状態をやり直す
  useEffect(() => {
    setSession(loadSession(code));
    setChecked(false);
  }, [code]);

  // 保存済みセッションの有効性確認（再接続）。
  // 通信エラーなど一時的な失敗ではセッションを消さない。
  useEffect(() => {
    if (!session) { setChecked(true); return; }
    let cancelled = false;
    act('join', { code })
      .then(() => {
        if (cancelled) return;
        setReconnectError(null);
        setChecked(true);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        if (AUTH_ERRORS.includes(msg)) {
          clearSession(code);
          setSession(null);
          setReconnectError(null);
        } else {
          setReconnectError(msg || '接続に失敗しました');
        }
        setChecked(true);
      });
    return () => { cancelled = true; };
  }, [code, session, retry]);

  const recheck = useCallback(() => {
    setReconnectError(null);
    setChecked(false);
    setRetry((n) => n + 1);
  }, []);

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

  const notice = reconnectError && (
    <div className="flex items-center justify-center gap-3 px-3 py-1.5 text-sm">
      <span className="text-rose-400">再接続できません：{reconnectError}</span>
      <button onClick={recheck} className="rounded-full bg-slate-800 px-3 py-1 text-slate-200">再試行</button>
    </div>
  );

  const me = players.find((p) => p.id === session.playerId);
  if (!me) return <div className="p-6 text-slate-400">{notice}参加処理中…</div>;
  const isHost = room.host_player_id === me.id;

  let screen;
  if (room.status === 'lobby') screen = <Lobby room={room} players={players} me={me} isHost={isHost} />;
  else if (room.status === 'finished' && room.state?.phase === 'game_end') {
    screen = <Result room={room} players={players} me={me} isHost={isHost} />;
  } else screen = <Table room={room} players={players} me={me} isHost={isHost} />;

  return <>{notice}{screen}</>;
}
