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
}
export interface PlayerRow {
  id: string;
  name: string;
  seat: number | null;
  is_cpu: boolean;
}

export function useRoom(code: string) {
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPlayers = useCallback(async (roomId: string) => {
    const { data } = await supabase
      .from('players')
      .select('id, name, seat, is_cpu')
      .eq('room_id', roomId)
      .order('seat', { ascending: true, nullsFirst: false })
      .order('joined_at', { ascending: true });
    if (data) setPlayers(data as PlayerRow[]);
  }, []);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('rooms').select('*').eq('code', code.toUpperCase()).maybeSingle();
    if (error || !data) {
      setError('ルームが見つかりません');
      setLoading(false);
      return null;
    }
    const next = data as RoomRow;
    setRoom((prev) => (prev && prev.version > next.version ? prev : next));
    await fetchPlayers(next.id);
    setLoading(false);
    return next;
  }, [code, fetchPlayers]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    (async () => {
      const r = await refresh();
      if (!r || cancelled) return;
      channel = supabase
        .channel(`room:${r.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${r.id}` }, (payload) => {
          setRoom((prev) => {
            const next = payload.new as RoomRow;
            return prev && prev.version > next.version ? prev : next;
          });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${r.id}` }, () => {
          void fetchPlayers(r.id);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') void refresh();
        });
    })();
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [refresh, fetchPlayers]);

  return { room, players, error, loading, refresh };
}
