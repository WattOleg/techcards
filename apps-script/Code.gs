const SPREADSHEET_ID = '1-Y32ev-G5ooRWcRMHbiSRShnyg4yb6ysF9s4kzJqiLo'
const PIN = '1234'
const LIST_CACHE_KEY = 'cards_list_v1'
const LIST_CACHE_TTL_SEC = 120
const SECTIONS_SHEET_NAME = '_APP_CONTENT'
const SCHEDULE_SHEET_NAME = '_SCHEDULE'
/** Месячные листы: _SCHEDULE_2026-03 (JSON смен + недостача за месяц) */
const SCHEDULE_MONTH_PREFIX = '_SCHEDULE_'
const STATS_SHEET_NAME = '_APP_STATS'
const WRITEOFFS_SHEET_NAME = '_WRITEOFFS'
/** Строка 1: A1 — JSON { templates: [...] }. Строка 2 — заголовки. Со строки 3 — записи списаний. */
const WRITEOFFS_DATA_ROW_START = 3
const WRITEOFFS_HEADERS = ['id', 'date', 'employee', 'item', 'qty', 'unit', 'type', 'reason', 'createdAt']

function doGet(e) {
  const action = e.parameter.action
  if (action === 'getList') return getList()
  if (action === 'getCard') return getCard(e.parameter.sheetName)
  if (action === 'getAll') return getAll()
  if (action === 'getSections') return getSections()
  if (action === 'getSchedule') return getSchedule()
  if (action === 'getWriteoffs') return getWriteoffs()
  /** Надёжная запись списаний с мобильных: тот же контракт, что POST updateWriteoffs, но через GET (без CORS preflight). */
  if (action === 'writeoffsMutate') return writeoffsMutateFromGet_(e.parameter)
  if (action === 'logVisit') return logAppVisit()
  return jsonResponse({ error: 'unknown action' })
}

function writeoffsMutateFromGet_(params) {
  const raw = params.payload != null ? String(params.payload) : ''
  if (!raw) return jsonResponse({ error: 'payload required' })
  let inner
  try {
    inner = JSON.parse(raw)
  } catch (err) {
    return jsonResponse({ error: 'Некорректный payload' })
  }
  if (!inner || typeof inner !== 'object') return jsonResponse({ error: 'invalid payload' })
  const pin = params.pin != null ? String(params.pin) : ''
  const out = updateWriteoffs({
    pin: pin,
    op: inner.op,
    entry: inner.entry,
    id: inner.id,
    templates: inner.templates,
  })
  const cb = params.callback != null ? String(params.callback).replace(/[^a-zA-Z0-9_$]/g, '') : ''
  if (cb.length >= 8 && cb.length <= 64 && /^[a-zA-Z_$]/.test(cb)) {
    const jsonBody = out.getContent()
    return ContentService.createTextOutput(cb + '(' + jsonBody + ');').setMimeType(ContentService.MimeType.JAVASCRIPT)
  }
  return out
}

function doPost(e) {
  let body
  try {
    const raw = e.postData && e.postData.contents != null ? String(e.postData.contents) : ''
    body = raw ? JSON.parse(raw) : {}
  } catch (err) {
    return jsonResponse({ error: 'Некорректный JSON в теле запроса' })
  }
  if (!body || typeof body !== 'object') return jsonResponse({ error: 'Пустое тело запроса' })
  if (body.action === 'create') return createSheet(body)
  if (body.action === 'update') return updateSheet(body)
  if (body.action === 'delete') return deleteSheet(body)
  if (body.action === 'updateSection') return updateSection(body)
  if (body.action === 'updateSchedule') return updateSchedule(body)
  if (body.action === 'updateWriteoffs') return updateWriteoffs(body)
  return jsonResponse({ error: 'unknown action' })
}

function normalizeWriteoffEntry_(e) {
  return {
    id: String((e && e.id) || '').trim() || Utilities.getUuid(),
    date: String((e && e.date) || '').trim(),
    employee: String((e && e.employee) || '').trim(),
    item: String((e && e.item) || '').trim(),
    qty: String((e && e.qty) || '').trim(),
    unit: String((e && e.unit) || '').trim(),
    type: String((e && e.type) || '').trim() === 'move' ? 'move' : 'writeoff',
    reason: String((e && e.reason) || '').trim(),
    createdAt: String((e && e.createdAt) || '').trim(),
  }
}

function normalizeWriteoffTemplate_(t) {
  return {
    id: String((t && t.id) || '').trim() || Utilities.getUuid(),
    title: String((t && t.title) || '').trim(),
    item: String((t && t.item) || '').trim(),
    qty: String((t && t.qty) || '').trim(),
    unit: String((t && t.unit) || '').trim(),
    type: String((t && t.type) || '').trim() === 'move' ? 'move' : 'writeoff',
    reason: String((t && t.reason) || '').trim(),
  }
}

