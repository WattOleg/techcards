import { useMemo, useRef, useState } from 'react'
import {
  DEFAULT_REVENUE_MONTHS,
  formatKzt,
  mergeRevenueMonths,
  monthKey,
  monthLabelFull,
  monthLabelShort,
  parseMoney,
  parseRevenueCsv,
  REVENUE_STORE_KEY,
} from '../constants/revenue.js'
import { readStore, writeStore } from '../utils/localStore.js'

function sortMonths(rows) {
  return [...(rows || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)))
}

function RevenueChart({ months, selectedId, onSelect }) {
  const width = 360
  const height = 168
  const pad = { top: 16, right: 12, bottom: 28, left: 8 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const maxVal = Math.max(1, ...months.flatMap((m) => [m.revenue, m.plan]))
  const n = Math.max(1, months.length - 1)

  const point = (row, i) => {
    const x = pad.left + (n === 0 ? innerW / 2 : (i / n) * innerW)
    const y = pad.top + innerH - (row.revenue / maxVal) * innerH
    const yPlan = pad.top + innerH - (row.plan / maxVal) * innerH
    return { x, y, yPlan }
  }

  const pts = months.map(point)
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const planLine = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.yPlan.toFixed(1)}`)
    .join(' ')
  const area =
    pts.length > 0
      ? `${line} L${pts[pts.length - 1].x.toFixed(1)},${(pad.top + innerH).toFixed(1)} L${pts[0].x.toFixed(1)},${(pad.top + innerH).toFixed(1)} Z`
      : ''

  return (
    <svg className="revenue-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Динамика выручки">
      <defs>
        <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0052cc" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#0052cc" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((t) => {
        const y = pad.top + innerH * (1 - t)
        return (
          <line
            key={t}
            x1={pad.left}
            x2={width - pad.right}
            y1={y}
            y2={y}
            stroke="#e6e4df"
            strokeWidth="1"
          />
        )
      })}
      {area ? <path d={area} fill="url(#revArea)" /> : null}
      <path d={planLine} fill="none" stroke="#9aa4b2" strokeWidth="1.6" strokeDasharray="4 4" />
      <path d={line} fill="none" stroke="#0052cc" strokeWidth="2.4" strokeLinejoin="round" />
      {months.map((row, i) => {
        const p = pts[i]
        const active = row.id === selectedId
        return (
          <g key={row.id}>
            <circle
              cx={p.x}
              cy={p.y}
              r="16"
              fill="transparent"
              onClick={() => onSelect?.(row.id)}
              style={{ cursor: 'pointer' }}
            />
            <circle
              cx={p.x}
              cy={p.y}
              r={active ? 6 : 4}
              fill={active ? '#0052cc' : '#fff'}
              stroke="#0052cc"
              strokeWidth="2"
              style={{ pointerEvents: 'none' }}
            />
            <text
              x={p.x}
              y={height - 8}
              textAnchor="middle"
              className="revenue-chart-label"
              fill={active ? '#0052cc' : '#6b6b65'}
            >
              {monthLabelShort(row.year, row.month)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function loadRevenueMonths() {
  const stored = readStore(REVENUE_STORE_KEY, null)
  return sortMonths(Array.isArray(stored) ? stored : DEFAULT_REVENUE_MONTHS)
}

export default function RevenueView() {
  const [months, setMonths] = useState(loadRevenueMonths)
  const [selectedId, setSelectedId] = useState(() => {
    const list = loadRevenueMonths()
    return list[list.length - 1]?.id || ''
  })
  const [formRevenue, setFormRevenue] = useState('')
  const [formPlan, setFormPlan] = useState('')
  const [formMonth, setFormMonth] = useState(() => {
    const now = new Date()
    return monthKey(now.getFullYear(), now.getMonth() + 1)
  })
  const [uploadNote, setUploadNote] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)

  const persist = (next) => {
    const sorted = sortMonths(next)
    setMonths(sorted)
    writeStore(REVENUE_STORE_KEY, sorted)
    return sorted
  }

  const selected = months.find((m) => m.id === selectedId) || months[months.length - 1] || null
  const prev = useMemo(() => {
    if (!selected) return null
    const idx = months.findIndex((m) => m.id === selected.id)
    return idx > 0 ? months[idx - 1] : null
  }, [months, selected])

  const revenue = selected?.revenue || 0
  const plan = selected?.plan || 0
  const deviation = revenue - plan
  const growth =
    prev && prev.revenue ? ((revenue - prev.revenue) / prev.revenue) * 100 : null
  const growthPositive = growth == null ? null : growth >= 0
  const deviationPositive = deviation >= 0

  const saveManual = () => {
    const [yearStr, monthStr] = formMonth.split('-')
    const year = Number(yearStr)
    const month = Number(monthStr)
    if (!year || !month) return
    const row = {
      id: monthKey(year, month),
      year,
      month,
      revenue: parseMoney(formRevenue),
      plan: parseMoney(formPlan),
    }
    const next = persist(mergeRevenueMonths(months, [row]))
    setSelectedId(row.id)
    setFormRevenue('')
    setFormPlan('')
    const found = next.find((m) => m.id === row.id)
    if (found) {
      setUploadNote(`Сохранён ${monthLabelFull(found.year, found.month)}`)
      setUploadError('')
    }
  }

  const ingestFile = async (file) => {
    setUploadError('')
    setUploadNote('')
    if (!file) return
    const name = file.name || 'файл'
    const lower = name.toLowerCase()
    const isCsv = lower.endsWith('.csv') || file.type.includes('csv') || file.type.includes('text')
    const isSheet = lower.endsWith('.xlsx') || lower.endsWith('.xls')
    const isPdf = lower.endsWith('.pdf')

    if (isPdf || (isSheet && !isCsv)) {
      setUploadError(
        `${name}: этот формат нужно сохранить как CSV (месяц, выручка, план) или внести цифры вручную.`,
      )
      return
    }

    try {
      const text = await file.text()
      if (text.startsWith('PK')) {
        setUploadError('Excel-файл не разобран. Сохраните лист как CSV и загрузите снова.')
        return
      }
      const rows = parseRevenueCsv(text)
      const next = persist(mergeRevenueMonths(months, rows))
      setSelectedId(rows[rows.length - 1].id)
      setUploadNote(`Загружено строк: ${rows.length} из «${name}». Всего месяцев: ${next.length}.`)
    } catch (err) {
      setUploadError(err.message || 'Не удалось прочитать файл')
    }
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer?.files?.[0]
    void ingestFile(file)
  }

  return (
    <div className="revenue-view">
      <aside className="revenue-confidential" role="note">
        <strong>Конфиденциально.</strong> Данная информация не подлежит разглашению.
      </aside>

      <div className="revenue-month-row">
        <label className="revenue-month-label">
          Период
          <select
            className="revenue-month-select"
            value={selected?.id || ''}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {months.map((m) => (
              <option key={m.id} value={m.id}>
                {monthLabelFull(m.year, m.month)}
              </option>
            ))}
          </select>
        </label>
        {growth != null ? (
          <span className={`revenue-growth ${growthPositive ? 'is-up' : 'is-down'}`}>
            {growthPositive ? '▲' : '▼'} {Math.abs(growth).toFixed(1)}% к прошлому месяцу
          </span>
        ) : (
          <span className="muted small">Нет базы для сравнения</span>
        )}
      </div>

      <div className="revenue-kpis">
        <article className="revenue-kpi">
          <p className="revenue-kpi-label">Выручка</p>
          <p className="revenue-kpi-value">{formatKzt(revenue)}</p>
        </article>
        <article className="revenue-kpi">
          <p className="revenue-kpi-label">План</p>
          <p className="revenue-kpi-value">{formatKzt(plan)}</p>
        </article>
        <article className={`revenue-kpi ${deviationPositive ? 'is-up' : 'is-down'}`}>
          <p className="revenue-kpi-label">Отклонение</p>
          <p className="revenue-kpi-value">
            {deviationPositive ? '+' : '−'}
            {formatKzt(Math.abs(deviation))}
          </p>
        </article>
      </div>

      <section className="revenue-card">
        <div className="revenue-card-head">
          <h3>Динамика</h3>
          <div className="revenue-legend">
            <span>
              <i className="revenue-legend-line" /> Факт
            </span>
            <span>
              <i className="revenue-legend-line is-plan" /> План
            </span>
          </div>
        </div>
        {months.length ? (
          <RevenueChart months={months} selectedId={selected?.id} onSelect={setSelectedId} />
        ) : (
          <p className="muted">Нет данных для графика</p>
        )}
      </section>

      <section className="revenue-card">
        <h3>Внести данные</h3>
        <p className="muted small">Структурированная форма для обновления месяца.</p>
        <div className="revenue-form">
          <label className="regulation-editor-label">
            Месяц
            <input
              className="regulation-editor-input"
              type="month"
              value={formMonth}
              onChange={(e) => setFormMonth(e.target.value)}
            />
          </label>
          <label className="regulation-editor-label">
            Выручка, ₸
            <input
              className="regulation-editor-input"
              inputMode="numeric"
              value={formRevenue}
              onChange={(e) => setFormRevenue(e.target.value)}
              placeholder="0"
            />
          </label>
          <label className="regulation-editor-label">
            План, ₸
            <input
              className="regulation-editor-input"
              inputMode="numeric"
              value={formPlan}
              onChange={(e) => setFormPlan(e.target.value)}
              placeholder="0"
            />
          </label>
          <button type="button" className="btn btn-dark" onClick={saveManual}>
            Сохранить месяц
          </button>
        </div>
      </section>

      <section className="revenue-card">
        <h3>Загрузить файл</h3>
        <p className="muted small">CSV с колонками месяц, выручка, план. Excel и PDF — через CSV или ручной ввод.</p>
        <div
          className={`revenue-drop${dragging ? ' is-dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click()
          }}
        >
          <strong>Перетащите файл сюда</strong>
          <span className="muted small">или нажмите, чтобы выбрать CSV / Excel / PDF</span>
        </div>
        <input
          ref={fileRef}
          type="file"
          className="revenue-file-input"
          accept=".csv,.xlsx,.xls,.pdf,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            void ingestFile(file)
          }}
        />
        {uploadNote ? <p className="revenue-upload-ok">{uploadNote}</p> : null}
        {uploadError ? <p className="error">{uploadError}</p> : null}
      </section>
    </div>
  )
}
