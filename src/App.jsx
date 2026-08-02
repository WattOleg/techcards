import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ListView from './components/ListView'
import DetailView from './components/DetailView'
import EditOverlay from './components/EditOverlay'
import PinModal from './components/PinModal'
import AuthGate from './components/AuthGate'
import RegulationCardEditor from './components/RegulationCardEditor'
import ChecklistItemEditor from './components/ChecklistItemEditor'
import { useCards } from './hooks/useCards'
import { useAuth } from './hooks/useAuth'
import {
  createCard,
  deleteCard,
  fetchCardDetail,
  fetchSchedule,
  fetchSectionsContent,
  fetchWriteoffs,
  fetchStopList,
  mutateWriteoffs,
  mutateStopList,
  peekCachedSchedule,
  peekCachedSections,
  peekCachedStopList,
  peekCachedWriteoffs,
  syncWriteoffsOfflineCache,
  updateCard,
  updateSchedule,
} from './api/sheets'
import {
  buildSeedRowsFromLegacySections,
  fetchRegulationsFromSupabase,
  groupRegulationsByCategory,
  insertRegulationCardsBulk,
  upsertRegulationCard,
  deleteRegulationCard,
} from './api/regulationsSupabase.js'
import {
  buildDefaultChecklistRows,
  fetchChecklistsFromSupabase,
  groupChecklistsByType,
  insertChecklistItemsBulk,
  upsertChecklistItem,
  deleteChecklistItem,
} from './api/checklistsSupabase.js'
import { isSupabaseConfigured } from './api/supabaseClient.js'
import { exportAllCardsToPdf, exportCardToPdf } from './utils/pdfExport'
import { normalizePhotoUrl } from './utils/photoUrl'
import { bindNetworkSettleListeners } from './utils/network'
import { startServerLinkMonitor } from './hooks/useServerLink'

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

const DETAIL_HISTORY = { tk: 'detail' }
const EDGE_SWIPE_ZONE = 36
const EDGE_SWIPE_COMMIT = 0.28