function getWriteoffsSheet_(ss) {
  let sheet = ss.getSheetByName(WRITEOFFS_SHEET_NAME)
  if (!sheet) {
    sheet = ss.insertSheet(WRITEOFFS_SHEET_NAME)
    sheet.getRange(1, 1).setValue(JSON.stringify({ templates: [] }))
    sheet.getRange(2, 1, 2, WRITEOFFS_HEADERS.length).setValues([WRITEOFFS_HEADERS])
    sheet.hideSheet()
  }
  return sheet
}

function ensureWriteoffHeaderRow_(sheet) {
  const cell = String(sheet.getRange(2, 1).getValue() || '').trim()
  if (cell !== 'id') {
    sheet.getRange(2, 1, 2, WRITEOFFS_HEADERS.length).setValues([WRITEOFFS_HEADERS])
  }
}

function migrateWriteoffsIfNeeded_(sheet) {
  const raw = sheet.getRange(1, 1).getValue()
  if (!raw || !String(raw).trim()) return
  let parsed
  try {
    parsed = JSON.parse(String(raw))
  } catch (e) {
    return
  }
  if (!parsed || typeof parsed !== 'object') return
  if (Array.isArray(parsed.entries) && parsed.entries.length > 0) {
    ensureWriteoffHeaderRow_(sheet)
    const entries = parsed.entries
      .map(normalizeWriteoffEntry_)
      .filter(function (e) {
        return e.date && e.employee && e.item && e.qty
      })
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i]
      sheet.appendRow([e.id, e.date, e.employee, e.item, e.qty, e.unit, e.type, e.reason, e.createdAt])
    }
    const templates = Array.isArray(parsed.templates) ? parsed.templates : []
    sheet.getRange(1, 1).setValue(JSON.stringify({ templates: templates }))
    return
  }
  if (parsed.entries !== undefined) {
    const templates = Array.isArray(parsed.templates) ? parsed.templates : []
    sheet.getRange(1, 1).setValue(JSON.stringify({ templates: templates }))
  }
}

function readEntriesFromSheet_(sheet) {
  const lastRow = sheet.getLastRow()
  if (lastRow < WRITEOFFS_DATA_ROW_START) return []
  const data = sheet.getRange(WRITEOFFS_DATA_ROW_START, 1, lastRow, 9).getValues()
  const out = []
  for (var r = 0; r < data.length; r++) {
    const row = data[r]
    const id = String(row[0] || '').trim()
    if (!id) continue
    const entry = {
      id: id,
      date: String(row[1] || '').trim(),
      employee: String(row[2] || '').trim(),
      item: String(row[3] || '').trim(),
      qty: String(row[4] || '').trim(),
      unit: String(row[5] || '').trim(),
      type: String(row[6] || '').trim() === 'move' ? 'move' : 'writeoff',
      reason: String(row[7] || '').trim(),
      createdAt: String(row[8] || '').trim(),
    }
    if (entry.date && entry.employee && entry.item && entry.qty) out.push(entry)
  }
  return out
}

function parseTemplatesFromA1_(raw) {
  if (!raw || !String(raw).trim()) return []
  try {
    const parsed = JSON.parse(String(raw))
    if (!parsed || typeof parsed !== 'object') return []
    if (Array.isArray(parsed.templates)) return parsed.templates
    return []
  } catch (e) {
    return []
  }
}

function getWriteoffs() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID)
  const sheet = getWriteoffsSheet_(ss)
  migrateWriteoffsIfNeeded_(sheet)
  ensureWriteoffHeaderRow_(sheet)
  const raw = sheet.getRange(1, 1).getValue()
  const templates = parseTemplatesFromA1_(raw)
    .map(normalizeWriteoffTemplate_)
    .filter(function (t) {
      return t.title && t.item && t.qty
    })
  const entries = readEntriesFromSheet_(sheet)
  return jsonResponse({ writeoffs: { entries: entries, templates: templates } })
}

function findWriteoffRowById_(sheet, id) {
  const target = String(id || '').trim()
  if (!target) return -1
  const lastRow = sheet.getLastRow()
  if (lastRow < WRITEOFFS_DATA_ROW_START) return -1
  const col = sheet.getRange(WRITEOFFS_DATA_ROW_START, 1, lastRow, 1).getValues()
  for (var i = 0; i < col.length; i++) {
    if (String(col[i][0] || '').trim() === target) return WRITEOFFS_DATA_ROW_START + i
  }
  return -1
}

