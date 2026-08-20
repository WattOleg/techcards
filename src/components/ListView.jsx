import { useEffect, useMemo, useRef, useState } from 'react'
import AppDrawer from './AppDrawer'
import CardItem from './CardItem'
import ChecklistView from './ChecklistView'
import RegulationsHub from './RegulationsHub'
import SearchBar from './SearchBar'
import ScheduleView from './ScheduleView'
import ServerLinkDot from './ServerLinkDot'
import WriteoffsView from './WriteoffsView'
import UpdatesView from './UpdatesView'
import EquipmentHub from './EquipmentHub'
import SuppliersView from './SuppliersView'
import RevenueView from './RevenueView'
import {
  CATEGORY_TO_SECTION,
  SECTION_TO_CATEGORY,
} from '../api/regulationsSupabase.js'
import { SECTION_TO_CHECKLIST_TYPE, CHECKLIST_TYPES } from '../api/checklistsSupabase.js'

const MAIN_TAB_IDS = ['techcards', 'schedule', 'writeoffs']
const REGULATION_SECTION_IDS = [
  'regulations',
  'appearance',
  'behavior',
  'rights',
  'requirements',
  'rights_and_duties',
]
const CHECKLIST_SECTION_IDS = ['checklist-opening', 'checklist-closing']
const EQUIPMENT_SECTION_ID = 'equipment_instructions'

