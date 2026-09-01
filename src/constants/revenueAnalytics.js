import {
  findMonth,
  formatKzt,
  monthLabelFull,
  monthLabelShort,
  shiftMonth,
} from './revenue.js'

export const REVENUE_REWARD_RATE_KEY = 'tk_revenue_reward_rate'
export const DEFAULT_REWARD_RATE = 20

export function sortMonths(rows) {
  return [...(rows || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)))
}

export function monthsInRange(allMonths, fromId, toId) {
  let start = String(fromId || '')
  let end = String(toId || '')
  if (!start || !end) return []
  if (start > end) [start, end] = [end, start]
  return sortMonths(allMonths).filter((m) => m.id >= start && m.id <= end)
}

export function periodLabel(fromRow, toRow) {
  if (!fromRow || !toRow) return ''
  if (fromRow.id === toRow.id) return monthLabelFull(fromRow.year, fromRow.month)
  return `${monthLabelFull(fromRow.year, fromRow.month)} – ${monthLabelFull(toRow.year, toRow.month)}`
}

export function sumRevenue(rows) {
  return (rows || []).reduce((sum, row) => sum + (Number(row.revenue) || 0), 0)
}

export function avgRevenue(rows) {
  const list = rows || []
  if (!list.length) return 0
  return Math.round(sumRevenue(list) / list.length)
}

export function momChangePct(current, previous) {
  const prevRev = Number(previous?.revenue) || 0
  if (!prevRev) return null
  return ((Number(current?.revenue) || 0) - prevRev) / prevRev * 100
}

/** `count` месяцев, заканчивая на `endRow` (включительно). */
export function trailingMonths(allMonths, endRow, count) {
  if (!endRow || count < 1) return []
  const out = []
  for (let i = count - 1; i >= 0; i -= 1) {
    const slot = shiftMonth(endRow.year, endRow.month, -i)
    out.push(findMonth(allMonths, slot.id) || { ...slot, revenue: 0, plan: 0 })
  }
  return out
}

/** Три месяца до выбранного (без самого выбранного) — база для плана выплат. */
export function planBaselineMonths(allMonths, selectedRow) {
  if (!selectedRow) return []
  const out = []
  for (let i = 3; i >= 1; i -= 1) {
    const slot = shiftMonth(selectedRow.year, selectedRow.month, -i)
    out.push(findMonth(allMonths, slot.id) || { ...slot, revenue: 0, plan: 0 })
  }
  return out
}

export function computeRollingSummary(allMonths, selectedRow) {
  const trailing3 = trailingMonths(allMonths, selectedRow, 3)
  const total3 = sumRevenue(trailing3)
  const avg3 = avgRevenue(trailing3)
  const actual = Number(selectedRow?.revenue) || 0
  const growthVsAvg = avg3 ? ((actual - avg3) / avg3) * 100 : null
  const nextSlot = selectedRow ? shiftMonth(selectedRow.year, selectedRow.month, 1) : null

  return {
    trailing3,
    total3,
    avg3,
    growthVsAvg,
    forecast: avg3,
    nextSlot,
  }
}

export function computePayout(allMonths, selectedRow, ratePercent) {
  const actual = Number(selectedRow?.revenue) || 0
  const baseline = planBaselineMonths(allMonths, selectedRow)
  const planAvg = avgRevenue(baseline)
  const base = actual - planAvg
  const rate = Math.max(0, Number(ratePercent) || 0)
  const payout = Math.round(Math.max(0, base) * (rate / 100))

  return {
    actual,
    planAvg,
    base,
    rate,
    payout,
    baseline,
  }
}

export function buildInsights(rows, allMonths) {
  const insights = []
  ;(rows || []).forEach((row, index) => {
    const prev =
      index > 0
        ? rows[index - 1]
        : findMonth(allMonths, shiftMonth(row.year, row.month, -1).id)
    const change = momChangePct(row, prev)
    if (change == null) return
    const verb = change >= 0 ? 'выросла' : 'снизилась'
    const prevLabel = prev ? monthLabelFull(prev.year, prev.month) : 'пред. месяцу'
    insights.push(
      `${monthLabelFull(row.year, row.month)} ${verb} на ${Math.abs(change).toFixed(1)}% к ${prevLabel}.`,
    )
  })
  return insights
}

