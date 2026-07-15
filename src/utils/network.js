/** Задержка после смены сети (Wi‑Fi ↔ LTE), пока интерфейс «прыгает». */
export const NETWORK_SETTLE_MS = 2200

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
 * Таймаут одного запроса: на мобильной сети / после handoff запросы дольше.
 * Раньше 2.5 с обрывали LTE и приложение тихо брало localStorage.
 */
export function getFetchTimeoutMs() {
  const type = getConnectionType()
  if (type === 'cellular') return 12000
  if (type === 'wifi' || type === 'ethernet') return 6000
  // Safari / без Network Information API — часто телефон
  return 10000
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

/** Пометить, что сеть только что сменилась / восстановилась — подождать перед fetch. */
export function markNetworkUnsettled(ms = NETWORK_SETTLE_MS) {
  scheduleSettle(ms)
}

/** Дождаться конца «прыжка» сети (или сразу, если уже стабильно). */
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

/** Один раз на приложение: слушаем online/offline и смену типа соединения. */
export function bindNetworkSettleListeners() {
  if (listenersBound || typeof window === 'undefined') return
  listenersBound = true

  const onFlap = () => markNetworkUnsettled(NETWORK_SETTLE_MS)
  window.addEventListener('online', onFlap)
  window.addEventListener('offline', onFlap)

  const conn = getConnection()
  if (conn && typeof conn.addEventListener === 'function') {
    conn.addEventListener('change', onFlap)
  }
}

/**
 * Подписка на стабилизацию сети после сбоя/смены типа.
 * callback вызывается только когда снова online и settle-таймер истёк.
 */
export function onNetworkSettled(callback) {
  if (typeof window === 'undefined') return () => {}
  bindNetworkSettleListeners()

  let cancelled = false
  let pending = false

  const runWhenSettled = async () => {
    if (cancelled || pending) return
    pending = true
    try {
      await waitForNetworkSettle()
      if (cancelled || !isOnline()) return
      callback()
    } finally {
      pending = false
    }
  }

  const onOnline = () => {
    markNetworkUnsettled(NETWORK_SETTLE_MS)
    void runWhenSettled()
  }

  const onChange = () => {
    markNetworkUnsettled(NETWORK_SETTLE_MS)
    if (isOnline()) void runWhenSettled()
  }

  window.addEventListener('online', onOnline)
  const conn = getConnection()
  if (conn && typeof conn.addEventListener === 'function') {
    conn.addEventListener('change', onChange)
  }

  return () => {
    cancelled = true
    window.removeEventListener('online', onOnline)
    if (conn && typeof conn.removeEventListener === 'function') {
      conn.removeEventListener('change', onChange)
    }
  }
}
