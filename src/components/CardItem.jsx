import { useEffect, useMemo, useState } from 'react'
import { getCardPhotoUrls, getPhotoCandidates } from '../utils/photoUrl'

function CardItem({ card, onClick }) {
  const primaryUrl = useMemo(() => getCardPhotoUrls(card)[0] || '', [card])
  const photoCandidates = useMemo(() => getPhotoCandidates(primaryUrl), [primaryUrl])
  const [photoIdx, setPhotoIdx] = useState(0)

  useEffect(() => {
    setPhotoIdx(0)
  }, [primaryUrl])

  const hasCandidate = photoIdx < photoCandidates.length
  const photoUrl = hasCandidate ? photoCandidates[photoIdx] : ''

  return (
    <button type="button" className="card-item" onClick={onClick}>
      <div className="thumb">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={card.name}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() =>
              setPhotoIdx((prev) => (prev + 1 <= photoCandidates.length ? prev + 1 : prev))
            }
          />
        ) : (
          <span>🍹</span>
        )}
      </div>
      <div className="card-main">
        <div className="card-title">{card.name}</div>
        <div className="card-subtitle">{card.nameRu}</div>
        <div className="tag-row">
          <span className="tag tag-green">{card.yield}</span>
          <span className="tag tag-pink">{card.time}</span>
          <span className="tag tag-gray">{card.method}</span>
        </div>
      </div>
      <span className="chevron">›</span>
    </button>
  )
}

export default CardItem
