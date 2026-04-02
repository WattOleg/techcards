export function timeToMinutes(t) {
  if (!t || typeof t !== 'string') return 0
  const [h, m = '0'] = t.split(':').map((x) => parseInt(x, 10))
  if (Number.isNaN(h)) return 0
  return h * 60 + (Number.isNaN(parseInt(m, 10)) ? 0 : parseInt(m, 10))
}

export function shiftHours(shift, defaultStart, defaultEnd) {
  const s = (shift.start || defaultStart || '09:00').trim()
  const e = (shift.end || defaultEnd || '23:00').trim()
  let startM = timeToMinutes(s)
  let endM = timeToMinutes(e)
  if (endM <= startM) endM += 24 * 60
  return Math.max(0, (endM - startM) / 60)
}

export function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

export function monthDateStrings(year, monthIndex) {
  const n = daysInMonth(year, monthIndex)
  const mm = String(monthIndex + 1).padStart(2, '0')
  return Array.from({ length: n }, (_, i) => {
    const dd = String(i + 1).padStart(2, '0')
    return `${year}-${mm}-${dd}`
  })
}

export function addDaysYmd(ymd, delta) {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(y, m - 1, d + delta)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export function weekdayShortRu(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  const w = new Date(y, m - 1, d).getDay()
  const map = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
  return map[w]
}

export function formatRuDate(ymd) {
  const [y, m, d] = ymd.split('-')
  return `${d}.${m}.${y}`
}

/** Эффективные границы смены для отображения */
export function effectiveShiftTimes(shift, defaultStart, defaultEnd) {
  const start = (shift.start && String(shift.start).trim()) || defaultStart || '09:00'
  const end = (shift.end && String(shift.end).trim()) || defaultEnd || '23:00'
  return { start, end }
}

export function formatShiftRange(shift, defaultStart, defaultEnd) {
  const { start, end } = effectiveShiftTimes(shift, defaultStart, defaultEnd)
  return `${start.slice(0, 5)}–${end.slice(0, 5)}`
}

/** #rgb / #rrggbb → { r, g, b } или null */
export function parseHexColor(s) {
  if (!s || typeof s !== 'string') return null
  let h = s.trim()
  if (!h.startsWith('#')) return null
  h = h.slice(1)
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length !== 6) return null
  const n = parseInt(h, 16)
  if (Number.isNaN(n)) return null
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/** Яркость фона WCAG (0 = чёрный, 1 = белый) */
export function relativeLuminance(r, g, b) {
  const lin = (v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** Цвета текста для цветного чипа (читаемо на тёмном и светлом фоне) */
export function chipTextColors(backgroundHex) {
  const rgb = parseHexColor(backgroundHex)
  if (!rgb) {
    return { main: '#111111', muted: 'rgba(17, 17, 17, 0.78)' }
  }
  const L = relativeLuminance(rgb.r, rgb.g, rgb.b)
  if (L < 0.5) {
    return { main: '#ffffff', muted: 'rgba(255, 255, 255, 0.88)' }
  }
  return { main: '#111111', muted: 'rgba(17, 17, 17, 0.78)' }
}

/**
 * Делит недостачу (в тыйынах) пропорционально начислениям.
 * Сумма элементов результата === shortageCents (если totalGross > 0).
 */
export function shortageDeductionsByGrossCents(grossCentsArray, shortageCents) {
  const n = grossCentsArray.length
  if (n === 0 || shortageCents <= 0) return Array(Math.max(n, 0)).fill(0)
  const total = grossCentsArray.reduce((a, b) => a + b, 0)
  if (total <= 0) return Array(n).fill(0)
  const raw = grossCentsArray.map((g) => (shortageCents * g) / total)
  const base = raw.map((r) => Math.floor(r))
  let rem = shortageCents - base.reduce((a, b) => a + b, 0)
  const order = raw.map((r, i) => ({ i, frac: r - base[i] })).sort((a, b) => b.frac - a.frac)
  const out = [...base]
  let k = 0
  while (rem > 0 && order.length) {
    out[order[k % order.length].i] += 1
    rem -= 1
    k += 1
  }
  return out
}

/**
 * Делит недостачу (в тыйынах) поровну между всеми сотрудниками.
 * Остаток от деления распределяется по 1 тыйыну на первых сотрудников.
 * Сумма элементов === shortageCents (при n > 0).
 */
export function shortageDeductionsEqualCents(employeeCount, shortageCents) {
  const n = Math.max(0, Math.floor(employeeCount))
  if (n === 0 || shortageCents <= 0) return Array(n).fill(0)
  const base = Math.floor(shortageCents / n)
  let rem = shortageCents - base * n
  const out = Array(n).fill(base)
  for (let i = 0; i < rem; i += 1) {
    out[i] += 1
  }
  return out
}

export function normalizeRateHistory(rateHistory) {
  if (!Array.isArray(rateHistory)) return []
  return rateHistory
    .map((r) => {
      const from = String(r?.from || '').trim()
      const toRaw = r?.to == null ? '' : String(r.to).trim()
      let to = toRaw || null
      const modeRaw = String(r?.mode || '').trim()
      const rate = Number(r?.rate)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return null
      if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null
      if (to && to < from) to = from
      if (!Number.isFinite(rate) || rate < 0) return null
      let mode = modeRaw === 'from' || modeRaw === 'day' || modeRaw === 'period' ? modeRaw : ''
      if (!mode) {
        if (!to) mode = 'from'
        else if (to === from) mode = 'day'
        else mode = 'period'
      }
      if (mode === 'from') to = null
      if (mode === 'day') to = from
      if (mode === 'period' && !to) to = from
      return { from, to, mode, rate: Math.round(rate) }
    })
    .filter(Boolean)
    .sort((a, b) => {
      const d = a.from.localeCompare(b.from)
      if (d !== 0) return d
      if (!a.to && b.to) return -1
      if (a.to && !b.to) return 1
      return String(a.to || '').localeCompare(String(b.to || ''))
    })
}

export function rateForDate(ymd, employee) {
  const history = normalizeRateHistory(employee?.rateHistory)
  const baseRate = Math.max(0, Math.round(Number(employee?.hourlyRate) || 0))
  if (!history.length) return baseRate
  let applied = baseRate
  for (const item of history) {
    if (item.from > ymd) break
    const inRange = !item.to || ymd <= item.to
    if (inRange) applied = item.rate
  }
  return applied
}
