
-- Paired devices: phones registered to approve logins for a user
create table public.paired_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_name text not null default 'My phone',
  pairing_code text not null unique,
  paired_at timestamptz,
  webauthn_credential_id text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index idx_paired_devices_user on public.paired_devices(user_id);
create index idx_paired_devices_code on public.paired_devices(pairing_code);

alter table public.paired_devices enable row level security;

create policy "Users view own devices"
  on public.paired_devices for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own devices"
  on public.paired_devices for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own devices"
  on public.paired_devices for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Users delete own devices"
  on public.paired_devices for delete
  to authenticated
  using (auth.uid() = user_id);

-- Auth challenges: pending login approvals
create table public.auth_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid references public.paired_devices(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','approved','denied','expired')),
  ip_hint text,
  user_agent text,
  location_hint text,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz not null default (now() + interval '2 minutes'),
  biometric_method text
);

create index idx_auth_challenges_user on public.auth_challenges(user_id, created_at desc);

alter table public.auth_challenges enable row level security;

create policy "Users view own challenges"
  on public.auth_challenges for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users create own challenges"
  on public.auth_challenges for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own challenges"
  on public.auth_challenges for update
  to authenticated
  using (auth.uid() = user_id);

-- Enable realtime
alter publication supabase_realtime add table public.paired_devices;
alter publication supabase_realtime add table public.auth_challenges;
alter table public.auth_challenges replica identity full;
alter table public.paired_devices replica identity full;
