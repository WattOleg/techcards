import { useEffect, useId, useRef, useState } from 'react'

const DRAWER_ITEMS = [
  { id: 'regulations', label: 'Регламенты' },
  { id: 'checklist-opening', label: 'Чек-лист открытия смены' },
  { id: 'checklist-closing', label: 'Чек-лист закрытия смены' },
]

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
  authUser,
  authEmail,
  authRequired,
  onSignOut,
}) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)
  const titleId = useId()

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

  const close = () => setOpen(false)

  const go = (id) => {
    onNavigate?.(id)
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
    'equipment_instructions',
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

            <nav className="app-drawer-nav" aria-label="Разделы приложения">
              {DRAWER_ITEMS.map((item) => {
                const isActive = item.id === 'regulations' ? regActive : activeSection === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`app-drawer-item${isActive ? ' is-active' : ''}`}
                    onClick={() => go(item.id)}
                  >
                    {item.label}
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

export { DRAWER_ITEMS }
