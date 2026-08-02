-- Equipment instruction cards (list → detail, like techcards)
-- Run in Supabase SQL Editor.

begin;

create table if not exists public.equipment_cards (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  name_ru text not null default '',
  photo_url text not null default '',
  instructions text not null default '',
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists equipment_cards_order_idx
  on public.equipment_cards (order_index);

create or replace function public.set_equipment_cards_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists equipment_cards_set_updated_at on public.equipment_cards;
create trigger equipment_cards_set_updated_at
  before update on public.equipment_cards
  for each row execute function public.set_equipment_cards_updated_at();

alter table public.equipment_cards enable row level security;

drop policy if exists equipment_cards_select on public.equipment_cards;
drop policy if exists equipment_cards_insert on public.equipment_cards;
drop policy if exists equipment_cards_update on public.equipment_cards;
drop policy if exists equipment_cards_delete on public.equipment_cards;

create policy equipment_cards_select on public.equipment_cards for select using (true);
create policy equipment_cards_insert on public.equipment_cards for insert with check (true);
create policy equipment_cards_update on public.equipment_cards for update using (true) with check (true);
create policy equipment_cards_delete on public.equipment_cards for delete using (true);

commit;
