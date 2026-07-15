/** Задержка только при реальном handoff Wi‑Fi ↔ LTE (не на каждый старт). */
export const NETWORK_SETTLE_MS = 1600

function getConnection() {
  if (typeof navigator === 'undefined') return null
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null
}

/** wifi | cellular | ethernet | other | unknown */
export function getConnectionType() {
  const c = getConnection()
  if (!c) return 'unknown'
  const type = String(c.type || '').toLowerCase()
  if (type === 'wifi' || type === 'cellular' || type === 'ethernet' || type === 'none') return type
  const effective = String(c.effectiveType || '').toLowerCase()
  if (effective === '4g' || effective === '3g' || effective === '2g' || effective === 'slow-2g') {
    return 'cellular'
  }
  return 'unknown'
}

export function isOnline() {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine !== false
}

/**
 * Таймаут одного запроса. Без искусственной паузы на старте —
 * длиннее только когда реально cellular.
 */
export function getFetchTimeoutMs() {
  const type = getConnectionType()
  if (type === 'cellular') return 10000
  if (type === 'wifi' || type === 'ethernet') return 5000
  return 7000
}

let settleUntil = 0
let settleTimer = null
const settleWaiters = new Set()

function flushSettleWaiters() {
  if (Date.now() < settleUntil) return
  const waiters = [...settleWaiters]
  settleWaiters.clear()
  waiters.forEach((resolve) => resolve())
}

function scheduleSettle(ms = NETWORK_SETTLE_MS) {
  settleUntil = Math.max(settleUntil, Date.now() + ms)
  if (settleTimer) clearTimeout(settleTimer)
  const delay = Math.max(0, settleUntil - Date.now())
  settleTimer = setTimeout(() => {
    settleTimer = null
    flushSettleWaiters()
  }, delay)
}

export function markNetworkUnsettled(ms = NETWORK_SETTLE_MS) {
  scheduleSettle(ms)
}

export function waitForNetworkSettle() {
  if (Date.now() >= settleUntil) return Promise.resolve()
  return new Promise((resolve) => {
    settleWaiters.add(resolve)
  })
}

export function isNetworkSettling() {
  return Date.now() < settleUntil
}

let listenersBound = false
let lastConnectionType = 'unknown'

function isHandoff(from, to) {
  return (
    (from === 'wifi' && to === 'cellular') ||
    (from === 'cellular' && to === 'wifi') ||
    (from === 'wifi' && to === 'none') ||
    (from === 'cellular' && to === 'none')
  )
}

/** Слушаем только online/offline и смену типа (Wi‑Fi ↔ LTE), не каждый signal change. */
export function bindNetworkSettleListeners() {
  if (listenersBound || typeof window === 'undefined') return
  listenersBound = true
  lastConnectionType = getConnectionType()

  window.addEventListener('online', () => markNetworkUnsettled(NETWORK_SETTLE_MS))
  window.addEventListener('offline', () => markNetworkUnsettled(NETWORK_SETTLE_MS))

  const conn = getConnection()
  if (conn && typeof conn.addEventListener === 'function') {
    conn.addEventListener('change', () => {
      const next = getConnectionType()
      if (isHandoff(lastConnectionType, next)) {
        markNetworkUnsettled(NETWORK_SETTLE_MS)
      }
      lastConnectionType = next
    })
  }
}

/**
 * После восстановления сети (online) — один мягкий refresh.
 * Не вызывается на обычный старт приложения.
 */
export function onNetworkSettled(callback) {
  if (typeof window === 'undefined') return () => {}
  bindNetworkSettleListeners()

  let cancelled = false
  let pending = false
  let debounceTimer = null

  const runWhenSettled = () => {
    if (cancelled || pending) return
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(async () => {
      debounceTimer = null
      if (cancelled || pending) return
      pending = true
      try {
        await waitForNetworkSettle()
        if (cancelled || !isOnline()) return
        callback()
      } finally {
        pending = false
      }
    }, 400)
  }

  const onOnline = () => {
    markNetworkUnsettled(NETWORK_SETTLE_MS)
    runWhenSettled()
  }

  const onChange = () => {
    const next = getConnectionType()
    const handoff = isHandoff(lastConnectionType, next)
    lastConnectionType = next
    if (handoff && isOnline()) {
      markNetworkUnsettled(NETWORK_SETTLE_MS)
      runWhenSettled()
    }
  }

  window.addEventListener('online', onOnline)
  const conn = getConnection()
  if (conn && typeof conn.addEventListener === 'function') {
    conn.addEventListener('change', onChange)
  }

  return () => {
    cancelled = true
    if (debounceTimer) clearTimeout(debounceTimer)
    window.removeEventListener('online', onOnline)
    if (conn && typeof conn.removeEventListener === 'function') {
      conn.removeEventListener('change', onChange)
    }
  }
}