function appendWriteoffEntry_(body) {
  let e = normalizeWriteoffEntry_(body.entry)
  if (!e.date || !e.employee || !e.item || !e.qty) return jsonResponse({ error: 'entry: нужны date, employee, item, qty' })
  if (!e.createdAt) e.createdAt = new Date().toISOString()
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID)
  const sheet = getWriteoffsSheet_(ss)
  migrateWriteoffsIfNeeded_(sheet)
  ensureWriteoffHeaderRow_(sheet)
  sheet.appendRow([e.id, e.date, e.employee, e.item, e.qty, e.unit, e.type, e.reason, e.createdAt])
  return jsonResponse({ success: true, entry: e })
}

function deleteWriteoffEntry_(body) {
  const id = String(body.id || '').trim()
  if (!id) return jsonResponse({ error: 'id is required' })
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID)
  const sheet = getWriteoffsSheet_(ss)
  migrateWriteoffsIfNeeded_(sheet)
  const row = findWriteoffRowById_(sheet, id)
  if (row < 0) return jsonResponse({ error: 'запись не найдена' })
  sheet.deleteRow(row)
  return jsonResponse({ success: true })
}

function updateWriteoffEntry_(body) {
  const e = normalizeWriteoffEntry_(body.entry)
  if (!e.id || !e.date || !e.employee || !e.item || !e.qty) return jsonResponse({ error: 'entry: нужны id, date, employee, item, qty' })
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID)
  const sheet = getWriteoffsSheet_(ss)
  migrateWriteoffsIfNeeded_(sheet)
  const row = findWriteoffRowById_(sheet, e.id)
  if (row < 0) return jsonResponse({ error: 'запись не найдена' })
  sheet.getRange(row, 1, row, 9).setValues([[e.id, e.date, e.employee, e.item, e.qty, e.unit, e.type, e.reason, e.createdAt]])
  return jsonResponse({ success: true, entry: e })
}

function updateWriteoffTemplates_(body) {
  const src = body.templates
  if (!Array.isArray(src)) return jsonResponse({ error: 'templates must be an array' })
  const templates = src
    .map(normalizeWriteoffTemplate_)
    .filter(function (t) {
      return t.title && t.item && t.qty
    })
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID)
  const sheet = getWriteoffsSheet_(ss)
  migrateWriteoffsIfNeeded_(sheet)
  sheet.getRange(1, 1).setValue(JSON.stringify({ templates: templates }))
  return jsonResponse({ success: true })
}

function updateWriteoffs(body) {
  if (body.pin && body.pin !== PIN) return jsonResponse({ error: 'invalid pin' })
  const op = String(body.op || '').trim()
  if (op === 'append') return appendWriteoffEntry_(body)
  if (op === 'delete') return deleteWriteoffEntry_(body)
  if (op === 'update') return updateWriteoffEntry_(body)
  if (op === 'templates') return updateWriteoffTemplates_(body)
  return jsonResponse({ error: 'Укажите op: append, delete, update, templates' })
}

function getDefaultSectionsObject() {
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

function getSectionsSheet_(ss) {
  let sheet = ss.getSheetByName(SECTIONS_SHEET_NAME)
  if (!sheet) {
    sheet = ss.insertSheet(SECTIONS_SHEET_NAME)
    sheet.getRange(1, 1, 1, 3).setValues([['sectionId', 'title', 'points']])
    const defaults = getDefaultSectionsObject()
    const rows = Object.keys(defaults).map((sectionId) => {
      const data = defaults[sectionId]
      return [sectionId, data.title, (data.points || []).join('\n')]
    })
    if (rows.length) {
      sheet.getRange(2, 1, rows.length, 3).setValues(rows)
    }
    sheet.hideSheet()
  }
  return sheet
}

function getSections() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID)
  const sheet = getSectionsSheet_(ss)
  const lastRow = sheet.getLastRow()
  const defaults = getDefaultSectionsObject()
  if (lastRow < 2) return jsonResponse({ sections: defaults })

  const rows = sheet.getRange(2, 1, lastRow - 1, 3).getValues()
  const sections = {}
  rows.forEach((row) => {
    const sectionId = String(row[0] || '').trim()
    if (!sectionId) return
    const base = defaults[sectionId] || { title: sectionId, points: [] }
    const title = String(row[1] || '').trim() || base.title
    const pointsText = String(row[2] || '')
    const points = pointsText
      .split(/\r\n|\n|\r/)
      .map(function (line) {
        return String(line || '').replace(/\u00a0/g, ' ').trim()
      })
      .filter(Boolean)
    sections[sectionId] = {
      title: title,
      points: points.length ? points : base.points,
    }
  })

  return jsonResponse({ sections: { ...defaults, ...sections } })
}

