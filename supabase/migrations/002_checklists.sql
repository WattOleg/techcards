-- Checklists: opening / closing shift items
-- Run in Supabase SQL Editor.

begin;

create table if not exists public.checklists (
  id uuid primary key default gen_random_uuid(),
  type text not null
    check (type in ('opening', 'closing')),
  item_text text not null default '',
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists checklists_type_order_idx
  on public.checklists (type, order_index);

create or replace function public.set_checklists_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists checklists_set_updated_at on public.checklists;
create trigger checklists_set_updated_at
  before update on public.checklists
  for each row execute function public.set_checklists_updated_at();

alter table public.checklists enable row level security;

drop policy if exists checklists_select on public.checklists;
drop policy if exists checklists_insert on public.checklists;
drop policy if exists checklists_update on public.checklists;
drop policy if exists checklists_delete on public.checklists;

create policy checklists_select on public.checklists for select using (true);
create policy checklists_insert on public.checklists for insert with check (true);
create policy checklists_update on public.checklists for update using (true) with check (true);
create policy checklists_delete on public.checklists for delete using (true);

commit;
