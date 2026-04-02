const SPREADSHEET_ID = '1-Y32ev-G5ooRWcRMHbiSRShnyg4yb6ysF9s4kzJqiLo'
const PIN = '1234'
const LIST_CACHE_KEY = 'cards_list_v1'
const LIST_CACHE_TTL_SEC = 120
const SECTIONS_SHEET_NAME = '_APP_CONTENT'
const SCHEDULE_SHEET_NAME = '_SCHEDULE'
/** Месячные листы: _SCHEDULE_2026-03 (JSON смен + недостача за месяц) */
const SCHEDULE_MONTH_PREFIX = '_SCHEDULE_'
const STATS_SHEET_NAME = '_APP_STATS'

function doGet(e) {
  const action = e.parameter.action
  if (action === 'getList') return getList()
  if (action === 'getCard') return getCard(e.parameter.sheetName)
  if (action === 'getAll') return getAll()
  if (action === 'getSections') return getSections()
  if (action === 'getSchedule') return getSchedule()
  if (action === 'logVisit') return logAppVisit()
  return jsonResponse({ error: 'unknown action' })
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents)
  if (body.action === 'create') return createSheet(body)
  if (body.action === 'update') return updateSheet(body)
  if (body.action === 'delete') return deleteSheet(body)
  if (body.action === 'updateSection') return updateSection(body)
  if (body.action === 'updateSchedule') return updateSchedule(body)
  return jsonResponse({ error: 'unknown action' })
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
  if (n === SECTIONS_SHEET_NAME || n === SCHEDULE_SHEET_NAME || n === STATS_SHEET_NAME) return false
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
    writeMonthScheduleSheet_(ss, mk, { shifts: byMonth[mk], shortageByMonth: sm, bonusesByMonth: bm })
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
    writeMonthScheduleSheet_(ss, key, { shifts: [], shortageByMonth: sm, bonusesByMonth: bm })
  }
  for (var bkey in bonusesByMonth) {
    if (!bonusesByMonth.hasOwnProperty(bkey)) continue
    if (byMonth[bkey] || shortageByMonth[bkey] !== undefined) continue
    const bm = {}
    bm[bkey] = bonusesByMonth[bkey]
    writeMonthScheduleSheet_(ss, bkey, { shifts: [], shortageByMonth: {}, bonusesByMonth: bm })
  }
  const nextGlobal = {
    defaultStart: parsed.defaultStart || '09:00',
    defaultEnd: parsed.defaultEnd || '23:00',
    employees: Array.isArray(parsed.employees) ? parsed.employees : [],
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
  if (!raw || !String(raw).trim()) return { shifts: [], shortageByMonth: {}, bonusesByMonth: {} }
  try {
    const p = JSON.parse(String(raw))
    if (!p || typeof p !== 'object') return { shifts: [], shortageByMonth: {}, bonusesByMonth: {} }
    return {
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
    return { shifts: [], shortageByMonth: {}, bonusesByMonth: {} }
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
  ss.getSheets().forEach(function (sh) {
    if (!isScheduleMonthSheetName_(sh.getName())) return
    const part = readMonthSheetPayload_(sh)
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

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID)
  const globalSheet = getScheduleSheet_(ss)
  const globalPayload = {
    defaultStart: safe.defaultStart,
    defaultEnd: safe.defaultEnd,
    employees: safe.employees,
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
    writeMonthScheduleSheet_(ss, mk, { shifts: monthShifts, shortageByMonth: sm, bonusesByMonth: bm })
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
