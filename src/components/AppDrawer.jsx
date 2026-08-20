import { useEffect, useId, useRef, useState } from 'react'
import { DRAWER_ITEMS } from '../constants/drawerNav.js'
import { searchMenuContent } from '../api/menuSearchSupabase.js'

function LockIcon() {
  return (
    <svg
      className="app-drawer-lock"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

function HamburgerIcon() {
  return (
    <svg
      className="app-drawer-burger-icon"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

/**
 * Гамбургер + боковое меню приложения.
 */
export default function AppDrawer({
  activeSection,
  onNavigate,
  onSearchNavigate,
  authUser,
  authEmail,
  authRequired,
  onSignOut,
}) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const panelRef = useRef(null)
  const titleId = useId()
  const searchTimerRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      setSearchQuery('')
      setSearchResults([])
      setSearchError('')
      setSearchLoading(false)
      if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current)
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const q = searchQuery.trim()
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current)
    if (q.length < 2) {
      setSearchResults([])
      setSearchError('')
      setSearchLoading(false)
      return undefined
    }
    setSearchLoading(true)
    searchTimerRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          const rows = await searchMenuContent(q)
          setSearchResults(rows)
          setSearchError('')
        } catch (err) {
          setSearchResults([])
          setSearchError(err.message || 'Ошибка поиска')
        } finally {
          setSearchLoading(false)
        }
      })()
    }, 280)
    return () => {
      if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current)
    }
  }, [searchQuery, open])

  const close = () => setOpen(false)

  const go = (id) => {
    onNavigate?.(id)
    close()
  }

  const goResult = (item) => {
    if (onSearchNavigate) {
      onSearchNavigate(item)
    } else {
      onNavigate?.(item.sectionId)
    }
    close()
  }

  const email = authEmail || authUser?.email || ''
  const regActive = [
    'regulations',
    'appearance',
    'behavior',
    'rights',
    'requirements',
    'rights_and_duties',
  ].includes(activeSection)

  return (
    <div className="app-drawer-root">
      <button
        type="button"
        className="app-drawer-burger"
        aria-label="Открыть меню"
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
        onClick={() => setOpen(true)}
      >
        <HamburgerIcon />
      </button>

      {open ? (
        <div className="app-drawer-overlay" role="presentation" onClick={close}>
          <aside
            className="app-drawer-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="app-drawer-head">
              <h2 id={titleId} className="app-drawer-title">
                Меню
              </h2>
              <button type="button" className="app-drawer-close" onClick={close} aria-label="Закрыть меню">
                ✕
              </button>
            </div>

            <div className="app-drawer-search">
              <input
                type="search"
                className="app-drawer-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по разделам…"
                aria-label="Поиск по разделам и регламентам"
                autoComplete="off"
              />
              {searchQuery.trim().length >= 2 ? (
                <div className="app-drawer-search-results" role="listbox" aria-label="Результаты поиска">
                  {searchLoading ? <p className="muted small">Ищу…</p> : null}
                  {searchError ? <p className="error">{searchError}</p> : null}
                  {!searchLoading && !searchError && searchResults.length === 0 ? (
                    <p className="muted small">Ничего не найдено</p>
                  ) : null}
                  {searchResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="app-drawer-search-hit"
                      role="option"
                      onClick={() => goResult(item)}
                    >
                      <span className="app-drawer-search-hit-title">{item.title}</span>
                      <span className="app-drawer-search-hit-sub muted small">{item.subtitle}</span>
                      {item.snippet ? (
                        <span className="app-drawer-search-hit-snip muted small">{item.snippet}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <nav className="app-drawer-nav" aria-label="Разделы приложения">
              {DRAWER_ITEMS.map((item) => {
                const isActive = item.id === 'regulations' ? regActive : activeSection === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`app-drawer-item${isActive ? ' is-active' : ''}${item.id === 'suppliers' ? ' drawer-secure-start' : ''}`}
                    title={item.pin ? 'Нужен код доступа' : undefined}
                    onClick={() => go(item.id)}
                  >
                    <span>{item.label}</span>
                    {item.pin ? <LockIcon /> : null}
                  </button>
                )
              })}
            </nav>

            {authRequired && authUser ? (
              <div className="app-drawer-account">
                <div className="app-drawer-account-email" title={email}>
                  {email || 'Аккаунт'}
                </div>
                <button
                  type="button"
                  className="app-drawer-logout"
                  onClick={() => {
                    close()
                    void onSignOut?.()
                  }}
                >
                  Выйти
                </button>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
    </div>
  )
}

export { DRAWER_ITEMS } from '../constants/drawerNav.js'
