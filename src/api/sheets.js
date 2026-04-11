const BASE_URL = import.meta.env.VITE_APPS_SCRIPT_URL
const OFFLINE_KEYS = {
  cardsList: 'tk_offline_cards_list_v1',
  cardsAll: 'tk_offline_cards_all_v1',
  sections: 'tk_offline_sections_v1',
  schedule: 'tk_offline_schedule_v1',
  writeoffs: 'tk_offline_writeoffs_v1',
}

function readOffline(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function writeOffline(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore storage errors
  }
}

async function requestJson(url, options) {
  const method = String(options?.method || 'GET').toUpperCase()
  const retries = 2
  let lastError = null

  // Не ставить Content-Type: application/json на POST к Apps Script: это включает CORS preflight
  // (OPTIONS), который у веб‑приложений GAS часто падает с телефона. Тело всё равно приходит в
  // postData.contents; fetch по умолчанию шлёт text/plain для строки — «простой» запрос.

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let res
    try {
      res = await fetch(url, options)
    } catch (err) {
      lastError = err
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 350 * (attempt + 1)))
        continue
      }
      throw new Error(
        'Не удалось подключиться к серверу. Проверьте URL (VITE_APPS_SCRIPT_URL), деплой Apps Script и доступ «Anyone».',
      )
    }

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      if (attempt < retries && res.status >= 500) {
        await new Promise((r) => setTimeout(r, 350 * (attempt + 1)))
        continue
      }
      if (!data.error && res.status === 403) {
        throw new Error('Доступ запрещён (403). В деплое Apps Script включите «Anyone».')
      }
      throw new Error(data.error || `Ошибка ответа сервера (${res.status})`)
    }
    if (data && data.error) {
      throw new Error(data.error)
    }
    return data
  }
  throw lastError || new Error('Ошибка сети')
}

const mockCards = [
  {
    sheetName: 'Aphrodite',
    name: 'Aphrodite',
    nameRu: 'Афродита',
    category: 'cocktail',
    yield: '150 мл',
    time: '5 мин',
    method: 'Shake',
    glass: 'Шампанское-блюдце',
    garnish: 'Цедра апельсина',
    photoUrl: '',
    author: 'Кравченко Богдан',
    date: '10.03.2025',
    technology: 'Взбить все ингредиенты со льдом в шейкере, процедить в охлажденный бокал.',
    ingredients: [
      { name: 'Ром Bacardi', amount: '50 мл' },
      { name: 'Ликер апельсиновый', amount: '20 мл' },
      { name: 'Сок лимона', amount: '15 мл' },
    ],
  },
  {
    sheetName: 'BerryFizz',
    name: 'Berry Fizz',
    nameRu: 'Берри Физз',
    category: 'mocktail',
    yield: '220 мл',
    time: '4 мин',
    method: 'Build',
    glass: 'Хайбол',
    garnish: 'Мята',
    photoUrl: '',
    author: 'Бар команда',
    date: '05.02.2026',
    technology: 'Собрать в бокале со льдом, аккуратно перемешать барной ложкой.',
    ingredients: [
      { name: 'Пюре ягодное', amount: '30 мл' },
      { name: 'Лайм фреш', amount: '15 мл' },
      { name: 'Содовая', amount: '120 мл' },
    ],
  },
]

export async function fetchAllCards(options = {}) {
  if (!BASE_URL) {
    return mockCards
  }
  try {
    const data = await requestJson(`${BASE_URL}?action=getAll`, { signal: options.signal })
    const cards = data.cards || []
    writeOffline(OFFLINE_KEYS.cardsAll, cards)
    return cards
  } catch (err) {
    const cached = readOffline(OFFLINE_KEYS.cardsAll, [])
    if (cached.length) return cached
    throw err
  }
}

export async function fetchCardList(options = {}) {
  if (!BASE_URL) {
    return mockCards
  }
  try {
    const data = await requestJson(`${BASE_URL}?action=getList`, { signal: options.signal })
    const cards = data.cards || []
    writeOffline(OFFLINE_KEYS.cardsList, cards)
    return cards
  } catch (err) {
    const cachedList = readOffline(OFFLINE_KEYS.cardsList, [])
    if (cachedList.length) return cachedList
    throw err
  }
}

