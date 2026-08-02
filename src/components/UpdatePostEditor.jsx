import { useEffect, useState } from 'react'
import { uploadUpdatesImage } from '../api/updatesSupabase.js'

/**
 * Редактор новости / записи «Актуальное» (после PIN).
 */
export default function UpdatePostEditor({
  open,
  kindLabel,
  post,
  saving,
  error,
  onClose,
  onSave,
  onDelete,
}) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [imageUrls, setImageUrls] = useState([])
  const [uploading, setUploading] = useState(false)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    if (!open) return
    setTitle(post?.title || '')
    setContent(post?.content || '')
    setImageUrls(Array.isArray(post?.imageUrls) ? [...post.imageUrls] : [])
    setLocalError('')
  }, [open, post])

  if (!open) return null

  const isNew = !post?.id

  const onPickFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setUploading(true)
      setLocalError('')
      const url = await uploadUpdatesImage(file)
      if (url) setImageUrls((prev) => [...prev, url])
    } catch (err) {
      setLocalError(err.message || 'Ошибка загрузки')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="export-modal-backdrop" onClick={onClose}>
      <div className="export-modal regulation-editor-modal" onClick={(e) => e.stopPropagation()}>
        <h3>
          {isNew ? `Новая запись` : 'Редактирование'}
          {kindLabel ? ` · ${kindLabel}` : ''}
        </h3>
        <label className="regulation-editor-label">
          Заголовок
          <input
            className="regulation-editor-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Заголовок"
            autoFocus
          />
        </label>
        <label className="regulation-editor-label">
          Текст
          <textarea
            className="section-editor-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Текст…"
          />
        </label>
        <div className="updates-editor-photos">
          <div className="ing-head">
            <h4>Фото</h4>
            <label className="ghost-btn updates-upload-btn">
              {uploading ? 'Загрузка…' : '+ С устройства'}
              <input type="file" accept="image/*" hidden disabled={uploading || saving} onChange={onPickFile} />
            </label>
          </div>
          {imageUrls.length ? (
            <div className="updates-post-photos">
              {imageUrls.map((url) => (
                <div key={url} className="updates-editor-photo">
                  <img src={url} alt="" />
                  <button
                    type="button"
                    className="ghost-btn btn-compact"
                    onClick={() => setImageUrls((prev) => prev.filter((u) => u !== url))}
                  >
                    Убрать
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">Можно добавить фото с телефона.</p>
          )}
        </div>
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
            disabled={saving || uploading || !title.trim()}
            onClick={() => onSave?.({ ...post, title: title.trim(), content, imageUrls })}
          >
            {saving ? 'Сохраняю…' : 'Сохранить'}
          </button>
        </div>
        {localError || error ? <p className="error">{localError || error}</p> : null}
      </div>
    </div>
  )
}