function updateSection(body) {
  if (body.pin && body.pin !== PIN) return jsonResponse({ error: 'invalid pin' })
  const sectionId = String(body.sectionId || '').trim()
  if (!sectionId) return jsonResponse({ error: 'sectionId is required' })
  const points = Array.isArray(body.points) ? body.points : []
  const safePoints = points.map((p) => String(p || '').trim()).filter(Boolean)
  const title = String(body.title || '').trim()

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID)
  const sheet = getSectionsSheet_(ss)
  const lastRow = sheet.getLastRow()
  const rows = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues() : []
  const idx = rows.findIndex((row) => String(row[0] || '').trim() === sectionId)
  const targetRow = idx === -1 ? lastRow + 1 : idx + 2
  const defaults = getDefaultSectionsObject()
  const defaultTitle = defaults[sectionId] ? defaults[sectionId].title : sectionId
  const nextTitle = title || defaultTitle
  const pointsText = safePoints.join('\n')

  sheet.getRange(targetRow, 1, 1, 3).setValues([[sectionId, nextTitle, pointsText]])
  return jsonResponse({ success: true })
}

function shouldIncludeSheetInCardList_(sheetName) {
  const n = String(sheetName || '')
  if (n === SECTIONS_SHEET_NAME || n === SCHEDULE_SHEET_NAME || n === STATS_SHEET_NAME || n === WRITEOFFS_SHEET_NAME) return false
  if (n.indexOf(SCHEDULE_MONTH_PREFIX) === 0 && n.length > SCHEDULE_MONTH_PREFIX.length) return false
  return true
}

/** Увеличивает счётчик открытий приложения (ячейка A1 на скрытом листе). */
function logAppVisit() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID)
  let sheet = ss.getSheetByName(STATS_SHEET_NAME)
  if (!sheet) {
    sheet = ss.insertSheet(STATS_SHEET_NAME)
    sheet.getRange(1, 1).setValue(0)
    sheet.getRange(1, 2).setValue('Счётчик открытий веб-приложения')
    sheet.hideSheet()
  }
  const lock = LockService.getScriptLock()
  lock.waitLock(10000)
  try {
    const cell = sheet.getRange(1, 1)
    const prev = parseInt(String(cell.getValue() || '0'), 10)
    const next = (isNaN(prev) ? 0 : Math.max(0, prev)) + 1
    cell.setValue(next)
    return jsonResponse({ visitCount: next })
  } finally {
    lock.releaseLock()
  }
}

function getAll() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID)
  const cards = ss
    .getSheets()
    .filter((sheet) => shouldIncludeSheetInCardList_(sheet.getName()))
    .map((sheet) => parseSheet(sheet, true))
  return jsonResponse({ cards })
}

function getList() {
  const cache = CacheService.getScriptCache()
  const cached = cache.get(LIST_CACHE_KEY)
  if (cached) {
    return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON)
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID)
  const cards = ss
    .getSheets()
    .filter((sheet) => shouldIncludeSheetInCardList_(sheet.getName()))
    .map((sheet) => parseSheet(sheet, false))
  const payload = JSON.stringify({ cards })
  cache.put(LIST_CACHE_KEY, payload, LIST_CACHE_TTL_SEC)
  return ContentService.createTextOutput(payload).setMimeType(ContentService.MimeType.JSON)
}

function getCard(sheetName) {
  const name = String(sheetName || '').trim()
  if (!name) return jsonResponse({ error: 'sheetName is required' })
  if (!shouldIncludeSheetInCardList_(name)) return jsonResponse({ error: 'sheet not found' })
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID)
  const sheet = ss.getSheetByName(name)
  if (!sheet) return jsonResponse({ error: 'sheet not found' })
  return jsonResponse({ card: parseSheet(sheet, true) })
}

function parseSheet(sheet, includeDetails) {
  const name = sheet.getName()
  const meta = sheet.getRange(1, 2, 12, 1).getValues().map((row) => row[0])
  const get = (index) => (meta[index] !== undefined ? meta[index] : '')
  const card = {
    sheetName: name,
    name: get(0),
    nameRu: get(1),
    category: get(2),
    yield: get(3),
    time: get(4),
    method: get(5),
    glass: get(6),
    garnish: get(7),
    photoUrl: get(8),
    author: get(9),
    date: get(10),
    technology: includeDetails ? get(11) : '',
    ingredients: [],
    isPartial: !includeDetails,
  }

  if (includeDetails) {
    const ingredients = []
    const lastRow = sheet.getLastRow()
    if (lastRow >= 14) {
      const ingredientRange = sheet.getRange(14, 1, lastRow - 13, 2).getValues()
      ingredientRange.forEach((row) => {
        if (row[0]) ingredients.push({ name: row[0], amount: row[1] || '' })
      })
    }
    card.ingredients = ingredients
  }
  return card
}

