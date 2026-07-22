/**
 * Прокси Google Apps Script (Vercel Serverless).
 * Браузер с Vercel не может читать ответ script.google.com из‑за CORS — запросы идут на тот же origin (/api/gas), сервер пересылает на APPS_SCRIPT_URL.
 *
 * Переменные Vercel:
 *   APPS_SCRIPT_URL = https://script.google.com/macros/s/…/exec
 *   VITE_APPS_SCRIPT_URL = /api/gas   (в клиентском билде)
 */

const UPSTREAM = () =>
  String(process.env.APPS_SCRIPT_URL || process.env.VITE_APPS_SCRIPT_URL || '').trim()

function assertScriptGoogleUrl(urlStr) {
  let u
  try {
    u = new URL(urlStr)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' || u.hostname !== 'script.google.com') return null
  if (!u.pathname.includes('/macros/s/') || !u.pathname.endsWith('/exec')) return null
  return u
}

export default async function handler(req, res) {
  const baseRaw = UPSTREAM()
  const base = assertScriptGoogleUrl(baseRaw)
  if (!base) {
    res.status(500).setHeader('Content-Type', 'application/json; charset=utf-8')
    res.send(
      JSON.stringify({
        error:
          'На сервере задайте APPS_SCRIPT_URL = полный https://script.google.com/macros/s/…/exec (без прокси-пути).',
      }),
    )
    return
  }

  try {
    const target = new URL(base.toString())
    const q = req.query || {}
    for (const key of Object.keys(q)) {
      const value = q[key]
      if (Array.isArray(value)) {
        value.forEach((v) => target.searchParams.append(key, String(v)))
      } else if (value != null && value !== '') {
        target.searchParams.set(key, String(value))
      }
    }

    if (req.method === 'OPTIONS') {
      res.status(204)
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      res.setHeader('Access-Control-Max-Age', '86400')
      res.send('')
      return
    }

    if (req.method === 'GET') {
      const r = await fetch(target.toString(), {
        method: 'GET',
        redirect: 'follow',
        cache: 'no-store',
      })
      const text = await r.text()
      const ct = r.headers.get('content-type') || 'application/json; charset=utf-8'
      res.status(r.status).setHeader('Content-Type', ct)
      res.send(text)
      return
    }

    if (req.method === 'POST') {
      let rawBody = '{}'
      if (typeof req.body === 'string') rawBody = req.body
      else if (Buffer.isBuffer(req.body)) rawBody = req.body.toString('utf8')
      else if (req.body && typeof req.body === 'object') rawBody = JSON.stringify(req.body)
      let lastErr = null
      let text = ''
      let status = 502
      let ct = 'application/json; charset=utf-8'
      // Retry: на LTE редирект script.google.com → googleusercontent часто рвётся с первого раза.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const r = await fetch(target.toString(), {
            method: 'POST',
            redirect: 'follow',
            cache: 'no-store',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: rawBody,
          })
          text = await r.text()
          status = r.status
          ct = r.headers.get('content-type') || 'application/json; charset=utf-8'
          lastErr = null
          break
        } catch (e) {
          lastErr = e
          if (attempt < 2) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
        }
      }
      if (lastErr) throw lastErr
      res.status(status).setHeader('Content-Type', ct)
      res.send(text)
      return
    }

    res.setHeader('Allow', 'GET, POST, OPTIONS')
    res.status(405).setHeader('Content-Type', 'application/json; charset=utf-8')
    res.send(JSON.stringify({ error: 'method not allowed' }))
  } catch (e) {
    const msg = e && typeof e.message === 'string' ? e.message : String(e)
    res.status(502).setHeader('Content-Type', 'application/json; charset=utf-8')
    res.send(JSON.stringify({ error: msg }))
  }
}
