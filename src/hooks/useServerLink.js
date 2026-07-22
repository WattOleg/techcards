import { useEffect, useState } from 'react'
import { getGasClientBaseUrl } from '../config/gasBaseUrl.js'
import {
  getServerLinkStatus,
  reportServerReachable,
  reportServerUnreachable,
  subscribeServerLinkStatus,
} from '../utils/serverStatus.js'
import { isOnline } from '../utils/network.js'

const PING_INTERVAL_MS = 45000

let monitorStarted = false

async function pingServer() {
  const base = getGasClientBaseUrl()
  if (!base) {
    reportServerReachable()
    return true
  }
  if (!isOnline()) {
    reportServerUnreachable()
    return false
  }
  const sep = base.includes('?') ? '&' : '?'
  const url = `${base}${sep}action=ping&_cb=${Date.now()}`
  try {
    const res = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      redirect: 'follow',
      cache: 'no-store',
    })
    const text = await res.text()
    try {
      if (text) JSON.parse(text)
    } catch {
      reportServerUnreachable()
      return false
    }
    if (res.ok) {
      // Любой JSON/200 = сервер доступен (в т.ч. unknown action до редеплоя ping).
      reportServerReachable()
      return true
    }
    reportServerUnreachable()
    return false
  } catch {
    reportServerUnreachable()
    return false
  }
}

/** Один глобальный ping-цикл (вызывать из App). */
export function startServerLinkMonitor() {
  if (monitorStarted || typeof window === 'undefined') return () => {}
  monitorStarted = true

  let cancelled = false
  let timer = null

  const schedule = () => {
    if (cancelled) return
    timer = setTimeout(run, PING_INTERVAL_MS)
  }

  const run = async () => {
    if (cancelled) return
    await pingServer()
    schedule()
  }

  run()

  const onOnline = () => {
    if (timer) clearTimeout(timer)
    run()
  }
  const onOffline = () => {
    reportServerUnreachable()
  }

  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)

  return () => {
    cancelled = true
    monitorStarted = false
    if (timer) clearTimeout(timer)
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
  }
}

/** Только подписка на статус для UI. */
export function useServerLink() {
  const [status, setStatus] = useState(getServerLinkStatus)
  useEffect(() => subscribeServerLinkStatus(setStatus), [])
  return { status, online: status === 'ok' }
}
