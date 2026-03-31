function splitItalicSegments(text, keyBase) {
  const nodes = []
  const re = /_([^_\n]+)_/g
  let last = 0
  let m
  let ei = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    nodes.push(<em key={`${keyBase}e${ei++}`}>{m[1]}</em>)
    last = re.lastIndex
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes.length ? nodes : [text]
}

/** **жирный**, __жирный__, _курсив_ */
function parseInline(text, keyPrefix) {
  if (text == null || text === '') return null
  const s = String(text)
  const boldRe = /\*\*([^*]+)\*\*|__([^_]+)__/g
  const out = []
  let last = 0
  let m
  let ki = 0
  let fi = 0
  while ((m = boldRe.exec(s)) !== null) {
    if (m.index > last) {
      out.push(...splitItalicSegments(s.slice(last, m.index), `${keyPrefix}-f${fi++}`))
    }
    out.push(<strong key={`${keyPrefix}-b${ki++}`}>{m[1] || m[2]}</strong>)
    last = m.lastIndex
  }
  if (last < s.length) {
    out.push(...splitItalicSegments(s.slice(last), `${keyPrefix}-f${fi++}`))
  }
  return out.length ? out : splitItalicSegments(s, `${keyPrefix}-z`)
}

function isBulletLine(t) {
  const u = String(t || '').trim()
  if (/^[-*]\s/.test(u)) return true
  if (u.startsWith('•')) return true
  if (u.startsWith('\u2022')) return true
  return false
}

function stripBullet(t) {
  let u = String(t || '').trim()
  if (/^[-*]/.test(u)) u = u.slice(1).trimStart()
  else if (u.startsWith('•') || u.startsWith('\u2022')) u = u.slice(1).trimStart()
  return u
}

function parseHeadingLine(t) {
  if (t.startsWith('###')) {
    const body = t.slice(3).trim()
    return body ? { level: 3, body } : null
  }
  if (t.startsWith('##')) {
    const body = t.slice(2).trim()
    return body ? { level: 2, body } : null
  }
  if (t.startsWith('#')) {
    let body = t.slice(1).trim()
    body = body.replace(/^\d+[\.)]\s+/, '').replace(/^\d+\./, '')
    return body ? { level: 1, body } : null
  }
  return null
}

/**
 * Свободная вёрстка: без автоматической нумерации.
 * Обычная строка — абзац. # / ## / ### — заголовки (#2. тоже).
 * - * • — маркеры; > — примечание; --- — линия.
 */
function buildInfoBlocks(lines) {
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const raw = lines[i]
    const t = String(raw || '').trim()
    i += 1

    if (t === '') continue

    if (t === '---' || t === '***') {
      blocks.push({ type: 'hr' })
      continue
    }

    const head = parseHeadingLine(t)
    if (head) {
      if (head.level === 3) blocks.push({ type: 'caption', text: head.body })
      else if (head.level === 2) blocks.push({ type: 'h5', text: head.body })
      else blocks.push({ type: 'h4', text: head.body })
      continue
    }

    if (t.startsWith('> ')) {
      blocks.push({ type: 'note', text: t.slice(2).trim() })
      continue
    }

    if (isBulletLine(t)) {
      const bullets = [stripBullet(t)]
      while (i < lines.length) {
        const next = String(lines[i] || '').trim()
        if (next && isBulletLine(next)) {
          bullets.push(stripBullet(next))
          i += 1
        } else break
      }
      blocks.push({ type: 'ul', items: bullets.filter(Boolean) })
      continue
    }

    blocks.push({ type: 'p', text: t })
  }

  return blocks
}

export default function InfoSectionBody({ sectionId, points }) {
  const safe = Array.isArray(points) ? points : []
  const blocks = buildInfoBlocks(safe)

  return (
    <div className="info-section-body">
      {blocks.map((b, bi) => {
        const kp = `${sectionId}-${bi}`
        if (b.type === 'hr') {
          return <hr key={kp} className="info-block-sep" />
        }
        if (b.type === 'h4') {
          return (
            <h4 key={kp} className="info-block-title">
              {parseInline(b.text, kp)}
            </h4>
          )
        }
        if (b.type === 'h5') {
          return (
            <h5 key={kp} className="info-block-subtitle">
              {parseInline(b.text, kp)}
            </h5>
          )
        }
        if (b.type === 'caption') {
          return (
            <p key={kp} className="info-block-caption">
              {parseInline(b.text, kp)}
            </p>
          )
        }
        if (b.type === 'note') {
          return (
            <p key={kp} className="info-line-note">
              {parseInline(b.text, kp)}
            </p>
          )
        }
        if (b.type === 'ul') {
          return (
            <ul key={kp} className="info-sublist">
              {b.items.map((item, j) => (
                <li key={`${kp}-u${j}`}>{parseInline(item, `${kp}-u${j}`)}</li>
              ))}
            </ul>
          )
        }
        if (b.type === 'p') {
          return (
            <p key={kp} className="info-para">
              {parseInline(b.text, kp)}
            </p>
          )
        }
        return null
      })}
    </div>
  )
}
