import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { GallerySlide } from './PhotoGallery'

const CLOSE_Y = 96

/**
 * Полноэкранное фото ингредиента: свайп вниз закрывает, страница не увеличивается.
 */
export default function IngredientPhotoViewer({ url, title, onClose }) {
  const stageRef = useRef(null)
  const backdropRef = useRef(null)
  const startRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    document.body.classList.add('ing-photo-open')
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.classList.remove('ing-photo-open')
      document.body.style.overflow = prevOverflow
    }
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const applyDrag = (dy) => {
    const y = Math.max(0, dy)
    if (stageRef.current) {
      stageRef.current.style.transition = 'none'
      stageRef.current.style.transform = `translateY(${y}px)`
    }
    if (backdropRef.current) {
      backdropRef.current.style.transition = 'none'
      backdropRef.current.style.opacity = String(Math.max(0.2, 1 - y / 340))
    }
  }

  const snapBack = () => {
    if (stageRef.current) {
      stageRef.current.style.transition = 'transform 0.22s ease'
      stageRef.current.style.transform = 'translateY(0)'
    }
    if (backdropRef.current) {
      backdropRef.current.style.transition = 'opacity 0.22s ease'
      backdropRef.current.style.opacity = '1'
    }
  }

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (e.target.closest('[data-ing-photo-ui]')) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    startRef.current = { x: e.clientX, y: e.clientY }
  }

  const onPointerMove = (e) => {
    const start = startRef.current
    if (!start) return
    const dy = e.clientY - start.y
    const dx = e.clientX - start.x
    if (dy > 0 && Math.abs(dy) >= Math.abs(dx)) applyDrag(dy)
  }

  const onPointerUp = (e) => {
    const start = startRef.current
    startRef.current = null
    if (!start) return
    const dy = e.clientY - start.y
    const dx = e.clientX - start.x
    if (dy > CLOSE_Y && dy > Math.abs(dx)) {
      onCloseRef.current?.()
      return
    }
    snapBack()
  }

  const node = (
    <div
      className="ing-photo-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={title ? `Фото: ${title}` : 'Фото ингредиента'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        startRef.current = null
        snapBack()
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="ing-photo-viewer-backdrop" ref={backdropRef} />
      <div className="ing-photo-viewer-stage" ref={stageRef}>
        <div className="ing-photo-viewer-media">
          <GallerySlide url={url} alt="" className="ing-photo-viewer-blur" />
          <GallerySlide url={url} alt={title || ''} className="ing-photo-viewer-photo" />
        </div>
        {title ? <p className="ing-photo-viewer-caption">{title}</p> : null}
        <button
          type="button"
          className="ing-photo-viewer-close"
          data-ing-photo-ui="true"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onCloseRef.current?.()}
          aria-label="Закрыть"
        >
          ✕
        </button>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
