-- Гарантирует таблицу журнала техкарт + права для anon/authenticated.
-- Run in Supabase SQL Editor, если «Изменения» не показывают правки техкарт.

begin;

create table if not exists public.techcard_changes (
  sheet_name text primary key,
  title text not null default '',
  category text not null default '',
  photo_url text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists techcard_changes_updated_idx
  on public.techcard_changes (updated_at desc);

alter table public.techcard_changes enable row level security;

drop policy if exists techcard_changes_select on public.techcard_changes;
drop policy if exists techcard_changes_insert on public.techcard_changes;
drop policy if exists techcard_changes_update on public.techcard_changes;
drop policy if exists techcard_changes_delete on public.techcard_changes;

create policy techcard_changes_select on public.techcard_changes for select using (true);
create policy techcard_changes_insert on public.techcard_changes for insert with check (true);
create policy techcard_changes_update on public.techcard_changes for update using (true) with check (true);
create policy techcard_changes_delete on public.techcard_changes for delete using (true);

grant select, insert, update, delete on table public.techcard_changes to anon, authenticated;

commit;
