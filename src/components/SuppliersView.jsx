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

function ColorPicker({ value, onChange }) {
  return (
    <div className="supplier-color-row" role="group" aria-label="Цвет карточки">
      {SUPPLIER_COLORS.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`supplier-color-dot${value === c.id ? ' is-active' : ''}`}
          style={{ background: c.bg, borderColor: c.border }}
          onClick={() => onChange(c.id)}
          aria-label={c.id}
        />
      ))}
    </div>
  )
}

function SupplierEditorCard({ draft, onChange, onCancel, onSave, onDelete }) {
  const isNew = !draft.id
  const palette = colorOf(draft.color)

  const set = (patch) => onChange({ ...draft, ...patch })

  return (
    <form
      className="supplier-frame is-editing"
      style={{ background: palette.bg, borderColor: palette.border }}
      onSubmit={(e) => {
        e.preventDefault()
        onSave()
      }}
    >
      <header className="supplier-frame-head">
        <input
          className="supplier-edit-name"
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Название компании"
          aria-label="Компания"
          autoFocus
        />
      </header>

      <div className="supplier-edit-grid">
        <label className="supplier-edit-field">
          <span>Менеджер</span>
          <input
            className="supplier-edit-input"
            value={draft.manager}
            onChange={(e) => set({ manager: e.target.value })}
            placeholder="Имя менеджера"
          />
        </label>
        <label className="supplier-edit-field">
          <span>Телефон</span>
          <input
            className="supplier-edit-input"
            type="tel"
            value={draft.phone}
            onChange={(e) => set({ phone: e.target.value })}
            placeholder="+7 …"
          />
        </label>
        <label className="supplier-edit-field">
          <span>Поставляют</span>
          <textarea
            className="supplier-edit-textarea"
            value={draft.supplies}
            onChange={(e) => set({ supplies: e.target.value })}
            placeholder="Ассортимент"
            rows={2}
          />
        </label>
        <label className="supplier-edit-field">
          <span>Условия поставок</span>
          <textarea
            className="supplier-edit-textarea"
            value={draft.terms}
            onChange={(e) => set({ terms: e.target.value })}
            placeholder="График, оплата, минимум"
            rows={2}
          />
        </label>
        <div className="supplier-edit-field">
          <span>Цвет карточки</span>
          <ColorPicker value={draft.color} onChange={(color) => set({ color })} />
        </div>
      </div>

      <div className="supplier-edit-actions">
        {!isNew && onDelete ? (
          <button type="button" className="ghost-btn btn-compact supplier-delete-btn" onClick={onDelete}>
            Удалить
          </button>
        ) : null}
        <button type="button" className="ghost-btn btn-compact" onClick={onCancel}>
          Отмена
        </button>
        <button type="submit" className="btn btn-dark btn-compact" disabled={!draft.name.trim()}>
          Сохранить
        </button>
      </div>
    </form>
  )
}

function SupplierViewCard({ item, onEdit }) {
  const palette = colorOf(item.color)
  const wa = whatsappHref(item.phone)

  return (
    <article
      className="supplier-frame"
      style={{ background: palette.bg, borderColor: palette.border }}
    >
      <header className="supplier-frame-head">
        <h3>{item.name}</h3>
        <button type="button" className="ghost-btn btn-compact supplier-edit-btn" onClick={onEdit}>
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

  const showNewEditor = Boolean(draft && !draft.id)
  const isEmpty = filtered.length === 0 && !showNewEditor

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

      {isEmpty ? (
        <section className="info-page drawer-placeholder">
          <h3>Никого нет</h3>
          <p className="muted">Добавьте первого поставщика.</p>
        </section>
      ) : (
        <div className="suppliers-grid">
          {showNewEditor ? (
            <SupplierEditorCard
              draft={draft}
              onChange={setDraft}
              onCancel={() => setDraft(null)}
              onSave={saveDraft}
            />
          ) : null}
          {filtered.map((item) =>
            draft?.id === item.id ? (
              <SupplierEditorCard
                key={item.id}
                draft={draft}
                onChange={setDraft}
                onCancel={() => setDraft(null)}
                onSave={saveDraft}
                onDelete={deleteDraft}
              />
            ) : (
              <SupplierViewCard key={item.id} item={item} onEdit={() => setDraft({ ...item })} />
            ),
          )}
        </div>
      )}
    </div>
  )
}
