import { useMemo } from 'react'
import InfoSectionBody from './InfoSectionBody'
import SwipeableCardCarousel from './SwipeableCardCarousel'

function parseCardTitle(line) {
  const t = String(line || '').trim()
  if (!t.startsWith('#') || t.startsWith('##')) return null
  let body = t.slice(1).trim()
  body = body.replace(/^\d+[\.)]\s+/, '').replace(/^\d+\./, '')
  return body || null
}

/** Разбивает points регламента на карточки по `#` и `---`. */
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

/**
 * Страница «Регламенты»: существующий текст → swipe-карусель с peek.
 */
export default function RegulationsSwipe({ points }) {
  const cards = useMemo(() => {
    return splitRegulationCards(points).map((item, i) => ({
      id: `regulations-${i}`,
      title: item.title || `Карточка ${i + 1}`,
      body:
        item.points.length > 0 ? (
          <InfoSectionBody sectionId={`regulations-card-${i}`} points={item.points} />
        ) : null,
    }))
  }, [points])

  if (cards.length === 0) {
    return <p className="muted">Пока нет пунктов регламента.</p>
  }

  return <SwipeableCardCarousel cards={cards} aria-label="Регламенты" />
}
