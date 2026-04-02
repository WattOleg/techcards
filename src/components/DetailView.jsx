import { useEffect, useMemo, useRef, useState } from 'react'
import { getPhotoCandidates } from '../utils/photoUrl'

function DetailView({ card, loading, onBack, onEdit, onDelete, onExport, onShare }) {
  const touchRef = useRef({ x: 0, y: 0, active: false })
  const photoCandidates = useMemo(() => getPhotoCandidates(card?.photoUrl), [card?.photoUrl])
  const [photoIdx, setPhotoIdx] = useState(0)

  useEffect(() => {
    setPhotoIdx(0)
  }, [card?.photoUrl])

  if (!card) {
    return (
      <div className="view detail-view">
        <p className="muted">Выберите карточку</p>
      </div>
    )
  }

  const hasCandidate = photoIdx < photoCandidates.length
  const photoUrl = hasCandidate ? photoCandidates[photoIdx] : ''

  const onTouchStart = (e) => {
    const t = e.changedTouches?.[0]
    if (!t) return
    touchRef.current = { x: t.clientX, y: t.clientY, active: true }
  }

  const onTouchEnd = (e) => {
    const t = e.changedTouches?.[0]
    const state = touchRef.current
    touchRef.current.active = false
    if (!t || !state.active) return

    const dx = t.clientX - state.x
    const dy = t.clientY - state.y
    const mostlyHorizontal = Math.abs(dx) > Math.abs(dy) * 1.4

    // Swipe left: close card and return to list.
    if (mostlyHorizontal && dx < -70) onBack()
  }

  return (
    <div className="view detail-view" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="hero">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={card.name}
            referrerPolicy="no-referrer"
            onError={() =>
              setPhotoIdx((prev) => (prev + 1 <= photoCandidates.length ? prev + 1 : prev))
            }
          />
        ) : (
          <div className="hero-placeholder">🍹</div>
        )}
        <div className="hero-top">
          <button type="button" className="icon-btn" onClick={onBack}>
            ←
          </button>
          <button type="button" className="icon-btn" onClick={onEdit}>
            Изменить
          </button>
        </div>
      </div>

      <h2 className="title">{card.name}</h2>
      <p className="subtitle">{card.nameRu}</p>

      <div className="meta-row">
        <div className="meta-box">
          <span>Выход</span>
          <strong>{card.yield}</strong>
        </div>
        <div className="meta-box">
          <span>Время</span>
          <strong>{card.time}</strong>
        </div>
        <div className="meta-box">
          <span>Метод</span>
          <strong>{card.method}</strong>
        </div>
      </div>

      <section className="block">
        <h3>Подача</h3>
        <p>{card.glass}</p>
        <p className="muted">{card.garnish}</p>
      </section>

      <section className={`block detail-block ${loading ? 'is-loading' : 'is-ready'}`}>
        <h3>Ингредиенты</h3>
        {loading ? <p className="muted">Загружаю детали...</p> : null}
        <div className="ingredient-list">
          {card.ingredients?.map((ing, idx) => (
            <div key={`${ing.name}-${idx}`} className="ingredient-row">
              <span>{ing.name}</span>
              <strong>{ing.amount}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className={`block detail-block ${loading ? 'is-loading' : 'is-ready'}`}>
        <h3>Технология</h3>
        <p>{card.technology}</p>
      </section>

      <div className="actions">
        <button type="button" className="btn btn-dark" onClick={onEdit}>
          Редактировать
        </button>
        <div className="actions-inline">
          <button type="button" className="btn btn-compact btn-outline-black" onClick={onExport}>
            Экспорт PDF
          </button>
          <button type="button" className="btn btn-compact btn-outline-black" onClick={onShare}>
            Отправить
          </button>
        </div>
        <button type="button" className="btn btn-danger" onClick={onDelete}>
          Удалить
        </button>
      </div>
    </div>
  )
}

export default DetailView
