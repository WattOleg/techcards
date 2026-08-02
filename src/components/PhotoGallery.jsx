import { useEffect, useMemo, useRef, useState } from 'react'
import { getPhotoCandidates } from '../utils/photoUrl'

function GallerySlide({ url, alt }) {
  const candidates = useMemo(() => getPhotoCandidates(url), [url])
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    setIdx(0)
  }, [url])

  const src = idx < candidates.length ? candidates[idx] : ''
  if (!src) {
    return <div className="hero-placeholder">🍹</div>
  }

  return (
    <img
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
      <div className="hero photo-gallery">
        <div className="hero-placeholder">🍹</div>
        {topSlot}
      </div>
    )
  }

  if (list.length === 1) {
    return (
      <div className="hero photo-gallery">
        <GallerySlide url={list[0]} alt={alt} />
        {topSlot}
      </div>
    )
  }

  return (
    <div className="hero photo-gallery photo-gallery-multi">
      <div ref={trackRef} className="photo-gallery-track" aria-label="Фотографии">
        {list.map((url, i) => (
          <div key={`${i}-${url}`} className="photo-gallery-slide" aria-hidden={i !== activeIndex}>
            <GallerySlide url={url} alt={`${alt} (${i + 1})`} />
          </div>
        ))}
      </div>
      <div className="photo-gallery-dots" aria-hidden>
        {list.map((_, i) => (
          <span key={i} className={`photo-gallery-dot${i === activeIndex ? ' is-active' : ''}`} />
        ))}
      </div>
      <div className="photo-gallery-count">
        {activeIndex + 1} / {list.length}
      </div>
      {topSlot}
    </div>
  )
}
