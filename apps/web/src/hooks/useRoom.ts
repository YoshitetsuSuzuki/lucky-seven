import { useCallback, useEffect, useState } from 'react';
import type { PublicState, Settings } from '@lucky7/engine';
import { supabase } from '../lib/supabase';

export interface RoomRow {
  id: string;
  code: string;
  host_player_id: string | null;
  status: 'lobby' | 'playing' | 'finished';
  settings: Settings;
  state: PublicState | null;
  version: number;
  updated_at: string;
}
export interface RoomPlayer {
  id: string;
  name: string;
  seat: number | null;
  is_cpu: boolean;
}

/** 各画面（Lobby / Table / Result）に共通で渡す props */
export interface ScreenProps { room: RoomRow; players: RoomPlayer[]; me: RoomPlayer; isHost: boolean }

const NET_ERROR = '通信に失敗しました';
/** players 取得に失敗したときの再試行までの待ち時間 */
const PLAYERS_RETRY_MS = 1000;
/** 購読の張り直し・初回取得の再試行まで */
const RESUBSCRIBE_MS = 3000;
/** Realtime が落ちていても最終的に追いつくための保険ポーリング */
const POLL_MS = 10000;

export function useRoom(code: string) {
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPlayers = useCallback(async (roomId: string) => {
    const load = async () => {
      const { data, error: e } = await supabase
        .from('players')
        .select('id, name, seat, is_cpu')
        .eq('room_id', roomId)
        .order('seat', { ascending: true, nullsFirst: false })
        .order('joined_at', { ascending: true });
      if (e || !data) return false;
      setPlayers(data as RoomPlayer[]);
      return true;
    };
    if (await load()) return;
    // 一時的な失敗は 1 秒後に 1 度だけ引き直す
    await new Promise((r) => setTimeout(r, PLAYERS_RETRY_MS));
    if (!(await load())) setError(NET_ERROR);
  }, []);

  const refresh = useCallback(async () => {
    const { data, error: e } = await supabase.from('rooms').select('*').eq('code', code.toUpperCase()).maybeSingle();
    if (e) {
      // 通信エラーと「行が無い」を区別する（前者は再試行で直る）
      setError(NET_ERROR);
      setLoading(false);
      return null;
    }
    if (!data) {
      setError('ルームが見つかりません');
      setLoading(false);
      return null;
    }
    setError(null);
    const next = data as RoomRow;
    setRoom((prev) => (prev && prev.version > next.version ? prev : next));
    await fetchPlayers(next.id);
    setLoading(false);
    return next;
  }, [code, fetchPlayers]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let timer: number | null = null;

    const subscribe = (roomId: string) => {
      if (cancelled) return;
      // トピックは購読ごとに一意にする（同名チャンネルは既存インスタンスが再利用され、
      // subscribe 済みに .on を足そうとして例外になるため）
      channel = supabase
        .channel(`room:${roomId}:${Math.random().toString(36).slice(2, 8)}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) => {
          setRoom((prev) => {
            const next = payload.new as Partial<RoomRow>;
            // 欠けたペイロード（REPLICA IDENTITY 設定漏れなど）は捨てて取り直す
            if (typeof next.version !== 'number' || !next.status) { void refresh(); return prev; }
            return prev && prev.version > next.version ? prev : (next as RoomRow);
          });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, () => {
          void fetchPlayers(roomId);
        })
        .subscribe((status: string) => {
          if (cancelled) return;
          if (status === 'SUBSCRIBED') { void refresh(); return; }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            void refresh();
            const dead = channel;
            channel = null;
            if (dead) void supabase.removeChannel(dead);
            timer = window.setTimeout(() => subscribe(roomId), RESUBSCRIBE_MS);
          }
        });
    };

    const start = async (canRetry: boolean) => {
      const r = await refresh();
      if (cancelled) return;
      if (!r) {
        // 一時的な通信エラーで購読まで辿り着けなかった場合、もう一度だけ試す
        if (canRetry) timer = window.setTimeout(() => { void start(false); }, RESUBSCRIBE_MS);
        return;
      }
      subscribe(r.id);
    };
    void start(true);

    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    const poll = window.setInterval(() => { void refresh(); }, POLL_MS);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(poll);
      if (timer !== null) window.clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [refresh, fetchPlayers]);

  return { room, players, error, loading, refresh };
}
