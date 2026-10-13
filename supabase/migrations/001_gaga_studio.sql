create extension if not exists pgcrypto;

create table if not exists public.gaga_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  is_active boolean not null default true,
  monthly_quota_usd numeric(12,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gaga_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.gaga_users(id) on delete cascade,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gaga_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.gaga_users(id) on delete restrict,
  project_id uuid references public.gaga_projects(id) on delete set null,
  provider_task_id text not null unique,
  mode text not null check (mode in ('image', 'video')),
  model text not null,
  prompt text not null,
  aspect_ratio text not null default '1:1',
  resolution text not null default '1K',
  duration text,
  status text not null default 'QUEUED' check (status in ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELED')),
  outputs jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  error_message text,
  cost_usd numeric(12,6) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gaga_tasks_user_created_idx on public.gaga_tasks(user_id, created_at desc);
create index if not exists gaga_tasks_status_idx on public.gaga_tasks(status) where status in ('QUEUED', 'RUNNING');
create index if not exists gaga_projects_user_created_idx on public.gaga_projects(user_id, created_at desc);

alter table public.gaga_users enable row level security;
alter table public.gaga_projects enable row level security;
alter table public.gaga_tasks enable row level security;

drop policy if exists "Gaga users read own profile" on public.gaga_users;
create policy "Gaga users read own profile" on public.gaga_users for select to authenticated using (id = auth.uid());
drop policy if exists "Gaga projects own rows" on public.gaga_projects;
create policy "Gaga projects own rows" on public.gaga_projects for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Gaga tasks own rows" on public.gaga_tasks;
create policy "Gaga tasks own rows" on public.gaga_tasks for select to authenticated using (user_id = auth.uid());

comment on table public.gaga_users is 'Gaga AI Studio team profiles; isolated from Metaverz application tables.';
comment on table public.gaga_tasks is 'Gaga generation history for image and non-BytePlus video models.';
