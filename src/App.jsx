import { useEffect, useMemo, useState } from 'react'
import ListView from './components/ListView'
import DetailView from './components/DetailView'
import EditOverlay from './components/EditOverlay'
import PinModal from './components/PinModal'
import { useCards } from './hooks/useCards'
import {
  createCard,
  deleteCard,
  fetchCardDetail,
  fetchSchedule,
  fetchSectionsContent,
  updateCard,
  updateSchedule,
  updateSectionContent,
} from './api/sheets'
import { exportAllCardsToPdf, exportCardToPdf, shareCardPdf } from './utils/pdfExport'
import { normalizePhotoUrl } from './utils/photoUrl'

function makeEmptyCard() {
  const today = new Date().toISOString().slice(0, 10)
  return {
    sheetName: '',
    name: '',
    nameRu: '',
    category: '',
    yield: '',
    time: '',
    method: '',
    glass: '',
    garnish: '',
    photoUrl: '',
    author: '',
    date: today,
    technology: '',
    ingredients: [{ name: '', amount: '' }],
  }
}

const CATEGORY_PRIORITY = ['Кофе', 'Матча', 'Чай листовой', 'Чай авторский', 'Лимонад']
const APP_SECTIONS = [
  { id: 'techcards', label: 'ТехКарты' },
  { id: 'schedule', label: 'График смен' },
  { id: 'regulations', label: 'Регламенты' },
  { id: 'appearance', label: 'Требования к внешнему виду' },
  { id: 'behavior', label: 'Поведение' },
  { id: 'rights', label: 'Права и ответственность' },
]

const DEFAULT_SCHEDULE = {
  defaultStart: '09:00',
  defaultEnd: '23:00',
  employees: [],
  employeesByMonth: {},
  shifts: [],
  shortageByMonth: {},
  bonusesByMonth: {},
}

function normalizeScheduleServer(s) {
  const raw = s && typeof s === 'object' ? s : {}
  const rawShifts = Array.isArray(raw.shifts) ? raw.shifts : []
  const shortageByMonth =
    raw.shortageByMonth && typeof raw.shortageByMonth === 'object' && !Array.isArray(raw.shortageByMonth)
      ? { ...raw.shortageByMonth }
      : {}
  const bonusesByMonth =
    raw.bonusesByMonth && typeof raw.bonusesByMonth === 'object' && !Array.isArray(raw.bonusesByMonth)
      ? { ...raw.bonusesByMonth }
      : {}
  const employeesByMonth =
    raw.employeesByMonth && typeof raw.employeesByMonth === 'object' && !Array.isArray(raw.employeesByMonth)
      ? { ...raw.employeesByMonth }
      : {}
  return {
    ...DEFAULT_SCHEDULE,
    ...raw,
    employees: Array.isArray(raw.employees) ? raw.employees : [],
    shifts: rawShifts.map((sh, i) => ({
      ...sh,
      id:
        sh.id && String(sh.id).trim()
          ? String(sh.id).trim()
          : `mig_${i}_${sh.date}_${sh.employeeId}_${sh.start || ''}_${sh.end || ''}`,
    })),
    shortageByMonth,
    bonusesByMonth,
    employeesByMonth,
  }
}
const DEFAULT_SECTION_CONTENT = {
  regulations: {
    title: 'Регламенты',
    points: [
      '# Смена',
      '- Открытие и закрытие точки строго по **чек-листу**.',
      '- В конце смены зафиксировать **списания** и брак.',
      '---',
      '# Санитария и хранение',
      'Соблюдать санитарные нормы и условия хранения ингредиентов по внутренним правилам.',
    ],
  },
  appearance: {
    title: 'Требования к внешнему виду',
    points: [
      '## Общий вид',
      '**Чистая форма** и опрятный внешний вид на протяжении всей смены.',
      '## Детали образа',
      '- Минимум украшений, аккуратные волосы, **закрытая обувь**.',
      '- Личная гигиена и регулярная дезинфекция рук.',
      '> По согласованию с командой — только неароматный дезодорант.',
    ],
  },
  behavior: {
    title: 'Поведение',
    points: [
      '# Общение',
      'Вежливый тон с гостями и коллегами, **внимание** к запросам и очереди.',
      '# Командная работа',
      'Проактивная помощь в **пиковые часы**, равномерная загрузка зоны.',
      '# Конфликты',
      'Спокойная коммуникация: факты вместо обвинений; при эскалации — **руководитель смены**.',
    ],
  },
  rights: {
    title: 'Права и ответственность',
    points: [
      '# Условия труда',
      'Право на **безопасные** условия и понятные задачи.',
      '# Качество и стандарты',
      'Ответственность за напитки, рецептуру и **стандарты** подачи.',
      '# Правила точки',
      'Соблюдение регламентов и бережное отношение к **оборудованию** и продукту.',
    ],
  },
}

