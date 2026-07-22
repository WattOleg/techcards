import { useEffect, useMemo, useRef, useState } from 'react'

function initialsFromUser(user, email) {
  const metaName = String(user?.user_metadata?.full_name || '').trim()
  if (metaName) {
    const parts = metaName.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
    }
    return metaName.slice(0, 2).toUpperCase()
  }
  const mail = String(email || user?.email || '').trim()
  if (!mail) return '??'
  const local = mail.split('@')[0] || mail
  const chunks = local.split(/[._-]+/).filter(Boolean)
  if (chunks.length >= 2) {
    return `${chunks[0][0] || ''}${chunks[1][0] || ''}`.toUpperCase()
  }
  return local.slice(0, 2).toUpperCase()
}

function AccountMenu({ user, email, onSignOut, authRequired }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  const initials = useMemo(() => initialsFromUser(user, email), [user, email])
  const label = email || user?.email || 'Аккаунт'

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!authRequired) {
    return (
      <div className="title-menu-btn" aria-hidden>
        <img src="/e-Bar.png" alt="" className="title-logo" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="account-avatar is-guest" aria-hidden>
        ?
      </div>
    )
  }

  return (
    <div className="account-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className="account-avatar"
        aria-label={`Аккаунт ${label}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        title={label}
      >
        {initials}
      </button>
      {open ? (
        <div className="account-menu-dropdown" role="menu">
          <div className="account-menu-email" title={label}>
            {label}
          </div>
          <button
            type="button"
            className="account-menu-item account-menu-logout"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              void onSignOut?.()
            }}
          >
            Выйти
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default AccountMenu
