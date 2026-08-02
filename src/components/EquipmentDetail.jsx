import { useEffect, useMemo, useRef, useState } from 'react'
import InfoSectionBody from './InfoSectionBody'
import { getPhotoCandidates } from '../utils/photoUrl'

function contentToPoints(content) {
  return String(content || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\u00a0/g, ' ').trimEnd())
    .filter((l) => l.trim() !== '')
}

const EDGE_ZONE = 28
const COMMIT = 0.28

export default function EquipmentDetail({ item, onBack, onEdit }) {
  const photoCandidates = useMemo(() => getPhotoCandidates(item?.photoUrl), [item?.photoUrl])
  const [photoIdx, setPhotoIdx] = useState(0)
  const rootRef = useRef(null)
  const swipeRef = useRef({ active: false, startX: 0, startY: 0, locked: false })
  const [swipeX, setSwipeX] = useState(0)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    setPhotoIdx(0)
    setSwipeX(0)
    setDragging(false)
  }, [item?.photoUrl, item?.id])

  useEffect(() => {
    const el = rootRef.current
    if (!el || !onBack) return undefined

    const onStart = (e) => {
      const t = e.touches?.[0]
      if (!t) return
      if (t.clientX > EDGE_ZONE) return
      swipeRef.current = {
        active: true,
        startX: t.clientX,
        startY: t.clientY,
        locked: false,
      }
    }

    const onMove = (e) => {
      const state = swipeRef.current
      if (!state.active) return
      const t = e.touches?.[0]
      if (!t) return
      const dx = t.clientX - state.startX
      const dy = t.clientY - state.startY
      if (!state.locked) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
        if (Math.abs(dy) > Math.abs(dx) * 1.15 || dx < 0) {
          state.active = false
          setDragging(false)
          setSwipeX(0)
          return
        }
        state.locked = true
        setDragging(true)
      }
      if (e.cancelable) e.preventDefault()
      const width = window.innerWidth || 390
      setSwipeX(Math.max(0, Math.min(dx, width)))
    }

    const onEnd = (e) => {
      const state = swipeRef.current
      if (!state.active) return
      const t = e.changedTouches?.[0]
      const clientX = t ? t.clientX : state.startX
      const dx = state.locked ? Math.max(0, clientX - state.startX) : 0
      const width = window.innerWidth || 390
      state.active = false
      state.locked = false
      setDragging(false)
      if (dx / width >= COMMIT) {
        setSwipeX(0)
        onBack()
      } else {
        setSwipeX(0)
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [onBack])

  if (!item) return null

  const photoUrl = photoIdx < photoCandidates.length ? photoCandidates[photoIdx] : ''
  const points = contentToPoints(item.instructions)

  return (
    <div
      className="equipment-detail"
      ref={rootRef}
      style={
        swipeX > 0
          ? {
              transform: `translateX(${swipeX}px)`,
              transition: dragging ? 'none' : 'transform 180ms ease-out',
            }
          : undefined
      }
    >
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
