function SearchBar({ query, onQueryChange, category, onCategoryChange, categories }) {
  return (
    <div className="search-wrap">
      <div className="search-input-wrap">
        <input
          className="search-input"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Поиск по названию..."
        />
        {query ? (
          <button type="button" className="search-clear" onClick={() => onQueryChange('')} aria-label="Очистить поиск">
            ×
          </button>
        ) : null}
      </div>
      <div className="chips-row">
        {categories.map((item) => (
          <button
            key={item.value || 'all'}
            type="button"
            className={`chip ${category === item.value ? 'chip-active' : ''}`}
            onClick={() => onCategoryChange(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default SearchBar