function updateSheet(body) {
  if (body.pin && body.pin !== PIN) return jsonResponse({ error: 'invalid pin' })
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID)
  const sheet = ss.getSheetByName(body.sheetName)
  if (!sheet) return jsonResponse({ error: 'sheet not found' })

  const d = body.data
  const set = (row, val) => sheet.getRange(row, 2).setValue(val || '')
  set(1, d.name)
  set(2, d.nameRu)
  set(3, d.category)
  set(4, d.yield)
  set(5, d.time)
  set(6, d.method)
  set(7, d.glass)
  set(8, d.garnish)
  set(9, d.photoUrl)
  set(10, d.author)
  set(11, d.date)
  set(12, d.technology)
  sheet.getRange(14, 1, 50, 2).clearContent()
  ;(d.ingredients || []).forEach((ing, i) => {
    sheet.getRange(14 + i, 1).setValue(ing.name || '')
    sheet.getRange(14 + i, 2).setValue(ing.amount || '')
  })
  clearListCache()
  return jsonResponse({ success: true })
}

function createSheet(body) {
  if (body.pin && body.pin !== PIN) return jsonResponse({ error: 'invalid pin' })
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID)
  const d = body.data || {}
  const sheetName = String(d.sheetName || '').trim()
  if (!sheetName) return jsonResponse({ error: 'sheetName is required' })
  if (ss.getSheetByName(sheetName)) return jsonResponse({ error: 'sheet already exists' })

  const sheet = ss.insertSheet(sheetName)
  const set = (row, val) => sheet.getRange(row, 2).setValue(val || '')
  set(1, d.name)
  set(2, d.nameRu)
  set(3, d.category)
  set(4, d.yield)
  set(5, d.time)
  set(6, d.method)
  set(7, d.glass)
  set(8, d.garnish)
  set(9, d.photoUrl)
  set(10, d.author)
  set(11, d.date)
  set(12, d.technology)
  ;(d.ingredients || []).forEach((ing, i) => {
    sheet.getRange(14 + i, 1).setValue(ing.name || '')
    sheet.getRange(14 + i, 2).setValue(ing.amount || '')
  })
  clearListCache()
  return jsonResponse({ success: true })
}

function deleteSheet(body) {
  if (body.pin && body.pin !== PIN) return jsonResponse({ error: 'invalid pin' })
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID)
  const sheet = ss.getSheetByName(body.sheetName)
  if (!sheet) return jsonResponse({ error: 'sheet not found' })
  ss.deleteSheet(sheet)
  clearListCache()
  return jsonResponse({ success: true })
}

function clearListCache() {
  CacheService.getScriptCache().remove(LIST_CACHE_KEY)
}

function getDefaultScheduleData_() {
  return {
    defaultStart: '09:00',
    defaultEnd: '23:00',
    employees: [],
    employeesByMonth: {},
    shifts: [],
    shortageByMonth: {},
    bonusesByMonth: {},
  }
}

function getScheduleSheet_(ss) {
  let sheet = ss.getSheetByName(SCHEDULE_SHEET_NAME)
  if (!sheet) {
    sheet = ss.insertSheet(SCHEDULE_SHEET_NAME)
    sheet.getRange(1, 1).setValue(JSON.stringify(getDefaultScheduleData_()))
    sheet.getRange(2, 1).setValue('График: сотрудники в A1; смены по месяцам — листы _SCHEDULE_YYYY-MM.')
    sheet.hideSheet()
  }
  return sheet
}

function isScheduleMonthSheetName_(name) {
  const n = String(name || '')
  if (n.indexOf(SCHEDULE_MONTH_PREFIX) !== 0) return false
  const key = n.substring(SCHEDULE_MONTH_PREFIX.length)
  return /^[0-9]{4}-[0-9]{2}$/.test(key)
}

function scheduleMonthSheetName_(monthKey) {
  return SCHEDULE_MONTH_PREFIX + String(monthKey || '').trim()
}

function monthKeyFromShiftDate_(dateStr) {
  const d = String(dateStr || '').trim()
  if (d.length < 7) return ''
  const mk = d.substring(0, 7)
  return /^[0-9]{4}-[0-9]{2}$/.test(mk) ? mk : ''
}

/**
 * Старый формат: всё в A1 _SCHEDULE.
 * Переносим смены, недостачу и бонусы по месячным листам.
 */
