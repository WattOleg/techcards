import { useEffect, useState } from 'react'

/**
 * Чек-лист открытия/закрытия: пункты с галочками + редактирование (PIN снаружи).
 */
export default function ChecklistView({
  title,
  items = [],
  loading,
  error,
  onEditItem,
  onAddItem,
}) {
  const [checked, setChecked] = useState(() => new Set())

  useEffect(() => {
    setChecked(new Set())
  }, [items])

  const toggle = (id) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="checklist-view">
      <div className="checklist-head">
        <h3 className="checklist-title">{title}</h3>
        <p className="muted small">Отметьте пункты на смене. Редактирование — кнопка у пункта (PIN).</p>
      </div>

      {loading ? <p className="muted">Загрузка…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && items.length === 0 ? (
        <section className="info-page drawer-placeholder">
          <h3>Пока пусто</h3>
          <p className="muted">Добавьте первый пункт кнопкой «+» в шапке (нужен PIN).</p>
          {onAddItem ? (
            <button type="button" className="btn btn-dark" onClick={onAddItem}>
              + Пункт
            </button>
          ) : null}
        </section>
      ) : null}

      <ul className="checklist-list">
        {items.map((item, i) => {
          const isOn = checked.has(item.id)
          return (
            <li key={item.id} className={`checklist-item${isOn ? ' is-checked' : ''}`}>
              <button
                type="button"
                className="checklist-check"
                aria-pressed={isOn}
                aria-label={isOn ? 'Снять отметку' : 'Отметить'}
                onClick={() => toggle(item.id)}
              >
                <span className="checklist-box" aria-hidden>
                  {isOn ? '✓' : ''}
                </span>
                <span className="checklist-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="checklist-text">{item.itemText}</span>
              </button>
              {onEditItem ? (
                <button
                  type="button"
                  className="checklist-edit"
                  onClick={() => onEditItem(item)}
                  aria-label="Редактировать пункт"
                >
                  ✎
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
