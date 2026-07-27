import { useEffect, useRef, useState } from 'react'
import InfoSectionBody from './InfoSectionBody'

function parseCardTitle(line) {
  const t = String(line || '').trim()
  if (!t.startsWith('#') || t.startsWith('##')) return null
  let body = t.slice(1).trim()
  body = body.replace(/^\d+[\.)]\s+/, '').replace(/^\d+\./, '')
  return body || null
}

/** Разбивает points на карточки по заголовкам `#` и разделителям `---`. */
export function splitRegulationCards(points) {
  const lines = Array.isArray(points) ? points : []
  const cards = []
  let current = null

  const pushCurrent = () => {
    if (!current) return
    if (!current.title && current.points.length === 0) return
    cards.push(current)
    current = null
  }

  for (const raw of lines) {
    const t = String(raw || '').trim()

    if (t === '---' || t === '***') {
      pushCurrent()
      continue
    }

    const title = parseCardTitle(t)
    if (title) {
      pushCurrent()
      current = { title, points: [] }
      continue
    }

    if (!current) current = { title: '', points: [] }
    current.points.push(raw)
  }

  pushCurrent()
  return cards
}

export default function RegulationsSwipe({ points }) {
  const trackRef = useRef(null)
  const [index, setIndex] = useState(0)
  const cards = splitRegulationCards(points)

  useEffect(() => {
    setIndex(0)
    const el = trackRef.current
    if (el) el.scrollTo({ left: 0 })
  }, [points])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return

    const updateIndex = () => {
      const w = el.clientWidth
      if (w <= 0) return
      const next = Math.round(el.scrollLeft / w)
      setIndex(Math.max(0, Math.min(cards.length - 1, next)))
    }

    el.addEventListener('scroll', updateIndex, { passive: true })
    updateIndex()
    return () => el.removeEventListener('scroll', updateIndex)
  }, [cards.length])

  if (cards.length === 0) {
    return <p className="muted">Пока нет пунктов регламента.</p>
  }

  const goTo = (i) => {
    const el = trackRef.current
    if (!el) return
    const clamped = Math.max(0, Math.min(cards.length - 1, i))
    el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' })
    setIndex(clamped)
  }

  return (
    <div className="reg-swipe">
      <div
        className="reg-swipe-track"
        ref={trackRef}
        role="region"
        aria-roledescription="carousel"
        aria-label="Регламенты"
      >
        {cards.map((card, i) => (
          <article
            key={`reg-card-${i}`}
            className="reg-swipe-card"
            aria-roledescription="slide"
            aria-label={`${i + 1} из ${cards.length}${card.title ? `: ${card.title}` : ''}`}
            aria-hidden={i !== index}
          >
            <div className="reg-swipe-card-top">
              <span className="reg-swipe-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="reg-swipe-of">
                {i + 1} / {cards.length}
              </span>
            </div>
            {card.title ? <h4 className="reg-swipe-title">{card.title}</h4> : null}
            {card.points.length > 0 ? (
              <InfoSectionBody sectionId={`regulations-card-${i}`} points={card.points} />
            ) : null}
          </article>
        ))}
      </div>

      {cards.length > 1 ? (
        <div className="reg-swipe-nav" aria-hidden={false}>
          <button
            type="button"
            className="reg-swipe-arrow"
            onClick={() => goTo(index - 1)}
            disabled={index <= 0}
            aria-label="Предыдущая карточка"
          >
            ‹
          </button>
          <div className="reg-swipe-dots" role="tablist" aria-label="Карточки регламента">
            {cards.map((card, i) => (
              <button
                key={`reg-dot-${i}`}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={card.title || `Карточка ${i + 1}`}
                className={`reg-swipe-dot${i === index ? ' is-active' : ''}`}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
          <button
            type="button"
            className="reg-swipe-arrow"
            onClick={() => goTo(index + 1)}
            disabled={index >= cards.length - 1}
            aria-label="Следующая карточка"
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  )
}
