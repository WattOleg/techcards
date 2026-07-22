/** Глобальный статус связи с Apps Script / прокси (для индикатора в шапке). */

/** @typedef {'unknown' | 'ok' | 'down'} ServerLinkStatus */

/** @type {ServerLinkStatus} */
let status = 'unknown'
const listeners = new Set()

export function getServerLinkStatus() {
  return status
}

export function setServerLinkStatus(next) {
  if (next !== 'ok' && next !== 'down' && next !== 'unknown') return
  if (status === next) return
  status = next
  listeners.forEach((cb) => {
    try {
      cb(status)
    } catch {
      // ignore listener errors
    }
  })
}

export function reportServerReachable() {
  setServerLinkStatus('ok')
}

export function reportServerUnreachable() {
  setServerLinkStatus('down')
}

export function subscribeServerLinkStatus(callback) {
  if (typeof callback !== 'function') return () => {}
  listeners.add(callback)
  callback(status)
  return () => listeners.delete(callback)
}
