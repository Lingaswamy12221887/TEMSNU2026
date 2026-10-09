-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run

-- The whole website content (pages, menu, settings) as one JSON document
create table if not exists public.site_content (
  id         int primary key default 1 check (id = 1),
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Automatic history of previous versions (the server keeps the latest 20)
create table if not exists public.site_backups (
  id         bigserial primary key,
  data       jsonb not null,
  created_at timestamptz not null default now()
);

-- Admin password (salted scrypt hash, never the plain password)
create table if not exists public.admin_credentials (
  id   int primary key default 1 check (id = 1),
  salt text not null,
  hash text not null
);

-- Lock the tables down: only the server (service/secret key) can touch them.
alter table public.site_content      enable row level security;
alter table public.site_backups      enable row level security;
alter table public.admin_credentials enable row level security;

-- Private storage bucket for uploaded images (served to visitors through the server)
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;
