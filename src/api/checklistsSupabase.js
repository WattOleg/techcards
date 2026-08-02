/**
 * Чек-листы открытия/закрытия смены (Supabase).
 */
import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { reportServerReachable, reportServerUnreachable } from '../utils/serverStatus.js'

export const CHECKLIST_TYPES = [
  { id: 'opening', sectionId: 'checklist-opening', label: 'Чек-лист открытия смены' },
  { id: 'closing', sectionId: 'checklist-closing', label: 'Чек-лист закрытия смены' },
]

export const SECTION_TO_CHECKLIST_TYPE = {
  'checklist-opening': 'opening',
  'checklist-closing': 'closing',
}

const DEFAULT_ITEMS = {
  opening: [
    'Проверить чистоту рабочей зоны',
    'Включить оборудование по чек-листу',
    'Проверить наличие продукта',
    'Открыть кассу / смену в системе',
  ],
  closing: [
    'Зафиксировать списания и брак',
    'Вымыть оборудование и зону',
    'Выключить оборудование',
    'Закрыть кассу / смену в системе',
  ],
}

function assertConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase не настроен (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)')
  }
}

function throwSb(error, fallback) {
  reportServerUnreachable()
  const msg = error?.message || fallback || 'Ошибка Supabase'
  console.error('SUPABASE CHECKLISTS ERROR:', { message: msg, code: error?.code, details: error?.details })
  throw new Error(msg)
}

function assertPin(pin) {
  const expected = String(import.meta.env.VITE_PIN_CODE || '1234').trim()
  const got = String(pin ?? '').trim()
  if (!got || got !== expected) throw new Error('Неверный PIN')
}

function mapRow(row) {
  return {
    id: row.id,
    type: row.type,
    itemText: row.item_text || '',
    orderIndex: Number(row.order_index) || 0,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

export async function fetchChecklistsFromSupabase() {
  assertConfigured()
  const { data, error } = await supabase
    .from('checklists')
    .select('*')
    .order('type', { ascending: true })
    .order('order_index', { ascending: true })
  if (error) throwSb(error, 'Не удалось загрузить чек-листы')
  reportServerReachable()
  return (data || []).map(mapRow)
}

export async function upsertChecklistItem(item, pin) {
  assertConfigured()
  assertPin(pin)
  const payload = {
    type: item.type,
    item_text: String(item.itemText || '').trim() || 'Пункт',
    order_index: Number.isFinite(item.orderIndex) ? item.orderIndex : 0,
  }
  if (item.id) {
    const { data, error } = await supabase
      .from('checklists')
      .update(payload)
      .eq('id', item.id)
      .select('*')
      .single()
    if (error) throwSb(error, 'Не удалось сохранить пункт')
    reportServerReachable()
    return mapRow(data)
  }
  const { data, error } = await supabase.from('checklists').insert(payload).select('*').single()
  if (error) throwSb(error, 'Не удалось создать пункт')
  reportServerReachable()
  return mapRow(data)
}

export async function deleteChecklistItem(id, pin) {
  assertConfigured()
  assertPin(pin)
  const { error } = await supabase.from('checklists').delete().eq('id', id)
  if (error) throwSb(error, 'Не удалось удалить пункт')
  reportServerReachable()
  return true
}

export async function insertChecklistItemsBulk(rows, pin) {
  assertConfigured()
  assertPin(pin)
  if (!rows.length) return []
  const payload = rows.map((r) => ({
    type: r.type,
    item_text: String(r.itemText || '').trim() || 'Пункт',
    order_index: Number.isFinite(r.orderIndex) ? r.orderIndex : 0,
  }))
  const { data, error } = await supabase.from('checklists').insert(payload).select('*')
  if (error) throwSb(error, 'Не удалось создать чек-листы')
  reportServerReachable()
  return (data || []).map(mapRow)
}

export function buildDefaultChecklistRows() {
  const rows = []
  for (const [type, texts] of Object.entries(DEFAULT_ITEMS)) {
    texts.forEach((itemText, i) => {
      rows.push({ type, itemText, orderIndex: i })
    })
  }
  return rows
}

export function groupChecklistsByType(rows) {
  const map = { opening: [], closing: [] }
  for (const row of rows || []) {
    if (!map[row.type]) map[row.type] = []
    map[row.type].push(row)
  }
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => a.orderIndex - b.orderIndex)
  }
  return map
}