export function formatPct(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return '—'
  const sign = value >= 0 ? '+' : '−'
  return `${sign}${Math.abs(value).toFixed(digits)}%`
}

export function formatPlainNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString('ru-RU')
}

export function buildReportPayload({
  months,
  selectedRow,
  periodFromId,
  periodToId,
  rewardRate,
}) {
  const periodRows = monthsInRange(months, periodFromId, periodToId)
  const fromRow = periodRows[0] || null
  const toRow = periodRows[periodRows.length - 1] || null
  const rolling = computeRollingSummary(months, selectedRow)
  const payout = computePayout(months, selectedRow, rewardRate)
  const tableRows = periodRows.map((row, index) => {
    const prev =
      index > 0
        ? periodRows[index - 1]
        : findMonth(months, shiftMonth(row.year, row.month, -1).id)
    return {
      id: row.id,
      label: monthLabelFull(row.year, row.month),
      shortLabel: monthLabelShort(row.year, row.month),
      revenue: Number(row.revenue) || 0,
      momPct: momChangePct(row, prev),
    }
  })

  const forecastRow =
    rolling.nextSlot && selectedRow
      ? {
          id: rolling.nextSlot.id,
          label: monthLabelFull(rolling.nextSlot.year, rolling.nextSlot.month),
          shortLabel: monthLabelShort(rolling.nextSlot.year, rolling.nextSlot.month),
          revenue: rolling.forecast,
          isForecast: true,
        }
      : null

  const insights = buildInsights(periodRows, months)
  if (forecastRow) {
    insights.push(
      `Прогноз на ${forecastRow.label}: ${formatKzt(forecastRow.revenue)} (среднее за 3 мес.).`,
    )
  }

  return {
    title: `Отчёт по выручке бара`,
    periodTitle: periodLabel(fromRow, toRow),
    selectedLabel: selectedRow ? monthLabelFull(selectedRow.year, selectedRow.month) : '',
    generatedAt: new Date().toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }),
    periodRows,
    periodTotal: sumRevenue(periodRows),
    periodAvg: avgRevenue(periodRows),
    periodCount: periodRows.length,
    rolling,
    payout,
    tableRows,
    forecastRow,
    insights,
    filenameStem: `${fromRow?.id || 'period'}-${toRow?.id || 'report'}`,
  }
}

export function reportToCsv(payload) {
  const lines = [
    payload.title,
    payload.periodTitle,
    `Сформировано: ${payload.generatedAt}`,
    '',
    'Месяц;Выручка ₸;К пред. мес.',
    ...payload.tableRows.map((row) =>
      [row.label, row.revenue, row.momPct == null ? '' : formatPct(row.momPct)].join(';'),
    ),
  ]
  if (payload.forecastRow) {
    lines.push(
      [
        `${payload.forecastRow.label} (прогноз)`,
        payload.forecastRow.revenue,
        '',
      ].join(';'),
    )
  }
  lines.push(
    '',
    `Итого за период;${payload.periodTotal}`,
    `Средняя в месяц;${payload.periodAvg}`,
    '',
    'Расчёт выплат',
    `Месяц;${payload.selectedLabel}`,
    `Факт;${payload.payout.actual}`,
    `План (среднее 3 мес.);${payload.payout.planAvg}`,
    `База;${payload.payout.base}`,
    `Ставка %;${payload.payout.rate}`,
    `К выплате;${payload.payout.payout}`,
  )
  return `\uFEFF${lines.join('\n')}`
}

export function downloadRevenueCsv(payload) {
  const blob = new Blob([reportToCsv(payload)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `otchet-vyruchka-${payload.filenameStem}.csv`
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
