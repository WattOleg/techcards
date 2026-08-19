import { useEffect, useMemo, useRef, useState } from 'react'
import { getPhotoCandidates } from '../utils/photoUrl'

export function GallerySlide({ url, alt, className }) {
  const candidates = useMemo(() => getPhotoCandidates(url), [url])
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    setIdx(0)
  }, [url])

  const src = idx < candidates.length ? candidates[idx] : ''
  if (!src) {
    return <div className={className ? `hero-placeholder ${className}` : 'hero-placeholder'}>🍹</div>
  }

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() => setIdx((prev) => (prev + 1 <= candidates.length ? prev + 1 : prev))}
    />
  )
}

/**
 * Свайп-галерея фото карточки. Один URL — как раньше; несколько — листание.
 */
export default function PhotoGallery({ urls = [], alt = '', topSlot = null }) {
  const trackRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const list = Array.isArray(urls) ? urls.filter(Boolean) : []
  const key = list.join('|')
  const multi = list.length > 1

  useEffect(() => {
    setActiveIndex(0)
    const el = trackRef.current
    if (el) el.scrollTo({ left: 0 })
  }, [key])

  useEffect(() => {
    const track = trackRef.current
    if (!track || list.length <= 1) return undefined

    const onScroll = () => {
      const w = track.clientWidth || 1
      const next = Math.round(track.scrollLeft / w)
      setActiveIndex(Math.max(0, Math.min(list.length - 1, next)))
    }
    track.addEventListener('scroll', onScroll, { passive: true })
    return () => track.removeEventListener('scroll', onScroll)
  }, [key, list.length])

  if (list.length === 0) {
    return (
      <div className="photo-gallery-wrap">
        <div className="hero photo-gallery">
          <div className="hero-placeholder">🍹</div>
          {topSlot}
        </div>
      </div>
    )
  }

  if (!multi) {
    return (
      <div className="photo-gallery-wrap">
        <div className="hero photo-gallery">
          <GallerySlide url={list[0]} alt={alt} />
          {topSlot}
        </div>
      </div>
    )
  }

  return (
    <div className="photo-gallery-wrap photo-gallery-wrap-multi">
      <div className="hero photo-gallery photo-gallery-multi">
        <div ref={trackRef} className="photo-gallery-track" aria-label="Фотографии">
          {list.map((url, i) => (
            <div key={`${i}-${url}`} className="photo-gallery-slide" aria-hidden={i !== activeIndex}>
              <GallerySlide url={url} alt={`${alt} (${i + 1})`} />
            </div>
          ))}
        </div>
        {topSlot}
      </div>
      <div className="photo-gallery-indicators" aria-label={`Фото ${activeIndex + 1} из ${list.length}`}>
        <div className="photo-gallery-dots" aria-hidden>
          {list.map((_, i) => (
            <span key={i} className={`photo-gallery-dot${i === activeIndex ? ' is-active' : ''}`} />
          ))}
        </div>
        <span className="photo-gallery-count">
          {activeIndex + 1}/{list.length}
        </span>
      </div>
    </div>
  )
}
