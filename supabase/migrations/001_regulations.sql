-- Regulations / requirements / behavior cards in Supabase
-- Run in Supabase SQL Editor (reproducible migration).

begin;

create table if not exists public.regulations (
  id uuid primary key default gen_random_uuid(),
  category text not null
    check (category in (
      'regulations',
      'requirements',
      'behavior',
      'rights_and_duties',
      'equipment_instructions'
    )),
  title text not null default '',
  content text not null default '',
  order_index integer not null default 0,
  images text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists regulations_category_order_idx
  on public.regulations (category, order_index);

create or replace function public.set_regulations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists regulations_set_updated_at on public.regulations;
create trigger regulations_set_updated_at
  before update on public.regulations
  for each row execute function public.set_regulations_updated_at();

alter table public.regulations enable row level security;

drop policy if exists regulations_select on public.regulations;
drop policy if exists regulations_insert on public.regulations;
drop policy if exists regulations_update on public.regulations;
drop policy if exists regulations_delete on public.regulations;

create policy regulations_select on public.regulations for select using (true);
create policy regulations_insert on public.regulations for insert with check (true);
create policy regulations_update on public.regulations for update using (true) with check (true);
create policy regulations_delete on public.regulations for delete using (true);

commit;

-- Seed is done by the app on first empty load (migrates Sheets/defaults → rows).
-- Optionally check: select category, count(*) from public.regulations group by 1;
