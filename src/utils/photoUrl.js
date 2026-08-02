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

/**
 * Читает список фото из поля Sheets `photoUrl` (строка / JSON-массив / несколько URL)
 * или из `photoUrls` на карточке.
 */
export function parsePhotoUrls(raw) {
  if (Array.isArray(raw)) {
    return raw.map((u) => normalizePhotoUrl(String(u || '').trim())).filter(Boolean)
  }
  const value = String(raw || '').trim()
  if (!value) return []

  if (value.startsWith('[')) {
    try {
      const arr = JSON.parse(value)
      if (Array.isArray(arr)) {
        return arr.map((u) => normalizePhotoUrl(String(u || '').trim())).filter(Boolean)
      }
    } catch {
      /* fall through */
    }
  }

  if (value.includes('\n') || value.includes('|')) {
    return value
      .split(/\n|\|/)
      .map((s) => normalizePhotoUrl(s.trim()))
      .filter(Boolean)
  }

  return [normalizePhotoUrl(value)].filter(Boolean)
}

/** Пишет в Sheets: 1 URL — как раньше; несколько — JSON-массив в том же столбце. */
export function serializePhotoUrls(urls) {
  const list = parsePhotoUrls(urls)
  if (list.length === 0) return ''
  if (list.length === 1) return list[0]
  return JSON.stringify(list)
}

export function getCardPhotoUrls(card) {
  if (!card) return []
  if (Array.isArray(card.photoUrls) && card.photoUrls.length > 0) {
    return parsePhotoUrls(card.photoUrls)
  }
  return parsePhotoUrls(card.photoUrl)
}
