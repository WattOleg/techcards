import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchAllCards, fetchCardList } from '../api/sheets'
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

/**
 * Загрузка с учётом Wi‑Fi → LTE: ждём стабилизации, при сбое ждём и пробуем ещё раз,
 * иначе на медленном мобильном молча остаёмся на localStorage.
 */
async function fetchListResilient(opts = {}) {
  const forceNetwork = Boolean(opts.forceNetwork)
  await waitForNetworkSettle()

  try {
    return await fetchListWithTimeout({ forceNetwork, networkOnly: true })
  } catch (firstErr) {
    if (!isOnline()) {
      // Оффлайн — отдаём кэш, если есть.
      return await fetchCardList({ forceNetwork: false })
    }
    markNetworkUnsettled(2200)
    await waitForNetworkSettle()
    try {
      return await fetchListWithTimeout({ forceNetwork: true, networkOnly: true })
    } catch {
      try {
        return await fetchCardList({ forceNetwork: false })
      } catch {
        throw firstErr
      }
    }
  }
}

export function useCards() {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadCards = useCallback(async (opts = {}) => {
    const forceNetwork = Boolean(opts.forceNetwork)
    const silent = Boolean(opts.silent)
    try {
      if (!silent) {
        setLoading(true)
        setError('')
      }

      const nextCards = await fetchListResilient({ forceNetwork })
      setCards(nextCards)
      setError('')

      // Background: полные техкарты для быстрых деталей.
      void (async () => {
        try {
          await waitForNetworkSettle()
          const full = await fetchAllCards({ forceNetwork, networkOnly: true })
          if (!Array.isArray(full) || full.length === 0) return
          const byId = new Map(full.map((c) => [c.sheetName, c]))
          setCards((prev) => prev.map((c) => byId.get(c.sheetName) || c))
        } catch {
          // список уже на экране; полные данные подтянутся при следующем settle
        }
      })()
    } catch (err) {
      if (!silent) setError(err.message || 'Не удалось загрузить позиции')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    bindNetworkSettleListeners()
    loadCards()
  }, [loadCards])

  // После появления сети / смены Wi‑Fi↔LTE мягко подтянуть свежие данные.
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
    refresh: useCallback(() => loadCards({ forceNetwork: true }), [loadCards]),
    addLocalCard,
    updateLocalCard,
    removeLocalCard,
  }
}
