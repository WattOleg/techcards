import { useMemo, useState } from 'react'
import {
  DEFAULT_SUPPLIERS,
  nextSupplierColor,
  newSupplierId,
  SUPPLIER_COLORS,
  SUPPLIERS_STORE_KEY,
  whatsappHref,
} from '../constants/suppliers.js'
import { readStore, writeStore } from '../utils/localStore.js'

function colorOf(id) {
  return SUPPLIER_COLORS.find((c) => c.id === id) || SUPPLIER_COLORS[0]
}

function WhatsAppIcon() {
  return (
    <svg className="supplier-wa-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#25D366"
        d="M12 2a10 10 0 0 0-8.7 14.9L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 1.8a8.2 8.2 0 0 1 7 12.4l-.3.5.5 1.9-2-.5-.5.3A8.2 8.2 0 1 1 12 3.8z"
      />
      <path
        fill="#25D366"
        d="M9.4 8.3c-.2-.4-.3-.4-.5-.4h-.4c-.2 0-.4.1-.6.3s-.7.8-.7 1.9.8 2.2 2.3 3.7c1.6 1.5 2.9 1.8 3.4 1.9.5 0 1.4-.4 1.6-1 .2-.5.2-1 .1-1.1l-.5-.2c-.2-.1-1.3-.6-1.5-.7s-.3-.1-.5.1-.6.7-.7.8-.3.2-.5.1c-.8-.4-1.5-1-2-1.8-.2-.2 0-.3.1-.5l.3-.4c.1-.1.1-.3.1-.4s-.3-.7-.4-1z"
      />
    </svg>
  )
}

function emptyDraft(color) {
  return {
    id: '',
    name: '',
    manager: '',
    phone: '',
    supplies: '',
    terms: '',
    color,
  }
}

function SupplierEditor({ draft, onChange, onClose, onSave, onDelete }) {
  const isNew = !draft.id
  return (
    <div className="export-modal-backdrop" onClick={onClose}>
      <div className="export-modal regulation-editor-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{isNew ? 'Новый поставщик' : 'Поставщик'}</h3>
        <label className="regulation-editor-label">
          Компания
          <input
            className="regulation-editor-input"
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            placeholder="Название"
            autoFocus
          />
        </label>
        <label className="regulation-editor-label">
          Менеджер
          <input
            className="regulation-editor-input"
            value={draft.manager}
            onChange={(e) => onChange({ ...draft, manager: e.target.value })}
            placeholder="Имя менеджера"
          />
        </label>
        <label className="regulation-editor-label">
          Телефон менеджера
          <input
            className="regulation-editor-input"
            type="tel"
            value={draft.phone}
            onChange={(e) => onChange({ ...draft, phone: e.target.value })}
            placeholder="+7 …"
          />
        </label>
        <label className="regulation-editor-label">
          Что поставляют
          <textarea
            className="section-editor-textarea"
            value={draft.supplies}
            onChange={(e) => onChange({ ...draft, supplies: e.target.value })}
            placeholder="Ассортимент"
            rows={3}
          />
        </label>
        <label className="regulation-editor-label">
          Условия поставок
          <textarea
            className="section-editor-textarea"
            value={draft.terms}
            onChange={(e) => onChange({ ...draft, terms: e.target.value })}
            placeholder="График, оплата, минимум"
            rows={3}
          />
        </label>
        <div className="supplier-color-row" role="group" aria-label="Цвет карточки">
          {SUPPLIER_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`supplier-color-dot${draft.color === c.id ? ' is-active' : ''}`}
              style={{ background: c.bg, borderColor: c.border }}
              onClick={() => onChange({ ...draft, color: c.id })}
              aria-label={c.id}
            />
          ))}
        </div>
        <div className="export-actions">
          {!isNew && onDelete ? (
            <button type="button" className="ghost-btn regulation-delete-btn" onClick={onDelete}>
              Удалить
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="ghost-btn" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="btn btn-dark"
            disabled={!draft.name.trim()}
            onClick={onSave}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SuppliersView() {
  const [items, setItems] = useState(() => {
    const stored = readStore(SUPPLIERS_STORE_KEY, null)
    return Array.isArray(stored) ? stored : DEFAULT_SUPPLIERS
  })
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState(null)

  const persist = (next) => {
    setItems(next)
    writeStore(SUPPLIERS_STORE_KEY, next)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) =>
      [item.name, item.manager, item.phone, item.supplies, item.terms]
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [items, query])

  const saveDraft = () => {
    if (!draft?.name.trim()) return
    const row = {
      ...draft,
      name: draft.name.trim(),
      manager: draft.manager.trim(),
      phone: draft.phone.trim(),
      supplies: draft.supplies.trim(),
      terms: draft.terms.trim(),
    }
    if (row.id) {
      persist(items.map((item) => (item.id === row.id ? row : item)))
    } else {
      persist([...items, { ...row, id: newSupplierId() }])
    }
    setDraft(null)
  }

  const deleteDraft = () => {
    if (!draft?.id) return
    persist(items.filter((item) => item.id !== draft.id))
    setDraft(null)
  }

  return (
    <div className="suppliers-view">
      <p className="muted small suppliers-hint">
        Нажмите номер телефона — откроется WhatsApp.
      </p>
      <div className="suppliers-toolbar">
        <input
          type="search"
          className="suppliers-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по имени, телефону…"
          aria-label="Поиск поставщиков"
        />
        <button
          type="button"
          className="btn btn-dark btn-compact suppliers-add-btn"
          onClick={() => setDraft(emptyDraft(nextSupplierColor(items.length)))}
        >
          Добавить
        </button>
      </div>

      {filtered.length === 0 ? (
        <section className="info-page drawer-placeholder">
          <h3>Никого нет</h3>
          <p className="muted">Добавьте первого поставщика.</p>
        </section>
      ) : (
        <div className="suppliers-grid">
          {filtered.map((item) => {
            const palette = colorOf(item.color)
            const wa = whatsappHref(item.phone)
            return (
              <article
                key={item.id}
                className="supplier-frame"
                style={{ background: palette.bg, borderColor: palette.border }}
              >
                <header className="supplier-frame-head">
                  <h3>{item.name}</h3>
                  <button
                    type="button"
                    className="ghost-btn btn-compact supplier-edit-btn"
                    onClick={() => setDraft({ ...item })}
                  >
                    Изменить
                  </button>
                </header>
                <dl className="supplier-meta">
                  <div>
                    <dt>Менеджер</dt>
                    <dd>{item.manager || '—'}</dd>
                  </div>
                  <div>
                    <dt>Телефон</dt>
                    <dd>
                      {wa ? (
                        <a className="supplier-phone" href={wa}>
                          <WhatsAppIcon />
                          {item.phone}
                        </a>
                      ) : (
                        item.phone || '—'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Поставляют</dt>
                    <dd>{item.supplies || '—'}</dd>
                  </div>
                  <div>
                    <dt>Условия поставок</dt>
                    <dd>{item.terms || '—'}</dd>
                  </div>
                </dl>
              </article>
            )
          })}
        </div>
      )}

      {draft ? (
        <SupplierEditor
          draft={draft}
          onChange={setDraft}
          onClose={() => setDraft(null)}
          onSave={saveDraft}
          onDelete={draft.id ? deleteDraft : undefined}
        />
      ) : null}
    </div>
  )
}
