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
