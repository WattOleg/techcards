-- e-Bar: writeoffs + stop list (run once in Supabase SQL Editor)
begin;

create table if not exists public.stop_list_items (
  id uuid primary key default gen_random_uuid(),
  item text not null,
  date date not null default (current_date),
  created_at timestamptz not null default now()
);

create table if not exists public.writeoff_entries (
  id uuid primary key default gen_random_uuid(),
  item text not null,
  qty text not null,
  unit text not null default 'гр',
  type text not null check (type in ('writeoff', 'move')),
  employee text not null,
  date date not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.writeoff_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  item text not null,
  qty text not null,
  unit text not null default 'гр',
  type text not null check (type in ('writeoff', 'move')),
  reason text not null default '',
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists writeoff_entries_date_idx on public.writeoff_entries (date desc);
create index if not exists stop_list_items_date_idx on public.stop_list_items (date desc);

alter table public.stop_list_items enable row level security;
alter table public.writeoff_entries enable row level security;
alter table public.writeoff_templates enable row level security;

-- authenticated staff (Supabase Auth)
drop policy if exists stop_list_select on public.stop_list_items;
drop policy if exists stop_list_insert on public.stop_list_items;
drop policy if exists stop_list_update on public.stop_list_items;
drop policy if exists stop_list_delete on public.stop_list_items;
create policy stop_list_select on public.stop_list_items for select to authenticated using (true);
create policy stop_list_insert on public.stop_list_items for insert to authenticated with check (true);
create policy stop_list_update on public.stop_list_items for update to authenticated using (true) with check (true);
create policy stop_list_delete on public.stop_list_items for delete to authenticated using (true);

drop policy if exists writeoff_entries_select on public.writeoff_entries;
drop policy if exists writeoff_entries_insert on public.writeoff_entries;
drop policy if exists writeoff_entries_update on public.writeoff_entries;
drop policy if exists writeoff_entries_delete on public.writeoff_entries;
create policy writeoff_entries_select on public.writeoff_entries for select to authenticated using (true);
create policy writeoff_entries_insert on public.writeoff_entries for insert to authenticated with check (true);
create policy writeoff_entries_update on public.writeoff_entries for update to authenticated using (true) with check (true);
create policy writeoff_entries_delete on public.writeoff_entries for delete to authenticated using (true);

drop policy if exists writeoff_templates_select on public.writeoff_templates;
drop policy if exists writeoff_templates_insert on public.writeoff_templates;
drop policy if exists writeoff_templates_update on public.writeoff_templates;
drop policy if exists writeoff_templates_delete on public.writeoff_templates;
create policy writeoff_templates_select on public.writeoff_templates for select to authenticated using (true);
create policy writeoff_templates_insert on public.writeoff_templates for insert to authenticated with check (true);
create policy writeoff_templates_update on public.writeoff_templates for update to authenticated using (true) with check (true);
create policy writeoff_templates_delete on public.writeoff_templates for delete to authenticated using (true);

-- seed stop list
delete from public.stop_list_items;
insert into public.stop_list_items (id, item, date) values ('66e70570-0440-4b1e-89f2-35de8c1231c0', 'Сок рич яблоко', '2026-07-20'::date);
insert into public.stop_list_items (id, item, date) values ('b39c153c-a8af-4c60-9bdf-78d857d56513', 'Нитро колд брю', '2026-07-19'::date);
insert into public.stop_list_items (id, item, date) values ('60b8c310-237e-44ee-8656-ae9acd02b27f', 'Апероль Б/А', '2026-07-18'::date);
-- seed writeoff entries
delete from public.writeoff_entries;
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('31afa01f-4251-4904-8820-287813dca2fc', 'Кофе Эфиопия', '60', 'Грамм', 'move', 'Олег', '2026-04-11'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('e05cd631-647e-4c89-988f-07a3d45afabb', 'Мята', '92', 'Грамм', 'writeoff', 'Олег', '2026-04-08'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('82eb334a-c554-49e0-844c-8a0fc1e29551', 'Кофе Эфиопия', '1,56', 'Килограмм', 'writeoff', 'Олег', '2026-03-31'::date, 'Настрой помола (26 дней)');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('51516e77-94c1-4d80-85a0-831e1ce4736d', 'Кофе Эфиопия', '60', 'Грамм', 'move', 'Олег', '2026-04-04'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('ae6a6354-c251-40f4-a554-75dcb87473c0', 'Комбуча', '1', 'Штука', 'writeoff', 'Олег', '2026-04-04'::date, 'Порча');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('894f5c86-d12e-4acf-8112-74b9355b3ebb', 'Кофе Эфиопия', '60', 'Грамм', 'move', 'Олег', '2026-04-04'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('5e78be1e-e5fe-4399-b50e-59eaaaf5c36a', 'Кофе Эфиопия', '60', 'Грамм', 'move', 'Олег', '2026-04-03'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('857cbc1c-72da-4393-bd02-9a6d28aa164f', 'Мята', '200', 'Грамм', 'writeoff', 'Олег', '2026-04-03'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('5be7b105-19b6-4cb7-827a-e87191aa47e3', 'Мята', '80', 'Грамм', 'writeoff', 'Олег', '2026-03-31'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('46949f07-0092-4d03-81b1-c105f9116a76', 'Яблоко', '630', 'Грамм', 'move', 'Олег', '2026-03-31'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('bdd6dcf2-3df4-4f0d-ac99-d741a46c18ba', 'Молоко 3,2%', '10', 'Литров', 'move', 'Олег', '2026-03-31'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('e79016cc-2697-48a2-9d2b-0d5f8a5c9d4d', 'Кокосовое молоко', '1', 'Литров', 'move', 'Олег', '2026-03-30'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('de789dae-2a0f-48c5-9fa1-828dbd001bd7', 'Молоко 3,2%', '5', 'Литров', 'move', 'Олег', '2026-03-30'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('9338b2de-e392-4ca6-85be-233134fc097d', 'Кофе Эфиопия', '60', 'Грамм', 'move', 'Аяулым', '2026-03-29'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('8d3c7b43-b2c0-4550-a42e-c6290f6c1d97', 'Мята', '90', 'Грамм', 'writeoff', 'Олег', '2026-03-28'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('0df9263a-e119-4fd5-8410-88a7e243a668', 'Мороженное', '2,5', 'Килограмм', 'move', 'Олег', '2026-03-26'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('fae86003-cce1-4d18-8802-d9ab7370d1cf', 'Кофе Эфиопия', '60', 'Грамм', 'move', 'Олег', '2026-03-26'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('e6ee975a-9b6a-4d2f-9c02-1d6b297925dc', 'Сок Апельсиновый', '1', 'Литр', 'move', 'Олег', '2026-03-26'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('226d7ff1-3204-4072-a6b4-6adef9069091', 'Creman D’Alsace', '50', 'Миллилитр', 'writeoff', 'Олег', '2026-03-26'::date, 'Выдохлось');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('7661b611-7102-4a46-b2a6-d6248615c469', 'Prosecco Validabbiadeno', '145', 'Миллилитр', 'writeoff', 'Олег', '2026-03-26'::date, 'Выдохлось');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('aa8ee208-f4d6-44ab-965c-5c0710fd2f6c', 'Мята', '110', 'Грамм', 'writeoff', 'Аяулым', '2026-03-23'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('46803a6c-ccac-4d4e-aced-7c6e6f904b22', 'Кофе Эфиопия', '60', 'Грамм', 'move', 'Аяулым', '2026-03-23'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('a8e8d146-332d-476e-b8f6-12faa2407621', 'Молоко 3,2%', '2', 'Литров', 'move', 'Аяулым', '2026-03-23'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('2a17a47c-6f7e-4705-a206-046180f5d54d', 'Комбуча', '1', 'Штук', 'writeoff', 'Олег', '2026-03-22'::date, 'Порча (перемерзло)');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('017684be-2e87-4974-8371-d6a3109d5d15', 'Кофе Эфиопия', '60', 'Грамм', 'move', 'Олег', '2026-03-21'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('e85af0a5-817c-4b89-a982-ad829258359d', 'Мята', '90', 'Грамм', 'writeoff', 'Олег', '2026-03-20'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('aff1cbe8-813d-4bda-9467-b3019cc4d051', 'Кофе Эфиопия', '60', 'Грамм', 'move', 'Олег', '2026-03-20'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('d25e9ee7-408d-4344-8a40-0de49330ec4d', 'Кофе Эфиопия', '60', 'Грамм', 'move', 'Олег', '2026-03-18'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('34e63dce-3313-46b5-8e1d-c7b88b8bafbf', 'Кофе Эфиопия', '60', 'Грамм', 'move', 'Олег', '2026-03-16'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('636aad42-be10-402f-b5e5-ce252388a64c', 'Мята', '100', 'Грамм', 'writeoff', 'Олег', '2026-03-15'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('04db48b4-5153-4189-849f-a0465a802873', 'Кофе Эфиопия', '180', 'Грамм', 'move', 'Олег', '2026-03-13'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('341ce1b3-9c16-47da-bad8-a298dc7f9e0d', 'Молоко 3,2%', '24', 'Литров', 'move', 'Аяулым', '2026-03-10'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('1da349a2-495c-4f26-bd5d-598db5c6e658', 'Кофе Эфиопия', '60', 'Грамм', 'move', 'Аяулым', '2026-03-10'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('f1a65de4-b5bb-43c6-a7a7-66e30fda6126', 'Мята', '65', 'Грамм', 'writeoff', 'Олег', '2026-03-09'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('7d705638-5c97-4cb6-9783-0fe9b01f169d', 'Кофе Эфиопия', '60', 'Грамм', 'move', 'Олег', '2026-03-09'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('83ffcdc3-24dc-4726-93a5-4e13f3f90bb0', 'Кофе Эфиопия', '60', 'Грамм', 'move', 'Олег', '2026-03-08'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('d6a466c9-4ae8-466b-b05c-46c1b3181540', 'Мята', '40', 'Грамм', 'writeoff', 'Олег', '2026-03-08'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('c6931e0c-c368-49d3-82f5-6e7fbfa9989c', 'Мята', '65', 'Грамм', 'writeoff', 'Аяулым', '2026-03-07'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('52dcd7c3-f9ec-4f2a-8347-284e3338d30c', 'Сок Rich Яблоко', '0.4', 'Литр', 'move', 'Аяулым', '2026-03-07'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('a54e5eb6-8d1b-4308-bb62-6d2eb7ecbfda', 'Вино Don Simon merlot', '0,75', 'Литр', 'move', 'Аяулым', '2026-03-06'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('697b2e55-b698-4e47-8d36-1522c44dc805', 'Кофе Эфиопия', '60', 'Грамм', 'move', 'Аяулым', '2026-03-06'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('9c11bc93-3e6a-48c6-be4a-f12b3de97503', 'Молоко 3,2%', '8', 'Литров', 'move', 'Олег', '2026-03-05'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('9f0bc4b2-c41c-43f1-a895-884ac8c09b21', 'Молоко 3,2%', '6', 'Литров', 'move', 'Олег', '2026-04-08'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('69ce8df7-9c67-4e4e-8184-f2cdce620f07', 'Мята', '172', 'гр', 'writeoff', 'Олег', '2026-04-11'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('c1011261-4d1a-4b6d-a9ae-497ec9b5373d', 'Молоко 3,2%', '24', 'Литр', 'move', 'Аяулым', '2026-04-10'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('35062605-30df-4140-9801-cde584e36b29', 'Кокосовое молоко', '1', 'Литр', 'move', 'Аяулым', '2026-04-10'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('0a9eb8bf-d1ab-4f06-bc29-7e36d56866d2', 'Кофе Эфиопия', '60', 'Грамм', 'move', 'Аяулым', '2026-04-10'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('6a7f6c5e-69f4-4c2e-9ecb-22db30c69588', 'Эритрит (сахзам)', '100', 'Грамм', 'move', 'Аяулым', '2026-04-10'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('bb61ce84-f33f-4c66-ae66-aaaf20344d84', 'Пюре лимон см', '50', 'Грамм', 'move', 'Аяулым', '2026-04-10'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('fb01ea54-9c35-40fd-ac5e-039ed143d2d3', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Олег', '2026-04-12'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('103c2625-09c8-4776-899d-e89ce9bc3e52', 'Сок Вишневый (в ассорт.)', '500', 'Миллилитр', 'writeoff', 'Олег', '2026-04-12'::date, 'Порча');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('f3ac7b74-b71a-474e-99ab-f307263e2bb7', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Даяна', '2026-04-13'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('50205edc-89e5-4a15-aa27-cf9f640394a9', 'Мята', '52.3', 'гр', 'writeoff', 'Даяна', '2026-04-13'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('53c562a1-dc12-4eab-9e9c-bbec4021da1c', 'Молоко 3,2%', '2', 'Литр', 'move', 'Даяна', '2026-04-14'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('9b6f3adf-bc79-44e3-bb99-1446fa7bc923', 'Лимон', '170', 'гр', 'move', 'Даяна', '2026-04-14'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('ae188262-5dc5-4980-bb48-addf2e8b2b35', 'Молоко 3,2%', '8', 'Литр', 'move', 'Олег', '2026-04-15'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('94aa795c-d510-4c4a-b6db-dc815cfade28', 'Мята', '175', 'гр', 'writeoff', 'Олег', '2026-04-15'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('1191b3b4-65d2-4633-9f9a-566486591d2c', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Олег', '2026-04-15'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('d1e9b2df-6b6c-43f2-8b02-5f4a1c2ad920', 'Сок в ассорт. (Гранат)', '400', 'Мл', 'writeoff', 'Олег', '2026-04-15'::date, 'Порча');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('544e6ba5-4bda-4649-a098-b5dccb6628ba', 'Молоко 3,2%', '2', 'Литр', 'move', 'Олег', '2026-04-17'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('0135b470-fa91-4bb7-b35d-bee569a6df64', 'Банан', '450', 'гр', 'move', 'Олег', '2026-04-17'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('69350f1d-7d2a-4f31-b051-c3d19ef24f01', 'Молоко 3,2%', '5', 'Литр', 'move', 'Олег', '2026-04-18'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('e5df7085-3373-4bef-89d4-37267ee072a6', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Олег', '2026-04-18'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('3b7e5093-064b-4723-9589-6eff8a73eb81', 'Молоко 3,2%', '8', 'Литр', 'move', 'Олег', '2026-04-19'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('a275eeea-5fe2-42c0-a0fd-a57407c9931f', 'Кофе Эфиопия-Гватемала', '120', 'гр', 'move', 'Олег', '2026-04-19'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('c1d0dd29-07c2-4123-ac98-3f11b2e87ae6', 'Мята', '135', 'гр', 'writeoff', 'Олег', '2026-04-19'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('c307ee87-ffd7-4c69-a83b-b9fcfe5e4bf2', 'Молоко 3,2%', '2', 'Литр', 'move', 'Олег', '2026-04-19'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('45d8ddf2-e7ed-4580-8052-05187a2a2e0b', 'Молоко 3,2%', '24', 'Литр', 'move', 'Даяна', '2026-04-20'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('1a01cf72-1101-49bb-9d68-e649f417de0c', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Олег', '2026-04-21'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('86fb1000-2be3-471c-b5b8-38623fae375f', 'Мята', '50', 'гр', 'move', 'Олег', '2026-04-21'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('6de5d483-9d84-4392-b4ac-d035354384fa', 'Маракуя см', '110', 'гр', 'move', 'Олег', '2026-04-21'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('f01d9e4c-dfb4-400b-a12e-4d8afabee8a3', 'Яблоко зеленое', '420', 'гр', 'move', 'Олег', '2026-04-21'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('136be6da-7f52-434b-a9bb-8c3a9751741a', 'San Pellegrino', '0,75', 'Л', 'writeoff', 'Олег', '2026-04-22'::date, 'Перемерзла/порча');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('5d2bf60e-2a79-4420-98a1-f0532601e752', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Даяна', '2026-04-23'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('6f268e9f-f8f6-4eae-b108-50f6b540b757', 'Мороженное', '2,5', 'Кг', 'move', 'Олег', '2026-04-25'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('ef0bcc03-9add-4730-a7f8-d564c500b520', 'Мята', '195', 'гр', 'writeoff', 'Даяна', '2026-04-23'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('7461cece-532f-4868-b24c-beb65cd894af', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Олег', '2026-04-26'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('6bfcc0c8-5127-4fe6-b4e1-1f5292ace57a', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Даяна', '2026-04-27'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('acefb798-670c-4a7e-b57e-dad1d3d68505', 'Мята', '203', 'гр', 'writeoff', 'Даяна', '2026-04-27'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('669a8bef-a9a0-4aa9-a338-76ed1929c034', 'Молоко на кондитерку', '2', 'Л', 'move', 'Даяна', '2026-04-27'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('4c046afb-ff37-4def-8866-d33d736e66a8', 'Молоко 3,2%', '5', 'Литр', 'move', 'Даяна', '2026-04-28'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('70538a39-62e6-40cb-9f31-5d1394aa75f4', 'Протеин в ассорт.', '100', 'гр', 'writeoff', 'Олег', '2026-04-29'::date, 'Проработка/фотоссесия');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('4cafbf4a-a080-4995-9ddc-88f15e29fc5d', 'Пюре мандарин см', '1000', 'гр', 'writeoff', 'Олег', '2026-04-29'::date, 'Проработка/фотоссесия');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('97a0d775-e0d2-43b5-9df6-3289559cfc4e', 'Смузи Голубика-сгущенка', '4', 'Шт', 'writeoff', 'Олег', '2026-04-29'::date, 'Проработка/фотоссесия');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('a2f4a43c-c660-4ebc-aeb5-5b3b78bbb812', 'Смузи Дыня-Соленая карамель', '5', 'Шт', 'writeoff', 'Олег', '2026-04-29'::date, 'Проработка/фотоссесия');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('b8bd7cbb-41ab-4463-a733-61b86165bce1', 'Кофе', '100', 'гр', 'writeoff', 'Олег', '2026-04-29'::date, 'Проработка/фотоссесия');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('6eeb65c7-7c28-4bea-b908-b8095e0daf3d', 'Молоко', '1000', 'Мл', 'writeoff', 'Олег', '2026-04-29'::date, 'Проработка/фотоссесия');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('5a24779b-fe08-42b1-82c5-aae6fb3bddbc', 'Молочный коктейль Тирамису', '4', 'Шт', 'writeoff', 'Олег', '2026-04-29'::date, 'Проработка/фотоссесия');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('e62bdfeb-dd88-4f22-9801-95e8ac8d141a', 'Ежевика см', '300', 'гр', 'writeoff', 'Олег', '2026-04-29'::date, 'Проработка/фотоссесия');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('2c865e11-0206-47ca-ac66-9f454fd8ed8a', 'Сахар', '1000', 'гр', 'writeoff', 'Олег', '2026-04-29'::date, 'Проработка/фотоссесия');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('c466c6dd-ba60-499a-be9f-ed41a0086b74', 'Лимонад манго-личи 350', '4', 'Шт', 'writeoff', 'Олег', '2026-04-29'::date, 'Проработка/фотоссесия');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('e1dc0739-5b97-4d2a-a78e-1fae262ed681', 'Лимонад Гранат-Лимон 350', '4', 'Шт', 'writeoff', 'Олег', '2026-04-29'::date, 'Проработка/фотоссесия');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('c80094e8-4ced-43a5-b909-a45678140ca7', 'Фреш Огурец-Яблоко', '3', 'Шт', 'writeoff', 'Олег', '2026-04-29'::date, 'Проработка/фотоссесия');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('30f77e95-9d1f-43cc-a489-06c5d3487857', 'Крыжовник см', '1', 'Кг', 'move', 'Олег', '2026-04-25'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('f44e5a75-48d3-44df-b67c-64f6565f2c9d', 'Алоэ', '300', 'Гр', 'writeoff', 'Олег', '2026-04-29'::date, 'Проработка/фотоссесия');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('044b8933-881c-4dcf-8d29-7202944d0103', 'Сироп в ассорт. HerrBarista', '200', 'Мл', 'writeoff', 'Олег', '2026-04-29'::date, 'Проработка/фотоссесия');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('be01a03d-a8b0-4d20-9157-d151ff50b643', 'Кофе Эфиопия-Гватемала', '1700', 'гр', 'writeoff', 'Олег', '2026-04-29'::date, 'Настрой помола (29 дней)');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('f064c3e9-a8e5-4f78-95d2-6bd203bc6b0f', 'Молоко 3,2%', '5', 'Литр', 'move', 'Даяна', '2026-04-30'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('e4cdd4a9-c520-420e-a791-f8a695a34ea7', 'Молоко 3,2%', '24', 'Литр', 'move', 'Даяна', '2026-04-30'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('d1535a75-0874-4d18-a05d-97ec621482b0', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Даяна', '2026-04-30'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('04c933d3-313b-4d28-8bf3-2928be655ce5', 'Банан', '51', 'гр', 'writeoff', 'Даяна', '2026-04-30'::date, 'Испортился');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('65c1d3ae-2538-49cb-a185-a9f53255f1b7', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Олег', '2026-05-01'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('4af4c79c-2b34-404a-a248-8b990bec3e18', 'Газированная вода Туран', '3', 'Л', 'move', 'Олег', '2026-05-01'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('4d44865c-9727-4c11-873a-0358e1ed9abc', 'Мороженное', '2,7', 'Кг', 'move', 'Олег', '2026-04-30'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('d1637581-1f88-450c-9a5f-49474890bf30', 'Мята', '155', 'гр', 'writeoff', 'Олег', '2026-05-01'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('91832060-4388-49a9-86a1-4ae26d97fe93', 'Малина см', '850', 'гр', 'move', 'Олег', '2026-05-02'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('30feb97e-e01b-4d4f-8831-f510332ea389', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Олег', '2026-05-02'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('f2c759c7-f729-4583-a450-080e78e24fc9', 'Пюре манго см', '1', 'Кг', 'move', 'Олег', '2026-05-02'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('aae58b21-f24f-4d95-8423-8484c9eb5b56', 'Мята', '152', 'гр', 'writeoff', 'Даяна', '2026-05-03'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('08574c19-103c-4213-b74e-fd142452f761', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Даяна', '2026-05-04'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('92d7bbca-2544-4223-80fd-b9ea0b79e999', 'Молоко 3,2%', '4', 'Литр', 'move', 'Олег', '2026-05-06'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('f56fc786-3577-4870-89eb-f5ce1adfb241', 'Эритрит', '460', 'гр', 'move', 'Олег', '2026-05-07'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('d2768334-3d88-4648-811e-0fc3f10be15a', 'Молоко 3,2%', '5', 'Литр', 'move', 'Олег', '2026-05-07'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('1ca5a8d8-7839-48c7-863d-222beb37f334', 'Мята', '105', 'гр', 'writeoff', 'Олег', '2026-05-07'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('5daf7c14-f0c9-4da9-9fb3-353bf2bbcad6', 'Молоко', '2', 'Л', 'move', 'Даяна', '2026-05-07'::date, 'Кондитерская');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('5c405e1a-a6ca-4e72-9802-c3672520dd64', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Даяна', '2026-05-07'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('bf434c10-c151-46c9-8b81-de60e686d9a9', 'Мин. Вода Туран', '6', 'Литр', 'move', 'Олег', '2026-05-09'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('10756302-daa9-415b-8821-a0764785e855', 'Молоко 3,2%', '2', 'Литр', 'move', 'Олег', '2026-05-09'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('d4cf0f03-d672-43e6-a9bc-10e62a6bf31d', 'Мята', '115', 'гр', 'writeoff', 'Олег', '2026-05-09'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('f6297b24-4b0f-4036-ad7d-a352bd088735', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Даяна', '2026-05-10'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('bee2268f-9a4d-4899-b31e-db6757019505', 'Вино белое Don Cimon', '0,75', 'Л', 'move', 'Даяна', '2026-05-12'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('56c2031e-5a36-4d56-9e19-e7e1459ff43d', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Олег', '2026-05-13'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('2a6cffe9-a176-4ccf-87ed-095b102355f0', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Олег', '2026-05-14'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('def3ad54-0597-4edf-99c3-2781c764682e', 'Мята', '160', 'гр', 'writeoff', 'Олег', '2026-05-14'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('3ad194e5-9a95-45dc-8e69-1d40c653012c', 'Молоко', '2', 'Л', 'move', 'Даяна', '2026-05-13'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('4991a6ec-12c9-4488-8a86-8344eae2174c', 'Молоко Кокосовое', '1', 'Л', 'move', 'Даяна', '2026-05-15'::date, 'Кондитерская');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('0b483b94-5e3f-4b60-a7d0-2e858e0c6c89', 'Молоко Кокосовое', '1', 'Л', 'move', 'Даяна', '2026-05-15'::date, 'Кондитерская');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('a8b9e9ea-eed9-4644-935a-50531a20a0b2', 'Мята', '210', 'гр', 'writeoff', 'Олег', '2026-05-16'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('54a12b3b-1540-4ec7-9076-d7146f07629e', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Олег', '2026-05-17'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('35db8be9-ae7e-482d-bb1e-8008f11c351e', 'Молоко 3,2%', '2', 'Литр', 'move', 'Даяна', '2026-05-17'::date, 'Кондитерская');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('547d9001-075c-44b5-95e2-d1df24172cec', 'Мята', '135', 'гр', 'writeoff', 'Даяна', '2026-05-18'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('6fee5c0e-6244-46e9-90e6-4c39c777b4eb', 'Мята', '135', 'гр', 'writeoff', 'Даяна', '2026-05-18'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('20bb6808-7e40-4e99-b114-ab8f8e0585c0', 'Лимон', '307', 'гр', 'move', 'Даяна', '2026-05-18'::date, 'Кондитерская');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('c9f25dee-71b1-403f-b71b-7b3428ccf719', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Олег', '2026-05-20'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('253c2145-5902-4d61-a00d-ba1bd4a24ded', 'Лимон пюре', '100', 'гр', 'move', 'Даяна', '2026-05-22'::date, 'Кондитерская');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('0148516b-e3b6-4dc0-9e6e-3847b7d69a42', 'Огурец', '167', 'гр', 'move', 'Даяна', '2026-05-22'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('ea186fbe-ab66-4517-80c7-7ae4b0a07a34', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Олег', '2026-05-23'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('4c58b71f-ded6-4216-9c0e-6873ed7f0d92', 'Банан', '160', 'Гр', 'move', 'Олег', '2026-05-23'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('04be3719-9e78-4db9-860f-35db0dd2ae60', 'Мята', '95', 'гр', 'writeoff', 'Олег', '2026-05-24'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('184c0b10-5f43-4900-83ef-9a651c358a89', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Олег', '2026-05-25'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('9f9d3aac-4ffd-43ca-9db4-2dc26d9bca74', 'Молоко 3,2%', '5', 'Литр', 'move', 'Даяна', '2026-05-25'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('2ee4a5ff-cdc6-47e8-8d61-255d887682c1', 'Вода Туран', '3', 'Л', 'move', 'Олег', '2026-05-27'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('632c79dd-6cdf-48dd-ad10-73298bb93585', 'Сок в ассортименте', '1', 'Л', 'writeoff', 'Олег', '2026-05-27'::date, 'Порча');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('8d39a3da-74d5-44e3-8a7f-dc97d6849f73', 'Сок в ассортименте', '1', 'Л', 'move', 'Олег', '2026-05-28'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('05b01cc7-bf8a-4d52-ba2a-56db355ec799', 'Вода Туран', '1,5', 'Л', 'move', 'Олег', '2026-05-28'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('6e6bf8b3-bbdd-4047-84e2-6e8a0cc0d82d', 'Молоко 3,2%', '7', 'Литр', 'move', 'Олег', '2026-05-28'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('8a1e0c9f-b266-4919-b88c-2a42395f9a1d', 'Кофе Эфиопия Гватемала', '1,74', 'Кг', 'writeoff', 'Одег', '2026-05-28'::date, 'Настрой помола');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('4bb2eee1-058f-4987-9260-bce53eeafef4', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Даяна', '2026-05-27'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('a3385e5b-1afa-440a-94ec-45b5dec39bb9', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Даяна', '2026-05-29'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('8c3e5746-6713-47f3-9b1a-556ab8169c62', 'Вода Туран', '18', 'Л', 'move', 'Олег', '2026-05-30'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('35d2697f-0fe3-41d7-a350-7708ad6336b8', 'Молоко 3,2%', '60', 'Литр', 'move', 'Даяна', '2026-05-29'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('7f6223af-ab31-4a59-b700-0fc9ee5ab064', 'Мята', '150', 'гр', 'writeoff', 'Даяна', '2026-05-30'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('9c2dbf5f-487b-4d58-aafe-3cb2ce57bfa9', 'Молоко 3,2%', '2', 'Литр', 'move', 'Олег', '2026-06-01'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('65326b9f-c506-4b3e-9111-9ca3c37504c5', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Даяна', '2026-06-01'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('cb5c13be-f791-4b80-a9f1-89e1e57b3ec9', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Даяна', '2026-06-02'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('51975555-268a-44ab-a5e1-cf44155305ee', 'Мята', '134', 'гр', 'writeoff', 'Даяна', '2026-06-02'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('68a43449-00e7-4824-a49b-7f55d63d7ab4', 'Вода Туран', '4,5', 'Л', 'move', 'Олег', '2026-06-03'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('eb733894-7ef4-4e5b-9133-09237445c7fc', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Олег', '2026-06-06'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('4cf5cba0-df48-499b-b46f-226b235743a2', 'Вода Туран', '9', 'Л', 'move', 'Олег', '2026-06-06'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('e532ecbb-7130-4e04-942b-104004d640d8', 'Мята', '185', 'гр', 'writeoff', 'Олег', '2026-06-06'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('7194f49b-1122-4ae4-8018-6f2383b7d406', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Олег', '2026-06-07'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('d9ecd92b-9595-4b2f-85f9-c772764b3710', 'Баллоны для сливок', '20', 'Шт', 'move', 'Олег', '2026-06-07'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('780f0017-797c-4619-90b7-74ff830a70fd', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Даяна', '2026-06-08'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('e04eacb3-eaad-48ba-865a-1d082a998aa7', 'Мята', '132', 'гр', 'writeoff', 'Даяна', '2026-06-09'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('0a795d91-4694-4743-98a3-ebdc63544e61', 'Кофе Эфиопия-Гватемала', '120', 'гр', 'move', 'Олег', '2026-06-10'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('1f6a0de2-25fd-4b62-88fa-581ec88737a0', 'Молоко 3,2%', '2', 'Литр', 'move', 'Олег', '2026-06-10'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('5f6a442a-5fa9-4960-a03b-0a0ad12c4741', 'Клубника см', '1', 'Кг', 'move', 'Олег', '2026-06-11'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('268ad126-9f58-4cc0-9929-3e632cba0e08', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Даяна', '2026-06-12'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('685e01f4-4993-42e1-b036-8fb45a35c57a', 'Мята', '140', 'гр', 'writeoff', 'Даяна', '2026-06-12'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('4365398a-1532-42a3-8732-e3dbef9ede1f', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Олег', '2026-06-13'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('0655f054-8783-43aa-8db5-b382009bc892', 'Огурец', '730', 'Гр', 'move', 'Олег', '2026-06-13'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('65995e0f-561c-4511-8264-f6515eca8238', 'Сок il Primo 0,2', '2', 'Шт', 'writeoff', 'Олег', '2026-06-13'::date, 'Отработка');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('ba45e471-6747-4491-aadc-894493622cd0', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Олег', '2026-06-14'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('ce3d132f-6e35-437f-82e3-f368725d8635', 'Молоко 3,2%', '3', 'Литр', 'move', 'Даяна', '2026-06-15'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('802488d7-002b-43ca-8d9e-4fbbc4414727', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Даяна', '2026-06-15'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('c285f4b7-d71d-4c87-a212-88ab6fa3668a', 'Вода Туран', '9', 'Л', 'move', 'Олег', '2026-06-15'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('2a489c95-de7a-45e3-ba67-ed5aa647aa2f', 'Мята', '84', 'гр', 'writeoff', 'Даяна', '2026-06-16'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('d92d6730-1788-4d80-9be6-d1a26df28582', 'Мед', '50', 'гр', 'move', 'Даяна', '2026-06-16'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('58149417-83f5-4ed6-84dd-dfb40dffb7c7', 'Don Simon Merlot/Chardonay кр/бел', '7,5', 'Л', 'move', 'Олег', '2026-06-18'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('ec7939bd-b076-4451-bcb3-242270ff14e2', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Даяна', '2026-06-18'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('c62cc9e4-8067-4cda-b189-7640855d8637', 'Мята', '78.9', 'гр', 'writeoff', 'Даяна', '2026-06-18'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('925f81b8-7124-4aed-b9ea-4c12fd6843b8', 'Молоко кокос', '280', 'гр', 'move', 'Даяна', '2026-06-19'::date, 'Кондитерская');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('cd1d03d7-9eda-490d-801e-aa96703b47a5', 'Мед', '196', 'гр', 'move', 'Даяна', '2026-06-19'::date, 'Кондитерская');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('d0c51f9f-f1e7-40bc-9f6e-f874e1a47353', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Олег', '2026-06-20'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('3945213a-b31f-462f-9c5a-3c6f2effe787', 'Мед', '1000', 'Гр', 'move', 'Олег', '2026-06-20'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('8c9c7fe1-e0fb-4b31-a1fa-b2ed83aa8ca7', 'Мята', '100', 'гр', 'writeoff', 'Олег', '2026-06-20'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('e33fd297-682c-4999-96c8-bfbe9a7d7574', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Даяна', '2026-06-23'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('694c1f85-ee08-4c31-a4d1-115e578dac1a', 'Мята', '70', 'гр', 'writeoff', 'Даяна', '2026-06-23'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('89d40499-5468-4dcf-840e-02b002324759', 'Молоко 3,2%', '36', 'Литр', 'move', 'Олег', '2026-06-24'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('348794c2-389b-49d0-a63a-a0421e6fd916', 'Вода Туран', '9', 'Л', 'move', 'Олег', '2026-06-25'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('57ce1c86-c399-4a58-9b63-ab04e9e63056', 'Мята', '135', 'гр', 'writeoff', 'Даяна', '2026-06-25'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('b0e79f0f-068c-4dd1-b07b-41d4ccf99a44', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Даяна', '2026-06-26'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('5d28f288-b447-4c3e-9062-af7eb921a800', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Олег', '2026-06-27'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('42c2b3c2-f95e-49e5-949a-26105abc045a', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Олег', '2026-06-28'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('c4ec34aa-445b-4e55-8345-2f61e45e628d', 'Мята', '70', 'гр', 'writeoff', 'Даяна', '2026-06-28'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('f92798a9-01d4-451d-9e6b-845b50aba7da', 'Пюре манго см', '1', 'Кг', 'move', 'Олег', '2026-06-29'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('c91dc057-ff99-4853-9bb0-ecddc2e0f1a7', 'Сок апельсин', '1', 'Л', 'move', 'Даяна', '2026-06-29'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('d79c0670-63ac-4489-9f0c-34008be4f7c4', 'Мороженое', '2,7', 'Кг', 'move', 'Олег', '2026-06-30'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('430abcea-e1dc-4983-b3b8-24ee43eb87f3', 'Кофе Эфиопия-Гватемала', '30', 'гр', 'move', 'Олег', '2026-06-29'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('38c839ef-7672-4354-8722-fea91b2d3697', 'Кофе Эфиопия-Гватемала', '20', 'гр', 'move', 'Олег', '2026-06-30'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('a045bb0e-cc5b-4100-a70f-f0c157082a91', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Олег', '2026-07-01'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('70f4a8aa-0f93-4176-8790-a94fc07af259', 'Мята', '150', 'гр', 'writeoff', 'Олег', '2026-07-01'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('044afce2-be91-413a-a7bd-ebe3ae890a31', 'Пюре манго см', '1', 'Кг', 'move', 'Олег', '2026-07-02'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('7db23d05-1595-4780-8649-590cbc6630a0', 'Пюре манго см', '1', 'Кг', 'move', 'Олег', '2026-07-02'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('7837d227-6526-4b43-9f3c-353702ce5797', 'Кофе', '40', 'гр', 'move', 'Даяна', '2026-07-03'::date, 'Кондитерская');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('a76089b9-1e4e-445a-a97e-fc2f86129cc7', 'Кофе', '40', 'гр', 'move', 'Даяна', '2026-07-03'::date, 'Кондитерская');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('9d763051-081d-4f62-8008-9a1b363e4ebb', 'Кофе', '40', 'гр', 'move', 'Даяна', '2026-07-03'::date, 'Кондитерская');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('55d2b333-e74f-46a7-9031-141e6ddebc1e', 'Лимон пюре', '20', 'гр', 'move', 'Даяна', '2026-07-03'::date, 'Кондитерская');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('76952222-b682-4c68-8574-7ab8509ddb6f', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Олег', '2026-07-04'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('e7f43292-37ab-4b03-a5da-a70eb2a4802e', 'Молоко 3,2%', '2', 'Литр', 'move', 'Олег', '2026-07-04'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('68297dee-9a6c-4b68-8088-4584ec98f994', 'Мята', '100', 'гр', 'writeoff', 'Олег', '2026-07-04'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('f8c4857f-c9a5-4f74-943e-7ac312761ab7', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Олег', '2026-07-05'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('370424ca-4e51-4095-ad3b-958eceb9ad63', 'Яблоко зеленое', '530', 'гр', 'move', 'Олег', '2026-07-05'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('105da1b7-5447-44f6-9dda-bc1ec3aee5c9', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Олег', '2026-07-06'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('d759c00b-792d-4af2-b6e5-54157a23ab0b', 'Молоко 3,2%', '2', 'Литр', 'move', 'Олег', '2026-07-06'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('1a9064c0-d121-4d53-acee-94294213faa2', 'Мята', '100', 'гр', 'writeoff', 'Олег', '2026-07-08'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('5976f261-2963-41a9-84a2-464270c5b003', 'Мята', '100', 'гр', 'writeoff', 'Олег', '2026-07-08'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('77f45a24-b0c7-4b1e-90ad-81157c1dc13f', 'Мята', '100', 'гр', 'writeoff', 'Олег', '2026-07-08'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('e5bb7980-11d9-4e12-9475-e60994253e54', 'Вода Туран', '9', 'Л', 'move', 'Олег', '2026-07-08'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('1e08976a-35b7-4995-99d8-dbc46e50417e', 'Молоко 3,2%', '24', 'Литр', 'move', 'Милена', '2026-07-09'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('6c2085c4-bef4-4bc3-82c8-598d30fa43a2', 'Суб. Малина', '10', 'гр', 'move', 'Олег', '2026-07-12'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('a5687aec-cf92-40c8-8207-b847a25d34b8', 'Молоко 3,2%', '2', 'Литр', 'move', 'Олег', '2026-07-12'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('82a4ecdc-9b23-43ac-964f-58293a3bdc7e', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Олег', '2026-07-12'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('9342549f-eb73-4e78-8188-8d0fd6e5b5a0', 'Мята', '60', 'гр', 'writeoff', 'Олег', '2026-07-12'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('bce5c108-8676-43d4-a479-65fce93d6034', 'Швепс на ягодах пф', '250', 'Мл', 'writeoff', 'Олег', '2026-07-12'::date, 'Порча');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('678f7562-2848-4b46-af10-9bc675c363bf', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Милена', '2026-07-13'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('6216a4d5-b004-44fe-b0ac-66058309573f', 'Молоко 3,2%', '5', 'Литр', 'move', 'Милена', '2026-07-15'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('509ada2b-9471-4200-8057-0b0f948eb2e5', 'Мята', '60', 'гр', 'writeoff', 'Олег', '2026-07-15'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('79ad9a44-0671-45f4-b25c-e78703bf71aa', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Олег', '2026-07-16'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('ed183e8f-12b5-45bc-8267-5735ae8b538c', 'Альтернативное молоко (фундук)', '3', 'Л', 'writeoff', 'Олег', '2026-07-16'::date, 'Закончился срок годности');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('b770f238-1fb8-46bc-b215-c6f30e456116', 'Матча зеленая', '15', 'Гр', 'writeoff', 'Олег', '2026-07-16'::date, 'Отработка');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('8e4a2d19-e877-411e-af34-bc39f55b58b8', 'Альтернативное молоко (овсяное)', '1', 'Л', 'writeoff', 'Олег', '2026-07-16'::date, 'Отработка');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('94408f80-1559-433e-abc0-48bf34013eb6', 'лимон пф', '1', '20 грамм', 'move', 'Милена', '2026-07-16'::date, 'кондитерка');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('f2bd89f9-e684-49b8-b196-7fc7550e1d4d', 'Мята', '1', '6 гр', 'move', 'Милена', '2026-07-17'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('abf88726-0423-44a8-a156-b2c2e13b1093', 'Клубничная матча', '1', 'Порция', 'writeoff', 'Олег', '2026-07-17'::date, 'Отработка');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('0fedc361-2187-4727-b3e4-69a236cc4207', 'Матча с голубикой', '1', 'Порция', 'writeoff', 'Олег', '2026-07-17'::date, 'Отработка');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('70aac9ef-1a09-4151-8e34-e298a9ba83d3', 'Матча розовый персик', '1', 'Порция', 'writeoff', 'Олег', '2026-07-17'::date, 'Отработка');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('2e404265-8a46-4005-a170-9f4dca8866b8', 'Кола эспрессо', '1', 'Порция', 'writeoff', 'Олег', '2026-07-17'::date, 'Отработка');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('593bce2d-8d4c-4207-884c-24ad6a36551a', 'Матча фраппучино', '1', 'Порция', 'writeoff', 'Олег', '2026-07-17'::date, 'Отработка');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('732d72bc-9b13-4166-9f3e-fc6d4c7a32d2', 'Кокосовая матча с чиа', '1', 'Порция', 'writeoff', 'Олег', '2026-07-17'::date, 'Отработка');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('385d1311-80a0-4bb9-a562-6280283d7ef5', 'Айс ти игристый жасмин', '1', 'Порция', 'writeoff', 'Олег', '2026-07-17'::date, 'Отработка');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('960ba0c2-7580-4cde-8964-ab490cf00b03', 'Молоко 3,2%', '3', 'Литр', 'move', 'Олег', '2026-07-18'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('f96c7f27-7acb-413a-bbaf-6425bdcfeb13', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Олег', '2026-07-18'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('b219d364-a5cb-488b-9bc2-562be8702a6c', 'Мята', '150', 'гр', 'writeoff', 'Олег', '2026-07-18'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('6bd9b768-fd18-4191-adcd-e580005df3fe', 'Лимон', '0,175', 'Кг', 'move', 'Олег', '2026-07-18'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('6b392315-d8a5-49b9-83f0-28db354da4b4', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Олег', '2026-07-19'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('681d9681-062a-40bb-8b92-0f7811afb148', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Даяна', '2026-07-20'::date, 'Кондитерский цех');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('fb8066d9-9af4-4158-9e3d-ca203e259dc5', 'Молоко 3,2%', '6', 'Литр', 'move', 'Dayana', '2026-07-21'::date, 'Кухня');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('241b7398-f67e-4efc-bd4d-c1f0185dd5e7', 'Мята', '40', 'гр', 'writeoff', 'Даяна', '2026-07-21'::date, 'Отход');
insert into public.writeoff_entries (id, item, qty, unit, type, employee, date, reason) values ('ffeb6701-94ba-4d4f-96e7-e7b91ed9e794', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Олег', '2026-07-22'::date, 'Кондитерский цех');
-- seed templates
delete from public.writeoff_templates;
insert into public.writeoff_templates (id, title, item, qty, unit, type, reason, sort_order) values ('07b31ade-0ac0-4dcc-81fa-77b10bf3054c', 'Вода Туран кухня', 'Вода Туран', '4,5', 'Л', 'move', 'Кухня', 0);
insert into public.writeoff_templates (id, title, item, qty, unit, type, reason, sort_order) values ('e58bf613-dbb4-4339-a39f-48af9a368561', 'Молоко на кондитерский', 'Молоко 3,2%', '2', 'Литр', 'move', 'Кондитерский цех', 1);
insert into public.writeoff_templates (id, title, item, qty, unit, type, reason, sort_order) values ('aacac79c-2eae-4277-bb7a-dc950166e18f', 'Молоко на Кухню', 'Молоко 3,2%', '12', 'Литр', 'move', 'Кухня', 2);
insert into public.writeoff_templates (id, title, item, qty, unit, type, reason, sort_order) values ('bafe157d-de0e-4b0f-85fe-c91fe0486a13', 'Мята', 'Мята', '100', 'гр', 'writeoff', 'Отход', 3);
insert into public.writeoff_templates (id, title, item, qty, unit, type, reason, sort_order) values ('54515731-69aa-4b94-9249-fa674d97b73a', 'Кофе на Тирамису', 'Кофе Эфиопия-Гватемала', '60', 'гр', 'move', 'Кондитерский цех', 4);
commit;

-- verify:
-- select (select count(*) from stop_list_items) as stop_list,
--        (select count(*) from writeoff_entries) as entries,
--        (select count(*) from writeoff_templates) as templates;