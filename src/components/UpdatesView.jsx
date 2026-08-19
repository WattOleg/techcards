import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

function formatRuDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(iso)
  }
}

function formatShortDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  } catch {
    return ''
  }
}

function initialLetter(title) {
  const t = String(title || '').trim()
  return t ? t[0].toUpperCase() : '•'
}

function kindTone(kind) {
  if (kind === 'equipment') return 'tone-equip'
  if (kind === 'checklist') return 'tone-check'
  if (kind === 'news') return 'tone-news'
  if (kind === 'current') return 'tone-current'
  if (kind === 'techcard') return 'tone-tech'
  return 'tone-reg'
}

const HOLD_DELAY_MS = 180
const MOVE_CANCEL_PX = 12
const SWIPE_X_PX = 56
const SWIPE_Y_PX = 80

function storyImageUrls(item) {
  if (Array.isArray(item?.imageUrls) && item.imageUrls.length) {
    return item.imageUrls.filter(Boolean)
  }
  return item?.imageUrl ? [item.imageUrl] : []
}

function flattenStorySlides(items) {
  const slides = []
  for (const it of items || []) {
    const urls = storyImageUrls(it)
    if (!urls.length) {
      slides.push({ item: it, imageUrl: null, key: `${it.id}-0` })
    } else {
      urls.forEach((url, i) => {
        slides.push({ item: it, imageUrl: url, key: `${it.id}-${i}` })
      })
    }
  }
  return slides
}

function firstSlideOfItem(items, itemIndex) {
  let n = 0
  const limit = Math.max(0, Math.min(itemIndex, (items || []).length))
  for (let i = 0; i < limit; i += 1) {
    n += storyImageUrls(items[i]).length || 1
  }
  return n
}

function storyDurationMs(item) {
  const text = String(item?.content || item?.snippet || '')
  return Math.min(12000, 5000 + Math.min(text.length, 200) * 30)
}

/**
 * Instagram-like viewer (портал на body — поверх шапки и таббара).
 * Полноэкранное фото, пауза по удержанию, свайп вниз — закрыть.
 */
