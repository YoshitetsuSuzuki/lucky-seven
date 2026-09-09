create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_player_id uuid,
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  settings jsonb not null default '{"turnSeconds": 20, "endMode": "points", "target": 200}'::jsonb,
  state jsonb,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null,
  seat integer,
  is_cpu boolean not null default false,
  joined_at timestamptz not null default now()
);
create index players_room_idx on public.players(room_id);
-- 同じルーム内で座席が重複しないようにする（観戦者は seat null なので対象外）
create unique index players_room_seat_uniq on public.players(room_id, seat) where seat is not null;

create table public.player_tokens (
  player_id uuid primary key references public.players(id) on delete cascade,
  token text not null
);

create table public.room_secrets (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  deck jsonb not null default '[]'::jsonb,
  lucky_player_ids jsonb not null default '[]'::jsonb
);

alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.player_tokens enable row level security;
alter table public.room_secrets enable row level security;

-- 身内向けの非公開ゲームのため、rooms は全行 select 可のままとする（ルームコードは推測困難、書き込みは Edge Function のみ）
create policy "rooms readable" on public.rooms for select to anon, authenticated using (true);
create policy "players readable" on public.players for select to anon, authenticated using (true);
-- player_tokens / room_secrets にはポリシーを作らない（service role のみ）

alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;

-- 状態と山札を1トランザクションで更新する（version の compare-and-set 付き）。
-- 更新できたら true、他の操作に先を越されていたら false を返す。
create or replace function public.commit_room(p_id uuid, p_version integer, p_state jsonb, p_status text, p_deck jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.rooms set state = p_state, status = p_status, version = p_version + 1, updated_at = now()
   where id = p_id and version = p_version;
  if not found then return false; end if;
  update public.room_secrets set deck = p_deck where room_id = p_id;
  return true;
end $$;
revoke execute on function public.commit_room(uuid, integer, jsonb, text, jsonb) from public, anon, authenticated;
grant execute on function public.commit_room(uuid, integer, jsonb, text, jsonb) to service_role;

-- ラッキーモードの切替を1文で行う（読み取り→書き込みの間に他者の更新が挟まらないよう行ロック）。
-- 切替後の状態（オンなら true）を返す。
create or replace function public.toggle_lucky(p_room_id uuid, p_player_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_ids jsonb; v_on boolean;
begin
  select lucky_player_ids into v_ids from public.room_secrets where room_id = p_room_id for update;
  if v_ids is null then raise exception 'room not found'; end if;
  v_on := v_ids ? p_player_id;
  if v_on then
    update public.room_secrets set lucky_player_ids = v_ids - p_player_id where room_id = p_room_id;
  else
    update public.room_secrets set lucky_player_ids = v_ids || to_jsonb(p_player_id) where room_id = p_room_id;
  end if;
  return not v_on;
end $$;
revoke execute on function public.toggle_lucky(uuid, text) from public, anon, authenticated;
grant execute on function public.toggle_lucky(uuid, text) to service_role;

-- 24時間以上前のルームを削除する関数（cron は任意）
create or replace function public.cleanup_old_rooms() returns void language sql security definer set search_path = '' as $$
  delete from public.rooms where created_at < now() - interval '24 hours';
$$;
revoke execute on function public.cleanup_old_rooms() from public, anon, authenticated;
