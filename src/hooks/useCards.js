import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchAllCards, fetchCardList, peekCachedCardList } from '../api/sheets'
import {
  bindNetworkSettleListeners,
  getFetchTimeoutMs,
  isOnline,
  markNetworkUnsettled,
  onNetworkSettled,
  waitForNetworkSettle,
} from '../utils/network'

function parseCardDate(value) {
  const raw = String(value || '').trim()
  if (!raw) return 0

  const nativeParsed = Date.parse(raw)
  if (!Number.isNaN(nativeParsed)) return nativeParsed

  const ruMatch = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (ruMatch) {
    const day = Number(ruMatch[1])
    const month = Number(ruMatch[2]) - 1
    const year = Number(ruMatch[3])
    return new Date(year, month, day).getTime()
  }

  return 0
}

async function fetchListWithTimeout(fetchOpts = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), getFetchTimeoutMs())
  try {
    return await fetchCardList({ ...fetchOpts, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function fetchAllWithTimeout(fetchOpts = {}) {
  const controller = new AbortController()
  // getAll тяжелее списка — даём чуть больше времени.
  const timer = setTimeout(() => controller.abort(), Math.max(getFetchTimeoutMs(), 12000))
  try {
    return await fetchAllCards({ ...fetchOpts, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Сеть сразу (без паузы на старте).
 * Пауза + повтор — только если запрос упал при online (handoff Wi‑Fi→LTE).
 */
async function fetchListFromNetwork(forceNetwork) {
  try {
    return await fetchListWithTimeout({ forceNetwork, networkOnly: true })
  } catch (firstErr) {
    if (!isOnline()) throw firstErr
    markNetworkUnsettled()
    await waitForNetworkSettle()
    return await fetchListWithTimeout({ forceNetwork: true, networkOnly: true })
  }
}

export function useCards() {
  const initialCache = useMemo(() => peekCachedCardList(), [])
  const [cards, setCards] = useState(initialCache)
  const [loading, setLoading] = useState(initialCache.length === 0)
  const [error, setError] = useState('')
  const hasCacheRef = useRef(initialCache.length > 0)
  const refreshGen = useRef(0)

  const loadCards = useCallback(async (opts = {}) => {
    const forceNetwork = Boolean(opts.forceNetwork)
    // Явный silent:false (кнопка 🔄) не перекрываем наличием локального кэша.
    const silent = opts.silent !== undefined ? Boolean(opts.silent) : hasCacheRef.current
    const gen = ++refreshGen.current

    try {
      if (!silent) {
        setLoading(true)
        setError('')
      }

      let nextCards
      let gotFullFromNetwork = false
      try {
        // Кнопка 🔄: полные карточки с сервера (getAll, без CacheService / localStorage).
        if (forceNetwork && !silent) {
          try {
            nextCards = await fetchAllWithTimeout({ forceNetwork: true, networkOnly: true })
            gotFullFromNetwork = true
          } catch {
            nextCards = await fetchListFromNetwork(true)
          }
        } else {
          nextCards = await fetchListFromNetwork(forceNetwork)
        }
      } catch (err) {
        // forceNetwork — только сеть, без подмены ответом из localStorage.
        if (forceNetwork || hasCacheRef.current) {
          if (!silent) setError(err.message || 'Не удалось загрузить позиции')
          return
        }
        nextCards = await fetchCardList({ forceNetwork: false })
      }

      if (gen !== refreshGen.current) return
      hasCacheRef.current = Array.isArray(nextCards) && nextCards.length > 0
      setCards(nextCards)
      setError('')

      // Полные техкарты — после списка, без блокировки UI (если ещё не тянули getAll).
      if (!gotFullFromNetwork) {
        window.setTimeout(() => {
          void (async () => {
            try {
              const full = await fetchAllCards({ forceNetwork, networkOnly: true })
              if (gen !== refreshGen.current) return
              if (!Array.isArray(full) || full.length === 0) return
              const byId = new Map(full.map((c) => [c.sheetName, c]))
              setCards((prev) => prev.map((c) => byId.get(c.sheetName) || c))
            } catch {
              /* список уже на экране */
            }
          })()
        }, 350)
      }
    } catch (err) {
      if (gen !== refreshGen.current) return
      if (!silent) setError(err.message || 'Не удалось загрузить позиции')
    } finally {
      if (gen === refreshGen.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    bindNetworkSettleListeners()
    // Есть кэш → сразу UI, сеть тихо. Нет кэша → обычный loading.
    void loadCards({ silent: initialCache.length > 0 })
  }, [loadCards, initialCache.length])

  useEffect(() => {
    return onNetworkSettled(() => {
      void loadCards({ forceNetwork: true, silent: true })
    })
  }, [loadCards])

  const updateLocalCard = useCallback((updatedCard) => {
    setCards((prev) =>
      prev.map((card) => (card.sheetName === updatedCard.sheetName ? updatedCard : card)),
    )
  }, [])

  const removeLocalCard = useCallback((sheetName) => {
    setCards((prev) => prev.filter((card) => card.sheetName !== sheetName))
  }, [])

  const addLocalCard = useCallback((newCard) => {
    setCards((prev) => [newCard, ...prev.filter((card) => card.sheetName !== newCard.sheetName)])
  }, [])

  const sortedCards = useMemo(
    () =>
      [...cards].sort((a, b) => {
        const dateDiff = parseCardDate(b.date) - parseCardDate(a.date)
        if (dateDiff !== 0) return dateDiff
        return String(a.name || '').localeCompare(String(b.name || ''))
      }),
    [cards],
  )

  return {
    cards: sortedCards,
    loading,
    error,
    refresh: useCallback(() => loadCards({ forceNetwork: true, silent: false }), [loadCards]),
    addLocalCard,
    updateLocalCard,
    removeLocalCard,
  }
}
