import { useMemo, useRef, useState } from 'react'
import {
  DEFAULT_REVENUE_MONTHS,
  findMonth,
  formatKzt,
  mergeRevenueMonths,
  monthLabelFull,
  monthLabelShort,
  monthsInWindow,
  parseMoney,
  parseRevenueCsv,
  REVENUE_STORE_KEY,
  shiftMonth,
} from '../constants/revenue.js'
import { readStore, writeStore } from '../utils/localStore.js'

const RANGE_OPTIONS = [
  { id: '1', label: 'Месяц', count: 1 },
  { id: '3', label: '3 месяца', count: 3 },
  { id: '12', label: 'Год', count: 12 },
]

function sortMonths(rows) {
  return [...(rows || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)))
}

function fieldsFrom(selected, nextRow) {
  return {
    revenue: selected?.revenue ? String(selected.revenue) : '',
    plan: selected?.plan ? String(selected.plan) : '',
    nextPlan: nextRow?.plan ? String(nextRow.plan) : '',
  }
}

function MonthBars({ row }) {
  const max = Math.max(row?.revenue || 0, row?.plan || 0, 1)
  return (
    <div className="revenue-bars">
      <div className="revenue-bar-col">
        <div className="revenue-bar-track">
          <div className="revenue-bar is-fact" style={{ height: `${((row?.revenue || 0) / max) * 100}%` }} />
        </div>
        <span>Факт</span>
        <strong>{formatKzt(row?.revenue || 0)}</strong>
      </div>
      <div className="revenue-bar-col">
        <div className="revenue-bar-track">
          <div className="revenue-bar is-plan" style={{ height: `${((row?.plan || 0) / max) * 100}%` }} />
        </div>
        <span>План</span>
        <strong>{formatKzt(row?.plan || 0)}</strong>
      </div>
    </div>
  )
}

