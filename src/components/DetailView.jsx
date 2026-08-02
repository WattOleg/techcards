import PhotoGallery from './PhotoGallery'
import ServerLinkDot from './ServerLinkDot'
import { getCardPhotoUrls } from '../utils/photoUrl'

function DetailView({ card, loading, onBack, onEdit, onExport }) {
  if (!card) {
    return (
      <div className="view detail-view">
        <p className="muted">Выберите карточку</p>
      </div>
    )
  }

  const photoUrls = getCardPhotoUrls(card)

  return (
    <div className="view detail-view">
      <PhotoGallery
        urls={photoUrls}
        alt={card.name}
        topSlot={
          <div className="hero-top">
            <button type="button" className="icon-btn" onClick={onBack}>
              ←
            </button>
            <div className="hero-top-trailing">
              <ServerLinkDot />
              <button type="button" className="icon-btn" onClick={onEdit}>
                Изменить
              </button>
            </div>
          </div>
        }
      />

      <h2 className="title">{card.name}</h2>
      <p className="subtitle">{card.nameRu}</p>

      <div className="meta-row">
        <div className="meta-box">
          <span>Выход</span>
          <strong>{card.yield}</strong>
        </div>
        <div className="meta-box">
          <span>Время</span>
          <strong>{card.time}</strong>
        </div>
        <div className="meta-box">
          <span>Метод</span>
          <strong>{card.method}</strong>
        </div>
      </div>

      <section className="block">
        <h3>Подача</h3>
        <p>{card.glass}</p>
        <p className="muted">{card.garnish}</p>
      </section>

      <section className={`block detail-block ${loading ? 'is-loading' : 'is-ready'}`}>
        <h3>Ингредиенты</h3>
        {loading ? <p className="muted">Загружаю детали...</p> : null}
        <div className="ingredient-list">
          {card.ingredients?.map((ing, idx) => (
            <div key={`${ing.name}-${idx}`} className="ingredient-row">
              <span>{ing.name}</span>
              <strong>{ing.amount}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className={`block detail-block ${loading ? 'is-loading' : 'is-ready'}`}>
        <h3>Технология</h3>
        <p>{card.technology}</p>
      </section>

      <div className="actions">
        <button type="button" className="btn btn-dark" onClick={onEdit}>
          Редактировать
        </button>
        <button type="button" className="btn btn-outline-black" onClick={onExport}>
          Экспорт в PDF
        </button>
      </div>
    </div>
  )
}

export default DetailView
