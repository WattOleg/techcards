const BASE_URL = import.meta.env.VITE_APPS_SCRIPT_URL
const OFFLINE_KEYS = {
  cardsList: 'tk_offline_cards_list_v1',
  cardsAll: 'tk_offline_cards_all_v1',
  sections: 'tk_offline_sections_v1',
  schedule: 'tk_offline_schedule_v1',
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
  let res
  try {
    res = await fetch(url, options)
  } catch {
    throw new Error('Не удалось подключиться к серверу. Проверьте Apps Script deploy и доступ "Anyone".')
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || 'Ошибка ответа сервера')
  }
  if (data && data.error) {
    throw new Error(data.error)
  }
  return data
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

export async function fetchAllCards() {
  if (!BASE_URL) {
    return mockCards
  }
  try {
    const data = await requestJson(`${BASE_URL}?action=getAll`)
    const cards = data.cards || []
    writeOffline(OFFLINE_KEYS.cardsAll, cards)
    return cards
  } catch (err) {
    const cached = readOffline(OFFLINE_KEYS.cardsAll, [])
    if (cached.length) return cached
    throw err
  }
}

export async function fetchCardList() {
  if (!BASE_URL) {
    return mockCards
  }
  try {
    const data = await requestJson(`${BASE_URL}?action=getList`)
    const cards = data.cards || []
    writeOffline(OFFLINE_KEYS.cardsList, cards)
    return cards
  } catch (err) {
    const cachedList = readOffline(OFFLINE_KEYS.cardsList, [])
    if (cachedList.length) return cachedList
    try {
      return await fetchAllCards()
    } catch {
      throw err
    }
  }
}

export async function fetchCardDetail(sheetName) {
  if (!BASE_URL) {
    const found = mockCards.find((card) => card.sheetName === sheetName)
    return found || null
  }
  try {
    const data = await requestJson(
      `${BASE_URL}?action=getCard&sheetName=${encodeURIComponent(sheetName)}`,
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
  shifts: [],
  shortageByMonth: {},
  bonusesByMonth: {},
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
