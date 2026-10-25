-- Who has entered a name on the welcome screen. One row per browser
-- (device_id); service role only, written through /api/visitors.
create table if not exists public.visitors (
  device_id uuid primary key,
  name text not null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
alter table public.visitors enable row level security;