function ListView({
  cards,
  categories,
  visitCount,
  loading,
  error,
  activeSection,
  onSectionChange,
  onSelect,
  onRefresh,
  onExportSelected,
  onCreate,
  stopList,
  schedule,
  writeoffs,
  authUser,
  authEmail,
  authRequired,
  onSignOut,
  regulations,
  checklists,
  updates,
}) {
  const rootRef = useRef(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [confirmExportOpen, setConfirmExportOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [stopListOpen, setStopListOpen] = useState(false)
  const [stopItemName, setStopItemName] = useState('')
  const [stopItemDate, setStopItemDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [menuFocus, setMenuFocus] = useState(null)

  const handleSearchNavigate = (item) => {
    if (!item?.sectionId) return
    onSectionChange(item.sectionId)
    if (item.focusId && (item.kind === 'regulation' || item.kind === 'equipment')) {
      setMenuFocus({ kind: item.kind, focusId: item.focusId })
    } else {
      setMenuFocus(null)
    }
  }

  useEffect(() => {
    const screenEl = rootRef.current?.closest('.screen')
    if (!screenEl) return
    const onScroll = () => setShowScrollTop(screenEl.scrollTop > 420)
    onScroll()
    screenEl.addEventListener('scroll', onScroll, { passive: true })
    return () => screenEl.removeEventListener('scroll', onScroll)
  }, [activeSection])

  const scrollToTop = () => {
    const screenEl = rootRef.current?.closest('.screen')
    if (!screenEl) return
    screenEl.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    return cards.filter((card) => {
      const categoryOk = !category || card.category === category
      if (!categoryOk) return false
      if (!search) return true
      return (
        String(card.name || '').toLowerCase().includes(search) ||
        String(card.nameRu || '').toLowerCase().includes(search) ||
        String(card.category || '').toLowerCase().includes(search)
      )
    })
  }, [cards, query, category])

  const grouped = useMemo(() => {
    const groups = new Map()
    filtered.forEach((card) => {
      const key = String(card.category || '').trim() || 'Без категории'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(card)
    })
    return Array.from(groups.entries())
      .map(([groupName, items]) => ({ groupName, items }))
      .sort((a, b) => {
        const ia = categories.indexOf(a.groupName)
        const ib = categories.indexOf(b.groupName)
        const wa = ia === -1 ? Number.MAX_SAFE_INTEGER : ia
        const wb = ib === -1 ? Number.MAX_SAFE_INTEGER : ib
        if (wa !== wb) return wa - wb
        return a.groupName.localeCompare(b.groupName)
      })
  }, [filtered, categories])

  const displayCategories = useMemo(() => {
    const allOption = { value: '', label: 'Все' }
    const base = categories.map((value) => ({ value, label: value }))
    const search = query.trim().toLowerCase()
    if (!search) return [allOption, ...base]

    const terms = search.split(/\s+/).filter(Boolean)
    const scored = base
      .map((item, idx) => {
        const lower = item.label.toLowerCase()
        const hits = terms.reduce((acc, term) => acc + (lower.includes(term) ? 1 : 0), 0)
        if (hits === 0) return null
        const starts = terms.some((term) => lower.startsWith(term))
        return { ...item, hits, starts, idx }
      })
      .filter(Boolean)

    scored.sort((a, b) => {
      if (b.hits !== a.hits) return b.hits - a.hits
      if (a.starts !== b.starts) return a.starts ? -1 : 1
      return a.idx - b.idx
    })

    return [allOption, ...scored.map(({ value, label }) => ({ value, label }))]
  }, [categories, query])

  const toggleSelect = (sheetName) => {
    setSelectedIds((prev) =>
      prev.includes(sheetName) ? prev.filter((id) => id !== sheetName) : [...prev, sheetName],
    )
  }

  const openExportModal = () => {
    setExportModalOpen(true)
    setConfirmExportOpen(false)
    setSelectedIds([])
    setExportError('')
  }

  const closeExportModal = () => {
    setExportModalOpen(false)
    setConfirmExportOpen(false)
    setSelectedIds([])
    setExporting(false)
    setExportError('')
  }

  const selectAllFiltered = () => {
    const allIds = filtered.map((card) => card.sheetName)
    const isAllSelected = allIds.length > 0 && allIds.every((id) => selectedIds.includes(id))
    setSelectedIds(isAllSelected ? [] : allIds)
  }

  const submitExport = async () => {
    try {
      setExporting(true)
      setExportError('')
      await onExportSelected(selectedIds)
      closeExportModal()
    } catch (err) {
      setExportError(err.message || 'Ошибка экспорта')
    } finally {
      setExporting(false)
    }
  }

  const submitStopListItem = async () => {
    const item = stopItemName.trim()
    if (!item || !stopList?.onAdd) return
    try {
      await stopList.onAdd({
        id: `tmp_${Date.now()}`,
        item,
        date: stopItemDate || new Date().toISOString().slice(0, 10),
      })
      setStopItemName('')
    } catch {
      // ошибка уже в stopList.error
    }
  }

  const showHeaderTitle =
    MAIN_TAB_IDS.includes(activeSection) ||
    activeSection === 'updates' ||
    activeSection === 'suppliers' ||
    activeSection === 'revenue'
  const activeSectionLabel =
    activeSection === 'techcards'
      ? 'Карточки'
      : activeSection === 'schedule'
        ? 'Графики'
        : activeSection === 'writeoffs'
          ? 'Списания'
          : activeSection === 'updates'
            ? 'Актуальное'
            : activeSection === 'suppliers'
              ? 'Поставщики'
              : activeSection === 'revenue'
                ? 'Выручка'
                : ''
  const activeMainSection = MAIN_TAB_IDS.includes(activeSection) ? activeSection : null
  const isRegulations = REGULATION_SECTION_IDS.includes(activeSection)
  const isChecklist = CHECKLIST_SECTION_IDS.includes(activeSection)
  const isEquipment = activeSection === EQUIPMENT_SECTION_ID
  const isUpdates = activeSection === 'updates'
  const activeCategory = isRegulations
    ? SECTION_TO_CATEGORY[activeSection] || 'regulations'
    : 'regulations'
  const checklistType = isChecklist ? SECTION_TO_CHECKLIST_TYPE[activeSection] : null
  const checklistMeta = CHECKLIST_TYPES.find((t) => t.id === checklistType)
  const showHeaderAdd = isRegulations || isChecklist || isEquipment

  const onHeaderAdd = () => {
    if (isEquipment) {
      regulations?.equipment?.onAddCard?.()
    } else if (isRegulations) {
      regulations?.onAddCard?.(activeCategory)
    } else if (isChecklist) checklists?.onAddItem?.(checklistType)
  }

  return (
    <div className="view list-view" ref={rootRef}>
      <div className="list-sticky-zone">
        <header className="list-header">
          <div className="title-menu-wrap">
            <div className="title-menu-btn">
              <AppDrawer
                activeSection={activeSection}
                onNavigate={onSectionChange}
                onSearchNavigate={handleSearchNavigate}
                authUser={authUser}
                authEmail={authEmail}
                authRequired={authRequired}
                onSignOut={onSignOut}
              />
              {showHeaderAdd ? (
                <button
                  type="button"
                  className="app-header-add"
                  onClick={onHeaderAdd}
                  aria-label={isChecklist ? 'Добавить пункт' : 'Добавить карточку'}
                  title={isChecklist ? 'Добавить пункт' : 'Добавить карточку'}
                >
                  +
                </button>
              ) : null}
              {showHeaderTitle ? <h1>{activeSectionLabel}</h1> : <h1 className="list-header-title-spacer" aria-hidden />}
            </div>
          </div>
          <div className="list-header-badges">
            <ServerLinkDot />
            {visitCount != null ? (
              <div
                className="app-visit-counter"
                aria-live="polite"
                aria-label={`Просмотров приложения: ${visitCount}`}
              >
                <svg
                  className="app-visit-eye"
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span>{visitCount.toLocaleString('ru-RU')}</span>
              </div>
            ) : null}
            <span className="count-badge">{activeSection === 'techcards' ? filtered.length : '•'}</span>
          </div>
        </header>

        {activeSection === 'techcards' ? (
          <SearchBar
            query={query}
            onQueryChange={setQuery}
            category={category}
            onCategoryChange={setCategory}
            categories={displayCategories}
          />
        ) : null}
      </div>

      {activeSection === 'schedule' && schedule ? <ScheduleView {...schedule} /> : null}
      {activeSection === 'writeoffs' && writeoffs ? <WriteoffsView {...writeoffs} /> : null}

      {isRegulations && regulations ? (
        <RegulationsHub
          activeCategory={activeCategory}
          onCategoryChange={(catId) => onSectionChange(CATEGORY_TO_SECTION[catId] || catId)}
          cardsByCategory={regulations.byCategory}
          onEditCard={regulations.onEditCard}
          loading={regulations.loading}
          error={regulations.error}
          focusTarget={menuFocus?.kind === 'regulation' ? menuFocus : null}
          onFocusConsumed={() => setMenuFocus(null)}
        />
      ) : null}

      {isEquipment && regulations?.equipment ? (
        <EquipmentHub
          items={regulations.equipment.items}
          loading={regulations.equipment.loading}
          error={regulations.equipment.error}
          onEditCard={regulations.equipment.onEditCard}
          focusTarget={menuFocus?.kind === 'equipment' ? menuFocus : null}
          onFocusConsumed={() => setMenuFocus(null)}
        />
      ) : null}

      {isChecklist && checklists ? (
        <ChecklistView
          title={checklistMeta?.label || 'Чек-лист'}
          items={checklists.byType?.[checklistType] || []}
          loading={checklists.loading}
          error={checklists.error}
          onEditItem={checklists.onEditItem}
          onAddItem={() => checklists.onAddItem?.(checklistType)}
        />
      ) : null}

      {activeSection === 'suppliers' ? <SuppliersView /> : null}
      {activeSection === 'revenue' ? <RevenueView /> : null}

      {isUpdates && updates ? (
        <UpdatesView
          recentChanges={updates.recentChanges}
          news={updates.news}
          current={updates.current}
          comments={updates.comments}
          loading={updates.loading}
          error={updates.error}
          techcardsWarning={updates.techcardsWarning}
          onReload={updates.onReload}
          onRequestAddNews={updates.onRequestAddNews}
          onRequestEditNews={updates.onRequestEditNews}
          onRequestAddCurrent={updates.onRequestAddCurrent}
          onRequestEditCurrent={updates.onRequestEditCurrent}
          onAddComment={updates.onAddComment}
          onDeleteComment={updates.onDeleteComment}
          commentSaving={updates.commentSaving}
        />
      ) : null}

      {activeSection === 'techcards' ? (
        <>
          <div className="toolbar-row">
            <button
              type="button"
              className="refresh-btn toolbar-icon-btn"
              onClick={onCreate}
              aria-label="Создать"
              title="Создать"
            >
              <span aria-hidden>➕</span>
            </button>
            <button
              type="button"
              className="refresh-btn toolbar-icon-btn"
              onClick={onRefresh}
              aria-label="Обновить"
              title="Обновить"
            >
              <span aria-hidden>🔄</span>
            </button>
            <button
              type="button"
              className="refresh-btn toolbar-icon-btn"
              onClick={openExportModal}
              aria-label="Скачать PDF"
              title="Скачать PDF"
            >
              <span aria-hidden>📄</span>
            </button>
            <button
              type="button"
              className="refresh-btn stop-list-btn"
              onClick={() => setStopListOpen(true)}
              aria-label={
                Array.isArray(stopList?.data) && stopList.data.length > 0
                  ? `Стоп лист, ${stopList.data.length} поз.`
                  : 'Стоп лист'
              }
            >
              Стоп лист
              {Array.isArray(stopList?.data) && stopList.data.length > 0 ? (
                <span className="stop-list-badge" aria-hidden>
                  {stopList.data.length > 99 ? '99+' : stopList.data.length}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              className="refresh-btn updates-btn"
              onClick={() => onSectionChange('updates')}
              aria-label="Актуальное"
            >
              Актуальное
            </button>
          </div>

          {loading ? (
            <div className="skeleton-list">
              {[0, 1, 2, 3, 4].map((idx) => (
                <div key={idx} className="skeleton-card">
                  <div className="skeleton-thumb shimmer" />
                  <div className="skeleton-content">
                    <div className="skeleton-line shimmer" />
                    <div className="skeleton-line short shimmer" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {!loading && error && <p className="error">{error}</p>}
          {!loading && !error && filtered.length === 0 && <p className="muted">Ничего не найдено</p>}

          <div className="list-grid">
            {grouped.map((group) => (
              <section key={group.groupName} className="category-section">
                <h3 className="category-title">{group.groupName}</h3>
                <div className="category-items">
                  {group.items.map((card) => (
                    <CardItem key={card.sheetName} card={card} onClick={() => onSelect(card.sheetName)} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {exportModalOpen ? (
            <div className="export-modal-backdrop" onClick={closeExportModal}>
              <div className="export-modal" onClick={(e) => e.stopPropagation()}>
                <h3>Экспорт PDF</h3>
                <div className="export-actions">
                  <button type="button" className="ghost-btn" onClick={selectAllFiltered}>
                    Выбрать все
                  </button>
                  <span className="muted">Выбрано: {selectedIds.length}</span>
                </div>
                <div className="export-list">
                  {filtered.map((card) => (
                    <label key={card.sheetName} className="select-row">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(card.sheetName)}
                        onChange={() => toggleSelect(card.sheetName)}
                      />
                      <span>
                        <strong>{card.name}</strong> <span className="muted">({card.category || 'Без категории'})</span>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="export-actions">
                  <button
                    type="button"
                    className="btn btn-dark export-confirm"
                    onClick={() => setConfirmExportOpen(true)}
                    disabled={selectedIds.length === 0 || exporting}
                  >
                    Экспортировать PDF
                  </button>
                  <button type="button" className="ghost-btn" onClick={closeExportModal}>
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {confirmExportOpen ? (
            <div className="export-modal-backdrop" onClick={() => setConfirmExportOpen(false)}>
              <div className="export-modal confirm-modal" onClick={(e) => e.stopPropagation()}>
                <h3>Подтвердить экспорт</h3>
                <p className="muted">Будет экспортировано позиций: {selectedIds.length}</p>
                <div className="export-actions">
                  <button type="button" className="ghost-btn" onClick={() => setConfirmExportOpen(false)}>
                    Назад
                  </button>
                  <button
                    type="button"
                    className="btn btn-dark export-confirm"
                    onClick={submitExport}
                    disabled={exporting}
                  >
                    {exporting ? 'Экспорт...' : 'Экспорт'}
                  </button>
                </div>
                {exportError ? <p className="error">{exportError}</p> : null}
              </div>
            </div>
          ) : null}

          {stopListOpen ? (
            <div className="export-modal-backdrop" onClick={() => setStopListOpen(false)}>
              <div className="export-modal stop-list-modal" onClick={(e) => e.stopPropagation()}>
                <h3>Стоп лист напитков</h3>
                <div className="stop-list-form">
                  <input
                    type="text"
                    value={stopItemName}
                    onChange={(e) => setStopItemName(e.target.value)}
                    placeholder="Например: Матча манго"
                  />
                  <input type="date" value={stopItemDate} onChange={(e) => setStopItemDate(e.target.value)} />
                  <button
                    type="button"
                    className="btn btn-dark btn-compact stop-list-add-btn"
                    onClick={submitStopListItem}
                    disabled={!stopItemName.trim() || stopList?.saving}
                  >
                    {stopList?.saving ? <span className="schedule-loading-spinner" aria-hidden /> : 'Добавить'}
                  </button>
                </div>
                <div className="export-actions">
                  <span className="muted">Позиции: {Array.isArray(stopList?.data) ? stopList.data.length : 0}</span>
                  <button type="button" className="ghost-btn stop-list-reload-btn" onClick={stopList?.onReload} disabled={stopList?.loading}>
                    {stopList?.loading ? <span className="schedule-loading-spinner" aria-hidden /> : 'Обновить'}
                  </button>
                </div>
                <div className="export-list">
                  {(stopList?.data || []).map((entry) => (
                    <div key={entry.id} className="stop-list-row">
                      <div>
                        <strong>{entry.item}</strong>
                        <div className="muted small">Дата: {entry.date || '-'}</div>
                      </div>
                      <button
                        type="button"
                        className="ghost-btn btn-compact stop-list-delete-btn"
                        onClick={() => stopList?.onDelete?.(entry.id)}
                        disabled={stopList?.saving}
                      >
                        {stopList?.saving ? <span className="schedule-loading-spinner" aria-hidden /> : 'Удалить'}
                      </button>
                    </div>
                  ))}
                  {!stopList?.loading && (!stopList?.data || stopList.data.length === 0) ? (
                    <p className="muted small">Сейчас все позиции в наличии.</p>
                  ) : null}
                </div>
                {stopList?.error ? <p className="error">{stopList.error}</p> : null}
                <button type="button" className="ghost-btn" onClick={() => setStopListOpen(false)}>
                  Закрыть
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <nav className="bottom-tabs bottom-tabs-3" aria-label="Разделы">
        <button
          type="button"
          className={`bottom-tab ${activeMainSection === 'techcards' ? 'is-active' : ''}`}
          onClick={() => onSectionChange('techcards')}
        >
          Карточки
        </button>
        <button
          type="button"
          className={`bottom-tab ${activeMainSection === 'schedule' ? 'is-active' : ''}`}
          onClick={() => onSectionChange('schedule')}
        >
          Графики
        </button>
        <button
          type="button"
          className={`bottom-tab ${activeMainSection === 'writeoffs' ? 'is-active' : ''}`}
          onClick={() => onSectionChange('writeoffs')}
        >
          Списания
        </button>
      </nav>

      {showScrollTop ? (
        <button type="button" className="floating-top-btn" onClick={scrollToTop} aria-label="Наверх">
          ↑ Наверх
        </button>
      ) : null}
    </div>
  )
}

export default ListView