function migrateLegacyScheduleIfNeeded_(ss) {
  const sheet = getScheduleSheet_(ss)
  const raw = sheet.getRange(1, 1).getValue()
  if (!raw || !String(raw).trim()) return
  let parsed
  try {
    parsed = JSON.parse(String(raw))
  } catch (e) {
    return
  }
  if (!parsed || typeof parsed !== 'object') return
  const shifts = Array.isArray(parsed.shifts) ? parsed.shifts : []
  if (!shifts.length) return
  const byMonth = {}
  shifts.forEach(function (s) {
    const mk = monthKeyFromShiftDate_(s.date)
    if (!mk) return
    if (!byMonth[mk]) byMonth[mk] = []
    byMonth[mk].push(s)
  })
  const shortageByMonth =
    parsed.shortageByMonth && typeof parsed.shortageByMonth === 'object' && !Array.isArray(parsed.shortageByMonth)
      ? parsed.shortageByMonth
      : {}
  const bonusesByMonth =
    parsed.bonusesByMonth && typeof parsed.bonusesByMonth === 'object' && !Array.isArray(parsed.bonusesByMonth)
      ? parsed.bonusesByMonth
      : {}
  for (var mk in byMonth) {
    if (!byMonth.hasOwnProperty(mk)) continue
    const sm = {}
    sm[mk] = shortageByMonth[mk] !== undefined ? Number(shortageByMonth[mk]) || 0 : 0
    const bm = {}
    if (bonusesByMonth[mk] && typeof bonusesByMonth[mk] === 'object' && !Array.isArray(bonusesByMonth[mk])) {
      bm[mk] = bonusesByMonth[mk]
    }
    writeMonthScheduleSheet_(ss, mk, {
      employees: Array.isArray(parsed.employees) ? parsed.employees : [],
      shifts: byMonth[mk],
      shortageByMonth: sm,
      bonusesByMonth: bm,
    })
  }
  for (var key in shortageByMonth) {
    if (!shortageByMonth.hasOwnProperty(key)) continue
    if (byMonth[key]) continue
    const sm = {}
    sm[key] = Number(shortageByMonth[key]) || 0
    const bm = {}
    if (bonusesByMonth[key] && typeof bonusesByMonth[key] === 'object' && !Array.isArray(bonusesByMonth[key])) {
      bm[key] = bonusesByMonth[key]
    }
    writeMonthScheduleSheet_(ss, key, {
      employees: Array.isArray(parsed.employees) ? parsed.employees : [],
      shifts: [],
      shortageByMonth: sm,
      bonusesByMonth: bm,
    })
  }
  for (var bkey in bonusesByMonth) {
    if (!bonusesByMonth.hasOwnProperty(bkey)) continue
    if (byMonth[bkey] || shortageByMonth[bkey] !== undefined) continue
    const bm = {}
    bm[bkey] = bonusesByMonth[bkey]
    writeMonthScheduleSheet_(ss, bkey, {
      employees: Array.isArray(parsed.employees) ? parsed.employees : [],
      shifts: [],
      shortageByMonth: {},
      bonusesByMonth: bm,
    })
  }
  const nextGlobal = {
    defaultStart: parsed.defaultStart || '09:00',
    defaultEnd: parsed.defaultEnd || '23:00',
    employees: Array.isArray(parsed.employees) ? parsed.employees : [],
    employeesByMonth: {},
    shifts: [],
    shortageByMonth: {},
    bonusesByMonth: {},
  }
  sheet.getRange(1, 1).setValue(JSON.stringify(nextGlobal))
}

function writeMonthScheduleSheet_(ss, monthKey, payload) {
  const name = scheduleMonthSheetName_(monthKey)
  let sh = ss.getSheetByName(name)
  if (!sh) {
    sh = ss.insertSheet(name)
    sh.getRange(2, 1).setValue('График ' + monthKey + ' (JSON в A1).')
    sh.hideSheet()
  }
  sh.getRange(1, 1).setValue(JSON.stringify(payload))
}

function readMonthSheetPayload_(sheet) {
  const raw = sheet.getRange(1, 1).getValue()
  if (!raw || !String(raw).trim()) return { employees: [], shifts: [], shortageByMonth: {}, bonusesByMonth: {} }
  try {
    const p = JSON.parse(String(raw))
    if (!p || typeof p !== 'object') return { employees: [], shifts: [], shortageByMonth: {}, bonusesByMonth: {} }
    return {
      employees: Array.isArray(p.employees) ? p.employees : [],
      shifts: Array.isArray(p.shifts) ? p.shifts : [],
      shortageByMonth:
        p.shortageByMonth && typeof p.shortageByMonth === 'object' && !Array.isArray(p.shortageByMonth)
          ? p.shortageByMonth
          : {},
      bonusesByMonth:
        p.bonusesByMonth && typeof p.bonusesByMonth === 'object' && !Array.isArray(p.bonusesByMonth)
          ? p.bonusesByMonth
          : {},
    }
  } catch (e) {
    return { employees: [], shifts: [], shortageByMonth: {}, bonusesByMonth: {} }
  }
}

