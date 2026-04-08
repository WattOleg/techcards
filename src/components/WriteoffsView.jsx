import { useMemo, useState } from 'react'
import { exportWriteoffsToPdf } from '../utils/pdfExport'

function uid(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10)
}

export default function WriteoffsView({ data, onChange, onSave, saving, loading, saveError }) {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [editEntry, setEditEntry] = useState(null)
  const [draft, setDraft] = useState({
    date: todayYmd(),
    employee: '',
    item: '',
    qty: '',
    unit: 'гр',
    type: 'writeoff',
    reason: '',
  })
  const [templateTitle, setTemplateTitle] = useState('')

  const entries = Array.isArray(data?.entries) ? data.entries : []
  const templates = Array.isArray(data?.templates) ? data.templates : []
  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => String(b.createdAt || b.date || '').localeCompare(String(a.createdAt || a.date || ''))),
    [entries],
  )
  const filteredEntries = useMemo(
    () =>
      sortedEntries.filter((e) => {
        const d = String(e.date || '')
        if (fromDate && d < fromDate) return false
        if (toDate && d > toDate) return false
        return true
      }),
    [sortedEntries, fromDate, toDate],
  )

  const addEntry = () => {
    if (!draft.employee.trim() || !draft.item.trim() || !String(draft.qty).trim()) return
    const entry = {
      id: uid('wr'),
      date: draft.date || todayYmd(),
      employee: draft.employee.trim(),
      item: draft.item.trim(),
      qty: String(draft.qty).trim(),
      unit: draft.unit.trim() || 'гр',
      type: draft.type === 'move' ? 'move' : 'writeoff',
      reason: draft.reason.trim(),
      createdAt: new Date().toISOString(),
    }
    onChange({ ...data, entries: [entry, ...entries] })
    setDraft((prev) => ({ ...prev, item: '', qty: '', reason: '' }))
  }

  const removeEntry = (id) => onChange({ ...data, entries: entries.filter((e) => e.id !== id) })
  const saveEditedEntry = () => {
    if (!editEntry) return
    const clean = {
      ...editEntry,
      date: String(editEntry.date || '').trim(),
      employee: String(editEntry.employee || '').trim(),
      item: String(editEntry.item || '').trim(),
      qty: String(editEntry.qty || '').trim(),
      unit: String(editEntry.unit || '').trim() || 'гр',
      type: editEntry.type === 'move' ? 'move' : 'writeoff',
      reason: String(editEntry.reason || '').trim(),
    }
    if (!clean.date || !clean.employee || !clean.item || !clean.qty) return
    onChange({ ...data, entries: entries.map((e) => (e.id === clean.id ? clean : e)) })
    setEditEntry(null)
  }

  const addTemplate = () => {
    if (!templateTitle.trim() || !draft.item.trim() || !String(draft.qty).trim()) return
    const tpl = {
      id: uid('tpl'),
      title: templateTitle.trim(),
      item: draft.item.trim(),
      qty: String(draft.qty).trim(),
      unit: draft.unit.trim() || 'гр',
      type: draft.type,
      reason: draft.reason.trim(),
    }
    onChange({ ...data, templates: [tpl, ...templates] })
    setTemplateTitle('')
  }

  const applyTemplate = (tpl) =>
    setDraft((prev) => ({
      ...prev,
      item: tpl.item || '',
      qty: tpl.qty || '',
      unit: tpl.unit || 'гр',
      type: tpl.type === 'move' ? 'move' : 'writeoff',
      reason: tpl.reason || '',
    }))

  const removeTemplate = (id) => onChange({ ...data, templates: templates.filter((t) => t.id !== id) })

  const exportPdf = async () => {
    await exportWriteoffsToPdf({ entries: filteredEntries })
  }

  return (
    <section className="writeoffs-page">
      <div className="schedule-toolbar schedule-toolbar-row">
        <button type="button" className="btn btn-dark" onClick={onSave} disabled={saving}>
          {saving ? 'Сохраняю...' : 'Сохранить в таблицу'}
        </button>
        <button type="button" className="ghost-btn" onClick={exportPdf}>
          Скачать PDF (период)
        </button>
      </div>
      {saveError ? <p className="error">{saveError}</p> : null}
      {loading ? <div className="schedule-loading">Загрузка списаний...</div> : null}

      <div className="schedule-employees card-primary">
        <h4>Новая запись</h4>
        <div className="writeoff-form-grid">
          <input type="date" value={draft.date} onChange={(e) => setDraft((p) => ({ ...p, date: e.target.value }))} />
          <input placeholder="Сотрудник" value={draft.employee} onChange={(e) => setDraft((p) => ({ ...p, employee: e.target.value }))} />
          <select value={draft.type} onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value }))}>
            <option value="writeoff">Списание</option>
            <option value="move">Перемещение</option>
          </select>
          <input placeholder="Продукт" value={draft.item} onChange={(e) => setDraft((p) => ({ ...p, item: e.target.value }))} />
          <input placeholder="Количество" value={draft.qty} onChange={(e) => setDraft((p) => ({ ...p, qty: e.target.value }))} />
          <input placeholder="Ед. изм. (гр/кг/л/шт)" value={draft.unit} onChange={(e) => setDraft((p) => ({ ...p, unit: e.target.value }))} />
          <input
            className="writeoff-form-reason"
            placeholder={draft.type === 'move' ? 'Куда перемещение' : 'Причина списания'}
            value={draft.reason}
            onChange={(e) => setDraft((p) => ({ ...p, reason: e.target.value }))}
          />
        </div>
        <div className="schedule-toolbar-row">
          <button type="button" className="btn btn-dark" onClick={addEntry}>
            Добавить в ленту
          </button>
          <input
            placeholder="Название шаблона"
            value={templateTitle}
            onChange={(e) => setTemplateTitle(e.target.value)}
            className="writeoff-template-input"
          />
          <button type="button" className="ghost-btn" onClick={addTemplate}>
            Сохранить как шаблон
          </button>
        </div>
      </div>

      <div className="schedule-totals card-primary">
        <h4>Шаблоны</h4>
        <div className="writeoff-templates">
          {templates.length === 0 ? <p className="muted">Шаблонов пока нет.</p> : null}
          {templates.map((tpl) => (
            <div key={tpl.id} className="writeoff-template-row">
              <button type="button" className="ghost-btn" onClick={() => applyTemplate(tpl)}>
                {tpl.title}
              </button>
              <button type="button" className="ghost-btn schedule-rate-remove" onClick={() => removeTemplate(tpl.id)}>
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="schedule-totals card-secondary">
        <h4>Лента истории</h4>
        <div className="writeoff-filter-row">
          <label className="schedule-modal-field">
            С даты
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </label>
          <label className="schedule-modal-field">
            По дату
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </label>
          {(fromDate || toDate) && (
            <button type="button" className="ghost-btn" onClick={() => {
              setFromDate('')
              setToDate('')
            }}>
              Сбросить
            </button>
          )}
        </div>
        <div className="writeoff-history">
          {filteredEntries.length === 0 ? <p className="muted">Записей за выбранный период нет.</p> : null}
          {filteredEntries.map((e) => (
            <div key={e.id} className="writeoff-history-row">
              <div>
                <strong>{e.item}</strong> - {e.qty} {e.unit}
              </div>
              <div className="muted small">
                {e.date} - {e.employee} - {e.type === 'move' ? 'Перемещение' : 'Списание'}
                {e.reason ? ` - ${e.reason}` : ''}
              </div>
              <button type="button" className="ghost-btn schedule-rate-remove" onClick={() => removeEntry(e.id)}>
                Удалить
              </button>
              <button type="button" className="ghost-btn schedule-rate-remove" onClick={() => setEditEntry({ ...e })}>
                Изменить
              </button>
            </div>
          ))}
        </div>
      </div>

      {editEntry ? (
        <div className="export-modal-backdrop" onClick={() => setEditEntry(null)}>
          <div className="export-modal" onClick={(ev) => ev.stopPropagation()}>
            <h3>Редактировать запись</h3>
            <div className="writeoff-form-grid">
              <input type="date" value={editEntry.date || ''} onChange={(e) => setEditEntry((p) => ({ ...p, date: e.target.value }))} />
              <input value={editEntry.employee || ''} onChange={(e) => setEditEntry((p) => ({ ...p, employee: e.target.value }))} />
              <select value={editEntry.type || 'writeoff'} onChange={(e) => setEditEntry((p) => ({ ...p, type: e.target.value }))}>
                <option value="writeoff">Списание</option>
                <option value="move">Перемещение</option>
              </select>
              <input value={editEntry.item || ''} onChange={(e) => setEditEntry((p) => ({ ...p, item: e.target.value }))} />
              <input value={editEntry.qty || ''} onChange={(e) => setEditEntry((p) => ({ ...p, qty: e.target.value }))} />
              <input value={editEntry.unit || ''} onChange={(e) => setEditEntry((p) => ({ ...p, unit: e.target.value }))} />
              <input
                className="writeoff-form-reason"
                value={editEntry.reason || ''}
                onChange={(e) => setEditEntry((p) => ({ ...p, reason: e.target.value }))}
              />
            </div>
            <div className="export-actions">
              <button type="button" className="ghost-btn" onClick={() => setEditEntry(null)}>
                Отмена
              </button>
              <button type="button" className="btn btn-dark" onClick={saveEditedEntry}>
                Сохранить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
