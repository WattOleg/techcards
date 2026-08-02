import { useEffect, useState } from 'react'

/**
 * Редактор одной карточки регламента (после PIN).
 */
export default function RegulationCardEditor({
  open,
  card,
  saving,
  error,
  onClose,
  onSave,
  onDelete,
}) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  useEffect(() => {
    if (!open) return
    setTitle(card?.title || '')
    setContent(card?.content || '')
  }, [open, card])

  if (!open) return null

  const isNew = !card?.id

  return (
    <div className="export-modal-backdrop" onClick={onClose}>
      <div className="export-modal regulation-editor-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{isNew ? 'Новая карточка' : 'Редактирование карточки'}</h3>
        <p className="muted section-editor-hint">
          Заголовок — тема карточки. В тексте: абзацы с новой строки; списки с <code>-</code> или{' '}
          <code>•</code>; заголовки <code>#</code> / <code>##</code>.
        </p>
        <label className="regulation-editor-label">
          Тема
          <input
            className="regulation-editor-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: Общий внешний вид"
            autoFocus
          />
        </label>
        <label className="regulation-editor-label">
          Текст
          <textarea
            className="section-editor-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Текст карточки…"
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
            disabled={saving}
            onClick={() => onSave?.({ ...card, title, content })}
          >
            {saving ? 'Сохраняю…' : 'Сохранить'}
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </div>
    </div>
  )
}
