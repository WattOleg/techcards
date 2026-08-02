import { useCallback, useEffect, useRef, useState } from 'react'
import Card from './Card'

/**
 * Карусель: сначала видна только первая карточка;
 * тап → режим листания (свайп влево/вправо, по одной карточке).
 */
export default function SwipeableCardCarousel({
  cards = [],
  className = '',
  'aria-label': ariaLabel = 'Карточки',
  onEditCard,
}) {
  const trackRef = useRef(null)
  const slideRefs = useRef([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [browsing, setBrowsing] = useState(false)
  const list = Array.isArray(cards) ? cards : []
  const cardsKey = list.map((c) => String(c?.id ?? '')).join('|')

  const scrollToIndex = useCallback((nextIndex, behavior = 'smooth') => {
    const track = trackRef.current
    const slide = slideRefs.current[nextIndex]
    if (!track || !slide) return
    const left = slide.offsetLeft
    track.scrollTo({ left: Math.max(0, left), behavior })
    setActiveIndex(nextIndex)
  }, [])

  useEffect(() => {
    setActiveIndex(0)
    setBrowsing(false)
    const track = trackRef.current
    if (track) track.scrollTo({ left: 0 })
    slideRefs.current = slideRefs.current.slice(0, list.length)
  }, [cardsKey, list.length])

  useEffect(() => {
    if (!browsing) return undefined
    const track = trackRef.current
    if (!track || list.length === 0) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        let best = null
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          if (!best || entry.intersectionRatio > best.intersectionRatio) best = entry
        }
        if (!best) return
        const idx = Number(best.target.getAttribute('data-index'))
        if (Number.isFinite(idx)) setActiveIndex(idx)
      },
      { root: track, threshold: [0.55, 0.7, 0.85] },
    )

    slideRefs.current.forEach((el) => {
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [browsing, cardsKey, list.length])

  useEffect(() => {
    if (!browsing) return undefined
    const track = trackRef.current
    if (!track) return undefined

    let startX = 0
    let startY = 0
    let locked = null

    const onStart = (e) => {
      const t = e.touches?.[0]
      if (!t) return
      startX = t.clientX
      startY = t.clientY
      locked = null
    }

    const onMove = (e) => {
      const t = e.touches?.[0]
      if (!t) return
      const dx = t.clientX - startX
      const dy = t.clientY - startY
      if (locked == null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      }
      if (locked === 'x' && e.cancelable) e.preventDefault()
    }

    track.addEventListener('touchstart', onStart, { passive: true })
    track.addEventListener('touchmove', onMove, { passive: false })
    return () => {
      track.removeEventListener('touchstart', onStart)
      track.removeEventListener('touchmove', onMove)
    }
  }, [browsing, cardsKey])

  if (list.length === 0) {
    return <p className="muted">Нет карточек.</p>
  }

  const first = list[0]

  if (!browsing) {
    return (
      <div className={`scc scc-preview${className ? ` ${className}` : ''}`}>
        <button
          type="button"
          className="scc-preview-hit"
          onClick={() => setBrowsing(true)}
          aria-label={
            list.length > 1
              ? `${first.title || 'Карточка 1'}. Нажмите, чтобы листать карточки`
              : first.title || 'Карточка 1'
          }
        >
          <Card card={first} index={0} total={list.length} active />
        </button>
        {list.length > 1 ? (
          <p className="scc-preview-hint muted">Нажмите на карточку, чтобы листать ← →</p>
        ) : null}
        {onEditCard ? (
          <button
            type="button"
            className="scc-card-edit scc-preview-edit"
            onClick={() => onEditCard(first)}
          >
            Редактировать
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className={`scc scc-browsing${className ? ` ${className}` : ''}`}>
      <div className="scc-browse-bar">
        <button type="button" className="ghost-btn scc-browse-back" onClick={() => setBrowsing(false)}>
          ← Свернуть
        </button>
        <span className="scc-browse-count">
          {activeIndex + 1} / {list.length}
        </span>
      </div>

      <div
        ref={trackRef}
        className="scc-track"
        role="region"
        aria-roledescription="carousel"
        aria-label={ariaLabel}
      >
        {list.map((card, i) => (
          <div
            key={card.id ?? i}
            className="scc-slide"
            data-index={i}
            ref={(el) => {
              slideRefs.current[i] = el
            }}
            aria-hidden={i !== activeIndex}
          >
            <Card
              card={card}
              index={i}
              total={list.length}
              active={i === activeIndex}
              onEdit={onEditCard ? () => onEditCard(card) : undefined}
            />
          </div>
        ))}
      </div>

      {list.length > 1 ? (
        <div className="scc-nav">
          <button
            type="button"
            className="scc-arrow"
            onClick={() => scrollToIndex(Math.max(0, activeIndex - 1))}
            disabled={activeIndex <= 0}
            aria-label="Предыдущая карточка"
          >
            ‹
          </button>
          <div className="scc-dots" role="tablist" aria-label="Индикаторы карточек">
            {list.map((card, i) => (
              <button
                key={`dot-${card.id ?? i}`}
                type="button"
                role="tab"
                aria-selected={i === activeIndex}
                aria-label={card.title || `Карточка ${i + 1}`}
                className={`scc-dot${i === activeIndex ? ' is-active' : ''}`}
                onClick={() => scrollToIndex(i)}
              />
            ))}
          </div>
          <button
            type="button"
            className="scc-arrow"
            onClick={() => scrollToIndex(Math.min(list.length - 1, activeIndex + 1))}
            disabled={activeIndex >= list.length - 1}
            aria-label="Следующая карточка"
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  )
}
