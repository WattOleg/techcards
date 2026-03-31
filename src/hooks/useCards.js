import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchCardList } from '../api/sheets'

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

export function useCards() {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadCards = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const nextCards = await fetchCardList()
      setCards(nextCards)
    } catch (err) {
      setError(err.message || 'Не удалось загрузить позиции')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCards()
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
    refresh: loadCards,
    addLocalCard,
    updateLocalCard,
    removeLocalCard,
  }
}
