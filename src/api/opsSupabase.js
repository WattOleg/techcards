/**
 * Списания и стоп-лист в Supabase.
 * Включается флагом VITE_OPS_BACKEND=supabase
 */
import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { reportServerReachable, reportServerUnreachable } from '../utils/serverStatus.js'

function assertConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase не настроен (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)')
  }
}

function mapEntry(row) {
  const date = String(row.date || '').slice(0, 10)
  return {
    id: row.id,
    item: row.item || '',
    qty: String(row.qty ?? ''),
    unit: row.unit || 'гр',
    type: row.type === 'move' ? 'move' : 'writeoff',
    employee: row.employee || '',
    date,
    reason: row.reason || '',
    createdAt: date,
  }
}

function mapTemplate(row) {
  return {
    id: row.id,
    title: row.title || '',
    item: row.item || '',
    qty: String(row.qty ?? ''),
    unit: row.unit || 'гр',
    type: row.type === 'move' ? 'move' : 'writeoff',
    reason: row.reason || '',
  }
}

function mapStop(row) {
  return {
    id: row.id,
    item: row.item || '',
    date: String(row.date || '').slice(0, 10),
  }
}

function throwSb(error, fallback) {
  reportServerUnreachable()
  const msg = error?.message || fallback || 'Ошибка Supabase'
  console.error('SUPABASE OPS ERROR:', { message: msg, code: error?.code, details: error?.details })
  throw new Error(msg)
}

export async function fetchWriteoffsFromSupabase() {
  assertConfigured()
  const [entriesRes, tplRes] = await Promise.all([
    supabase.from('writeoff_entries').select('*').order('date', { ascending: false }),
    supabase.from('writeoff_templates').select('*').order('sort_order', { ascending: true }),
  ])
  if (entriesRes.error) throwSb(entriesRes.error, 'Не удалось загрузить списания')
  if (tplRes.error) throwSb(tplRes.error, 'Не удалось загрузить шаблоны списаний')
  reportServerReachable()
  return {
    entries: (entriesRes.data || []).map(mapEntry),
    templates: (tplRes.data || []).map(mapTemplate),
  }
}

export async function mutateWriteoffsInSupabase(payload, pin) {
  assertConfigured()
  const expected = String(import.meta.env.VITE_PIN_CODE || '1234')
  if (String(pin || '') !== expected) {
    throw new Error('Неверный PIN')
  }

  const op = String(payload?.op || '').trim()

  if (op === 'append' && payload.entry) {
    const e = payload.entry
    const row = {
      id: e.id || undefined,
      item: String(e.item || '').trim(),
      qty: String(e.qty || '').trim(),
      unit: String(e.unit || '').trim() || 'гр',
      type: e.type === 'move' ? 'move' : 'writeoff',
      employee: String(e.employee || '').trim(),
      date: String(e.date || '').slice(0, 10),
      reason: String(e.reason || '').trim(),
    }
    if (!row.item || !row.qty || !row.employee || !row.date) {
      throw new Error('Не хватает данных: продукт, количество, сотрудник или дата.')
    }
    const { data, error } = await supabase.from('writeoff_entries').insert(row).select('*').single()
    if (error) throwSb(error, 'Не удалось сохранить списание')
    reportServerReachable()
    return { success: true, entry: mapEntry(data) }
  }

  if (op === 'delete' && payload.id != null && payload.id !== '') {
    const { error } = await supabase.from('writeoff_entries').delete().eq('id', String(payload.id))
    if (error) throwSb(error, 'Не удалось удалить списание')
    reportServerReachable()
    return { success: true }
  }

  if (op === 'update' && payload.entry) {
    const e = payload.entry
    const id = String(e.id || '').trim()
    if (!id) throw new Error('Нужен id записи')
    const row = {
      item: String(e.item || '').trim(),
      qty: String(e.qty || '').trim(),
      unit: String(e.unit || '').trim() || 'гр',
      type: e.type === 'move' ? 'move' : 'writeoff',
      employee: String(e.employee || '').trim(),
      date: String(e.date || '').slice(0, 10),
      reason: String(e.reason || '').trim(),
    }
    const { data, error } = await supabase
      .from('writeoff_entries')
      .update(row)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throwSb(error, 'Не удалось обновить списание')
    reportServerReachable()
    return { success: true, entry: mapEntry(data) }
  }

  if (op === 'templates' && Array.isArray(payload.templates)) {
    const templates = payload.templates
      .map((t, i) => ({
        id: t.id || undefined,
        title: String(t.title || '').trim(),
        item: String(t.item || '').trim(),
        qty: String(t.qty || '').trim(),
        unit: String(t.unit || '').trim() || 'гр',
        type: t.type === 'move' ? 'move' : 'writeoff',
        reason: String(t.reason || '').trim(),
        sort_order: i,
      }))
      .filter((t) => t.title && t.item && t.qty)

    const { error: delErr } = await supabase.from('writeoff_templates').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (delErr) throwSb(delErr, 'Не удалось обновить шаблоны')

    if (templates.length) {
      const { error } = await supabase.from('writeoff_templates').insert(templates)
      if (error) throwSb(error, 'Не удалось сохранить шаблоны')
    }
    reportServerReachable()
    return { success: true }
  }

  throw new Error('Неверная операция')
}

export async function fetchStopListFromSupabase() {
  assertConfigured()
  const { data, error } = await supabase
    .from('stop_list_items')
    .select('*')
    .order('date', { ascending: false })
  if (error) throwSb(error, 'Не удалось загрузить стоп-лист')
  reportServerReachable()
  return (data || []).map(mapStop)
}

export async function mutateStopListInSupabase(payload) {
  assertConfigured()
  const op = String(payload?.op || '').trim()

  if (op === 'append' && payload.entry) {
    const e = payload.entry
    const row = {
      id: e.id && String(e.id).startsWith('tmp_') ? undefined : e.id || undefined,
      item: String(e.item || '').trim(),
      date: String(e.date || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
    }
    if (!row.item) throw new Error('item required')
    const { data, error } = await supabase.from('stop_list_items').insert(row).select('*').single()
    if (error) throwSb(error, 'Не удалось добавить в стоп-лист')
    reportServerReachable()
    return { success: true, entry: mapStop(data) }
  }

  if (op === 'delete' && payload.id) {
    const { error } = await supabase.from('stop_list_items').delete().eq('id', String(payload.id))
    if (error) throwSb(error, 'Не удалось удалить из стоп-листа')
    reportServerReachable()
    return { success: true }
  }

  throw new Error('Неверная операция')
}
