-- Guides a visitor has saved for later. DevFili has no passwords, so a saved
-- list is keyed by a random per-browser id (device_id), not an auth user.
-- Service role only: no RLS policies, all access goes through /api/saved.
create table if not exists public.saved_guides (
  device_id uuid not null,
  app_slug text not null,
  app_name text not null,
  guide jsonb not null,
  saved_at timestamptz not null default now(),
  primary key (device_id, app_slug)
);
create index if not exists saved_guides_device_idx on public.saved_guides(device_id, saved_at desc);
alter table public.saved_guides enable row level security;