const VISIT_EVENT = 'app-visit-count'

function App() {
  const { cards, loading, error, refresh, addLocalCard, updateLocalCard, removeLocalCard } = useCards()
  const [visitCount, setVisitCount] = useState(null)
  const [view, setView] = useState('list')
  const [selectedId, setSelectedId] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [pinModal, setPinModal] = useState({ open: false, action: null })
  const [draftCard, setDraftCard] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [activeSection, setActiveSection] = useState('techcards')
  const [sectionContent, setSectionContent] = useState(DEFAULT_SECTION_CONTENT)
  const [sectionEditor, setSectionEditor] = useState({ open: false, sectionId: null, text: '' })
  const [sectionSaving, setSectionSaving] = useState(false)
  const [sectionSaveError, setSectionSaveError] = useState('')
  const [scheduleData, setScheduleData] = useState(DEFAULT_SCHEDULE)
  const [scheduleUnlocked, setScheduleUnlocked] = useState(false)
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [scheduleSaveError, setScheduleSaveError] = useState('')
  const [scheduleLoadError, setScheduleLoadError] = useState('')
  const [scheduleLoading, setScheduleLoading] = useState(false)

  const selectedCard = useMemo(
    () => cards.find((card) => card.sheetName === selectedId) || null,
    [cards, selectedId],
  )
  const categories = useMemo(
    () => {
      const unique = [...new Set(cards.map((card) => String(card.category || '').trim()).filter(Boolean))]
      const inPriority = CATEGORY_PRIORITY.filter((name) => unique.includes(name))
      const rest = unique.filter((name) => !CATEGORY_PRIORITY.includes(name))
      return [...inPriority, ...rest]
    },
    [cards],
  )

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const sharedSections = await fetchSectionsContent()
        if (!active) return
        setSectionContent({ ...DEFAULT_SECTION_CONTENT, ...sharedSections })
      } catch {
        // Keep local defaults when server sections are not available.
      }
    })()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        setScheduleLoading(true)
        setScheduleLoadError('')
        const s = await fetchSchedule()
        if (!active) return
        setScheduleData(normalizeScheduleServer(s))
      } catch (err) {
        if (active) setScheduleLoadError(err.message || 'Не удалось загрузить график')
      } finally {
        if (active) setScheduleLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (activeSection !== 'schedule') setScheduleUnlocked(false)
  }, [activeSection])

  useEffect(() => {
    const onVisit = (e) => {
      if (typeof e.detail === 'number' && !Number.isNaN(e.detail)) setVisitCount(e.detail)
    }
    window.addEventListener(VISIT_EVENT, onVisit)
    return () => window.removeEventListener(VISIT_EVENT, onVisit)
  }, [])

  const ensureFullCard = async (card) => {
    if (!card || !card.isPartial) return card
    const detailed = await fetchCardDetail(card.sheetName)
    if (detailed) {
      updateLocalCard(detailed)
      return detailed
    }
    return card
  }

  const exportSelectedCards = async (sheetNames) => {
    const selected = cards.filter((card) => sheetNames.includes(card.sheetName))
    if (selected.length === 0) return
    const fullCards = await Promise.all(selected.map((card) => ensureFullCard(card)))
    await exportAllCardsToPdf(fullCards)
  }

  const exportOneCard = async () => {
    if (!selectedCard) return
    const fullCard = await ensureFullCard(selectedCard)
    await exportCardToPdf(fullCard)
  }

  const shareOneCard = async () => {
    if (!selectedCard) return
    const fullCard = await ensureFullCard(selectedCard)
    await shareCardPdf(fullCard)
  }

  const openDetail = async (cardId) => {
    setSelectedId(cardId)
    setView('detail')
    const base = cards.find((card) => card.sheetName === cardId)
    if (base?.isPartial) {
      setDetailLoading(true)
      try {
        const detailed = await fetchCardDetail(cardId)
        if (detailed) updateLocalCard(detailed)
      } finally {
        setDetailLoading(false)
      }
    }
  }

  const closeDetail = () => {
    setView('list')
    setEditOpen(false)
  }

  const requestAction = (action) => {
    setPinModal({ open: true, action })
  }

  const requestSectionEdit = (sectionId) => {
    setPinModal({ open: true, action: 'editSection', sectionId })
  }

  const requestScheduleUnlock = () => {
    setPinModal({ open: true, action: 'scheduleUnlock' })
  }

  const closePinModal = () => {
    setPinModal({ open: false, action: null })
  }

  const onPinSuccess = async () => {
    if (!pinModal.action) return
    if (pinModal.action === 'create') {
      setDraftCard(makeEmptyCard())
      setEditOpen(true)
      closePinModal()
      return
    }
    if (pinModal.action === 'editSection') {
      const sectionId = pinModal.sectionId
      const current = sectionId ? sectionContent[sectionId] : null
      if (sectionId && current) {
        setSectionEditor({
          open: true,
          sectionId,
          text: current.points.join('\n'),
        })
        setSectionSaveError('')
      }
      closePinModal()
      return
    }

    if (pinModal.action === 'scheduleUnlock') {
      setScheduleUnlocked(true)
      closePinModal()
      return
    }

    if (!selectedCard) return
    if (pinModal.action === 'edit') {
      setDraftCard(null)
      setEditOpen(true)
      closePinModal()
      return
    }
    if (pinModal.action === 'delete') {
      await deleteCard(selectedCard.sheetName, import.meta.env.VITE_PIN_CODE)
      removeLocalCard(selectedCard.sheetName)
      closePinModal()
      closeDetail()
    }
  }

  const onSaveEdit = async (nextCard) => {
    const preparedCard = { ...nextCard, photoUrl: normalizePhotoUrl(nextCard.photoUrl) }
    const isCreate = !selectedCard || draftCard !== null

    if (isCreate) {
      if (!preparedCard.sheetName.trim()) {
        throw new Error('Заполните идентификатор листа (sheetName)')
      }
      await createCard(preparedCard, import.meta.env.VITE_PIN_CODE)
      addLocalCard(preparedCard)
      setSelectedId(preparedCard.sheetName)
      setView('detail')
      setDraftCard(null)
    } else {
      await updateCard(preparedCard.sheetName, preparedCard, import.meta.env.VITE_PIN_CODE)
      updateLocalCard(preparedCard)
    }
    setEditOpen(false)
  }

  const saveSectionEditor = async () => {
    const sectionId = sectionEditor.sectionId
    if (!sectionId) return
    const points = sectionEditor.text
      .split(/\r\n|\n|\r/)
      .map((line) => line.replace(/\u00a0/g, ' ').trim())
      .filter(Boolean)
    const safePoints = points.length ? points : ['Добавьте первый пункт.']
    const next = {
      ...sectionContent,
      [sectionId]: {
        ...sectionContent[sectionId],
        points: safePoints,
      },
    }
    try {
      setSectionSaving(true)
      setSectionSaveError('')
      await updateSectionContent(
        sectionId,
        sectionContent[sectionId]?.title || sectionId,
        safePoints,
        import.meta.env.VITE_PIN_CODE,
      )
      setSectionContent(next)
      setSectionEditor({ open: false, sectionId: null, text: '' })
    } catch (err) {
      setSectionSaveError(err.message || 'Не удалось сохранить раздел')
    } finally {
      setSectionSaving(false)
    }
  }

  const saveScheduleToSheet = async () => {
    try {
      setScheduleSaving(true)
      setScheduleSaveError('')
      await updateSchedule(scheduleData, import.meta.env.VITE_PIN_CODE)
      const fresh = await fetchSchedule()
      setScheduleData(normalizeScheduleServer(fresh))
    } catch (err) {
      setScheduleSaveError(err.message || 'Ошибка сохранения графика')
    } finally {
      setScheduleSaving(false)
    }
  }

  return (
    <div className="app-shell">
      <div className={`screen-stack view-${view}`}>
        <section className="screen screen-list" aria-hidden={view !== 'list'}>
          <ListView
            cards={cards}
            categories={categories}
            visitCount={visitCount}
            loading={loading}
            error={error}
            activeSection={activeSection}
            sections={APP_SECTIONS}
            sectionContent={sectionContent}
            onSectionChange={setActiveSection}
            onSectionEdit={requestSectionEdit}
            onSelect={openDetail}
            onRefresh={refresh}
            onExportSelected={exportSelectedCards}
            onCreate={() => requestAction('create')}
            schedule={
              activeSection === 'schedule'
                ? {
                    data: scheduleData,
                    onChange: setScheduleData,
                    canEdit: scheduleUnlocked,
                    onRequestUnlock: requestScheduleUnlock,
                    onExitEdit: () => setScheduleUnlocked(false),
                    onSave: saveScheduleToSheet,
                    saving: scheduleSaving,
                    loading: scheduleLoading,
                    saveError: scheduleSaveError,
                    loadError: scheduleLoadError,
                    onReload: async () => {
                      try {
                        setScheduleLoading(true)
                        setScheduleLoadError('')
                        const s = await fetchSchedule()
                        setScheduleData(normalizeScheduleServer(s))
                      } catch (e) {
                        setScheduleLoadError(e.message || 'Не удалось обновить график')
                      } finally {
                        setScheduleLoading(false)
                      }
                    },
                  }
                : null
            }
          />
        </section>
        <section className="screen screen-detail" aria-hidden={view !== 'detail'}>
          <DetailView
            card={selectedCard}
            loading={detailLoading}
            onBack={closeDetail}
            onEdit={() => requestAction('edit')}
            onDelete={() => requestAction('delete')}
            onExport={exportOneCard}
            onShare={shareOneCard}
          />
        </section>
      </div>

      <EditOverlay
        isOpen={editOpen}
        card={draftCard || selectedCard}
        categories={categories}
        onClose={() => {
          setEditOpen(false)
          setDraftCard(null)
        }}
        onSave={onSaveEdit}
      />

      <PinModal
        isOpen={pinModal.open}
        title={
          pinModal.action === 'delete'
            ? 'Удалить'
            : pinModal.action === 'create'
              ? 'Создать'
              : pinModal.action === 'scheduleUnlock'
                ? 'График смен'
                : pinModal.action === 'editSection'
                  ? 'Редактировать раздел'
                  : 'Редактировать'
        }
        onClose={closePinModal}
        onSuccess={onPinSuccess}
      />

      {sectionEditor.open ? (
        <div className="export-modal-backdrop" onClick={() => setSectionEditor({ open: false, sectionId: null, text: '' })}>
          <div className="export-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Редактирование раздела</h3>
            <p className="muted section-editor-hint">
              Каждая строка — отдельный абзац (без автонумерации). Заголовки: <code>#</code>, <code>##</code>,{' '}
              <code>###</code> в начале строки; можно <code>#2. Подзаголовок</code>. Списки: строки с{' '}
              <code>-</code>, <code>*</code> или <code>•</code>. Разделитель: <code>---</code>. Примечание:{' '}
              <code>&gt; текст</code>. В строке: <code>**жирный**</code>, <code>__жирный__</code>,{' '}
              <code>_курсив_</code>. Свой текст <code>1. 2.</code> остаётся как вы написали.
            </p>
            <textarea
              className="section-editor-textarea"
              value={sectionEditor.text}
              onChange={(e) => setSectionEditor((prev) => ({ ...prev, text: e.target.value }))}
            />
            <div className="export-actions">
              <button
                type="button"
                className="ghost-btn"
                disabled={sectionSaving}
                onClick={() => setSectionEditor({ open: false, sectionId: null, text: '' })}
              >
                Отмена
              </button>
              <button type="button" className="btn btn-dark" onClick={saveSectionEditor} disabled={sectionSaving}>
                {sectionSaving ? 'Сохраняю...' : 'Сохранить'}
              </button>
            </div>
            {sectionSaveError ? <p className="error">{sectionSaveError}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
