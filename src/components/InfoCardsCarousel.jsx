import { useMemo } from 'react'
import InfoSectionBody from './InfoSectionBody'
import SwipeableCardCarousel from './SwipeableCardCarousel'
import { splitInfoCards } from '../utils/splitInfoCards'

/**
 * Карусель для info-разделов (регламенты, внешний вид, поведение, права).
 * Текст из сборки дробится на короткие карточки.
 */
export default function InfoCardsCarousel({ sectionId, title, points }) {
  const cards = useMemo(() => {
    return splitInfoCards(points).map((item, i) => ({
      id: `${sectionId}-${i}`,
      title: item.title || (i === 0 && title ? title : `Карточка ${i + 1}`),
      body:
        item.points.length > 0 ? (
          <InfoSectionBody sectionId={`${sectionId}-card-${i}`} points={item.points} />
        ) : null,
    }))
  }, [points, sectionId, title])

  if (cards.length === 0) {
    return <p className="muted">Пока нет пунктов в этом разделе.</p>
  }

  return <SwipeableCardCarousel cards={cards} aria-label={title || sectionId} />
}
