import { useMemo, useState } from 'react'
import { exportWriteoffsToPdf } from '../utils/pdfExport'
import {
  formatWriteoffDateRuFromEntry,
  formatWriteoffDateRuFromYmd,
  ymdFromEntry,
} from '../utils/writeoffDateRu'

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
  onClearSaveError,
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
  const [appendSubmitting, setAppendSubmitting] = useState(false)
  const [reloadSubmitting, setReloadSubmitting] = useState(false)
  const [templateSubmitting, setTemplateSubmitting] = useState(false)
  /** Строка ленты: удаление или сохранение после «Изменить». */
  const [historyPending, setHistoryPending] = useState(null)

  const entries = Array.isArray(data?.entries) ? data.entries : []
  const templates = Array.isArray(data?.templates) ? data.templates : []
  const sortedEntries = useMemo(
    () =>
      [...entries].sort((a, b) => {
        const da = ymdFromEntry(a)
        const db = ymdFromEntry(b)
        if (!da && !db) return 0
        if (!da) return 1
        if (!db) return -1
        const c = db.localeCompare(da)
        if (c !== 0) return c
        return String(b.createdAt || b.date || '').localeCompare(String(a.createdAt || a.date || ''))
      }),
    [entries],
  )
  const filteredEntries = useMemo(
    () =>
      sortedEntries.filter((e) => {
        const d = ymdFromEntry(e)
        if (fromDate && d && d < fromDate) return false
        if (toDate && d && d > toDate) return false
        return true
      }),
    [sortedEntries, fromDate, toDate],
  )

  const busy = Boolean(
    saving ||
      loading ||
      appendSubmitting ||
      reloadSubmitting ||
      templateSubmitting ||
      historyPending,
  )

  /** saveError с сервера важнее: раньше formError затирал реальную причину (PIN, ответ GAS). */
  const bannerError = saveError || formError || ''

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
    setAppendSubmitting(true)
    try {
      setFormError('')
      await onAppendEntry(entry)
      setDraft((prev) => ({ ...prev, item: '', qty: '', reason: '' }))
    } catch (err) {
      setFormError(
        err?.message ||
          'Не удалось записать строку в таблицу. Проверьте сеть, PIN и деплой Apps Script.',
      )
    } finally {
      setAppendSubmitting(false)
    }
  }

  const removeEntry = async (id) => {
    setHistoryPending({ id, op: 'delete' })
    try {
      setFormError('')
      await onDeleteEntry(id)
    } catch (err) {
      setFormError(err?.message || 'Не удалось удалить запись.')
    } finally {
      setHistoryPending(null)
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
    setHistoryPending({ id: clean.id, op: 'update' })
    try {
      setFormError('')
      await onUpdateEntry(clean)
      setEditEntry(null)
    } catch (err) {
      setFormError(err?.message || 'Не удалось сохранить изменения.')
    } finally {
      setHistoryPending(null)
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
      type: draft.type === 'move' ? 'move' : 'writeoff',
      reason: draft.reason.trim(),
    }
    setTemplateSubmitting(true)
    try {
      setFormError('')
      await onReplaceTemplates([tpl, ...templates])
      setTemplateTitle('')
    } catch (err) {
      setFormError(err?.message || 'Не удалось сохранить шаблон. Проверьте сеть и обновите страницу.')
    } finally {
      setTemplateSubmitting(false)
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
    setTemplateSubmitting(true)
    try {
      setFormError('')
      await onReplaceTemplates(templates.filter((t) => t.id !== id))
    } catch (err) {
      setFormError(err?.message || 'Не удалось удалить шаблон.')
    } finally {
      setTemplateSubmitting(false)
    }
  }

  const exportPdf = async () => {
    await exportWriteoffsToPdf({ entries: filteredEntries })
  }

  const pullFromSheet = async () => {
    setSaveHint('')
    setReloadSubmitting(true)
    try {
      await onReload()
      setSaveHint('Загружены актуальные данные из таблицы')
    } catch {
      setSaveHint('')
    } finally {
      setReloadSubmitting(false)
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
          {reloadSubmitting ? <span className="schedule-loading-spinner" aria-hidden /> : <ToolbarIcon type="save" />}
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
      {bannerError ? (
        <div className="writeoffs-banner-error" role="alert">
          <p className="error writeoffs-banner-text">{bannerError}</p>
          <button
            type="button"
            className="ghost-btn writeoffs-banner-dismiss"
            onClick={() => {
              setFormError('')
              onClearSaveError?.()
            }}
          >
            Закрыть
          </button>
        </div>
      ) : null}
      {saveHint ? <p className="muted small">{saveHint}</p> : null}
      {loading ? <div className="schedule-loading">Загрузка списаний...</div> : null}

      <div className="schedule-employees card-primary writeoff-new-card">
        <h4>Новая запись</h4>
        <div className="writeoff-form-date-block">
          <span className="muted small writeoff-form-date-label">Дата записи</span>
          <span className="writeoff-date-ru-text">
            {draft.date && String(draft.date).length >= 10
              ? formatWriteoffDateRuFromYmd(String(draft.date).slice(0, 10))
              : '—'}
          </span>
          <input
            type="date"
            className="writeoff-date-native"
            value={draft.date}
            onChange={(e) => setDraft((p) => ({ ...p, date: e.target.value }))}
            lang="ru"
          />
        </div>
        <div className="writeoff-form-grid">
          <label className="writeoff-field-label">
            <span className="writeoff-field-caption">Сотрудник</span>
            <input placeholder="ФИО" value={draft.employee} onChange={(e) => setDraft((p) => ({ ...p, employee: e.target.value }))} />
          </label>
          <label className="writeoff-field-label">
            <span className="writeoff-field-caption">Тип</span>
            <select value={draft.type} onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value }))}>
              <option value="writeoff">Списание</option>
              <option value="move">Перемещение</option>
            </select>
          </label>
          <label className="writeoff-field-label">
            <span className="writeoff-field-caption">Продукт</span>
            <input placeholder="Название" value={draft.item} onChange={(e) => setDraft((p) => ({ ...p, item: e.target.value }))} />
          </label>
          <label className="writeoff-field-label">
            <span className="writeoff-field-caption">Количество</span>
            <input placeholder="Число" value={draft.qty} onChange={(e) => setDraft((p) => ({ ...p, qty: e.target.value }))} />
          </label>
          <label className="writeoff-field-label writeoff-form-unit">
            <span className="writeoff-field-caption">Ед. изм.</span>
            <input placeholder="гр, кг, л, шт…" value={draft.unit} onChange={(e) => setDraft((p) => ({ ...p, unit: e.target.value }))} />
          </label>
          <label className="writeoff-field-label writeoff-form-reason">
            <span className="writeoff-field-caption">{draft.type === 'move' ? 'Куда' : 'Причина'}</span>
            <input
              placeholder={draft.type === 'move' ? 'Куда перемещение' : 'Причина списания'}
              value={draft.reason}
              onChange={(e) => setDraft((p) => ({ ...p, reason: e.target.value }))}
            />
          </label>
        </div>
        <div className="writeoff-actions-row">
          <button type="button" className="btn btn-dark" onClick={addEntry} disabled={busy} aria-busy={appendSubmitting}>
            {appendSubmitting ? (
              <span className="writeoff-btn-inner">
                <span className="schedule-loading-spinner" aria-hidden />
                <span>Сохранение…</span>
              </span>
            ) : (
              'Добавить в ленту'
            )}
          </button>
          <input
            placeholder="Название шаблона"
            value={templateTitle}
            onChange={(e) => setTemplateTitle(e.target.value)}
            className="writeoff-template-input"
          />
          <button type="button" className="ghost-btn writeoff-template-save-btn" onClick={addTemplate} disabled={busy}>
            {templateSubmitting ? (
              <span className="writeoff-btn-inner">
                <span className="schedule-loading-spinner" aria-hidden />
                <span>Сохранение…</span>
              </span>
            ) : (
              'Сохранить как шаблон'
            )}
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
          {filteredEntries.map((e) => {
            const delBusy = historyPending?.id === e.id && historyPending.op === 'delete'
            const editBusy = historyPending?.id === e.id && historyPending.op === 'update'
            return (
              <div key={e.id} className="writeoff-history-row">
                <div className="writeoff-history-main">
                  <div>
                    <strong>{e.item}</strong> — {e.qty} {e.unit}
                  </div>
                  <div className="muted small">
                    {formatWriteoffDateRuFromEntry(e)} — {e.employee} — {e.type === 'move' ? 'Перемещение' : 'Списание'}
                    {e.reason ? ` — ${e.reason}` : ''}
                  </div>
                </div>
                <div className="writeoff-history-actions">
                  <button
                    type="button"
                    className="ghost-btn writeoff-row-action"
                    onClick={() => removeEntry(e.id)}
                    disabled={busy}
                    aria-busy={delBusy}
                  >
                    {delBusy ? (
                      <span className="writeoff-btn-inner writeoff-history-btn-inner">
                        <span className="schedule-loading-spinner" aria-hidden />
                        <span>Удаление…</span>
                      </span>
                    ) : (
                      'Удалить'
                    )}
                  </button>
                  <button
                    type="button"
                    className="ghost-btn writeoff-row-action"
                    onClick={() => setEditEntry({ ...e })}
                    disabled={busy}
                    aria-busy={editBusy}
                  >
                    {editBusy ? (
                      <span className="writeoff-btn-inner writeoff-history-btn-inner">
                        <span className="schedule-loading-spinner" aria-hidden />
                        <span>Сохранение…</span>
                      </span>
                    ) : (
                      'Изменить'
                    )}
                  </button>
                </div>
              </div>
            )
          })}
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
            <div className="writeoff-form-date-block">
              <span className="muted small">Дата записи</span>
              <span className="writeoff-date-ru-text">
                {editEntry.date && String(editEntry.date).length >= 10
                  ? formatWriteoffDateRuFromYmd(String(editEntry.date).slice(0, 10))
                  : '—'}
              </span>
              <input
                type="date"
                className="writeoff-date-native"
                value={String(editEntry.date || '').slice(0, 10)}
                onChange={(e) => setEditEntry((p) => ({ ...p, date: e.target.value }))}
                lang="ru"
              />
            </div>
            <div className="writeoff-form-grid">
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
                {saving ? (
                  <span className="writeoff-btn-inner">
                    <span className="schedule-loading-spinner" aria-hidden />
                    <span>Сохранение…</span>
                  </span>
                ) : (
                  'Сохранить'
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
