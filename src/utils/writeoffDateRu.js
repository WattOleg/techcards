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

export function ymdFromEntry(e) {
  const raw = String(e?.date || e?.createdAt || '').trim()
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : raw.slice(0, 10)
}

/** Дата для ленты / PDF: «11 апреля 2026 г.» */
export function formatWriteoffDateRuFromEntry(e) {
  const ymd = ymdFromEntry(e)
  if (!ymd || ymd.length < 10) {
    const s = String(e?.date || '').trim()
    if (!s) return '—'
    const iso = s.match(/^(\d{4}-\d{2}-\d{2})/)
    if (iso) return formatWriteoffDateRuFromYmd(iso[1])
    return s.replace(/T.*/, '').replace(/GMT.*/i, '').trim() || '—'
  }
  return formatWriteoffDateRuFromYmd(ymd)
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
