import { useMemo } from 'react'
import InfoSectionBody from './InfoSectionBody'
import SwipeableCardCarousel from './SwipeableCardCarousel'
import { REGULATION_CATEGORIES } from '../api/regulationsSupabase.js'

function contentToPoints(content) {
  return String(content || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\u00a0/g, ' ').trimEnd())
    .filter((l) => l.trim() !== '')
}

/**
 * Хаб регламентов: категории + одна карточка → тап → свайп.
 * Кнопка «+» — в шапке ListView.
 */
export default function RegulationsHub({
  activeCategory,
  onCategoryChange,
  cardsByCategory,
  onEditCard,
  loading,
  error,
}) {
  const categories = REGULATION_CATEGORIES
  const rows = cardsByCategory?.[activeCategory] || []

  const carouselCards = useMemo(
    () =>
      rows.map((row) => ({
        id: row.id,
        title: row.title,
        body: (
          <InfoSectionBody sectionId={`reg-${row.id}`} points={contentToPoints(row.content)} />
        ),
        imageUrl: row.images?.[0] || undefined,
        _raw: row,
      })),
    [rows],
  )

  return (
    <div className="regulations-hub">
      <div className="reg-subtabs">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`chip ${activeCategory === cat.id ? 'chip-active' : ''}`}
            onClick={() => onCategoryChange(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {loading ? <p className="muted">Загрузка регламентов…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && !error && carouselCards.length === 0 ? (
        <section className="info-page drawer-placeholder">
          <h3>Пока пусто</h3>
          <p className="muted">Добавьте первую карточку кнопкой «+» в шапке (нужен PIN).</p>
        </section>
      ) : null}

      {!loading && carouselCards.length > 0 ? (
        <SwipeableCardCarousel
          key={activeCategory}
          cards={carouselCards}
          aria-label={categories.find((c) => c.id === activeCategory)?.label || 'Регламенты'}
          onEditCard={(card) => onEditCard?.(card._raw || card)}
        />
      ) : null}
    </div>
  )
}
