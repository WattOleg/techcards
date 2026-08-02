import { useEffect, useMemo, useState } from 'react'
import InfoSectionBody from './InfoSectionBody'
import { getPhotoCandidates } from '../utils/photoUrl'

function contentToPoints(content) {
  return String(content || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\u00a0/g, ' ').trimEnd())
    .filter((l) => l.trim() !== '')
}

export default function EquipmentDetail({ item, onBack, onEdit }) {
  const photoCandidates = useMemo(() => getPhotoCandidates(item?.photoUrl), [item?.photoUrl])
  const [photoIdx, setPhotoIdx] = useState(0)

  useEffect(() => {
    setPhotoIdx(0)
  }, [item?.photoUrl])

  if (!item) return null

  const photoUrl = photoIdx < photoCandidates.length ? photoCandidates[photoIdx] : ''
  const points = contentToPoints(item.instructions)

  return (
    <div className="equipment-detail">
      <div className="equipment-detail-hero">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={item.name}
            referrerPolicy="no-referrer"
            onError={() =>
              setPhotoIdx((prev) => (prev + 1 <= photoCandidates.length ? prev + 1 : prev))
            }
          />
        ) : (
          <div className="equipment-detail-placeholder">⚙️</div>
        )}
        <div className="equipment-detail-top">
          <button type="button" className="icon-btn" onClick={onBack} aria-label="Назад">
            ←
          </button>
          {onEdit ? (
            <button type="button" className="icon-btn" onClick={() => onEdit(item)}>
              Изменить
            </button>
          ) : null}
        </div>
      </div>

      <h2 className="title">{item.name}</h2>
      {item.nameRu ? <p className="subtitle">{item.nameRu}</p> : null}

      <section className="block">
        <h3>Инструкция</h3>
        {points.length ? (
          <InfoSectionBody sectionId={`eq-${item.id}`} points={points} />
        ) : (
          <p className="muted">Инструкция пока не заполнена.</p>
        )}
      </section>

      <div className="actions">
        {onEdit ? (
          <button type="button" className="btn btn-dark" onClick={() => onEdit(item)}>
            Редактировать
          </button>
        ) : null}
        <button type="button" className="btn btn-outline-black" onClick={onBack}>
          К списку
        </button>
      </div>
    </div>
  )
}
