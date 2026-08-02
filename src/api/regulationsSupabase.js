/**
 * Регламенты и смежные разделы в Supabase.
 */
import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { reportServerReachable, reportServerUnreachable } from '../utils/serverStatus.js'
import { splitInfoCards } from '../utils/splitInfoCards.js'

export const REGULATION_CATEGORIES = [
  { id: 'regulations', label: 'Регламенты', legacySectionId: 'regulations' },
  { id: 'requirements', label: 'Требования', legacySectionId: 'appearance' },
  { id: 'behavior', label: 'Поведение', legacySectionId: 'behavior' },
  { id: 'rights_and_duties', label: 'Права и обязанности', legacySectionId: 'rights' },
  { id: 'equipment_instructions', label: 'Инструкции по оборудованию', legacySectionId: null, isEquipment: true },
]

/** UI section id → supabase category */
export const SECTION_TO_CATEGORY = {
  regulations: 'regulations',
  appearance: 'requirements',
  requirements: 'requirements',
  behavior: 'behavior',
  rights: 'rights_and_duties',
  rights_and_duties: 'rights_and_duties',
  equipment_instructions: 'equipment_instructions',
}

export const CATEGORY_TO_SECTION = {
  regulations: 'regulations',
  requirements: 'requirements',
  behavior: 'behavior',
  rights_and_duties: 'rights_and_duties',
  equipment_instructions: 'equipment_instructions',
}

function assertConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase не настроен (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)')
  }
}

function throwSb(error, fallback) {
  reportServerUnreachable()
  const msg = error?.message || fallback || 'Ошибка Supabase'
  console.error('SUPABASE REGULATIONS ERROR:', { message: msg, code: error?.code, details: error?.details })
  throw new Error(msg)
}

function assertPin(pin) {
  const expected = String(import.meta.env.VITE_PIN_CODE || '1234').trim()
  const got = String(pin ?? '').trim()
  if (!got || got !== expected) {
    throw new Error('Неверный PIN')
  }
}

function mapRow(row) {
  return {
    id: row.id,
    category: row.category,
    title: row.title || '',
    content: row.content || '',
    orderIndex: Number(row.order_index) || 0,
    images: Array.isArray(row.images) ? row.images.filter(Boolean) : [],
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

export async function fetchRegulationsFromSupabase() {
  assertConfigured()
  const { data, error } = await supabase
    .from('regulations')
    .select('*')
    .order('category', { ascending: true })
    .order('order_index', { ascending: true })
  if (error) throwSb(error, 'Не удалось загрузить регламенты')
  reportServerReachable()
  return (data || []).map(mapRow)
}

export async function upsertRegulationCard(card, pin) {
  assertConfigured()
  assertPin(pin)
  const payload = {
    category: card.category,
    title: String(card.title || '').trim() || 'Без названия',
    content: String(card.content || ''),
    order_index: Number.isFinite(card.orderIndex) ? card.orderIndex : 0,
    images: Array.isArray(card.images) ? card.images : [],
  }
  if (card.id) {
    const { data, error } = await supabase
      .from('regulations')
      .update(payload)
      .eq('id', card.id)
      .select('*')
      .single()
    if (error) throwSb(error, 'Не удалось сохранить карточку')
    reportServerReachable()
    return mapRow(data)
  }
  const { data, error } = await supabase.from('regulations').insert(payload).select('*').single()
  if (error) throwSb(error, 'Не удалось создать карточку')
  reportServerReachable()
  return mapRow(data)
}

export async function deleteRegulationCard(id, pin) {
  assertConfigured()
  assertPin(pin)
  const { error } = await supabase.from('regulations').delete().eq('id', id)
  if (error) throwSb(error, 'Не удалось удалить карточку')
  reportServerReachable()
  return true
}

export async function insertRegulationCardsBulk(rows, pin) {
  assertConfigured()
  assertPin(pin)
  if (!rows.length) return []
  const payload = rows.map((r) => ({
    category: r.category,
    title: String(r.title || '').trim() || 'Без названия',
    content: String(r.content || ''),
    order_index: Number.isFinite(r.orderIndex) ? r.orderIndex : 0,
    images: Array.isArray(r.images) ? r.images : [],
  }))
  const { data, error } = await supabase.from('regulations').insert(payload).select('*')
  if (error) throwSb(error, 'Не удалось загрузить начальные регламенты')
  reportServerReachable()
  return (data || []).map(mapRow)
}

/**
 * Собирает строки для сида из legacy sectionContent { points[] }.
 */
export function buildSeedRowsFromLegacySections(sectionContent) {
  const rows = []
  for (const cat of REGULATION_CATEGORIES) {
    if (!cat.legacySectionId) continue
    const block = sectionContent?.[cat.legacySectionId]
    const points = Array.isArray(block?.points) ? block.points : []
    const cards = splitInfoCards(points)
    if (cards.length === 0) {
      rows.push({
        category: cat.id,
        title: block?.title || cat.label,
        content: '',
        orderIndex: 0,
        images: [],
      })
      continue
    }
    cards.forEach((card, i) => {
      rows.push({
        category: cat.id,
        title: card.title || block?.title || cat.label,
        content: (card.points || []).join('\n'),
        orderIndex: i,
        images: [],
      })
    })
  }
  return rows
}

export function groupRegulationsByCategory(rows) {
  const map = Object.fromEntries(REGULATION_CATEGORIES.map((c) => [c.id, []]))
  for (const row of rows || []) {
    if (!map[row.category]) map[row.category] = []
    map[row.category].push(row)
  }
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => a.orderIndex - b.orderIndex)
  }
  return map
}
