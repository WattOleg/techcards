import { useEffect, useState } from 'react'

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

function PostCard({ post, onEdit }) {
  return (
    <article className="updates-post">
      <div className="updates-post-head">
        <h4>{post.title}</h4>
        {onEdit ? (
          <button type="button" className="ghost-btn btn-compact" onClick={() => onEdit(post)}>
            Изменить
          </button>
        ) : null}
      </div>
      {post.content ? <p className="updates-post-body">{post.content}</p> : null}
      {post.imageUrls?.length ? (
        <div className="updates-post-photos">
          {post.imageUrls.map((url) => (
            <img key={url} src={url} alt="" loading="lazy" referrerPolicy="no-referrer" />
          ))}
        </div>
      ) : null}
      <p className="muted small">{formatRuDate(post.updatedAt || post.createdAt)}</p>
    </article>
  )
}

/**
 * Экран «Актуальное»: изменения / новости / актуальное / комментарии смены.
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

  useEffect(() => {
    setLocalError('')
  }, [error])

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

      <section className="updates-block">
        <h3>Изменения за 7 дней</h3>
        <p className="muted small">Автоматически: регламенты, оборудование, чек-листы</p>
        {recentChanges.length === 0 ? (
          <p className="muted">За последние 7 дней изменений нет.</p>
        ) : (
          <ul className="updates-changes">
            {recentChanges.map((item) => (
              <li key={item.id}>
                <span className="updates-change-label">{item.label}</span>
                <strong>{item.title}</strong>
                <span className="muted small">{formatRuDate(item.updatedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="updates-block">
        <div className="updates-block-head">
          <h3>Новости</h3>
          <button type="button" className="btn btn-dark btn-compact" onClick={onRequestAddNews}>
            + Новость
          </button>
        </div>
        {news.length === 0 ? <p className="muted">Пока нет новостей.</p> : null}
        <div className="updates-posts">
          {news.map((post) => (
            <PostCard key={post.id} post={post} onEdit={onRequestEditNews} />
          ))}
        </div>
      </section>

      <section className="updates-block">
        <div className="updates-block-head">
          <h3>Актуальное</h3>
          <button type="button" className="btn btn-dark btn-compact" onClick={onRequestAddCurrent}>
            + Запись
          </button>
        </div>
        {current.length === 0 ? <p className="muted">Пока пусто.</p> : null}
        <div className="updates-posts">
          {current.map((post) => (
            <PostCard key={post.id} post={post} onEdit={onRequestEditCurrent} />
          ))}
        </div>
      </section>

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
    </div>
  )
}
