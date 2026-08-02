/**
 * Поиск по разделам меню, регламентам, оборудованию, чек-листам (этап 8).
 * Не связан с поиском техкарт.
 */
import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { reportServerReachable, reportServerUnreachable } from '../utils/serverStatus.js'
import { REGULATION_CATEGORIES, CATEGORY_TO_SECTION } from './regulationsSupabase.js'
import { CHECKLIST_TYPES } from './checklistsSupabase.js'
import { DRAWER_ITEMS } from '../constants/drawerNav.js'

function throwSb(error, fallback) {
  reportServerUnreachable()
  const msg = error?.message || fallback || 'Ошибка поиска'
  console.error('SUPABASE MENU SEARCH ERROR:', { message: msg, code: error?.code })
  throw new Error(msg)
}

const CATEGORY_LABELS = Object.fromEntries(REGULATION_CATEGORIES.map((c) => [c.id, c.label]))

function snippet(text, q, max = 100) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim()
  if (!raw) return ''
  const lower = raw.toLowerCase()
  const idx = lower.indexOf(String(q || '').toLowerCase())
  if (idx < 0) return raw.slice(0, max) + (raw.length > max ? '…' : '')
  const start = Math.max(0, idx - 24)
  const end = Math.min(raw.length, idx + String(q).length + 60)
  return `${start > 0 ? '…' : ''}${raw.slice(start, end)}${end < raw.length ? '…' : ''}`
}

function matchLocalSections(query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return []
  const items = []

  for (const item of DRAWER_ITEMS) {
    if (item.label.toLowerCase().includes(q)) {
      items.push({
        id: `section-${item.id}`,
        kind: 'section',
        sectionId: item.id,
        title: item.label,
        subtitle: 'Раздел меню',
        snippet: '',
      })
    }
  }

  for (const cat of REGULATION_CATEGORIES) {
    if (cat.label.toLowerCase().includes(q)) {
      const sectionId = CATEGORY_TO_SECTION[cat.id] || cat.id
      items.push({
        id: `section-cat-${cat.id}`,
        kind: 'section',
        sectionId,
        title: cat.label,
        subtitle: 'Раздел регламентов',
        snippet: '',
      })
    }
  }

  for (const t of CHECKLIST_TYPES) {
    if (t.label.toLowerCase().includes(q)) {
      items.push({
        id: `section-cl-${t.id}`,
        kind: 'section',
        sectionId: t.id === 'closing' ? 'checklist-closing' : 'checklist-opening',
        title: t.label,
        subtitle: 'Чек-лист',
        snippet: '',
      })
    }
  }

  return items
}

/**
 * @returns {Promise<Array<{id, kind, sectionId, focusId?, title, subtitle, snippet}>>}
 */
export async function searchMenuContent(query) {
  const q = String(query || '').trim()
  if (q.length < 2) return []

  const local = matchLocalSections(q)

  if (!isSupabaseConfigured) return local

  const pattern = `%${q.replace(/[%_,]/g, ' ').replace(/\s+/g, ' ').trim()}%`
  const [regs, equipment, checklists] = await Promise.all([
    supabase
      .from('regulations')
      .select('id, category, title, content')
      .or(`title.ilike."${pattern}",content.ilike."${pattern}"`)
      .limit(25),
    supabase
      .from('equipment_cards')
      .select('id, name, name_ru, instructions')
      .or(`name.ilike."${pattern}",name_ru.ilike."${pattern}",instructions.ilike."${pattern}"`)
      .limit(20),
    supabase
      .from('checklists')
      .select('id, type, item_text')
      .ilike('item_text', pattern)
      .limit(20),
  ])

  if (regs.error) throwSb(regs.error, 'Ошибка поиска регламентов')
  if (equipment.error) throwSb(equipment.error, 'Ошибка поиска оборудования')
  if (checklists.error) throwSb(checklists.error, 'Ошибка поиска чек-листов')
  reportServerReachable()

  const results = [...local]

  for (const row of regs.data || []) {
    if (row.category === 'equipment_instructions') continue
    const sectionId = CATEGORY_TO_SECTION[row.category] || 'regulations'
    results.push({
      id: `reg-${row.id}`,
      kind: 'regulation',
      sectionId,
      focusId: row.id,
      title: row.title || 'Без названия',
      subtitle: CATEGORY_LABELS[row.category] || 'Регламент',
      snippet: snippet(row.content, q),
    })
  }

  for (const row of equipment.data || []) {
    results.push({
      id: `eq-${row.id}`,
      kind: 'equipment',
      sectionId: 'equipment_instructions',
      focusId: row.id,
      title: row.name || row.name_ru || 'Оборудование',
      subtitle: 'Инструкции по оборудованию',
      snippet: snippet(row.instructions, q),
    })
  }

  for (const row of checklists.data || []) {
    const sectionId = row.type === 'closing' ? 'checklist-closing' : 'checklist-opening'
    results.push({
      id: `cl-${row.id}`,
      kind: 'checklist',
      sectionId,
      focusId: row.id,
      title: row.item_text || 'Пункт',
      subtitle: row.type === 'closing' ? 'Чек-лист закрытия' : 'Чек-лист открытия',
      snippet: '',
    })
  }

  return results
}