function getSchedule() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID)
  migrateLegacyScheduleIfNeeded_(ss)
  const sheet = getScheduleSheet_(ss)
  const raw = sheet.getRange(1, 1).getValue()
  let schedule = getDefaultScheduleData_()
  if (raw && String(raw).trim()) {
    try {
      const parsed = JSON.parse(String(raw))
      if (parsed && typeof parsed === 'object') {
        schedule = {
          defaultStart: parsed.defaultStart || schedule.defaultStart,
          defaultEnd: parsed.defaultEnd || schedule.defaultEnd,
          employees: Array.isArray(parsed.employees) ? parsed.employees : [],
          shifts: [],
          shortageByMonth: {},
          bonusesByMonth: {},
        }
      }
    } catch (e) {
      // keep default
    }
  }
  const allShifts = []
  const allShortage = {}
  const allBonuses = {}
  const employeesByMonth = {}
  ss.getSheets().forEach(function (sh) {
    if (!isScheduleMonthSheetName_(sh.getName())) return
    var mk = sh.getName().substring(SCHEDULE_MONTH_PREFIX.length)
    const part = readMonthSheetPayload_(sh)
    if (Array.isArray(part.employees)) {
      employeesByMonth[String(mk)] = part.employees
    }
    part.shifts.forEach(function (s) {
      allShifts.push(s)
    })
    for (var k in part.shortageByMonth) {
      if (part.shortageByMonth.hasOwnProperty(k)) {
        var v = Number(part.shortageByMonth[k])
        if (!isNaN(v) && v >= 0) allShortage[String(k)] = v
      }
    }
    for (var bmk in part.bonusesByMonth) {
      if (!part.bonusesByMonth.hasOwnProperty(bmk)) continue
      var src = part.bonusesByMonth[bmk]
      if (!src || typeof src !== 'object' || Array.isArray(src)) continue
      var clean = {}
      for (var empId in src) {
        if (!src.hasOwnProperty(empId)) continue
        var bn = Number(src[empId])
        if (!isNaN(bn) && bn >= 0) clean[String(empId)] = bn
      }
      if (Object.keys(clean).length) allBonuses[String(bmk)] = clean
    }
  })
  schedule.shifts = allShifts
  schedule.shortageByMonth = allShortage
  schedule.bonusesByMonth = allBonuses
  schedule.employeesByMonth = employeesByMonth
  schedule.employees = []
  return jsonResponse({ schedule })
}

