# e-Bar: writeoffs + stop list + regulations

## 1. Import data (once)

1. Open Supabase → **SQL Editor** → New query
2. Paste entire file: `supabase/seed_writeoffs_stoplist.sql`
3. Run
4. Verify counts:

```sql
select
  (select count(*) from stop_list_items) as stop_list,
  (select count(*) from writeoff_entries) as entries,
  (select count(*) from writeoff_templates) as templates;
```

Expected: stop_list=3, entries=250, templates=5

## 2. Regulations table

1. SQL Editor → paste `supabase/migrations/001_regulations.sql` → Run
2. First app open with empty table migrates Sheets/defaults into `regulations` rows (PIN = `VITE_PIN_CODE`).
3. Check:

```sql
select category, count(*) from public.regulations group by 1 order by 1;
```

## 3. App flag

Already set in `.env` / `.env.production`:

```
VITE_OPS_BACKEND=supabase
```

## 6. Актуальное → «Изменения» (техкарты)

Если правки техкарт не появляются в ряду **Изменения**:

1. Supabase → SQL Editor
2. Вставьте `supabase/migrations/006_techcard_changes_grants.sql` → Run
3. Сохраните техкарту ещё раз через приложение

Правки техкарт пишутся в таблицу `techcard_changes` (не в ручной ряд «Актуальное»).

## 7. Apps Script freeze

`Code.gs` has `OPS_MOVED_TO_SUPABASE = true` — write/update/delete for writeoffs & stop list return an error. Redeploy Apps Script after pull.

Для ссылок между техкартами (колонка C у ингредиентов) тоже нужен redeploy Apps Script после обновления `Code.gs`.

## 8. Rollback

Set `VITE_OPS_BACKEND=sheets` and redeploy the web app. Sheets data remains as archive (read still works via GAS get*).
Regulations stay in Supabase independently.
