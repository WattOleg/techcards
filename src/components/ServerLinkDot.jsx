import { useServerLink } from '../hooks/useServerLink'

const LABELS = {
  ok: 'Связь с сервером стабильна',
  down: 'Нет связи с сервером',
  unknown: 'Проверка связи с сервером…',
}

/** Маленький кружок связи с Apps Script в шапке. */
export default function ServerLinkDot() {
  const { status } = useServerLink()
  const label = LABELS[status] || LABELS.unknown

  return (
    <span
      className={`server-link-dot is-${status}`}
      title={label}
      role="status"
      aria-live="polite"
      aria-label={label}
      data-server-link={status}
    />
  )
}
