# e-Bar: writeoffs + stop list migration

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

## 2. App flag

Already set in `.env` / `.env.production`:

```
VITE_OPS_BACKEND=supabase
```

## 3. Apps Script freeze

`Code.gs` has `OPS_MOVED_TO_SUPABASE = true` — write/update/delete for writeoffs & stop list return an error. Redeploy Apps Script after pull.

## 4. Rollback

Set `VITE_OPS_BACKEND=sheets` and redeploy the web app. Sheets data remains as archive (read still works via GAS get*).
