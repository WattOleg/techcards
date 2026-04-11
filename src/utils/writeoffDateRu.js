/** Родительный падеж месяца — одинаково на всех устройствах (без зависимости от локали Safari). */
const RU_MONTHS_GEN = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
]

function ymdFromDateLocal(d) {
  const y = d.getFullYear()
  const mo = d.getMonth() + 1
  const day = d.getDate()
  return `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** YYYY-MM-DD для фильтра и сортировки; пустая строка, если дату не распознать. */
export function ymdFromEntry(e) {
  const raw = String(e?.date || e?.createdAt || '').trim()
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (m) return m[1]
  if (!raw) return ''
  const t = Date.parse(raw)
  if (!Number.isNaN(t)) return ymdFromDateLocal(new Date(t))
  const head = raw.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : ''
}

/** Дата для ленты / PDF: «11 апреля 2026 г.» (всегда по-русски, даже если в записи англ. строка от Sheets). */
export function formatWriteoffDateRuFromEntry(e) {
  const ymd = ymdFromEntry(e)
  if (ymd && ymd.length >= 10) return formatWriteoffDateRuFromYmd(ymd)
  const s = String(e?.date || e?.createdAt || '').trim()
  if (!s) return '—'
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (iso) return formatWriteoffDateRuFromYmd(iso[1])
  const t = Date.parse(s)
  if (!Number.isNaN(t)) return formatWriteoffDateRuFromYmd(ymdFromDateLocal(new Date(t)))
  return '—'
}

export function formatWriteoffDateRuFromYmd(ymd) {
  const parts = String(ymd || '')
    .slice(0, 10)
    .split('-')
    .map(Number)
  const y = parts[0]
  const mo = parts[1]
  const d = parts[2]
  if (!y || !mo || !d) return String(ymd || '').slice(0, 10) || '—'
  const monthName = RU_MONTHS_GEN[mo - 1]
  if (!monthName) return `${ymd}`
  return `${d} ${monthName} ${y} г.`
}
