/**
 * Раздел «Актуальное»: новости, актуальное, комментарии, изменения за 7 дней.
 */
import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { reportServerReachable, reportServerUnreachable } from '../utils/serverStatus.js'
import { parsePhotoUrls } from '../utils/photoUrl.js'

function assertConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase не настроен (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)')
  }
}

function throwSb(error, fallback) {
  reportServerUnreachable()
  const msg = error?.message || fallback || 'Ошибка Supabase'
  console.error('SUPABASE UPDATES ERROR:', { message: msg, code: error?.code, details: error?.details })
  throw new Error(msg)
}

function assertPin(pin) {
  const expected = String(import.meta.env.VITE_PIN_CODE || '1234').trim()
  const got = String(pin ?? '').trim()
  if (!got || got !== expected) throw new Error('Неверный PIN')
}

function mapPost(row) {
  return {
    id: row.id,
    title: row.title || '',
    content: row.content || '',
    imageUrls: Array.isArray(row.image_urls) ? row.image_urls.filter(Boolean) : [],
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

function mapComment(row) {
  return {
    id: row.id,
    authorName: row.author_name || '',
    commentText: row.comment_text || '',
    createdAt: row.created_at || null,
  }
}

const CATEGORY_LABELS = {
  regulations: 'Регламенты',
  requirements: 'Требования',
  behavior: 'Поведение',
  rights_and_duties: 'Права и обязанности',
  equipment_instructions: 'Оборудование',
}

export async function fetchRecentChanges(days = 7) {
  assertConfigured()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const [regs, equipment, checklists, techcards] = await Promise.all([
    supabase
      .from('regulations')
      .select('id, category, title, updated_at')
      .gte('updated_at', since)
      .order('updated_at', { ascending: false }),
    supabase
      .from('equipment_cards')
      .select('id, name, updated_at')
      .gte('updated_at', since)
      .order('updated_at', { ascending: false }),
    supabase
      .from('checklists')
      .select('id, type, item_text, updated_at')
      .gte('updated_at', since)
      .order('updated_at', { ascending: false }),
    supabase
      .from('techcard_changes')
      .select('sheet_name, title, category, photo_url, updated_at')
      .gte('updated_at', since)
      .order('updated_at', { ascending: false }),
  ])

  if (regs.error) throwSb(regs.error, 'Не удалось загрузить изменения регламентов')
  if (equipment.error) throwSb(equipment.error, 'Не удалось загрузить изменения оборудования')
  if (checklists.error) throwSb(checklists.error, 'Не удалось загрузить изменения чек-листов')

  let techcardsWarning = ''
  if (techcards.error) {
    const msg = String(techcards.error.message || '')
    const missing =
      techcards.error.code === '42P01' ||
      techcards.error.code === 'PGRST205' ||
      /techcard_changes|schema cache|does not exist/i.test(msg)
    if (missing) {
      techcardsWarning =
        'Таблица techcard_changes не найдена. Примените миграцию supabase/migrations/006_techcard_changes_grants.sql в Supabase SQL Editor.'
      console.error('TECHCARD CHANGES MISSING:', msg)
    } else {
      throwSb(techcards.error, 'Не удалось загрузить изменения техкарт')
    }
  }
  reportServerReachable()

  const items = []
  for (const row of regs.data || []) {
    items.push({
      id: `reg-${row.id}`,
      kind: 'regulation',
      label: CATEGORY_LABELS[row.category] || 'Регламент',
      title: row.title || 'Без названия',
      updatedAt: row.updated_at,
    })
  }
  for (const row of equipment.data || []) {
    items.push({
      id: `eq-${row.id}`,
      kind: 'equipment',
      label: 'Оборудование',
      title: row.name || 'Без названия',
      updatedAt: row.updated_at,
    })
  }
  for (const row of checklists.data || []) {
    items.push({
      id: `cl-${row.id}`,
      kind: 'checklist',
      label: row.type === 'closing' ? 'Чек-лист закрытия' : 'Чек-лист открытия',
      title: row.item_text || 'Пункт',
      updatedAt: row.updated_at,
    })
  }
  for (const row of techcards.data || []) {
    items.push({
      id: `tc-${row.sheet_name}`,
      kind: 'techcard',
      label: row.category ? `Техкарта · ${row.category}` : 'Техкарта',
      title: row.title || row.sheet_name || 'Без названия',
      imageUrl: row.photo_url || '',
      updatedAt: row.updated_at,
      sheetName: row.sheet_name,
    })
  }

  items.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
  return { items, techcardsWarning }
}

function mapLoggedTechcard(row) {
  if (!row) return null
  return {
    id: `tc-${row.sheet_name}`,
    kind: 'techcard',
    label: row.category ? `Техкарта · ${row.category}` : 'Техкарта',
    title: row.title || row.sheet_name || 'Без названия',
    imageUrl: row.photo_url || '',
    updatedAt: row.updated_at,
    sheetName: row.sheet_name,
  }
}

/** Фиксирует правку техкарты (фото, граммовка и т.д.) для блока «Изменения». */
export async function logTechcardChange(card) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase не настроен — изменение техкарты не попадёт в «Изменения»')
  }
  if (!card?.sheetName) {
    throw new Error('Нет sheetName — не удалось записать изменение техкарты')
  }
  const photos = parsePhotoUrls(card.photoUrls ?? card.photoUrl)
  const payload = {
    sheet_name: String(card.sheetName).trim(),
    title: String(card.name || card.nameRu || card.sheetName || '').trim() || 'Техкарта',
    category: String(card.category || '').trim(),
    photo_url: photos[0] || '',
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from('techcard_changes')
    .upsert(payload, { onConflict: 'sheet_name' })
    .select('*')
    .single()
  if (error) {
    const msg = String(error.message || '')
    const missing =
      error.code === '42P01' ||
      error.code === 'PGRST205' ||
      /techcard_changes|schema cache|does not exist/i.test(msg)
    if (missing) {
      throw new Error(
        'Таблица techcard_changes не создана. Примените миграцию 006_techcard_changes_grants.sql в Supabase.',
      )
    }
    console.error('TECHCARD CHANGE LOG:', error)
    throw new Error(msg || 'Не удалось записать изменение техкарты в «Изменения»')
  }
  reportServerReachable()
  return mapLoggedTechcard(data)
}

async function fetchPosts(table) {
  assertConfigured()
  const { data, error } = await supabase.from(table).select('*').order('updated_at', { ascending: false })
  if (error) throwSb(error, 'Не удалось загрузить записи')
  reportServerReachable()
  return (data || []).map(mapPost)
}

export function fetchNews() {
  return fetchPosts('updates_news')
}

export function fetchCurrentUpdates() {
  return fetchPosts('updates_current')
}

async function upsertPost(table, post, pin) {
  assertConfigured()
  assertPin(pin)
  const payload = {
    title: String(post.title || '').trim() || 'Без названия',
    content: String(post.content || ''),
    image_urls: Array.isArray(post.imageUrls) ? post.imageUrls.filter(Boolean) : [],
  }
  if (post.id) {
    const { data, error } = await supabase.from(table).update(payload).eq('id', post.id).select('*').single()
    if (error) throwSb(error, 'Не удалось сохранить')
    reportServerReachable()
    return mapPost(data)
  }
  const { data, error } = await supabase.from(table).insert(payload).select('*').single()
  if (error) throwSb(error, 'Не удалось создать')
  reportServerReachable()
  return mapPost(data)
}

export function upsertNews(post, pin) {
  return upsertPost('updates_news', post, pin)
}

export function upsertCurrentUpdate(post, pin) {
  return upsertPost('updates_current', post, pin)
}

async function deletePost(table, id, pin) {
  assertConfigured()
  assertPin(pin)
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throwSb(error, 'Не удалось удалить')
  reportServerReachable()
  return true
}

export function deleteNews(id, pin) {
  return deletePost('updates_news', id, pin)
}

export function deleteCurrentUpdate(id, pin) {
  return deletePost('updates_current', id, pin)
}

export async function fetchShiftComments() {
  assertConfigured()
  const { data, error } = await supabase
    .from('shift_comments')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throwSb(error, 'Не удалось загрузить комментарии')
  reportServerReachable()
  return (data || []).map(mapComment)
}

export async function addShiftComment({ authorName, commentText }) {
  assertConfigured()
  const payload = {
    author_name: String(authorName || '').trim() || 'Сотрудник',
    comment_text: String(commentText || '').trim(),
  }
  if (!payload.comment_text) throw new Error('Введите текст комментария')
  const { data, error } = await supabase.from('shift_comments').insert(payload).select('*').single()
  if (error) throwSb(error, 'Не удалось добавить комментарий')
  reportServerReachable()
  return mapComment(data)
}

export async function deleteShiftComment(id) {
  assertConfigured()
  const { error } = await supabase.from('shift_comments').delete().eq('id', id)
  if (error) throwSb(error, 'Не удалось удалить комментарий')
  reportServerReachable()
  return true
}

export async function uploadUpdatesImage(file) {
  assertConfigured()
  if (!file) throw new Error('Файл не выбран')
  const safeName = String(file.name || 'photo.jpg')
    .replace(/[^\w.\-а-яА-ЯёЁ]+/g, '_')
    .slice(0, 80)
  const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`
  const { error } = await supabase.storage.from('updates').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/jpeg',
  })
  if (error) throwSb(error, 'Не удалось загрузить фото')
  const { data } = supabase.storage.from('updates').getPublicUrl(path)
  reportServerReachable()
  return data?.publicUrl || ''
}