function RevenueChart({ months, selectedId, onSelect }) {
  const width = 360
  const height = 176
  const pad = { top: 14, right: 18, bottom: 30, left: 18 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const maxVal = Math.max(1, ...months.flatMap((m) => [m.revenue, m.plan]))
  const n = Math.max(1, months.length - 1)
  const labelStep = months.length > 6 ? 2 : 1

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
        const showLabel = i % labelStep === 0 || i === months.length - 1
        return (
          <g key={row.id}>
            <circle
              cx={p.x}
              cy={p.y}
              r="14"
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
            {showLabel ? (
              <text
                x={p.x}
                y={height - 8}
                textAnchor="middle"
                className="revenue-chart-label"
                fill={active ? '#0052cc' : '#6b6b65'}
              >
                {monthLabelShort(row.year, row.month)}
              </text>
            ) : null}
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
  const [selectedId, setSelectedId] = useState(() => loadRevenueMonths().slice(-1)[0]?.id || '')
  const [rangeId, setRangeId] = useState('3')
  const [form, setForm] = useState(() => {
    const list = loadRevenueMonths()
    const selected = list.slice(-1)[0] || null
    const next = selected ? findMonth(list, shiftMonth(selected.year, selected.month, 1).id) : null
    return fieldsFrom(selected, next)
  })
  const [saveNote, setSaveNote] = useState('')
  const [uploadNote, setUploadNote] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)
  const formRef = useRef(null)

  const persist = (next) => {
    const sorted = sortMonths(next)
    setMonths(sorted)
    writeStore(REVENUE_STORE_KEY, sorted)
    return sorted
  }

  const selected = findMonth(months, selectedId) || months[months.length - 1] || null
  const nextSlot = selected ? shiftMonth(selected.year, selected.month, 1) : null
  const nextRow = nextSlot ? findMonth(months, nextSlot.id) : null
  const prev = useMemo(() => {
    if (!selected) return null
    const prevSlot = shiftMonth(selected.year, selected.month, -1)
    return findMonth(months, prevSlot.id)
  }, [months, selected])

  const revenue = selected?.revenue || 0
  const plan = selected?.plan || 0
  const nextPlan = nextRow?.plan || 0
  const deviation = revenue - plan
  const growth = prev && prev.revenue ? ((revenue - prev.revenue) / prev.revenue) * 100 : null
  const growthPositive = growth == null ? null : growth >= 0
  const deviationPositive = deviation >= 0
  const range = RANGE_OPTIONS.find((item) => item.id === rangeId) || RANGE_OPTIONS[1]
  const chartMonths = selected ? monthsInWindow(months, selected, range.count) : []

  const selectMonth = (id) => {
    let list = months
    let row = findMonth(list, id)
    if (!row) {
      const [yearStr, monthStr] = String(id).split('-')
      const year = Number(yearStr)
      const month = Number(monthStr)
      if (!year || !month) return
      row = { id, year, month, revenue: 0, plan: 0 }
      list = persist(mergeRevenueMonths(list, [row]))
      row = findMonth(list, id) || row
    }
    setSelectedId(row.id)
    const nxt = findMonth(list, shiftMonth(row.year, row.month, 1).id)
    setForm(fieldsFrom(row, nxt))
    setSaveNote('')
  }

  const saveEdits = () => {
    if (!selected) return
    const next = nextSlot
    const updated = [
      {
        id: selected.id,
        year: selected.year,
        month: selected.month,
        revenue: parseMoney(form.revenue),
        plan: parseMoney(form.plan),
      },
    ]
    if (next) {
      updated.push({
        id: next.id,
        year: next.year,
        month: next.month,
        revenue: nextRow?.revenue || 0,
        plan: parseMoney(form.nextPlan),
      })
    }
    const list = persist(mergeRevenueMonths(months, updated))
    const saved = findMonth(list, selected.id)
    const savedNext = next ? findMonth(list, next.id) : null
    setForm(fieldsFrom(saved, savedNext))
    setSaveNote('Изменения сохранены')
    setUploadError('')
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
        `${name}: сохраните лист как CSV (месяц, выручка, план) или отредактируйте цифры ниже.`,
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
      const last = rows[rows.length - 1]
      setSelectedId(last.id)
      const saved = findMonth(next, last.id)
      const savedNext = saved ? findMonth(next, shiftMonth(saved.year, saved.month, 1).id) : null
      setForm(fieldsFrom(saved, savedNext))
      setUploadNote(`Загружено строк: ${rows.length} из «${name}».`)
    } catch (err) {
      setUploadError(err.message || 'Не удалось прочитать файл')
    }
  }

  const focusForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    formRef.current?.querySelector('input')?.focus()
  }

  return (
    <div className="revenue-view">
      <aside className="revenue-confidential" role="note">
        <strong>Конфиденциально.</strong> Данная информация не подлежит разглашению.
      </aside>

      <div className="revenue-month-row">
        <label className="revenue-month-label">
          Месяц
          <select
            className="revenue-month-select"
            value={selected?.id || ''}
            onChange={(e) => selectMonth(e.target.value)}
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
          <span className="revenue-growth is-flat">Нет базы для сравнения</span>
        )}
      </div>

      <div className="revenue-kpis">
        <button type="button" className="revenue-kpi is-main" onClick={focusForm}>
          <p className="revenue-kpi-label">Выручка</p>
          <p className="revenue-kpi-value">{formatKzt(revenue)}</p>
          <span className="revenue-kpi-edit">изменить</span>
        </button>
        <button type="button" className="revenue-kpi" onClick={focusForm}>
          <p className="revenue-kpi-label">План</p>
          <p className="revenue-kpi-value">{formatKzt(plan)}</p>
          <span className="revenue-kpi-edit">изменить</span>
        </button>
        <article className={`revenue-kpi ${deviationPositive ? 'is-up' : 'is-down'}`}>
          <p className="revenue-kpi-label">Отклонение</p>
          <p className="revenue-kpi-value">
            {deviationPositive ? '+' : '−'}
            {formatKzt(Math.abs(deviation))}
          </p>
        </article>
        <button type="button" className="revenue-kpi is-next" onClick={focusForm}>
          <p className="revenue-kpi-label">План на сл. месяц</p>
          <p className="revenue-kpi-value">{nextPlan ? formatKzt(nextPlan) : 'не задан'}</p>
          <span className="revenue-kpi-edit">
            {nextSlot ? monthLabelFull(nextSlot.year, nextSlot.month) : 'изменить'}
          </span>
        </button>
      </div>

      <section className="revenue-card">
        <div className="revenue-card-head">
          <h3>Динамика</h3>
          <div className="revenue-range" role="tablist" aria-label="Период графика">
            {RANGE_OPTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={rangeId === item.id}
                className={`revenue-range-btn${rangeId === item.id ? ' is-active' : ''}`}
                onClick={() => setRangeId(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="revenue-legend">
            <span>
              <i className="revenue-legend-line" /> Факт
            </span>
            <span>
              <i className="revenue-legend-line is-plan" /> План
            </span>
          </div>
        </div>
        {chartMonths.length === 0 ? (
          <p className="muted">Нет данных для графика</p>
        ) : range.count === 1 ? (
          <MonthBars row={chartMonths[0]} />
        ) : (
          <RevenueChart months={chartMonths} selectedId={selected?.id} onSelect={selectMonth} />
        )}
      </section>

      <section className="revenue-card" ref={formRef}>
        <h3>Редактировать {selected ? monthLabelFull(selected.year, selected.month) : 'месяц'}</h3>
        <p className="muted small">Цифры выбранного месяца. План на следующий месяц задаётся отдельным полем.</p>
        <div className="revenue-form">
          <label className="regulation-editor-label">
            Выручка, ₸
            <input
              className="regulation-editor-input"
              inputMode="numeric"
              value={form.revenue}
              onChange={(e) => setForm((prevForm) => ({ ...prevForm, revenue: e.target.value }))}
              placeholder="0"
            />
          </label>
          <label className="regulation-editor-label">
            План, ₸
            <input
              className="regulation-editor-input"
              inputMode="numeric"
              value={form.plan}
              onChange={(e) => setForm((prevForm) => ({ ...prevForm, plan: e.target.value }))}
              placeholder="0"
            />
          </label>
          <label className="regulation-editor-label revenue-form-wide">
            План на {nextSlot ? monthLabelFull(nextSlot.year, nextSlot.month) : 'следующий месяц'}, ₸
            <input
              className="regulation-editor-input"
              inputMode="numeric"
              value={form.nextPlan}
              onChange={(e) => setForm((prevForm) => ({ ...prevForm, nextPlan: e.target.value }))}
              placeholder="0"
            />
          </label>
          <button type="button" className="btn btn-dark revenue-form-wide" onClick={saveEdits}>
            Сохранить изменения
          </button>
        </div>
        {saveNote ? <p className="revenue-upload-ok">{saveNote}</p> : null}
      </section>

      <section className="revenue-card">
        <h3>Загрузить файл</h3>
        <p className="muted small">CSV с колонками месяц, выручка, план.</p>
        <div
          className={`revenue-drop${dragging ? ' is-dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            void ingestFile(e.dataTransfer?.files?.[0])
          }}
          onClick={() => fileRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click()
          }}
        >
          <strong>Перетащите файл сюда</strong>
          <span className="muted small">или нажмите, чтобы выбрать CSV</span>
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
