function tryParseUrl(value) {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

export function extractGoogleDriveFileId(rawUrl) {
  const value = String(rawUrl || '').trim()
  if (!value) return ''

  const byPath = value.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (byPath?.[1]) return byPath[1]

  const parsed = tryParseUrl(value)
  if (!parsed) return ''

  const byQuery = parsed.searchParams.get('id')
  if (byQuery) return byQuery

  return ''
}

export function normalizePhotoUrl(rawUrl) {
  const value = String(rawUrl || '').trim()
  if (!value) return ''

  const driveId = extractGoogleDriveFileId(value)
  if (!driveId) return value

  // Thumbnail endpoint is usually more reliable for public Drive files in <img>.
  return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1600`
}

export function getPhotoCandidates(rawUrl) {
  const value = String(rawUrl || '').trim()
  if (!value) return []

  const driveId = extractGoogleDriveFileId(value)
  if (!driveId) return [value]

  return [
    `https://lh3.googleusercontent.com/d/${driveId}=w1600`,
    `https://drive.google.com/thumbnail?id=${driveId}&sz=w1600`,
    `https://drive.google.com/uc?export=view&id=${driveId}`,
    `https://drive.google.com/uc?id=${driveId}`,
    value,
  ]
}

function looksLikeUrl(value) {
  const v = String(value || '').trim()
  return /^https?:\/\//i.test(v) || /^data:image\//i.test(v)
}

/** Ссылка на фото (Google Drive / http), а не id техкарты. */
export function isPhotoLink(value) {
  const v = String(value || '').trim()
  if (!v) return false
  if (extractGoogleDriveFileId(v)) return true
  if (!looksLikeUrl(v)) return false
  try {
    const u = new URL(v)
    if (!u.hostname || !u.hostname.includes('.')) return false
    const path = u.pathname || ''
    if (/\.(png|jpe?g|webp|gif|avif|bmp|svg)(\?|$)/i.test(path)) return true
    return path.length > 1 || u.search.length > 1
  } catch {
    return false
  }
}

/** Достаёт URL из битой JSON-строки / склейки (Sheets иногда портит кавычки). */
function extractUrlsFromBlob(raw) {
  const value = String(raw || '')
  const found = value.match(/https?:\/\/[^\s"'<>\\]+/gi) || []
  return found
    .map((u) => u.replace(/[),.;]+$/g, '').trim())
    .filter(looksLikeUrl)
}

/**
 * Читает список фото из поля Sheets `photoUrl` (строка / JSON-массив / несколько URL)
 * или из `photoUrls` на карточке.
 */
export function parsePhotoUrls(raw) {
  if (Array.isArray(raw)) {
    // Не нормализуем весь массив как одну строку — каждый элемент отдельно.
    const out = []
    for (const item of raw) {
      const part = parsePhotoUrls(item)
      for (const url of part) {
        if (!out.includes(url)) out.push(url)
      }
    }
    return out
  }

  const value = String(raw || '').trim()
  if (!value) return []

  // JSON-массив в ячейке Sheets
  if (value.startsWith('[')) {
    try {
      const arr = JSON.parse(value)
      if (Array.isArray(arr)) return parsePhotoUrls(arr)
    } catch {
      const recovered = extractUrlsFromBlob(value).map(normalizePhotoUrl).filter(Boolean)
      if (recovered.length) return recovered
    }
  }

  // Надёжный разделитель для Sheets (URL почти никогда не содержат |)
  if (value.includes('|')) {
    return value
      .split('|')
      .map((s) => normalizePhotoUrl(s.trim()))
      .filter(Boolean)
  }

  if (value.includes('\n') || value.includes(';')) {
    return value
      .split(/[\n;]+/)
      .map((s) => normalizePhotoUrl(s.trim()))
      .filter(Boolean)
  }

  // Несколько URL в одной строке (через пробел/запятую) — до short-circuit «один URL»
  const embedded = extractUrlsFromBlob(value)
    .map(normalizePhotoUrl)
    .filter(Boolean)
  if (embedded.length > 1) {
    const unique = []
    for (const url of embedded) {
      if (!unique.includes(url)) unique.push(url)
    }
    return unique
  }

  // Один URL
  if (looksLikeUrl(value)) {
    return [normalizePhotoUrl(value)].filter(Boolean)
  }

  return embedded
}

/**
 * Пишет в Sheets: 1 URL — как раньше; несколько — через `|`
 * (JSON в ячейках Sheets часто ломается → фото «пропадают»).
 */
export function serializePhotoUrls(urls) {
  const list = parsePhotoUrls(urls)
  if (list.length === 0) return ''
  if (list.length === 1) return list[0]
  return list.join('|')
}

export function getCardPhotoUrls(card) {
  if (!card) return []
  // Склеиваем оба источника, чтобы локальный photoUrls не затирал Sheets photoUrl и наоборот.
  const fromUrls = Array.isArray(card.photoUrls) ? parsePhotoUrls(card.photoUrls) : []
  const fromField = parsePhotoUrls(card.photoUrl)
  if (!fromUrls.length) return fromField
  if (!fromField.length) return fromUrls
  const out = [...fromUrls]
  for (const url of fromField) {
    if (!out.includes(url)) out.push(url)
  }
  return out
}
