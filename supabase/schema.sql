-- Robin.ai Phase A: workspaces and profiles
-- Run this in Supabase SQL Editor after creating your project.

-- Workspaces: one per user at signup; holds plan and Stripe ids
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Workspace',
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'solo', 'partner', 'fund', 'enterprise')),
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspaces_owner_id on public.workspaces(owner_id);
create index if not exists workspaces_stripe_customer on public.workspaces(stripe_customer_id) where stripe_customer_id is not null;

-- Profiles: app-specific user data (optional; Supabase Auth has email in auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  default_workspace_id uuid references public.workspaces(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Analysis usage for limit enforcement (Free: 5/month)
create table if not exists public.analysis_usage (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  used_at timestamptz not null default now()
);

create index if not exists analysis_usage_workspace_month on public.analysis_usage(workspace_id, date_trunc('month', used_at));

-- RLS: users see only their own workspaces (via owner_id or membership later)
alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;
alter table public.analysis_usage enable row level security;

create policy "Users can read own workspaces"
  on public.workspaces for select
  using (auth.uid() = owner_id);

create policy "Users can update own workspaces"
  on public.workspaces for update
  using (auth.uid() = owner_id);

-- Backend uses service_role key and bypasses RLS for inserts (e.g. create workspace on signup).

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can read usage for own workspaces"
  on public.analysis_usage for select
  using (
    workspace_id in (select id from public.workspaces where owner_id = auth.uid())
  );

-- Backend inserts usage with service_role (bypasses RLS).

-- Trigger: update updated_at on workspaces
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists workspaces_updated_at on public.workspaces;
create trigger workspaces_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