export async function fetchCardDetail(sheetName, options = {}) {
  if (!BASE_URL) {
    const found = mockCards.find((card) => card.sheetName === sheetName)
    return found || null
  }
  try {
    const data = await requestJson(
      `${BASE_URL}?action=getCard&sheetName=${encodeURIComponent(sheetName)}`,
      { signal: options.signal },
    )
    const card = data.card || null
    if (card && card.sheetName) {
      const all = readOffline(OFFLINE_KEYS.cardsAll, [])
      const next = [card, ...all.filter((c) => c && c.sheetName !== card.sheetName)]
      writeOffline(OFFLINE_KEYS.cardsAll, next)
    }
    return card
  } catch {
    const all = readOffline(OFFLINE_KEYS.cardsAll, [])
    const foundCached = all.find((card) => card && card.sheetName === sheetName)
    if (foundCached) return foundCached
    const list = readOffline(OFFLINE_KEYS.cardsList, [])
    return list.find((card) => card && card.sheetName === sheetName) || null
  }
}

export async function updateCard(sheetName, cardData, pin) {
  if (!BASE_URL) {
    return { success: true, mocked: true, sheetName, cardData, pin }
  }
  return await requestJson(BASE_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'update', sheetName, data: cardData, pin }),
  })
}

export async function createCard(cardData, pin) {
  if (!BASE_URL) {
    return { success: true, mocked: true, cardData, pin }
  }
  return await requestJson(BASE_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'create', data: cardData, pin }),
  })
}

export async function deleteCard(sheetName, pin) {
  if (!BASE_URL) {
    return { success: true, mocked: true, sheetName, pin }
  }
  return await requestJson(BASE_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'delete', sheetName, pin }),
  })
}

export async function fetchSectionsContent() {
  if (!BASE_URL) {
    return {
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
  }
  try {
    const data = await requestJson(`${BASE_URL}?action=getSections`)
    const sections = data.sections || {}
    writeOffline(OFFLINE_KEYS.sections, sections)
    return sections
  } catch (err) {
    const cached = readOffline(OFFLINE_KEYS.sections, null)
    if (cached && typeof cached === 'object') return cached
    throw err
  }
}

export async function updateSectionContent(sectionId, title, points, pin) {
  if (!BASE_URL) {
    return { success: true, mocked: true, sectionId, title, points, pin }
  }
  return await requestJson(BASE_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'updateSection', sectionId, title, points, pin }),
  })
}

const mockSchedule = {
  defaultStart: '09:00',
  defaultEnd: '23:00',
  employees: [
    { id: 'e1', name: 'Пример', color: '#f0d4cf', hourlyRate: 300 },
  ],
  employeesByMonth: {},
  shifts: [],
  shortageByMonth: {},
  bonusesByMonth: {},
}

const mockWriteoffs = {
  entries: [],
  templates: [
    {
      id: 'tpl-ethiopia',
      title: 'Кофе Эфиопия',
      item: 'Кофе Эфиопия',
      qty: '60',
      unit: 'гр',
      type: 'move',
      reason: 'на Кондитерский',
    },
  ],
}

function offlineWriteoffsState() {
  const cur = readOffline(OFFLINE_KEYS.writeoffs, null)
  if (cur && typeof cur === 'object' && Array.isArray(cur.entries) && Array.isArray(cur.templates)) {
    return { entries: [...cur.entries], templates: [...cur.templates] }
  }
  return {
    entries: Array.isArray(mockWriteoffs.entries) ? [...mockWriteoffs.entries] : [],
    templates: Array.isArray(mockWriteoffs.templates) ? [...mockWriteoffs.templates] : [],
  }
}

function persistOfflineWriteoffs(state) {
  writeOffline(OFFLINE_KEYS.writeoffs, state)
}

/** Сохранить снимок списаний в localStorage (после успешной записи при сбое повторной загрузки). */
export function syncWriteoffsOfflineCache(writeoffs) {
  if (writeoffs && typeof writeoffs === 'object') {
    writeOffline(OFFLINE_KEYS.writeoffs, writeoffs)
  }
}

export async function fetchSchedule() {
  if (!BASE_URL) {
    return mockSchedule
  }
  try {
    const cb = Date.now()
    const data = await requestJson(`${BASE_URL}?action=getSchedule&_cb=${cb}`)
    const schedule = data.schedule || mockSchedule
    writeOffline(OFFLINE_KEYS.schedule, schedule)
    return schedule
  } catch (err) {
    const cached = readOffline(OFFLINE_KEYS.schedule, null)
    if (cached && typeof cached === 'object') return cached
    throw err
  }
}

