/** Маркер в количестве: переживает старый Apps Script, который пишет только имя и объём. */
export const INGREDIENT_LINK_MARK = ' || '

function splitAmountLink(amount, linkedSheetName) {
  const raw = String(amount || '')
  let link = String(linkedSheetName || '').trim()
  let qty = raw
  const idx = raw.lastIndexOf(INGREDIENT_LINK_MARK)
  if (idx !== -1) {
    const encoded = raw.slice(idx + INGREDIENT_LINK_MARK.length).trim()
    qty = raw.slice(0, idx)
    if (!link && encoded) link = encoded
  }
  return { amount: qty, linkedSheetName: link }
}

export function decodeIngredient(ing) {
  const { amount, linkedSheetName } = splitAmountLink(ing?.amount, ing?.linkedSheetName)
  return {
    name: ing?.name || '',
    amount,
    linkedSheetName,
  }
}

export function encodeIngredient(ing) {
  const decoded = decodeIngredient(ing)
  const link = String(decoded.linkedSheetName || '').trim()
  return {
    name: decoded.name,
    amount: link ? `${decoded.amount}${INGREDIENT_LINK_MARK}${link}` : decoded.amount,
    linkedSheetName: link,
  }
}

export function decodeCardIngredients(card) {
  if (!card || typeof card !== 'object') return card
  if (!Array.isArray(card.ingredients)) return card
  return {
    ...card,
    ingredients: card.ingredients.map(decodeIngredient),
  }
}

export function encodeCardIngredients(card) {
  if (!card || typeof card !== 'object') return card
  if (!Array.isArray(card.ingredients)) return card
  return {
    ...card,
    ingredients: card.ingredients.map(encodeIngredient),
  }
}

export function mergeIngredientLinks(prevCard, nextCard) {
  if (!nextCard) return prevCard
  const next = decodeCardIngredients(nextCard)
  if (!prevCard) return next
  if (next.isPartial && !prevCard.isPartial) {
    return {
      ...next,
      technology: prevCard.technology || next.technology || '',
      ingredients: Array.isArray(prevCard.ingredients) ? prevCard.ingredients : next.ingredients,
      isPartial: false,
    }
  }
  const prevList = Array.isArray(prevCard.ingredients) ? prevCard.ingredients.map(decodeIngredient) : []
  const nextList = Array.isArray(next.ingredients) ? next.ingredients : []
  if (!nextList.length) return next
  return {
    ...next,
    ingredients: nextList.map((ing, i) => {
      if (ing.linkedSheetName) return ing
      const prev = prevList[i]
      if (prev?.linkedSheetName && String(prev.name || '') === String(ing.name || '')) {
        return { ...ing, linkedSheetName: prev.linkedSheetName }
      }
      const byName = prevList.find(
        (p) => p.linkedSheetName && String(p.name || '') === String(ing.name || ''),
      )
      return byName ? { ...ing, linkedSheetName: byName.linkedSheetName } : ing
    }),
  }
}
