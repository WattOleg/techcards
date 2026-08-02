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

/**
 * Instagram-like viewer (портал на body — поверх шапки и таббара).
 */
function StoriesViewer({ items, startIndex = 0, onClose, onEdit }) {
  const [index, setIndex] = useState(startIndex)
  const [progress, setProgress] = useState(0)
  const timerRef = useRef(null)
  const touchX = useRef(null)
  const touchY = useRef(null)
  const item = items[index]
  const durationMs = 4500

  useEffect(() => {
    setIndex(Math.max(0, Math.min(startIndex, items.length - 1)))
  }, [startIndex, items.length])

  useEffect(() => {
    document.body.classList.add('stories-open')
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.classList.remove('stories-open')
      document.body.style.overflow = prevOverflow
    }
  }, [])

  useEffect(() => {
    setProgress(0)
    if (!item) return undefined
    const started = performance.now()
    const tick = (now) => {
      const p = Math.min(1, (now - started) / durationMs)
      setProgress(p)
      if (p >= 1) {
        if (index < items.length - 1) setIndex((i) => i + 1)
        else onClose?.()
        return
      }
      timerRef.current = requestAnimationFrame(tick)
    }
    timerRef.current = requestAnimationFrame(tick)
    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current)
    }
  }, [index, item, items.length, onClose])

  if (!item) return null

  const goPrev = () => {
    if (index <= 0) onClose?.()
    else setIndex((i) => i - 1)
  }
  const goNext = () => {
    if (index >= items.length - 1) onClose?.()
    else setIndex((i) => i + 1)
  }

  const imageUrl = item.imageUrl || item.imageUrls?.[0] || null
  const bodyText = item.content || item.snippet || ''

  const node = (
    <div
      className="stories-viewer"
      role="dialog"
      aria-modal="true"
      aria-label="Сторис"
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null
        touchY.current = e.touches[0]?.clientY ?? null
      }}
      onTouchEnd={(e) => {
        const startX = touchX.current
        const startY = touchY.current
        touchX.current = null
        touchY.current = null
        if (startX == null || startY == null) return
        const endX = e.changedTouches[0]?.clientX ?? startX
        const endY = e.changedTouches[0]?.clientY ?? startY
        const dx = endX - startX
        const dy = endY - startY
        if (dy > 80 && Math.abs(dy) > Math.abs(dx) * 1.2) {
          onClose?.()
          return
        }
        if (Math.abs(dx) < 48) return
        if (dx > 0) goPrev()
        else goNext()
      }}
    >
      <div className="stories-viewer-chrome">
        <div className="stories-viewer-bars">
          {items.map((it, i) => (
            <div key={it.id} className="stories-viewer-bar">
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
                onClick={() => {
                  onClose?.()
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
        onClick={onClose}
        aria-label="Закрыть"
      >
        ✕
      </button>

      <div className="stories-viewer-body">
        {imageUrl ? (
          <img src={imageUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <div className={`stories-viewer-fallback ${kindTone(item.kind)}`}>
            <span>{initialLetter(item.title)}</span>
          </div>
        )}
        <div className="stories-viewer-caption">
          {item.label || item.subtitle ? (
            <p className="stories-viewer-caption-label">{item.label || item.subtitle}</p>
          ) : null}
          <h2 className="stories-viewer-caption-title">{item.title}</h2>
          {bodyText ? <p className="stories-viewer-text">{bodyText}</p> : null}
          <p className="stories-viewer-caption-date">{formatRuDate(item.updatedAt || item.createdAt)}</p>
        </div>
      </div>

      <button type="button" className="stories-viewer-hit left" aria-label="Назад" onClick={goPrev} />
      <button type="button" className="stories-viewer-hit right" aria-label="Далее" onClick={goNext} />
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
            placeholder="Ваше имя"
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
