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

function partsFromYmdOrDm(raw) {
  const s = String(raw || '').trim()
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) {
    return { y: Number(iso[1]), mo: Number(iso[2]), d: Number(iso[3]) }
  }
  const dm = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\b/)
  if (dm) {
    return { y: Number(dm[3]), mo: Number(dm[2]), d: Number(dm[1]) }
  }
  return null
}

export function formatWriteoffDateRuFromYmd(ymd) {
  const parts = partsFromYmdOrDm(ymd)
  if (!parts) return '—'
  const { y, mo, d } = parts
  if (!y || !mo || !d || mo < 1 || mo > 12 || d < 1 || d > 31) return String(ymd || '').trim().slice(0, 16) || '—'
  const monthName = RU_MONTHS_GEN[mo - 1]
  if (!monthName) return `${d}.${mo}.${y}`
  return `${d} ${monthName} ${y} г.`
}
