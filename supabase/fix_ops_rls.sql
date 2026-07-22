-- Fix RLS: allow read/write for app (anon + authenticated).
-- AuthGate already protects the UI; empty [] without JWT was breaking stop list / writeoffs.

begin;

-- stop_list_items
drop policy if exists stop_list_select on public.stop_list_items;
drop policy if exists stop_list_insert on public.stop_list_items;
drop policy if exists stop_list_update on public.stop_list_items;
drop policy if exists stop_list_delete on public.stop_list_items;
create policy stop_list_select on public.stop_list_items for select using (true);
create policy stop_list_insert on public.stop_list_items for insert with check (true);
create policy stop_list_update on public.stop_list_items for update using (true) with check (true);
create policy stop_list_delete on public.stop_list_items for delete using (true);

-- writeoff_entries
drop policy if exists writeoff_entries_select on public.writeoff_entries;
drop policy if exists writeoff_entries_insert on public.writeoff_entries;
drop policy if exists writeoff_entries_update on public.writeoff_entries;
drop policy if exists writeoff_entries_delete on public.writeoff_entries;
create policy writeoff_entries_select on public.writeoff_entries for select using (true);
create policy writeoff_entries_insert on public.writeoff_entries for insert with check (true);
create policy writeoff_entries_update on public.writeoff_entries for update using (true) with check (true);
create policy writeoff_entries_delete on public.writeoff_entries for delete using (true);

-- writeoff_templates
drop policy if exists writeoff_templates_select on public.writeoff_templates;
drop policy if exists writeoff_templates_insert on public.writeoff_templates;
drop policy if exists writeoff_templates_update on public.writeoff_templates;
drop policy if exists writeoff_templates_delete on public.writeoff_templates;
create policy writeoff_templates_select on public.writeoff_templates for select using (true);
create policy writeoff_templates_insert on public.writeoff_templates for insert with check (true);
create policy writeoff_templates_update on public.writeoff_templates for update using (true) with check (true);
create policy writeoff_templates_delete on public.writeoff_templates for delete using (true);

commit;

-- quick check (should return > 0):
-- select count(*) from stop_list_items;
-- select count(*) from writeoff_entries;
