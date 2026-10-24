create table public.guides (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  app_slug text not null,
  app_name text not null,
  guide jsonb not null,
  created_at timestamptz not null default now()
);
create index guides_owner_idx on public.guides(owner_id, created_at desc);
alter table public.guides enable row level security;
create policy "owner reads own" on public.guides for select using (auth.uid() = owner_id);
create policy "owner inserts own" on public.guides for insert with check (auth.uid() = owner_id);
create policy "owner deletes own" on public.guides for delete using (auth.uid() = owner_id);

create table public.research_cache (
  app_key text primary key,
  guide jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.research_cache enable row level security;   -- no policies: service role only

create table public.live_runs (
  bucket text not null,        -- 'ip:<hash>' | 'user:<uuid>' | 'global' | 'helper:<hash or uuid>'
  day date not null,
  count int not null default 0,
  primary key (bucket, day)
);
alter table public.live_runs enable row level security;        -- service role only

create function public.bump_live_run(p_bucket text, p_day date) returns int
language sql security definer set search_path = public as $$
  insert into public.live_runs(bucket, day, count) values (p_bucket, p_day, 1)
  on conflict (bucket, day) do update set count = public.live_runs.count + 1
  returning count;
$$;
revoke all on function public.bump_live_run(text, date) from public, anon, authenticated;
grant execute on function public.bump_live_run(text, date) to service_role;
