import { useCallback, useEffect, useRef, useState } from 'react'
import Card from './Card'

/**
 * Переиспользуемая карусель с peek-эффектом и CSS scroll-snap.
 * Горизонтальный скролл — нативный (touch на мобиле), не mouse-drag polyfill.
 *
 * @param {{
 *   cards: Array<{ id: string|number, title: string, body?: import('react').ReactNode, imageUrl?: string }>,
 *   className?: string,
 *   'aria-label'?: string,
 * }} props
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
  const list = Array.isArray(cards) ? cards : []
  const cardsKey = list.map((c) => String(c?.id ?? '')).join('|')

  const scrollToIndex = useCallback((nextIndex, behavior = 'smooth') => {
    const track = trackRef.current
    const slide = slideRefs.current[nextIndex]
    if (!track || !slide) return
    const trackRect = track.getBoundingClientRect()
    const slideRect = slide.getBoundingClientRect()
    const left =
      track.scrollLeft + (slideRect.left - trackRect.left) - (trackRect.width - slideRect.width) / 2
    track.scrollTo({ left: Math.max(0, left), behavior })
    setActiveIndex(nextIndex)
  }, [])

  useEffect(() => {
    setActiveIndex(0)
    const track = trackRef.current
    if (track) track.scrollTo({ left: 0 })
    slideRefs.current = slideRefs.current.slice(0, list.length)
  }, [cardsKey, list.length])

  useEffect(() => {
    const track = trackRef.current
    if (!track || list.length === 0) return

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
      {
        root: track,
        threshold: [0.45, 0.6, 0.75],
      },
    )

    slideRefs.current.forEach((el) => {
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [cardsKey, list.length])

  // iOS: не даём родительскому вертикальному скроллу перехватить горизонтальный жест
  useEffect(() => {
    const track = trackRef.current
    if (!track) return

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
  }, [cardsKey])

  if (list.length === 0) {
    return <p className="muted">Нет карточек.</p>
  }

  return (
    <div className={`scc${className ? ` ${className}` : ''}`}>
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
            className="scc-arrow scc-arrow-desktop"
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
            className="scc-arrow scc-arrow-desktop"
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
