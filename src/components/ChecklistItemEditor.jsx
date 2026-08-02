import { useEffect, useState } from 'react'

/**
 * Редактор пункта чек-листа (после PIN).
 */
export default function ChecklistItemEditor({ open, item, saving, error, onClose, onSave, onDelete }) {
  const [text, setText] = useState('')

  useEffect(() => {
    if (!open) return
    setText(item?.itemText || '')
  }, [open, item])

  if (!open) return null

  const isNew = !item?.id

  return (
    <div className="export-modal-backdrop" onClick={onClose}>
      <div className="export-modal regulation-editor-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{isNew ? 'Новый пункт' : 'Редактирование пункта'}</h3>
        <label className="regulation-editor-label">
          Текст пункта
          <textarea
            className="section-editor-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Например: Включить оборудование"
            autoFocus
          />
        </label>
        <div className="export-actions">
          {!isNew && onDelete ? (
            <button type="button" className="ghost-btn regulation-delete-btn" disabled={saving} onClick={onDelete}>
              Удалить
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="ghost-btn" disabled={saving} onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="btn btn-dark"
            disabled={saving || !String(text).trim()}
            onClick={() => onSave?.({ ...item, itemText: text.trim() })}
          >
            {saving ? 'Сохраняю…' : 'Сохранить'}
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </div>
    </div>
  )
}
