import { useMemo, useState } from 'react'
import { exportWriteoffsToPdf } from '../utils/pdfExport'

function uid(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10)
}

function ToolbarIcon({ type }) {
  if (type === 'save') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

export default function WriteoffsView({
  data,
  onReload,
  onAppendEntry,
  onDeleteEntry,
  onUpdateEntry,
  onReplaceTemplates,
  saving,
  loading,
  saveError,
}) {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [editEntry, setEditEntry] = useState(null)
  const [formError, setFormError] = useState('')
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
  const [saveHint, setSaveHint] = useState('')
  const [templateToDelete, setTemplateToDelete] = useState(null)

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

  const busy = Boolean(saving || loading)

  const addEntry = async () => {
    const employee = draft.employee.trim()
    const item = draft.item.trim()
    const qty = String(draft.qty).trim()
    if (!employee || !item || !qty) {
      setFormError('Заполните сотрудника, продукт и количество.')
      return
    }
    const entry = {
      id: uid('wr'),
      date: draft.date || todayYmd(),
      employee,
      item,
      qty,
      unit: draft.unit.trim() || 'гр',
      type: draft.type === 'move' ? 'move' : 'writeoff',
      reason: draft.reason.trim(),
      createdAt: new Date().toISOString(),
    }
    try {
      setFormError('')
      await onAppendEntry(entry)
      setDraft((prev) => ({ ...prev, item: '', qty: '', reason: '' }))
    } catch {
      setFormError('Не удалось записать строку в таблицу. Проверьте сеть и PIN.')
    }
  }

  const removeEntry = async (id) => {
    try {
      setFormError('')
      await onDeleteEntry(id)
    } catch {
      setFormError('Не удалось удалить запись.')
    }
  }

  const saveEditedEntry = async () => {
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
    if (!clean.date || !clean.employee || !clean.item || !clean.qty) {
      setFormError('В редактировании заполните дату, сотрудника, продукт и количество.')
      return
    }
    try {
      setFormError('')
      await onUpdateEntry(clean)
      setEditEntry(null)
    } catch {
      setFormError('Не удалось сохранить изменения.')
    }
  }

  const addTemplate = async () => {
    const title = templateTitle.trim()
    const item = draft.item.trim()
    const qty = String(draft.qty).trim()
    if (!title || !item || !qty) {
      setFormError('Для шаблона заполните название, продукт и количество.')
      return
    }
    const tpl = {
      id: uid('tpl'),
      title,
      item,
      qty,
      unit: draft.unit.trim() || 'гр',
      type: draft.type,
      reason: draft.reason.trim(),
    }
    try {
      setFormError('')
      await onReplaceTemplates([tpl, ...templates])
      setTemplateTitle('')
    } catch {
      setFormError('Не удалось сохранить шаблон.')
    }
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

  const removeTemplate = async (id) => {
    try {
      setFormError('')
      await onReplaceTemplates(templates.filter((t) => t.id !== id))
    } catch {
      setFormError('Не удалось удалить шаблон.')
    }
  }

  const exportPdf = async () => {
    await exportWriteoffsToPdf({ entries: filteredEntries })
  }

  const pullFromSheet = async () => {
    setSaveHint('')
    try {
      await onReload()
      setSaveHint('Загружены актуальные данные из таблицы')
    } catch {
      setSaveHint('')
    }
  }

  return (
    <section className="writeoffs-page">
      <div className="schedule-toolbar schedule-toolbar-row">
        <button
          type="button"
          className="btn btn-dark schedule-toolbar-icon-btn"
          onClick={pullFromSheet}
          disabled={busy}
          aria-label="Обновить из Google Таблицы"
          title="Обновить из таблицы"
        >
          <ToolbarIcon type="save" />
        </button>
        <button
          type="button"
          className="ghost-btn schedule-toolbar-icon-btn"
          onClick={exportPdf}
          aria-label="Скачать PDF (период)"
          title="Скачать PDF"
        >
          <ToolbarIcon type="download" />
        </button>
      </div>
      {saveError ? <p className="error">{saveError}</p> : null}
      {saveHint ? <p className="muted small">{saveHint}</p> : null}
      {formError ? <p className="error">{formError}</p> : null}
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
        <div className="writeoff-actions-row">
          <button type="button" className="btn btn-dark" onClick={addEntry} disabled={busy}>
            Добавить в ленту
          </button>
          <input
            placeholder="Название шаблона"
            value={templateTitle}
            onChange={(e) => setTemplateTitle(e.target.value)}
            className="writeoff-template-input"
          />
          <button type="button" className="ghost-btn" onClick={addTemplate} disabled={busy}>
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
              <button type="button" className="ghost-btn schedule-rate-remove" onClick={() => setTemplateToDelete(tpl)}>
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
              <button type="button" className="ghost-btn writeoff-row-action" onClick={() => removeEntry(e.id)} disabled={busy}>
                Удалить
              </button>
              <button
                type="button"
                className="ghost-btn writeoff-row-action"
                onClick={() => setEditEntry({ ...e })}
                disabled={busy}
              >
                Изменить
              </button>
            </div>
          ))}
        </div>
      </div>

      {templateToDelete ? (
        <div className="export-modal-backdrop" onClick={() => setTemplateToDelete(null)}>
          <div className="export-modal confirm-modal" onClick={(ev) => ev.stopPropagation()}>
            <h3>Удалить шаблон?</h3>
            <p className="muted">Шаблон «{templateToDelete.title}» будет удален.</p>
            <div className="export-actions">
              <button type="button" className="ghost-btn" onClick={() => setTemplateToDelete(null)}>
                Отмена
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  const id = templateToDelete.id
                  setTemplateToDelete(null)
                  await removeTemplate(id)
                }}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
              <button type="button" className="btn btn-dark" onClick={saveEditedEntry} disabled={busy}>
                Сохранить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