function StoriesViewer({ items, startIndex = 0, onClose, onEdit }) {
  const slides = useMemo(() => flattenStorySlides(items), [items])
  const [index, setIndex] = useState(() => firstSlideOfItem(items, startIndex))
  const [progress, setProgress] = useState(0)
  const [holding, setHolding] = useState(false)

  const timerRef = useRef(0)
  const elapsedRef = useRef(0)
  const lastTsRef = useRef(0)
  const pausedRef = useRef(false)
  const holdingRef = useRef(false)
  const holdTimerRef = useRef(null)
  const pointerRef = useRef(null)
  const didHoldRef = useRef(false)
  const onCloseRef = useRef(onClose)
  const slidesLenRef = useRef(slides.length)

  onCloseRef.current = onClose
  slidesLenRef.current = slides.length

  const slide = slides[index]
  const item = slide?.item

  useEffect(() => {
    const next = firstSlideOfItem(items, startIndex)
    setIndex(Math.max(0, Math.min(next, Math.max(0, slides.length - 1))))
  }, [startIndex, items, slides.length])

  useEffect(() => {
    document.body.classList.add('stories-open')
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.classList.remove('stories-open')
      document.body.style.overflow = prevOverflow
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current)
        holdTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        pausedRef.current = true
        return
      }
      if (!holdingRef.current) {
        pausedRef.current = false
        lastTsRef.current = performance.now()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    setProgress(0)
    elapsedRef.current = 0
    lastTsRef.current = performance.now()
    if (!item) return undefined
    const durationMs = storyDurationMs(item)
    const tick = (now) => {
      if (!pausedRef.current) {
        elapsedRef.current += now - lastTsRef.current
      }
      lastTsRef.current = now
      const p = Math.min(1, elapsedRef.current / durationMs)
      setProgress(p)
      if (p >= 1) {
        if (index < slidesLenRef.current - 1) setIndex((i) => i + 1)
        else onCloseRef.current?.()
        return
      }
      timerRef.current = requestAnimationFrame(tick)
    }
    timerRef.current = requestAnimationFrame(tick)
    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current)
    }
  }, [index, item])

  const goPrev = () => {
    if (index <= 0) onCloseRef.current?.()
    else setIndex((i) => i - 1)
  }
  const goNext = () => {
    if (index >= slides.length - 1) onCloseRef.current?.()
    else setIndex((i) => i + 1)
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.()
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setIndex((i) => {
          if (i <= 0) {
            onCloseRef.current?.()
            return i
          }
          return i - 1
        })
      }
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        setIndex((i) => {
          if (i >= slidesLenRef.current - 1) {
            onCloseRef.current?.()
            return i
          }
          return i + 1
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }

  const setPaused = (value) => {
    pausedRef.current = value
    holdingRef.current = value
    setHolding(value)
    if (!value) lastTsRef.current = performance.now()
  }

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (e.target.closest('[data-stories-ui]')) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    pointerRef.current = { x: e.clientX, y: e.clientY }
    didHoldRef.current = false
    clearHoldTimer()
    holdTimerRef.current = setTimeout(() => {
      didHoldRef.current = true
      setPaused(true)
    }, HOLD_DELAY_MS)
  }

  const onPointerMove = (e) => {
    const start = pointerRef.current
    if (!start || didHoldRef.current) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) clearHoldTimer()
  }

  const onPointerUp = (e) => {
    clearHoldTimer()
    const start = pointerRef.current
    pointerRef.current = null
    const wasHold = didHoldRef.current
    if (holdingRef.current || pausedRef.current) setPaused(false)
    if (!start || wasHold) return
    if (e.target.closest('[data-stories-ui]')) return

    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (dy > SWIPE_Y_PX && Math.abs(dy) > Math.abs(dx) * 1.15) {
      onCloseRef.current?.()
      return
    }
    if (Math.abs(dx) >= SWIPE_X_PX && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) goPrev()
      else goNext()
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    if (x < rect.width * 0.33) goPrev()
    else goNext()
  }

  const onPointerCancel = () => {
    clearHoldTimer()
    pointerRef.current = null
    if (pausedRef.current) setPaused(false)
  }

  if (!item || !slide) return null

  const imageUrl = slide.imageUrl
  const bodyText = item.content || item.snippet || ''

  const node = (
    <div
      className={`stories-viewer ${holding ? 'is-holding' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Сторис"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCloseRef.current?.()
      }}
    >
      <div
        className="stories-viewer-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="stories-viewer-media">
          {imageUrl ? (
            <img
              className="stories-viewer-media-photo"
              src={imageUrl}
              alt=""
              draggable={false}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className={`stories-viewer-fallback ${kindTone(item.kind)}`}>
              <span>{initialLetter(item.title)}</span>
            </div>
          )}
        </div>

        <div className="stories-viewer-chrome">
          <div className="stories-viewer-bars">
            {slides.map((s, i) => (
              <div key={s.key} className="stories-viewer-bar">
                <div
                  className="stories-viewer-bar-fill"
                  style={{
                    width: i < index ? '100%' : i === index ? `${progress * 100}%` : '0%',
                  }}
                />
              </div>
            ))}
          </div>
          <div className="stories-viewer-top">
            <div className="stories-viewer-meta">
              <span className="stories-viewer-label">{item.label || item.subtitle || ''}</span>
              <strong>{item.title}</strong>
              <span className="stories-viewer-date">{formatRuDate(item.updatedAt || item.createdAt)}</span>
            </div>
            <div className="stories-viewer-actions">
              {onEdit && item.rawPost ? (
                <button
                  type="button"
                  className="stories-viewer-edit"
                  data-stories-ui="true"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    onCloseRef.current?.()
                    onEdit(item.rawPost)
                  }}
                >
                  Изменить
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="stories-viewer-close"
          data-stories-ui="true"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onCloseRef.current?.()}
          aria-label="Закрыть"
        >
          ✕
        </button>

        <div className="stories-viewer-caption">
          {item.label || item.subtitle ? (
            <p className="stories-viewer-caption-label">{item.label || item.subtitle}</p>
          ) : null}
          <h2 className="stories-viewer-caption-title">{item.title}</h2>
          {bodyText ? (
            <p
              className="stories-viewer-text"
              data-stories-ui="true"
              onPointerDown={(e) => {
                e.stopPropagation()
                didHoldRef.current = true
                setPaused(true)
              }}
              onPointerUp={(e) => {
                e.stopPropagation()
                setPaused(false)
              }}
              onPointerCancel={(e) => {
                e.stopPropagation()
                setPaused(false)
              }}
            >
              {bodyText}
            </p>
          ) : null}
          <p className="stories-viewer-caption-date">{formatRuDate(item.updatedAt || item.createdAt)}</p>
        </div>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}

function StoriesRail({ title, hint, items, emptyText, onOpen, action }) {
  return (
    <section className="updates-block updates-stories-block">
      <div className="updates-block-head">
        <div>
          <h3>{title}</h3>
          {hint ? <p className="muted small updates-block-hint">{hint}</p> : null}
        </div>
        {action || null}
      </div>
      {items.length === 0 ? (
        <p className="muted">{emptyText}</p>
      ) : (
        <div className="stories-rail" role="list">
          {items.map((item, index) => {
            const img = item.imageUrl || item.imageUrls?.[0]
            return (
              <button
                key={item.id}
                type="button"
                className="stories-bubble"
                role="listitem"
                onClick={() => onOpen(index)}
              >
                <span className={`stories-ring ${kindTone(item.kind)}`}>
                  <span className="stories-ring-inner">
                    {img ? (
                      <img src={img} alt="" loading="lazy" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="stories-avatar-letter">{initialLetter(item.title)}</span>
                    )}
                  </span>
                </span>
                <span className="stories-bubble-title">{item.title}</span>
                <span className="stories-bubble-date">{formatShortDate(item.updatedAt || item.createdAt)}</span>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

/**
 * Экран «Актуальное»: сторис изменений / новости / актуальное / комментарии смены.
 */
export default function UpdatesView({
  recentChanges = [],
  news = [],
  current = [],
  comments = [],
  loading,
  error,
  techcardsWarning,
  onReload,
  onRequestAddNews,
  onRequestEditNews,
  onRequestAddCurrent,
  onRequestEditCurrent,
  onAddComment,
  onDeleteComment,
  commentSaving,
}) {
  const [authorName, setAuthorName] = useState('')
  const [commentText, setCommentText] = useState('')
  const [localError, setLocalError] = useState('')
  const [viewer, setViewer] = useState(null)

  useEffect(() => {
    setLocalError('')
  }, [error])

  const changeStories = useMemo(
    () =>
      recentChanges.map((item) => ({
        ...item,
        subtitle: item.label,
      })),
    [recentChanges],
  )

  const newsStories = useMemo(
    () =>
      news.map((post) => ({
        id: post.id,
        kind: 'news',
        title: post.title,
        content: post.content,
        imageUrls: post.imageUrls,
        updatedAt: post.updatedAt,
        createdAt: post.createdAt,
        label: 'Новости',
        rawPost: post,
      })),
    [news],
  )

  const currentStories = useMemo(
    () =>
      current.map((post) => ({
        id: post.id,
        kind: 'current',
        title: post.title,
        content: post.content,
        imageUrls: post.imageUrls,
        updatedAt: post.updatedAt,
        createdAt: post.createdAt,
        label: 'Актуальное',
        rawPost: post,
      })),
    [current],
  )

  const submitComment = async (e) => {
    e.preventDefault()
    setLocalError('')
    try {
      await onAddComment?.({ authorName, commentText })
      setCommentText('')
    } catch (err) {
      setLocalError(err.message || 'Не удалось добавить')
    }
  }

  return (
    <div className="updates-view">
      <div className="updates-toolbar">
        <button type="button" className="ghost-btn" onClick={onReload} disabled={loading}>
          {loading ? 'Обновляю…' : 'Обновить'}
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {techcardsWarning ? <p className="error updates-techcards-warning">{techcardsWarning}</p> : null}

      <StoriesRail
        title="Изменения"
        hint="За 7 дней · техкарты, регламенты, чек-листы"
        items={changeStories}
        emptyText="За последние 7 дней изменений нет."
        onOpen={(index) => setViewer({ items: changeStories, startIndex: index, onEdit: null })}
      />

      <StoriesRail
        title="Новости"
        hint="Нажмите на кружок — откроется сторис"
        items={newsStories}
        emptyText="Пока нет новостей."
        onOpen={(index) =>
          setViewer({ items: newsStories, startIndex: index, onEdit: onRequestEditNews })
        }
        action={
          <button type="button" className="btn btn-dark btn-compact" onClick={onRequestAddNews}>
            + Новость
          </button>
        }
      />

      <StoriesRail
        title="Актуальное"
        hint="Свежие слева, старые правее"
        items={currentStories}
        emptyText="Пока пусто."
        onOpen={(index) =>
          setViewer({ items: currentStories, startIndex: index, onEdit: onRequestEditCurrent })
        }
        action={
          <button type="button" className="btn btn-dark btn-compact" onClick={onRequestAddCurrent}>
            + Запись
          </button>
        }
      />

      <section className="updates-block">
        <h3>Комментарии к смене</h3>
        <p className="muted small">Добавить может любой сотрудник без PIN</p>
        <form className="updates-comment-form" onSubmit={submitComment}>
          <input
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Заголовок"
          />
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Комментарий к смене…"
            rows={3}
          />
          <button
            type="submit"
            className="btn btn-dark"
            disabled={commentSaving || !commentText.trim()}
          >
            {commentSaving ? 'Отправляю…' : 'Отправить'}
          </button>
        </form>
        {localError ? <p className="error">{localError}</p> : null}
        <ul className="updates-comments">
          {comments.map((c) => (
            <li key={c.id} className="updates-comment">
              <div className="updates-comment-main">
                <strong>{c.authorName}</strong>
                <span className="muted small">{formatRuDate(c.createdAt)}</span>
                <p>{c.commentText}</p>
              </div>
              <button
                type="button"
                className="updates-comment-delete"
                aria-label="Удалить комментарий"
                onClick={() => onDeleteComment?.(c.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </section>

      {viewer ? (
        <StoriesViewer
          items={viewer.items}
          startIndex={viewer.startIndex}
          onClose={() => setViewer(null)}
          onEdit={viewer.onEdit}
        />
      ) : null}
    </div>
  )
}
