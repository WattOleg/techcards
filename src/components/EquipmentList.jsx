import { useEffect, useMemo, useState } from 'react'
import { getPhotoCandidates } from '../utils/photoUrl'

function EquipmentListItem({ item, onClick }) {
  const photoCandidates = useMemo(() => getPhotoCandidates(item.photoUrl), [item.photoUrl])
  const [photoIdx, setPhotoIdx] = useState(0)

  useEffect(() => {
    setPhotoIdx(0)
  }, [item.photoUrl])

  const photoUrl = photoIdx < photoCandidates.length ? photoCandidates[photoIdx] : ''

  return (
    <button type="button" className="card-item" onClick={onClick}>
      <div className="thumb">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={item.name}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() =>
              setPhotoIdx((prev) => (prev + 1 <= photoCandidates.length ? prev + 1 : prev))
            }
          />
        ) : (
          <span>⚙️</span>
        )}
      </div>
      <div className="card-main">
        <div className="card-title">{item.name}</div>
        {item.nameRu ? <div className="card-subtitle">{item.nameRu}</div> : null}
      </div>
      <span className="chevron">›</span>
    </button>
  )
}

export default function EquipmentList({ items = [], loading, error, onSelect }) {
  if (loading) return <p className="muted">Загрузка оборудования…</p>
  if (error) return <p className="error">{error}</p>
  if (!items.length) {
    return (
      <section className="info-page drawer-placeholder">
        <h3>Пока пусто</h3>
        <p className="muted">Добавьте оборудование кнопкой «+» в шапке (нужен PIN).</p>
      </section>
    )
  }

  return (
    <div className="equipment-list">
      <p className="muted small equipment-list-hint">Нажмите на карточку, чтобы открыть инструкцию</p>
      <div className="list-grid">
        <section className="category-section">
          <div className="category-items">
            {items.map((item) => (
              <EquipmentListItem key={item.id} item={item} onClick={() => onSelect?.(item)} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
