/**
 * Карточка для SwipeableCardCarousel.
 * @param {{
 *   card: { id: string|number, title: string, body?: import('react').ReactNode, imageUrl?: string },
 *   index?: number,
 *   total?: number,
 *   active?: boolean,
 * }} props
 */
export default function Card({ card, index = 0, total = 1, active = false }) {
  if (!card) return null

  const num = String(index + 1).padStart(2, '0')

  return (
    <article
      className={`scc-card${active ? ' is-active' : ''}`}
      data-card-id={card.id}
      aria-label={`${index + 1} из ${total}${card.title ? `: ${card.title}` : ''}`}
    >
      <header className="scc-card-header">
        <span className="scc-card-num" aria-hidden>
          {num}
        </span>
        <span className="scc-card-count">
          {index + 1} / {total}
        </span>
      </header>

      {card.imageUrl ? (
        <div className="scc-card-media">
          <img src={card.imageUrl} alt="" loading="lazy" draggable={false} />
        </div>
      ) : null}

      {card.title ? <h4 className="scc-card-title">{card.title}</h4> : null}

      {card.body != null && card.body !== '' ? (
        <div className="scc-card-body">
          {typeof card.body === 'string' || typeof card.body === 'number' ? (
            <p>{card.body}</p>
          ) : (
            card.body
          )}
        </div>
      ) : null}
    </article>
  )
}
