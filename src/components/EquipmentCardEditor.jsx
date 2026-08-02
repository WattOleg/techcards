import { useEffect, useState } from 'react'
import { normalizePhotoUrl } from '../utils/photoUrl'

export default function EquipmentCardEditor({
  open,
  card,
  saving,
  error,
  onClose,
  onSave,
  onDelete,
}) {
  const [name, setName] = useState('')
  const [nameRu, setNameRu] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [instructions, setInstructions] = useState('')

  useEffect(() => {
    if (!open) return
    setName(card?.name || '')
    setNameRu(card?.nameRu || '')
    setPhotoUrl(card?.photoUrl || '')
    setInstructions(card?.instructions || '')
  }, [open, card])

  if (!open) return null

  const isNew = !card?.id

  return (
    <div className="export-modal-backdrop" onClick={onClose}>
      <div className="export-modal regulation-editor-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{isNew ? 'Новое оборудование' : 'Редактирование'}</h3>
        <p className="muted section-editor-hint">
          Как техкарта: название, фото (ссылка) и текст инструкции. Списки: <code>-</code> /{' '}
          <code>•</code>, заголовки <code>#</code>.
        </p>
        <label className="regulation-editor-label">
          Название
          <input
            className="regulation-editor-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Кофемашина"
            autoFocus
          />
        </label>
        <label className="regulation-editor-label">
          Подзаголовок
          <input
            className="regulation-editor-input"
            value={nameRu}
            onChange={(e) => setNameRu(e.target.value)}
            placeholder="Например: La Marzocco"
          />
        </label>
        <label className="regulation-editor-label">
          Фото (URL)
          <input
            className="regulation-editor-input"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            onBlur={(e) => setPhotoUrl(normalizePhotoUrl(e.target.value))}
            placeholder="https://…"
          />
        </label>
        <label className="regulation-editor-label">
          Инструкция
          <textarea
            className="section-editor-textarea"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Пошаговая инструкция…"
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
            disabled={saving || !String(name).trim()}
            onClick={() =>
              onSave?.({
                ...card,
                name: name.trim(),
                nameRu: nameRu.trim(),
                photoUrl: normalizePhotoUrl(photoUrl),
                instructions,
              })
            }
          >
            {saving ? 'Сохраняю…' : 'Сохранить'}
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </div>
    </div>
  )
}