export async function updateSchedule(schedule, pin) {
  if (!BASE_URL) {
    return { success: true, mocked: true, schedule, pin }
  }
  return await requestJson(BASE_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'updateSchedule', schedule, pin }),
  })
}

export async function fetchWriteoffs() {
  if (!BASE_URL) {
    return offlineWriteoffsState()
  }
  try {
    const cb = Date.now()
    const data = await requestJson(`${BASE_URL}?action=getWriteoffs&_cb=${cb}`)
    const writeoffs = data.writeoffs || mockWriteoffs
    writeOffline(OFFLINE_KEYS.writeoffs, writeoffs)
    return writeoffs
  } catch (err) {
    const cached = readOffline(OFFLINE_KEYS.writeoffs, null)
    if (cached && typeof cached === 'object') return cached
    throw err
  }
}

/**
 * Списания: короткий GET к Apps Script (без JSON в query) + POST только для шаблонов.
 */
export async function mutateWriteoffs(payload, pin) {
  const op = String(payload?.op || '').trim()
  if (!op) throw new Error('Не указана операция')

  if (!BASE_URL) {
    const state = offlineWriteoffsState()
    if (op === 'append' && payload.entry) {
      state.entries.unshift({ ...payload.entry })
      persistOfflineWriteoffs(state)
      return { success: true, mocked: true }
    }
    if (op === 'delete' && payload.id) {
      state.entries = state.entries.filter((e) => e.id !== payload.id)
      persistOfflineWriteoffs(state)
      return { success: true, mocked: true }
    }
    if (op === 'update' && payload.entry) {
      const e = payload.entry
      state.entries = state.entries.map((x) => (x.id === e.id ? { ...e } : x))
      persistOfflineWriteoffs(state)
      return { success: true, mocked: true }
    }
    if (op === 'templates' && Array.isArray(payload.templates)) {
      state.templates = payload.templates.map((t) => ({ ...t }))
      persistOfflineWriteoffs(state)
      return { success: true, mocked: true }
    }
    throw new Error('Неверная операция')
  }

  const baseUrl = String(BASE_URL).trim()
  const pinStr = String(pin || '')

  if (op === 'templates' && Array.isArray(payload.templates)) {
    return await requestJson(baseUrl, {
      method: 'POST',
      body: JSON.stringify({
        action: 'updateWriteoffs',
        pin: pinStr,
        op: 'templates',
        templates: payload.templates,
      }),
    })
  }

  const buildUrl = (action, extra) => {
    const u = new URL(baseUrl)
    u.searchParams.set('action', action)
    u.searchParams.set('pin', pinStr)
    u.searchParams.set('_cb', String(Date.now()))
    Object.keys(extra).forEach((k) => {
      const v = extra[k]
      if (v != null && v !== '') u.searchParams.set(k, String(v))
    })
    return u.toString()
  }

  if (op === 'append' && payload.entry) {
    const e = payload.entry
    const url = buildUrl('appendSimpleWriteoff', {
      item: e.item || '',
      qty: String(e.qty || ''),
      unit: e.unit || '',
      typ: e.type === 'move' ? 'move' : 'writeoff',
      emp: e.employee || '',
      date: e.date || '',
      reason: String(e.reason || '').slice(0, 500),
    })
    return await requestJson(url)
  }

  if (op === 'delete' && payload.id != null && payload.id !== '') {
    const url = buildUrl('deleteSimpleWriteoff', { id: String(payload.id) })
    return await requestJson(url)
  }

  if (op === 'update' && payload.entry) {
    const e = payload.entry
    const url = buildUrl('updateSimpleWriteoff', {
      id: String(e.id || ''),
      item: e.item || '',
      qty: String(e.qty || ''),
      unit: e.unit || '',
      typ: e.type === 'move' ? 'move' : 'writeoff',
      emp: e.employee || '',
      date: e.date || '',
      reason: String(e.reason || '').slice(0, 500),
    })
    if (url.length <= 7200) {
      return await requestJson(url)
    }
    return await requestJson(baseUrl, {
      method: 'POST',
      body: JSON.stringify({
        action: 'updateWriteoffs',
        pin: pinStr,
        op: 'update',
        entry: payload.entry,
      }),
    })
  }

  throw new Error('Неверная операция')
}
