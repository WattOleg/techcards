import { useCallback, useEffect, useRef, useState } from 'react'
import Card from './Card'

/**
 * Карусель: на экране одна карточка, свайп влево/вправо (CSS scroll-snap).
 * Без preventDefault — вертикальный скролл страницы не ломается.
 */
export default function SwipeableCardCarousel({
  cards = [],
  className = '',
  'aria-label': ariaLabel = 'Карточки',
  onEditCard,
  initialCardId,
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
    track.scrollTo({ left: slide.offsetLeft, behavior })
    setActiveIndex(nextIndex)
  }, [])

  useEffect(() => {
    const focusIdx = initialCardId
      ? list.findIndex((c) => String(c?.id) === String(initialCardId))
      : -1
    const startIdx = focusIdx >= 0 ? focusIdx : 0
    setActiveIndex(startIdx)
    slideRefs.current = slideRefs.current.slice(0, list.length)
    const timer = window.setTimeout(() => {
      scrollToIndex(startIdx, 'auto')
    }, 40)
    return () => window.clearTimeout(timer)
  }, [cardsKey, list, initialCardId, scrollToIndex])

  useEffect(() => {
    const track = trackRef.current
    if (!track || list.length === 0) return undefined

    const onScroll = () => {
      const w = track.clientWidth || 1
      const next = Math.round(track.scrollLeft / w)
      setActiveIndex(Math.max(0, Math.min(list.length - 1, next)))
    }

    track.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => track.removeEventListener('scroll', onScroll)
  }, [cardsKey, list.length])

  if (list.length === 0) {
    return <p className="muted">Нет карточек.</p>
  }

  return (
    <div className={`scc${className ? ` ${className}` : ''}`}>
      {list.length > 1 ? (
        <p className="scc-hint muted">Листайте карточку влево или вправо</p>
      ) : null}

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