const DEFAULT_SCHEDULE = {
  defaultStart: '08:00',
  defaultEnd: '23:00',
  employees: [],
  employeesByMonth: {},
  shifts: [],
  shortageByMonth: {},
  bonusesByMonth: {},
  deductionsByMonth: {},
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
  const deductionsByMonth =
    raw.deductionsByMonth && typeof raw.deductionsByMonth === 'object' && !Array.isArray(raw.deductionsByMonth)
      ? { ...raw.deductionsByMonth }
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
    deductionsByMonth,
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
const DEFAULT_WRITEOFFS = { entries: [], templates: [] }
const DEFAULT_STOP_LIST = []

function App() {
  const auth = useAuth()
  const { cards, loading, error, refresh, addLocalCard, updateLocalCard, removeLocalCard } = useCards()
  const [visitCount, setVisitCount] = useState(null)
  const [view, setView] = useState('list')
  const [selectedId, setSelectedId] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [pinModal, setPinModal] = useState({ open: false, action: null })
  const [draftCard, setDraftCard] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [activeSection, setActiveSection] = useState('techcards')
  const [authGateOpen, setAuthGateOpen] = useState(false)
  const [regulationRows, setRegulationRows] = useState([])
  const [regulationsLoading, setRegulationsLoading] = useState(false)
  const [regulationsError, setRegulationsError] = useState('')
  const [regCardEditor, setRegCardEditor] = useState({ open: false, card: null })
  const [regCardSaving, setRegCardSaving] = useState(false)
  const [regCardSaveError, setRegCardSaveError] = useState('')
  const [checklistRows, setChecklistRows] = useState([])
  const [checklistsLoading, setChecklistsLoading] = useState(false)
  const [checklistsError, setChecklistsError] = useState('')
  const [checklistEditor, setChecklistEditor] = useState({ open: false, item: null })
  const [checklistSaving, setChecklistSaving] = useState(false)
  const [checklistSaveError, setChecklistSaveError] = useState('')
  const cachedSchedule = peekCachedSchedule()
  const [scheduleData, setScheduleData] = useState(() =>
    cachedSchedule ? normalizeScheduleServer(cachedSchedule) : DEFAULT_SCHEDULE,
  )
  const [scheduleUnlocked, setScheduleUnlocked] = useState(false)
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [scheduleSaveError, setScheduleSaveError] = useState('')
  const [scheduleLoadError, setScheduleLoadError] = useState('')
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleBaseline, setScheduleBaseline] = useState(() =>
    cachedSchedule ? JSON.stringify(normalizeScheduleServer(cachedSchedule)) : '',
  )
  const [scheduleSavedAt, setScheduleSavedAt] = useState('')
  const cachedWriteoffs = peekCachedWriteoffs()
  const [writeoffsData, setWriteoffsData] = useState(() => cachedWriteoffs || DEFAULT_WRITEOFFS)
  const [writeoffsLoading, setWriteoffsLoading] = useState(false)
  const [writeoffsSaving, setWriteoffsSaving] = useState(false)
  const [writeoffsSaveError, setWriteoffsSaveError] = useState('')
  const [stopListData, setStopListData] = useState(() => peekCachedStopList())
  const [stopListLoading, setStopListLoading] = useState(false)
  const [stopListSaving, setStopListSaving] = useState(false)
  const [stopListError, setStopListError] = useState('')
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [swipeDragging, setSwipeDragging] = useState(false)
  const closingFromUiRef = useRef(false)
  const scheduleFetchedRef = useRef(Boolean(cachedSchedule))
  const writeoffsFetchedRef = useRef(Boolean(cachedWriteoffs))
  const stopListFetchedRef = useRef(peekCachedStopList().length > 0)
  const scheduleSessionLoadedRef = useRef(false)
  const writeoffsSessionLoadedRef = useRef(false)
  const edgeSwipeRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    locked: false,
    width: 0,
  })

  const selectedCard = useMemo(
    () => cards.find((card) => card.sheetName === selectedId) || null,
    [cards, selectedId],
  )
  const scheduleSerialized = useMemo(() => JSON.stringify(scheduleData), [scheduleData])
  const scheduleDirty = Boolean(scheduleBaseline) && scheduleSerialized !== scheduleBaseline
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
    bindNetworkSettleListeners()
    return startServerLinkMonitor()
  }, [])

  // Auth gate only when VITE_AUTH_ENABLED=true — otherwise app works exactly as before.
  useEffect(() => {
    if (!auth.authRequired) {
      setAuthGateOpen(false)
      return
    }
    setAuthGateOpen(!auth.loading && !auth.isAuthenticated)
  }, [auth.authRequired, auth.isAuthenticated, auth.loading])

  // Регламенты: Supabase + одноразовая миграция из Sheets/defaults, если таблица пуста.
  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      void (async () => {
        if (!isSupabaseConfigured) {
          if (active) setRegulationsError('Supabase не настроен — регламенты недоступны')
          return
        }
        try {
          if (active) {
            setRegulationsLoading(true)
            setRegulationsError('')
          }
          let legacy = {
            ...DEFAULT_SECTION_CONTENT,
            ...(peekCachedSections() || {}),
          }
          try {
            const shared = await fetchSectionsContent()
            legacy = { ...DEFAULT_SECTION_CONTENT, ...shared }
          } catch {
            /* кэш / дефолты */
          }

          let rows = await fetchRegulationsFromSupabase()
          if (rows.length === 0) {
            const seed = buildSeedRowsFromLegacySections(legacy)
            rows = await insertRegulationCardsBulk(seed, import.meta.env.VITE_PIN_CODE || '1234')
          }
          if (active) setRegulationRows(rows)
        } catch (err) {
          if (active) setRegulationsError(err.message || 'Не удалось загрузить регламенты')
        } finally {
          if (active) setRegulationsLoading(false)
        }
      })()
    }, 200)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [])

  const regulationsByCategory = useMemo(
    () => groupRegulationsByCategory(regulationRows),
    [regulationRows],
  )

  // Чек-листы открытия/закрытия
  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      void (async () => {
        if (!isSupabaseConfigured) return
        try {
          if (active) {
            setChecklistsLoading(true)
            setChecklistsError('')
          }
          let rows = await fetchChecklistsFromSupabase()
          if (rows.length === 0) {
            rows = await insertChecklistItemsBulk(
              buildDefaultChecklistRows(),
              import.meta.env.VITE_PIN_CODE || '1234',
            )
          }
          if (active) setChecklistRows(rows)
        } catch (err) {
          if (active) setChecklistsError(err.message || 'Не удалось загрузить чек-листы')
        } finally {
          if (active) setChecklistsLoading(false)
        }
      })()
    }, 250)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [])

  const checklistsByType = useMemo(() => groupChecklistsByType(checklistRows), [checklistRows])

  const loadScheduleFromNetwork = useCallback(async ({ showSpinner = true } = {}) => {
    try {
      if (showSpinner) setScheduleLoading(true)
      setScheduleLoadError('')
      const s = await fetchSchedule()
      const normalized = normalizeScheduleServer(s)
      setScheduleData(normalized)
      setScheduleBaseline(JSON.stringify(normalized))
      scheduleFetchedRef.current = true
    } catch (err) {
      setScheduleLoadError(err.message || 'Не удалось загрузить график')
    } finally {
      setScheduleLoading(false)
    }
  }, [])

  const loadWriteoffsFromNetwork = useCallback(async ({ showSpinner = true } = {}) => {
    try {
      if (showSpinner) setWriteoffsLoading(true)
      setWriteoffsSaveError('')
      const data = await fetchWriteoffs()
      setWriteoffsData({
        entries: Array.isArray(data?.entries) ? data.entries : [],
        templates: Array.isArray(data?.templates) ? data.templates : [],
      })
      writeoffsFetchedRef.current = true
    } catch (err) {
      setWriteoffsSaveError(err.message || 'Не удалось загрузить списания')
    } finally {
      setWriteoffsLoading(false)
    }
  }, [])

  const loadStopListFromNetwork = useCallback(async ({ showSpinner = false } = {}) => {
    try {
      if (showSpinner) setStopListLoading(true)
      setStopListError('')
      const data = await fetchStopList()
      setStopListData(Array.isArray(data) ? data : [])
      stopListFetchedRef.current = true
    } catch (err) {
      setStopListError(err.message || 'Не удалось загрузить стоп-лист')
    } finally {
      setStopListLoading(false)
    }
  }, [])

  // Стоп-лист нужен на вкладке карточек — подтянуть после старта и после логина.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStopListFromNetwork({ showSpinner: false })
    }, 900)
    return () => window.clearTimeout(timer)
  }, [loadStopListFromNetwork])

  useEffect(() => {
    if (!auth.isAuthenticated) return undefined
    const timer = window.setTimeout(() => {
      void loadStopListFromNetwork({ showSpinner: false })
      if (writeoffsSessionLoadedRef.current || activeSection === 'writeoffs') {
        void loadWriteoffsFromNetwork({ showSpinner: false })
      }
    }, 200)
    return () => window.clearTimeout(timer)
  }, [auth.isAuthenticated, activeSection, loadStopListFromNetwork, loadWriteoffsFromNetwork])

  // График / списания — при первом заходе на вкладку (кэш уже на экране).
  useEffect(() => {
    if (activeSection === 'schedule' && !scheduleSessionLoadedRef.current) {
      scheduleSessionLoadedRef.current = true
      void loadScheduleFromNetwork({ showSpinner: !scheduleFetchedRef.current })
    }
    if (activeSection === 'writeoffs' && !writeoffsSessionLoadedRef.current) {
      writeoffsSessionLoadedRef.current = true
      void loadWriteoffsFromNetwork({ showSpinner: !writeoffsFetchedRef.current })
    }
  }, [activeSection, loadScheduleFromNetwork, loadWriteoffsFromNetwork])

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

  // Системная «Назад» / жест браузера ↔ закрытие карточки.
  useEffect(() => {
    const onPopState = () => {
      if (closingFromUiRef.current) {
        closingFromUiRef.current = false
        return
      }
      setView('list')
      setEditOpen(false)
      setSwipeOffset(0)
      setSwipeDragging(false)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
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

  const openDetail = async (cardId) => {
    setSelectedId(cardId)
    setView('detail')
    setSwipeOffset(0)
    setSwipeDragging(false)
    if (typeof window !== 'undefined' && window.history.state?.tk !== 'detail') {
      window.history.pushState({ ...DETAIL_HISTORY, id: cardId }, '')
    }
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

  const closeDetail = useCallback(() => {
    setView('list')
    setEditOpen(false)
    setSwipeOffset(0)
    setSwipeDragging(false)
    if (typeof window !== 'undefined' && window.history.state?.tk === 'detail') {
      closingFromUiRef.current = true
      window.history.back()
    }
  }, [])

  const detailScreenRef = useRef(null)

  useEffect(() => {
    const el = detailScreenRef.current
    if (!el) return undefined

    const onStart = (e) => {
      if (view !== 'detail' || editOpen || pinModal.open) return
      const t = e.touches?.[0]
      if (!t) return
      if (t.clientX > EDGE_SWIPE_ZONE) return
      edgeSwipeRef.current = {
        active: true,
        startX: t.clientX,
        startY: t.clientY,
        locked: false,
        width: window.innerWidth || 390,
      }
    }

    const onMove = (e) => {
      const state = edgeSwipeRef.current
      if (!state.active) return
      const t = e.touches?.[0]
      if (!t) return
      const dx = t.clientX - state.startX
      const dy = t.clientY - state.startY
      if (!state.locked) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
        if (Math.abs(dy) > Math.abs(dx) * 1.15 || dx < 0) {
          state.active = false
          setSwipeDragging(false)
          setSwipeOffset(0)
          return
        }
        state.locked = true
        setSwipeDragging(true)
      }
      if (e.cancelable) e.preventDefault()
      const width = state.width || 390
      setSwipeOffset(Math.max(0, Math.min(dx, width)))
    }

    const onEnd = (e) => {
      const state = edgeSwipeRef.current
      if (!state.active) return
      const t = e.changedTouches?.[0]
      const clientX = t ? t.clientX : state.startX
      const dx = state.locked ? Math.max(0, clientX - state.startX) : 0
      const width = state.width || 390
      state.active = false
      state.locked = false
      setSwipeDragging(false)
      if (dx / width >= EDGE_SWIPE_COMMIT) {
        closeDetail()
      } else {
        setSwipeOffset(0)
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [view, editOpen, pinModal.open, closeDetail])

  const requestAction = (action) => {
    setPinModal({ open: true, action })
  }

  const requestRegulationCardEdit = (card) => {
    setPinModal({ open: true, action: 'editRegulationCard', card })
  }

  const requestRegulationCardAdd = (category) => {
    const list = regulationsByCategory[category] || []
    setPinModal({
      open: true,
      action: 'addRegulationCard',
      card: {
        category,
        title: '',
        content: '',
        orderIndex: list.length,
        images: [],
      },
    })
  }

  const requestChecklistItemEdit = (item) => {
    setPinModal({ open: true, action: 'editChecklistItem', item })
  }

  const requestChecklistItemAdd = (type) => {
    const list = checklistsByType[type] || []
    setPinModal({
      open: true,
      action: 'addChecklistItem',
      item: { type, itemText: '', orderIndex: list.length },
    })
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
    if (pinModal.action === 'editRegulationCard' || pinModal.action === 'addRegulationCard') {
      setRegCardEditor({ open: true, card: pinModal.card || null })
      setRegCardSaveError('')
      closePinModal()
      return
    }
    if (pinModal.action === 'editChecklistItem' || pinModal.action === 'addChecklistItem') {
      setChecklistEditor({ open: true, item: pinModal.item || null })
      setChecklistSaveError('')
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

  const saveRegulationCard = async (nextCard) => {
    try {
      setRegCardSaving(true)
      setRegCardSaveError('')
      const saved = await upsertRegulationCard(nextCard, import.meta.env.VITE_PIN_CODE || '1234')
      setRegulationRows((prev) => {
        const without = prev.filter((r) => r.id !== saved.id)
        return [...without, saved].sort((a, b) => {
          if (a.category !== b.category) return a.category.localeCompare(b.category)
          return a.orderIndex - b.orderIndex
        })
      })
      setRegCardEditor({ open: false, card: null })
    } catch (err) {
      setRegCardSaveError(err.message || 'Не удалось сохранить карточку')
    } finally {
      setRegCardSaving(false)
    }
  }

  const deleteRegulationCardFromEditor = async () => {
    const id = regCardEditor.card?.id
    if (!id) return
    try {
      setRegCardSaving(true)
      setRegCardSaveError('')
      await deleteRegulationCard(id, import.meta.env.VITE_PIN_CODE || '1234')
      setRegulationRows((prev) => prev.filter((r) => r.id !== id))
      setRegCardEditor({ open: false, card: null })
    } catch (err) {
      setRegCardSaveError(err.message || 'Не удалось удалить карточку')
    } finally {
      setRegCardSaving(false)
    }
  }

  const saveChecklistItem = async (nextItem) => {
    try {
      setChecklistSaving(true)
      setChecklistSaveError('')
      const saved = await upsertChecklistItem(nextItem, import.meta.env.VITE_PIN_CODE || '1234')
      setChecklistRows((prev) => {
        const without = prev.filter((r) => r.id !== saved.id)
        return [...without, saved].sort((a, b) => {
          if (a.type !== b.type) return a.type.localeCompare(b.type)
          return a.orderIndex - b.orderIndex
        })
      })
      setChecklistEditor({ open: false, item: null })
    } catch (err) {
      setChecklistSaveError(err.message || 'Не удалось сохранить пункт')
    } finally {
      setChecklistSaving(false)
    }
  }

  const deleteChecklistItemFromEditor = async () => {
    const id = checklistEditor.item?.id
    if (!id) return
    try {
      setChecklistSaving(true)
      setChecklistSaveError('')
      await deleteChecklistItem(id, import.meta.env.VITE_PIN_CODE || '1234')
      setChecklistRows((prev) => prev.filter((r) => r.id !== id))
      setChecklistEditor({ open: false, item: null })
    } catch (err) {
      setChecklistSaveError(err.message || 'Не удалось удалить пункт')
    } finally {
      setChecklistSaving(false)
    }
  }

  const saveScheduleToSheet = async () => {
    try {
      setScheduleSaving(true)
      setScheduleSaveError('')
      await updateSchedule(scheduleData, import.meta.env.VITE_PIN_CODE)
      const fresh = await fetchSchedule()
      const normalized = normalizeScheduleServer(fresh)
      setScheduleData(normalized)
      setScheduleBaseline(JSON.stringify(normalized))
      setScheduleSavedAt(new Date().toISOString())
    } catch (err) {
      setScheduleSaveError(err.message || 'Ошибка сохранения графика')
    } finally {
      setScheduleSaving(false)
    }
  }

  const writeoffsPin = String(import.meta.env.VITE_PIN_CODE || '1234')

  const reloadWriteoffsFromSheet = async () => {
    const fresh = await fetchWriteoffs()
    setWriteoffsData({
      entries: Array.isArray(fresh?.entries) ? fresh.entries : [],
      templates: Array.isArray(fresh?.templates) ? fresh.templates : [],
    })
  }

  const runWriteoffMutation = async (payload) => {
    setWriteoffsSaving(true)
    setWriteoffsSaveError('')
    try {
      const result = await mutateWriteoffs(payload, writeoffsPin)
      // Сразу обновляем UI из ответа мутации — на PWA reload GET мог отдать устаревший кэш SW.
      if (payload.op === 'append' && (result?.entry || payload.entry)) {
        const entry = result?.entry || payload.entry
        setWriteoffsData((prev) => {
          const list = Array.isArray(prev.entries) ? prev.entries : []
          const next = {
            templates: Array.isArray(prev.templates) ? prev.templates : [],
            entries: [entry, ...list.filter((e) => e.id !== entry.id)],
          }
          syncWriteoffsOfflineCache(next)
          return next
        })
      } else if (payload.op === 'delete' && payload.id) {
        setWriteoffsData((prev) => {
          const next = {
            templates: Array.isArray(prev.templates) ? prev.templates : [],
            entries: (Array.isArray(prev.entries) ? prev.entries : []).filter((e) => e.id !== payload.id),
          }
          syncWriteoffsOfflineCache(next)
          return next
        })
      } else if (payload.op === 'update' && (result?.entry || payload.entry)) {
        const entry = result?.entry || payload.entry
        setWriteoffsData((prev) => {
          const list = Array.isArray(prev.entries) ? prev.entries : []
          const next = {
            templates: Array.isArray(prev.templates) ? prev.templates : [],
            entries: list.map((e) => (e.id === entry.id ? entry : e)),
          }
          syncWriteoffsOfflineCache(next)
          return next
        })
      } else if (payload.op === 'templates' && Array.isArray(payload.templates)) {
        setWriteoffsData((prev) => {
          const next = {
            entries: Array.isArray(prev.entries) ? prev.entries : [],
            templates: payload.templates.map((t) => ({ ...t })),
          }
          syncWriteoffsOfflineCache(next)
          return next
        })
      }
      try {
        await reloadWriteoffsFromSheet()
      } catch {
        // UI уже обновлён локально
      }
    } catch (err) {
      setWriteoffsSaveError(err.message || 'Ошибка сохранения списаний')
      throw err
    } finally {
      setWriteoffsSaving(false)
    }
  }

  const refreshWriteoffsOnly = async () => {
    try {
      setWriteoffsSaving(true)
      setWriteoffsSaveError('')
      await reloadWriteoffsFromSheet()
    } catch (err) {
      setWriteoffsSaveError(err.message || 'Не удалось обновить списания')
      throw err
    } finally {
      setWriteoffsSaving(false)
    }
  }

  const reloadStopList = async () => {
    const fresh = await fetchStopList()
    setStopListData(Array.isArray(fresh) ? fresh : [])
  }

  const runStopListMutation = async (payload) => {
    setStopListSaving(true)
    setStopListError('')
    try {
      const result = await mutateStopList(payload)
      if (payload.op === 'append' && (result?.entry || payload.entry)) {
        const entry = result?.entry || payload.entry
        setStopListData((prev) => {
          const list = Array.isArray(prev) ? prev : []
          return [entry, ...list.filter((x) => x.id !== entry.id)]
        })
      } else if (payload.op === 'delete' && payload.id) {
        setStopListData((prev) => (Array.isArray(prev) ? prev.filter((x) => x.id !== payload.id) : []))
      }
      try {
        await reloadStopList()
      } catch {
        // UI уже обновлён локально
      }
    } catch (err) {
      setStopListError(err.message || 'Ошибка сохранения стоп-листа')
      throw err
    } finally {
      setStopListSaving(false)
    }
  }

  return (
    <div className="app-shell">
      {auth.authRequired && auth.loading ? (
        <div className="auth-boot" role="status" aria-live="polite">
          Загрузка…
        </div>
      ) : null}
      <AuthGate
        isOpen={authGateOpen}
        allowClose={false}
        title="e-Bar"
        onSuccess={() => setAuthGateOpen(false)}
      />
      <div
        className={`screen-stack view-${view}${swipeDragging ? ' is-swiping' : ''}`}
        style={
          view === 'detail' && swipeOffset > 0
            ? {
                transform: `translateX(calc(-50% + ${swipeOffset}px))`,
                transition: swipeDragging ? 'none' : undefined,
              }
            : undefined
        }
        aria-hidden={authGateOpen || (auth.authRequired && auth.loading) ? true : undefined}
      >
        <section className="screen screen-list" aria-hidden={view !== 'list'}>
          <ListView
            cards={cards}
            categories={categories}
            visitCount={visitCount}
            loading={loading}
            error={error}
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            onSelect={openDetail}
            onRefresh={refresh}
            onExportSelected={exportSelectedCards}
            onCreate={() => requestAction('create')}
            authUser={auth.user}
            authEmail={auth.email}
            authRequired={auth.authRequired}
            onSignOut={auth.signOut}
            regulations={{
              byCategory: regulationsByCategory,
              loading: regulationsLoading,
              error: regulationsError,
              onEditCard: requestRegulationCardEdit,
              onAddCard: requestRegulationCardAdd,
            }}
            checklists={{
              byType: checklistsByType,
              loading: checklistsLoading,
              error: checklistsError,
              onEditItem: requestChecklistItemEdit,
              onAddItem: requestChecklistItemAdd,
            }}
            stopList={{
              data: stopListData,
              loading: stopListLoading,
              saving: stopListSaving,
              error: stopListError,
              onReload: () => loadStopListFromNetwork({ showSpinner: true }),
              onAdd: (entry) => runStopListMutation({ op: 'append', entry }),
              onDelete: (id) => runStopListMutation({ op: 'delete', id }),
            }}
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
                    saveState: { dirty: scheduleDirty, savedAt: scheduleSavedAt },
                    onReload: () => loadScheduleFromNetwork({ showSpinner: true }),
                  }
                : null
            }
            writeoffs={
              activeSection === 'writeoffs'
                ? {
                    data: writeoffsData,
                    onReload: refreshWriteoffsOnly,
                    onAppendEntry: (entry) => runWriteoffMutation({ op: 'append', entry }),
                    onDeleteEntry: (id) => runWriteoffMutation({ op: 'delete', id }),
                    onUpdateEntry: (entry) => runWriteoffMutation({ op: 'update', entry }),
                    onReplaceTemplates: (templates) => runWriteoffMutation({ op: 'templates', templates }),
                    loading: writeoffsLoading,
                    saving: writeoffsSaving,
                    saveError: writeoffsSaveError,
                    onClearSaveError: () => setWriteoffsSaveError(''),
                  }
                : null
            }
          />
        </section>
        <section
          ref={detailScreenRef}
          className="screen screen-detail"
          aria-hidden={view !== 'detail'}
        >
          <DetailView
            card={selectedCard}
            loading={detailLoading}
            onBack={closeDetail}
            onEdit={() => requestAction('edit')}
            onExport={exportOneCard}
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
        onDelete={
          selectedCard && !draftCard
            ? () => {
                setEditOpen(false)
                requestAction('delete')
              }
            : undefined
        }
      />

      <PinModal
        isOpen={pinModal.open}
        title={
          pinModal.action === 'delete'
            ? 'Удалить'
            : pinModal.action === 'create'
              ? 'Создать'
              : pinModal.action === 'scheduleUnlock'
                ? 'Графики'
                : pinModal.action === 'addRegulationCard'
                  ? 'Новая карточка регламента'
                  : pinModal.action === 'editRegulationCard'
                    ? 'Редактировать карточку'
                    : pinModal.action === 'addChecklistItem'
                      ? 'Новый пункт чек-листа'
                      : pinModal.action === 'editChecklistItem'
                        ? 'Редактировать пункт'
                        : 'Редактировать'
        }
        onClose={closePinModal}
        onSuccess={onPinSuccess}
      />

      <RegulationCardEditor
        open={regCardEditor.open}
        card={regCardEditor.card}
        saving={regCardSaving}
        error={regCardSaveError}
        onClose={() => setRegCardEditor({ open: false, card: null })}
        onSave={saveRegulationCard}
        onDelete={regCardEditor.card?.id ? deleteRegulationCardFromEditor : undefined}
      />

      <ChecklistItemEditor
        open={checklistEditor.open}
        item={checklistEditor.item}
        saving={checklistSaving}
        error={checklistSaveError}
        onClose={() => setChecklistEditor({ open: false, item: null })}
        onSave={saveChecklistItem}
        onDelete={checklistEditor.item?.id ? deleteChecklistItemFromEditor : undefined}
      />
    </div>
  )
}

export default App