function updateSchedule(body) {
  if (body.pin && body.pin !== PIN) return jsonResponse({ error: 'invalid pin' })
  const next = body.schedule
  if (!next || typeof next !== 'object') return jsonResponse({ error: 'schedule is required' })
  var shortageByMonth = {}
  if (next.shortageByMonth && typeof next.shortageByMonth === 'object' && !Array.isArray(next.shortageByMonth)) {
    for (var key in next.shortageByMonth) {
      if (next.shortageByMonth.hasOwnProperty(key)) {
        var sn = Number(next.shortageByMonth[key])
        if (!isNaN(sn) && sn >= 0) shortageByMonth[String(key)] = sn
      }
    }
  }
  var bonusesByMonth = {}
  if (next.bonusesByMonth && typeof next.bonusesByMonth === 'object' && !Array.isArray(next.bonusesByMonth)) {
    for (var bkey in next.bonusesByMonth) {
      if (!next.bonusesByMonth.hasOwnProperty(bkey)) continue
      var monthObj = next.bonusesByMonth[bkey]
      if (!monthObj || typeof monthObj !== 'object' || Array.isArray(monthObj)) continue
      var cleanMonth = {}
      for (var empId in monthObj) {
        if (!monthObj.hasOwnProperty(empId)) continue
        var bn = Number(monthObj[empId])
        if (!isNaN(bn) && bn >= 0) cleanMonth[String(empId)] = bn
      }
      if (Object.keys(cleanMonth).length) bonusesByMonth[String(bkey)] = cleanMonth
    }
  }
  const safe = {
    defaultStart: String(next.defaultStart || '09:00').trim() || '09:00',
    defaultEnd: String(next.defaultEnd || '23:00').trim() || '23:00',
    employees: Array.isArray(next.employees)
      ? next.employees.map(function (e) {
          var rates = Array.isArray(e.rateHistory)
            ? e.rateHistory
                .map(function (r) {
                  var from = String((r && r.from) || '').trim()
                  var toRaw = r && r.to != null ? String(r.to).trim() : ''
                  var to = toRaw || ''
                  var modeRaw = String((r && r.mode) || '').trim()
                  var mode = modeRaw === 'from' || modeRaw === 'day' || modeRaw === 'period' ? modeRaw : ''
                  var rate = Number(r && r.rate)
                  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(from)) return null
                  if (to && !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(to)) return null
                  if (to && to < from) to = from
                  if (isNaN(rate) || rate < 0) return null
                  if (!mode) {
                    if (!to) mode = 'from'
                    else if (to === from) mode = 'day'
                    else mode = 'period'
                  }
                  if (mode === 'from') to = ''
                  if (mode === 'day') to = from
                  if (mode === 'period' && !to) to = from
                  return { from: from, to: to || null, mode: mode, rate: Math.round(rate) }
                })
                .filter(Boolean)
            : []
          return {
            id: String(e.id || '').trim() || Utilities.getUuid(),
            name: String(e.name || '').trim() || 'Без имени',
            color: String(e.color || '#f0d4cf').trim(),
            hourlyRate: Number(e.hourlyRate) >= 0 ? Number(e.hourlyRate) : 0,
            rateHistory: rates,
          }
        })
      : [],
    employeesByMonth:
      next.employeesByMonth && typeof next.employeesByMonth === 'object' && !Array.isArray(next.employeesByMonth)
        ? next.employeesByMonth
        : {},
    shifts: Array.isArray(next.shifts)
      ? next.shifts.map(function (s) {
          return {
            id: String(s.id || '').trim() || Utilities.getUuid(),
            date: String(s.date || '').trim(),
            employeeId: String(s.employeeId || '').trim(),
            start: s.start ? String(s.start).trim() : '',
            end: s.end ? String(s.end).trim() : '',
          }
        })
      : [],
  }
  safe.shifts = safe.shifts.filter(function (s) {
    return s.date && s.employeeId
  })

  const monthKeys = {}
  safe.shifts.forEach(function (s) {
    var mk = monthKeyFromShiftDate_(s.date)
    if (mk) monthKeys[mk] = true
  })
  for (var sk in shortageByMonth) {
    if (shortageByMonth.hasOwnProperty(sk)) monthKeys[String(sk)] = true
  }
  for (var bk in bonusesByMonth) {
    if (bonusesByMonth.hasOwnProperty(bk)) monthKeys[String(bk)] = true
  }
  for (var emk in safe.employeesByMonth) {
    if (safe.employeesByMonth.hasOwnProperty(emk)) monthKeys[String(emk)] = true
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID)
  const globalSheet = getScheduleSheet_(ss)
  const globalPayload = {
    defaultStart: safe.defaultStart,
    defaultEnd: safe.defaultEnd,
    employees: [],
    employeesByMonth: {},
    shifts: [],
    shortageByMonth: {},
    bonusesByMonth: {},
  }
  globalSheet.getRange(1, 1).setValue(JSON.stringify(globalPayload))

  for (var mk in monthKeys) {
    if (!monthKeys.hasOwnProperty(mk)) continue
    var monthShifts = safe.shifts.filter(function (s) {
      return monthKeyFromShiftDate_(s.date) === mk
    })
    var sm = {}
    if (shortageByMonth[mk] !== undefined) sm[mk] = shortageByMonth[mk]
    var bm = {}
    if (bonusesByMonth[mk] && typeof bonusesByMonth[mk] === 'object' && !Array.isArray(bonusesByMonth[mk])) {
      bm[mk] = bonusesByMonth[mk]
    }
    var monthEmployeesRaw =
      safe.employeesByMonth[mk] && Array.isArray(safe.employeesByMonth[mk])
        ? safe.employeesByMonth[mk]
        : []
    var monthEmployees = monthEmployeesRaw.map(function (e) {
      var rates = Array.isArray(e.rateHistory)
        ? e.rateHistory
            .map(function (r) {
              var from = String((r && r.from) || '').trim()
              var toRaw = r && r.to != null ? String(r.to).trim() : ''
              var to = toRaw || ''
              var modeRaw = String((r && r.mode) || '').trim()
              var mode = modeRaw === 'from' || modeRaw === 'day' || modeRaw === 'period' ? modeRaw : ''
              var rate = Number(r && r.rate)
              if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(from)) return null
              if (to && !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(to)) return null
              if (to && to < from) to = from
              if (isNaN(rate) || rate < 0) return null
              if (!mode) {
                if (!to) mode = 'from'
                else if (to === from) mode = 'day'
                else mode = 'period'
              }
              if (mode === 'from') to = ''
              if (mode === 'day') to = from
              if (mode === 'period' && !to) to = from
              return { from: from, to: to || null, mode: mode, rate: Math.round(rate) }
            })
            .filter(Boolean)
        : []
      return {
        id: String(e.id || '').trim() || Utilities.getUuid(),
        name: String(e.name || '').trim() || 'Без имени',
        color: String(e.color || '#f0d4cf').trim(),
        hourlyRate: Number(e.hourlyRate) >= 0 ? Number(e.hourlyRate) : 0,
        rateHistory: rates,
      }
    })
    writeMonthScheduleSheet_(ss, mk, {
      employees: monthEmployees,
      shifts: monthShifts,
      shortageByMonth: sm,
      bonusesByMonth: bm,
    })
  }

  var toDelete = []
  ss.getSheets().forEach(function (sh) {
    var nm = sh.getName()
    if (!isScheduleMonthSheetName_(nm)) return
    var mkey = nm.substring(SCHEDULE_MONTH_PREFIX.length)
    if (!monthKeys[mkey]) toDelete.push(sh)
  })
  toDelete.forEach(function (sh) {
    ss.deleteSheet(sh)
  })

  return jsonResponse({ success: true })
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  )
}
