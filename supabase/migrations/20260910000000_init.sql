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

create policy "rooms readable" on public.rooms for select to anon, authenticated using (true);
create policy "players readable" on public.players for select to anon, authenticated using (true);
-- player_tokens / room_secrets にはポリシーを作らない（service role のみ）

alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;

-- 24時間以上前のルームを削除する関数（cron は任意）
create or replace function public.cleanup_old_rooms() returns void language sql security definer as $$
  delete from public.rooms where created_at < now() - interval '24 hours';
$$;
