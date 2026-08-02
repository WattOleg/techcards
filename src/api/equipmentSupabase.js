/**
 * Карточки оборудования (инструкции) в Supabase.
 * UX как у техкарт: список → деталь с фото и текстом.
 */
import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { reportServerReachable, reportServerUnreachable } from '../utils/serverStatus.js'

function assertConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase не настроен (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)')
  }
}

function throwSb(error, fallback) {
  reportServerUnreachable()
  const msg = error?.message || fallback || 'Ошибка Supabase'
  console.error('SUPABASE EQUIPMENT ERROR:', { message: msg, code: error?.code, details: error?.details })
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
    name: row.name || '',
    nameRu: row.name_ru || '',
    photoUrl: row.photo_url || '',
    instructions: row.instructions || '',
    orderIndex: Number(row.order_index) || 0,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

export async function fetchEquipmentFromSupabase() {
  assertConfigured()
  const { data, error } = await supabase
    .from('equipment_cards')
    .select('*')
    .order('order_index', { ascending: true })
    .order('name', { ascending: true })
  if (error) throwSb(error, 'Не удалось загрузить оборудование')
  reportServerReachable()
  return (data || []).map(mapRow)
}

export async function upsertEquipmentCard(card, pin) {
  assertConfigured()
  assertPin(pin)
  const payload = {
    name: String(card.name || '').trim() || 'Оборудование',
    name_ru: String(card.nameRu || '').trim(),
    photo_url: String(card.photoUrl || '').trim(),
    instructions: String(card.instructions || ''),
    order_index: Number.isFinite(card.orderIndex) ? card.orderIndex : 0,
  }
  if (card.id) {
    const { data, error } = await supabase
      .from('equipment_cards')
      .update(payload)
      .eq('id', card.id)
      .select('*')
      .single()
    if (error) throwSb(error, 'Не удалось сохранить карточку')
    reportServerReachable()
    return mapRow(data)
  }
  const { data, error } = await supabase.from('equipment_cards').insert(payload).select('*').single()
  if (error) throwSb(error, 'Не удалось создать карточку')
  reportServerReachable()
  return mapRow(data)
}

export async function deleteEquipmentCard(id, pin) {
  assertConfigured()
  assertPin(pin)
  const { error } = await supabase.from('equipment_cards').delete().eq('id', id)
  if (error) throwSb(error, 'Не удалось удалить карточку')
  reportServerReachable()
  return true
}

/** Загрузка фото с устройства (тот же public bucket `updates`, папка equipment/). */
export async function uploadEquipmentImage(file) {
  assertConfigured()
  if (!file) throw new Error('Файл не выбран')
  const safeName = String(file.name || 'photo.jpg')
    .replace(/[^\w.\-а-яА-ЯёЁ]+/g, '_')
    .slice(0, 80)
  const path = `equipment/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`
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

/** Перенос старых строк regulations.equipment_instructions → equipment_cards (один раз). */
export async function migrateEquipmentFromRegulationsIfEmpty() {
  assertConfigured()
  const existing = await fetchEquipmentFromSupabase()
  if (existing.length > 0) return existing

  const { data, error } = await supabase
    .from('regulations')
    .select('*')
    .eq('category', 'equipment_instructions')
    .order('order_index', { ascending: true })
  if (error) throwSb(error, 'Не удалось прочитать старые инструкции')

  const legacy = data || []
  if (legacy.length === 0) {
    const seed = await upsertEquipmentCard(
      {
        name: 'Кофемашина',
        nameRu: 'Инструкция',
        photoUrl: '',
        instructions:
          'Раздел готов к заполнению.\n\nДобавьте фото и пошаговую инструкцию через «Редактировать» (PIN).',
        orderIndex: 0,
      },
      import.meta.env.VITE_PIN_CODE || '1234',
    )
    return [seed]
  }

  const rows = legacy.map((row, i) => ({
    name: row.title || `Оборудование ${i + 1}`,
    name_ru: '',
    photo_url: Array.isArray(row.images) && row.images[0] ? row.images[0] : '',
    instructions: row.content || '',
    order_index: Number(row.order_index) || i,
  }))

  const { data: inserted, error: insErr } = await supabase
    .from('equipment_cards')
    .insert(rows)
    .select('*')
  if (insErr) throwSb(insErr, 'Не удалось перенести инструкции оборудования')
  reportServerReachable()
  return (inserted || []).map(mapRow)
}
