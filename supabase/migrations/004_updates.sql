-- Актуальное: новости, актуальное, комментарии к смене + Storage bucket
-- Run in Supabase SQL Editor.

begin;

create table if not exists public.updates_news (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  content text not null default '',
  image_urls text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.updates_current (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  content text not null default '',
  image_urls text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shift_comments (
  id uuid primary key default gen_random_uuid(),
  author_name text not null default '',
  comment_text text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists updates_news_updated_idx on public.updates_news (updated_at desc);
create index if not exists updates_current_updated_idx on public.updates_current (updated_at desc);
create index if not exists shift_comments_created_idx on public.shift_comments (created_at desc);

create or replace function public.set_updates_news_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create or replace function public.set_updates_current_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists updates_news_set_updated_at on public.updates_news;
create trigger updates_news_set_updated_at
  before update on public.updates_news
  for each row execute function public.set_updates_news_updated_at();

drop trigger if exists updates_current_set_updated_at on public.updates_current;
create trigger updates_current_set_updated_at
  before update on public.updates_current
  for each row execute function public.set_updates_current_updated_at();

alter table public.updates_news enable row level security;
alter table public.updates_current enable row level security;
alter table public.shift_comments enable row level security;

drop policy if exists updates_news_select on public.updates_news;
drop policy if exists updates_news_insert on public.updates_news;
drop policy if exists updates_news_update on public.updates_news;
drop policy if exists updates_news_delete on public.updates_news;
create policy updates_news_select on public.updates_news for select using (true);
create policy updates_news_insert on public.updates_news for insert with check (true);
create policy updates_news_update on public.updates_news for update using (true) with check (true);
create policy updates_news_delete on public.updates_news for delete using (true);

drop policy if exists updates_current_select on public.updates_current;
drop policy if exists updates_current_insert on public.updates_current;
drop policy if exists updates_current_update on public.updates_current;
drop policy if exists updates_current_delete on public.updates_current;
create policy updates_current_select on public.updates_current for select using (true);
create policy updates_current_insert on public.updates_current for insert with check (true);
create policy updates_current_update on public.updates_current for update using (true) with check (true);
create policy updates_current_delete on public.updates_current for delete using (true);

drop policy if exists shift_comments_select on public.shift_comments;
drop policy if exists shift_comments_insert on public.shift_comments;
drop policy if exists shift_comments_delete on public.shift_comments;
create policy shift_comments_select on public.shift_comments for select using (true);
create policy shift_comments_insert on public.shift_comments for insert with check (true);
create policy shift_comments_delete on public.shift_comments for delete using (true);

-- Storage bucket for news/current photos
insert into storage.buckets (id, name, public)
values ('updates', 'updates', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists updates_storage_select on storage.objects;
drop policy if exists updates_storage_insert on storage.objects;
drop policy if exists updates_storage_update on storage.objects;
drop policy if exists updates_storage_delete on storage.objects;

create policy updates_storage_select on storage.objects
  for select using (bucket_id = 'updates');
create policy updates_storage_insert on storage.objects
  for insert with check (bucket_id = 'updates');
create policy updates_storage_update on storage.objects
  for update using (bucket_id = 'updates') with check (bucket_id = 'updates');
create policy updates_storage_delete on storage.objects
  for delete using (bucket_id = 'updates');

commit;
