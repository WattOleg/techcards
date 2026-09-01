export const REVENUE_STORE_KEY = 'tk_revenue_v1'
export const REVENUE_ACCENT = '#0052cc'

const MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const MONTH_FULL = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]

export function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function shiftMonth(year, month, delta) {
  const idx = Number(year) * 12 + (Number(month) - 1) + Number(delta)
  const y = Math.floor(idx / 12)
  const m = (idx % 12) + 1
  return { year: y, month: m, id: monthKey(y, m) }
}

export function findMonth(rows, id) {
  return (rows || []).find((row) => row.id === id) || null
}

/** Окно из `count` месяцев, заканчивающееся на `end`. Пустые слоты — нули. */
export function monthsInWindow(rows, end, count) {
  if (!end || count < 1) return []
  const map = new Map((rows || []).map((row) => [row.id, row]))
  const out = []
  for (let i = count - 1; i >= 0; i -= 1) {
    const slot = shiftMonth(end.year, end.month, -i)
    out.push(map.get(slot.id) || { ...slot, revenue: 0, plan: 0, placeholder: true })
  }
  return out
}

export function monthLabelShort(year, month) {
  return `${MONTH_SHORT[month - 1]} ${String(year).slice(2)}`
}

export function monthLabelFull(year, month) {
  return `${MONTH_FULL[month - 1]} ${year}`
}

export function formatKzt(value) {
  const n = Math.round(Number(value) || 0)
  return `${n.toLocaleString('ru-RU')} ₸`
}

function seedMonth(year, month, revenue, plan) {
  return {
    id: monthKey(year, month),
    year,
    month,
    revenue,
    plan,
  }
}

/** Стартовые месячные цифры (бар), чтобы дашборд сразу был читаемым. */
export const DEFAULT_REVENUE_MONTHS = [
  seedMonth(2026, 4, 7_800_000, 0),
  seedMonth(2026, 5, 11_200_000, 0),
  seedMonth(2026, 6, 12_200_000, 0),
  seedMonth(2026, 7, 11_467_566, 0),
]

export function parseMoney(raw) {
  const cleaned = String(raw || '')
    .replace(/\s/g, '')
    .replace(/₸|тг|kzt/gi, '')
    .replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? Math.round(n) : 0
}

const MONTH_ALIASES = {
  янв: 1,
  январь: 1,
  feb: 2,
  фев: 2,
  февраль: 2,
  мар: 3,
  март: 3,
  апр: 4,
  апрель: 4,
  май: 5,
  июн: 6,
  июнь: 6,
  июл: 7,
  июль: 7,
  авг: 8,
  август: 8,
  сен: 9,
  сентябрь: 9,
  окт: 10,
  октябрь: 10,
  ноя: 11,
  ноябрь: 11,
  дек: 12,
  декабрь: 12,
}

export function parseMonthValue(raw) {
  const text = String(raw || '').trim().toLowerCase()
  const iso = text.match(/^(\d{4})[-/.](\d{1,2})$/)
  if (iso) return { year: Number(iso[1]), month: Number(iso[2]) }
  const ru = text.match(/^(\d{1,2})[-/.](\d{4})$/)
  if (ru) return { year: Number(ru[2]), month: Number(ru[1]) }
  const named = text.match(/([а-яa-z]+)\.?[\s.]*(\d{4})/i)
  if (named) {
    const key = named[1].replace(/\./g, '')
    const month = MONTH_ALIASES[key]
    if (month) return { year: Number(named[2]), month }
  }
  return null
}

/**
 * CSV: month,revenue,plan (заголовок на RU или EN, разделитель , или ;).
 */
export function parseRevenueCsv(text) {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) throw new Error('В файле нет строк с данными')

  const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ','
  const split = (line) => line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ''))
  const header = split(lines[0]).map((h) => h.toLowerCase())

  const idxMonth = header.findIndex((h) => /month|месяц|период|date|дата/.test(h))
  const idxRev = header.findIndex((h) => /revenue|выручк|факт|sum|сумм/.test(h))
  const idxPlan = header.findIndex((h) => /plan|план|target|цель/.test(h))
  if (idxMonth < 0 || idxRev < 0) {
    throw new Error('Нужны колонки: месяц и выручка (опционально план)')
  }

  const rows = []
  for (const line of lines.slice(1)) {
    const cols = split(line)
    const parsed = parseMonthValue(cols[idxMonth])
    if (!parsed || parsed.month < 1 || parsed.month > 12) continue
    rows.push({
      id: monthKey(parsed.year, parsed.month),
      year: parsed.year,
      month: parsed.month,
      revenue: parseMoney(cols[idxRev]),
      plan: idxPlan >= 0 ? parseMoney(cols[idxPlan]) : 0,
    })
  }
  if (!rows.length) throw new Error('Не удалось прочитать ни одной строки')
  return rows
}

export function mergeRevenueMonths(current, incoming) {
  const map = new Map((current || []).map((row) => [row.id, row]))
  for (const row of incoming) map.set(row.id, row)
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id))
}
