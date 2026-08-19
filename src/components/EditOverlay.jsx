import { useEffect, useMemo, useRef, useState } from 'react'
import { getCardPhotoUrls, isPhotoLink, normalizePhotoUrl, parsePhotoUrls } from '../utils/photoUrl'
import { uploadIngredientImage } from '../api/updatesSupabase.js'
import { GallerySlide } from './PhotoGallery'

function normalizeIngredients(list) {
  const rows = (Array.isArray(list) ? list : []).map((ing) => ({
    name: ing?.name || '',
    amount: ing?.amount || '',
    linkedSheetName: ing?.linkedSheetName || '',
  }))
  return rows.length ? rows : [{ name: '', amount: '', linkedSheetName: '' }]
}

function cardLabel(c) {
  const title = c?.name || c?.nameRu || c?.sheetName || ''
  return c?.category ? `${title} · ${c.category}` : title
}

function matchesQuery(card, query) {
  const q = String(query || '')
    .trim()
    .toLowerCase()
  if (!q) return true
  const hay = [card.name, card.nameRu, card.sheetName, card.category]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

/**
 * Привязка ингредиента: техкарта (поиск) или фото с Google Drive (ссылка).
 */
function IngredientLinkPicker({ value, options, onChange }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [photoDraft, setPhotoDraft] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const rootRef = useRef(null)
  const photoLinked = isPhotoLink(value)

  const selected = useMemo(
    () => (!photoLinked && value ? options.find((c) => c.sheetName === value) || null : null),
    [options, value, photoLinked],
  )

  const filtered = useMemo(() => {
    const list = options.filter((c) => matchesQuery(c, query))
    return list.slice(0, 40)
  }, [options, query])

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
    }
  }, [open])

  useEffect(() => {
    if (!value) {
      setQuery('')
      setPhotoDraft('')
      return
    }
    setPhotoDraft(photoLinked ? value : '')
  }, [value, photoLinked])

  const commitPhoto = (raw) => {
    const v = String(raw || '').trim()
    if (!v) {
      if (photoLinked) onChange('')
      return
    }
    if (isPhotoLink(v)) {
      onChange(v)
      setQuery('')
      setOpen(false)
    }
  }

  const onSearchChange = (raw) => {
    const v = String(raw || '')
    if (isPhotoLink(v.trim())) {
      setQuery('')
      setPhotoDraft(v.trim())
      onChange(v.trim())
      setOpen(false)
      return
    }
    setQuery(v)
    setOpen(true)
  }

  const onPickFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setUploading(true)
      setUploadError('')
      const url = await uploadIngredientImage(file)
      if (!url) throw new Error('Не удалось получить ссылку на фото')
      setPhotoDraft(url)
      onChange(url)
      setQuery('')
      setOpen(false)
    } catch (err) {
      setUploadError(err.message || 'Не удалось загрузить фото')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="ing-link-picker" ref={rootRef}>
      <div className="ing-link-picker-head">
        <span className="muted small">Ссылка на техкарту или фото</span>
        {value ? (
          <button
            type="button"
            className="ghost-btn ing-link-clear"
            onClick={() => {
              onChange('')
              setQuery('')
              setPhotoDraft('')
              setUploadError('')
              setOpen(false)
            }}
          >
            Сбросить
          </button>
        ) : null}
      </div>

      {selected ? (
        <button
          type="button"
          className="ing-link-selected"
          onClick={() => {
            setOpen(true)
            setQuery('')
          }}
        >
          <span className="ing-link-selected-label">{cardLabel(selected)}</span>
          <span className="muted small">Техкарта · Изменить</span>
        </button>
      ) : (
        <input
          className="ing-link-search"
          type="search"
          placeholder="Поиск техкарты по названию…"
          value={query}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setOpen(true)}
          autoComplete="off"
        />
      )}

      <div className={`ing-link-photo-row${photoLinked ? ' is-linked' : ''}`}>
        {photoLinked ? (
          <span className="ing-link-photo-thumb" aria-hidden>
            <GallerySlide url={value} alt="" />
          </span>
        ) : null}
        <input
          className="ing-link-photo-input"
          type="text"
          inputMode="url"
          placeholder="Или ссылка на фото Google Drive"
          value={photoDraft}
          onChange={(e) => {
            const v = e.target.value
            setPhotoDraft(v)
            if (isPhotoLink(v.trim())) onChange(v.trim())
          }}
          onBlur={(e) => commitPhoto(e.target.value)}
          autoComplete="off"
        />
      </div>
      <label className={`ghost-btn ing-link-upload-btn${uploading ? ' is-busy' : ''}`}>
        {uploading ? 'Загрузка фото…' : 'С устройства'}
        <input type="file" accept="image/*" hidden disabled={uploading} onChange={onPickFile} />
      </label>
      {uploadError ? <p className="error ing-link-upload-error">{uploadError}</p> : null}

      {open ? (
        <div className="ing-link-dropdown" role="listbox">
          {selected ? (
            <input
              className="ing-link-search ing-link-search-in-dropdown"
              type="search"
              placeholder="Поиск по названию…"
              value={query}
              onChange={(e) => onSearchChange(e.target.value)}
              autoFocus
              autoComplete="off"
            />
          ) : null}
          {filtered.length === 0 ? (
            <p className="muted small ing-link-empty">Ничего не найдено</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.sheetName}
                type="button"
                className={`ing-link-option${c.sheetName === value ? ' is-active' : ''}`}
                role="option"
                aria-selected={c.sheetName === value}
                onClick={() => {
                  onChange(c.sheetName)
                  setQuery('')
                  setPhotoDraft('')
                  setOpen(false)
                }}
              >
                <strong>{c.name || c.nameRu || c.sheetName}</strong>
                {c.nameRu && c.name && c.nameRu !== c.name ? (
                  <span className="muted small">{c.nameRu}</span>
                ) : null}
                {c.category ? <span className="muted small">{c.category}</span> : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

function EditOverlay({ isOpen, card, categories, linkableCards = [], onClose, onSave, onDelete }) {
  const [form, setForm] = useState(null)
  const [saved, setSaved] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const openedForSheetRef = useRef('')

  // Инициализация только при открытии / смене карточки — не при фоновом refresh списка.
  useEffect(() => {
    if (!isOpen) {
      setForm(null)
      openedForSheetRef.current = ''
      return
    }
    if (!card) return
    const sheetKey = String(card.sheetName || '__draft__')
    if (openedForSheetRef.current === sheetKey) return
    openedForSheetRef.current = sheetKey
    const photoUrls = getCardPhotoUrls(card)
    setForm({
      ...card,
      photoUrls: photoUrls.length ? [...photoUrls] : [''],
      ingredients: normalizeIngredients(card.ingredients),
    })
    setSaved(false)
    setSubmitError('')
    setIsSubmitting(false)
  }, [isOpen, card])

  // Догрузка состава (partial → full), не затирая уже введённые правки.
  useEffect(() => {
    if (!isOpen || !card || card.isPartial) return
    setForm((prev) => {
      if (!prev) return prev
      const current = prev.ingredients || []
      const currentEmpty =
        current.length === 0 ||
        current.every((ing) => !ing.name && !ing.amount && !ing.linkedSheetName)
      const incoming = normalizeIngredients(card.ingredients)
      const incomingHasData = incoming.some((ing) => ing.name || ing.amount || ing.linkedSheetName)
      let next = prev
      if (currentEmpty && incomingHasData) {
        next = { ...next, ingredients: incoming }
      }
      if (!String(prev.technology || '').trim() && card.technology) {
        next = { ...next, technology: card.technology }
      }
      return next
    })
  }, [isOpen, card])

  const currentSheet = String(form?.sheetName || card?.sheetName || '').trim()
  const linkOptions = useMemo(() => {
    return (linkableCards || [])
      .filter((c) => c?.sheetName && String(c.sheetName).trim() && c.sheetName !== currentSheet)
      .slice()
      .sort((a, b) =>
        String(a.name || a.nameRu || a.sheetName).localeCompare(
          String(b.name || b.nameRu || b.sheetName),
          'ru',
        ),
      )
  }, [linkableCards, currentSheet])

  if (!form) return null

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const setPhotoAt = (index, value) => {
    setForm((prev) => {
      const next = [...(prev.photoUrls || [])]
      next[index] = value
      return { ...prev, photoUrls: next }
    })
  }

  const commitPhotoAt = (index, raw) => {
    const expanded = parsePhotoUrls(raw)
    setForm((prev) => {
      const current = [...(prev.photoUrls || [])]
      if (expanded.length <= 1) {
        current[index] = expanded[0] || normalizePhotoUrl(raw) || ''
        return { ...prev, photoUrls: current }
      }
      const before = current.slice(0, index)
      const after = current.slice(index + 1)
      return { ...prev, photoUrls: [...before, ...expanded, ...after] }
    })
  }

  const addPhoto = () => {
    setForm((prev) => ({
      ...prev,
      photoUrls: [...(prev.photoUrls || []), ''],
    }))
  }

  const removePhoto = (index) => {
    setForm((prev) => {
      const next = (prev.photoUrls || []).filter((_, i) => i !== index)
      return { ...prev, photoUrls: next.length ? next : [''] }
    })
  }

  const setIngredient = (index, field, value) => {
    setForm((prev) => {
      const next = [...(prev.ingredients || [])]
      next[index] = { ...next[index], [field]: value }
      return { ...prev, ingredients: next }
    })
  }

  const addIngredient = () => {
    setForm((prev) => ({
      ...prev,
      ingredients: [...(prev.ingredients || []), { name: '', amount: '', linkedSheetName: '' }],
    }))
  }

  const removeIngredient = (index) => {
    setForm((prev) => {
      const next = (prev.ingredients || []).filter((_, i) => i !== index)
      return {
        ...prev,
        ingredients: next.length ? next : [{ name: '', amount: '', linkedSheetName: '' }],
      }
    })
  }

  const submit = async (e) => {
    e.preventDefault()
    try {
      setIsSubmitting(true)
      setSubmitError('')
      await onSave({
        ...form,
        ingredients: normalizeIngredients(form.ingredients).filter(
          (ing) => ing.name || ing.amount || ing.linkedSheetName,
        ),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (err) {
      setSubmitError(err.message || 'Ошибка сохранения')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isCreate = !card?.sheetName
  const photoUrls = form.photoUrls || ['']
  const ingredients = form.ingredients?.length
    ? form.ingredients
    : [{ name: '', amount: '', linkedSheetName: '' }]

  return (
    <div className={`edit-overlay ${isOpen ? 'open' : ''}`} aria-hidden={!isOpen}>
      <form className="edit-form" onSubmit={submit}>
        <button type="button" className="close-btn" onClick={onClose} disabled={isSubmitting}>
          ×
        </button>

        <h3>{isCreate ? 'Новая техкарта' : 'Редактирование'}</h3>

        <label>
          ID листа (sheetName)
          <input
            value={form.sheetName || ''}
            onChange={(e) => setField('sheetName', e.target.value)}
            placeholder="Например: Espresso-300"
          />
        </label>

        <label>Название<input value={form.name || ''} onChange={(e) => setField('name', e.target.value)} /></label>
        <label>Название RU<input value={form.nameRu || ''} onChange={(e) => setField('nameRu', e.target.value)} /></label>
        <label>
          Категория
          <input
            value={form.category || ''}
            onChange={(e) => setField('category', e.target.value)}
            list="category-options"
            placeholder="Введите категорию"
          />
          <datalist id="category-options">
            {categories.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>
        <label>Выход<input value={form.yield || ''} onChange={(e) => setField('yield', e.target.value)} /></label>
        <label>Время<input value={form.time || ''} onChange={(e) => setField('time', e.target.value)} /></label>
        <label>Метод<input value={form.method || ''} onChange={(e) => setField('method', e.target.value)} /></label>
        <label>Бокал<input value={form.glass || ''} onChange={(e) => setField('glass', e.target.value)} /></label>
        <label>Украшение<input value={form.garnish || ''} onChange={(e) => setField('garnish', e.target.value)} /></label>

        <div className="ing-head">
          <h4>Фото (URL)</h4>
          <button type="button" className="ghost-btn" onClick={addPhoto}>
            + Фото
          </button>
        </div>
        <div className="photo-url-list">
          {photoUrls.map((url, index) => (
            <div key={index} className="photo-url-row">
              <input
                placeholder={`Фото ${index + 1}: https://…`}
                value={url}
                onChange={(e) => setPhotoAt(index, e.target.value)}
                onBlur={(e) => commitPhotoAt(index, e.target.value)}
              />
              <button type="button" className="ghost-btn" onClick={() => removePhoto(index)}>
                Удалить
              </button>
            </div>
          ))}
        </div>

        <label>
          Технология
          <textarea value={form.technology || ''} onChange={(e) => setField('technology', e.target.value)} />
        </label>

        <div className="ing-head">
          <h4>Ингредиенты</h4>
          <button type="button" className="ghost-btn" onClick={addIngredient}>
            + Добавить
          </button>
        </div>
        <p className="muted small ing-link-hint">
          Можно привязать техкарту или фото: загрузить с телефона либо вставить ссылку Google Drive.
          В карточке название станет синей ссылкой.
        </p>
        {card?.isPartial ? (
          <p className="muted small">Догружаю состав с сервера…</p>
        ) : null}
        <div className="ing-list">
          {ingredients.map((ing, index) => (
            <div key={index} className="ing-item">
              <input
                placeholder="Название"
                value={ing.name || ''}
                onChange={(e) => setIngredient(index, 'name', e.target.value)}
              />
              <input
                placeholder="Кол-во"
                value={ing.amount || ''}
                onChange={(e) => setIngredient(index, 'amount', e.target.value)}
              />
              <button type="button" className="ghost-btn" onClick={() => removeIngredient(index)}>
                Удалить
              </button>
              <IngredientLinkPicker
                value={ing.linkedSheetName || ''}
                options={linkOptions}
                onChange={(sheetName) => setIngredient(index, 'linkedSheetName', sheetName)}
              />
            </div>
          ))}
        </div>

        <button type="submit" className="btn btn-dark save-btn" disabled={isSubmitting}>
          {isSubmitting
            ? 'Сохранение...'
            : saved
              ? '✓ Сохранено'
              : isCreate
                ? 'Создать → Google Sheets'
                : 'Сохранить → Google Sheets'}
        </button>
        {!isCreate && typeof onDelete === 'function' ? (
          <button
            type="button"
            className="btn btn-danger edit-delete-btn"
            disabled={isSubmitting}
            onClick={() => onDelete()}
          >
            Удалить карточку
          </button>
        ) : null}
        {isSubmitting ? <p className="muted">Идет связь с сервером...</p> : null}
        {submitError ? <p className="error">{submitError}</p> : null}
      </form>
    </div>
  )
}

export default EditOverlay
