/** Максимум строк контента на одной карточке (чтобы умещалось на экран). */
const MAX_LINES_PER_CARD = 5

function flattenLines(points) {
  const out = []
  for (const raw of Array.isArray(points) ? points : []) {
    String(raw ?? '')
      .split(/\r?\n/)
      .forEach((line) => out.push(line))
  }
  return out
}

function isSeparator(line) {
  const t = String(line || '').trim()
  return t === '---' || t === '***' || t === '———' || t === '—'
}

/** `#`, `##`, `###` или короткий нумерованный заголовок вида `1. Тема` */
function parseSectionHeading(line) {
  const t = String(line || '').trim()
  if (!t) return null

  if (/^#{1,3}\s+\S/.test(t)) {
    let body = t.replace(/^#{1,3}\s+/, '').trim()
    body = body.replace(/^\d+[\.)]\s+/, '')
    return body || null
  }

  // «1. Общий внешний вид» — заголовок секции, не длинный пункт списка
  const numbered = t.match(/^(\d{1,2})[\.)]\s+(.+)$/)
  if (numbered) {
    const rest = numbered[2].trim()
    const wordCount = rest.split(/\s+/).filter(Boolean).length
    const looksLikeTitle =
      rest.length <= 80 &&
      wordCount <= 12 &&
      !/^[-*•]/.test(rest) &&
      (rest.match(/,/g) || []).length <= 1
    if (looksLikeTitle) return rest
  }

  return null
}

/**
 * Дробит текст раздела на короткие карточки для карусели.
 * @returns {Array<{ title: string, points: string[] }>}
 */
export function splitInfoCards(points) {
  const lines = flattenLines(points)
  const cards = []
  let current = null

  const push = () => {
    if (!current) return
    if (!current.title && current.points.length === 0) return
    cards.push(current)
    current = null
  }

  const start = (title) => {
    push()
    current = { title: title || '', points: [] }
  }

  const ensure = () => {
    if (!current) current = { title: '', points: [] }
  }

  const overflow = () => current && current.points.length >= MAX_LINES_PER_CARD

  for (const raw of lines) {
    const t = String(raw || '').trim()

    if (!t) continue

    if (isSeparator(t)) {
      push()
      continue
    }

    const heading = parseSectionHeading(t)
    if (heading) {
      start(heading)
      continue
    }

    ensure()

    if (overflow()) {
      const contTitle = current.title
      push()
      current = { title: contTitle, points: [] }
    }

    current.points.push(raw)
  }

  push()

  // Если получилась одна огромная карточка без заголовков — режем пачками
  if (cards.length === 1 && cards[0].points.length > MAX_LINES_PER_CARD) {
    const only = cards[0]
    const chunked = []
    for (let i = 0; i < only.points.length; i += MAX_LINES_PER_CARD) {
      chunked.push({
        title: only.title,
        points: only.points.slice(i, i + MAX_LINES_PER_CARD),
      })
    }
    return chunked
  }

  return cards
}

/**
 * Собирает плоский текст body (без markdown-рендера) — запасной вариант.
 * Основной путь: points → InfoSectionBody.
 */
export function linesToPlainBody(points) {
  return (Array.isArray(points) ? points : [])
    .map((l) => String(l || '').trim())
    .filter(Boolean)
    .join('\n')
}
