/** Тусклые Notion-цвета карточек поставщиков. */
export const SUPPLIER_COLORS = [
  { id: 'yellow', bg: '#fbf3db', border: '#e8d9a5' },
  { id: 'blue', bg: '#e7f3f8', border: '#c2dbe6' },
  { id: 'orange', bg: '#faebdd', border: '#edcfb0' },
  { id: 'pink', bg: '#f4e0e9', border: '#e3c3d1' },
  { id: 'green', bg: '#ddedea', border: '#b7d4ce' },
  { id: 'purple', bg: '#eae4f2', border: '#d0c5de' },
  { id: 'gray', bg: '#ebeced', border: '#d2d4d6' },
  { id: 'red', bg: '#fbe4e4', border: '#e9c6c6' },
]

export const SUPPLIERS_STORE_KEY = 'tk_suppliers_v1'

export function newSupplierId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `sup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function nextSupplierColor(index) {
  return SUPPLIER_COLORS[index % SUPPLIER_COLORS.length].id
}

export const DEFAULT_SUPPLIERS = [
  {
    id: 'sup_coffee',
    name: 'Atlas Coffee',
    manager: 'Алия Нурланова',
    phone: '+7 701 234 56 01',
    supplies: 'Кофейное зерно (эспрессо, фильтр), декаф',
    terms: 'Поставка 2 раза в неделю. Предоплата 50%, остаток по факту. Минимальный заказ — 10 кг.',
    color: 'yellow',
  },
  {
    id: 'sup_dairy',
    name: 'Dairy Fresh',
    manager: 'Марат Сериков',
    phone: '+7 707 111 22 03',
    supplies: 'Молоко 3,2%, сливки, альтернативное молоко (овсяное, миндальное)',
    terms: 'Ежедневная доставка до 08:00. Отсрочка 14 дней. Возврат брака в день поставки.',
    color: 'blue',
  },
  {
    id: 'sup_tea',
    name: 'Tea Garden',
    manager: 'Сауле Ибраева',
    phone: '+7 775 445 90 12',
    supplies: 'Чай листовой, матча, травяные смеси',
    terms: 'Раз в неделю, заявка до среды 15:00. Минимальный заказ 50 000 ₸.',
    color: 'green',
  },
  {
    id: 'sup_syrup',
    name: 'Barline',
    manager: 'Денис Пак',
    phone: '+7 777 320 18 44',
    supplies: 'Сиропы, пюре, топпинги',
    terms: 'По заявке, доставка 1–2 рабочих дня. Обмен вскрытых позиций не производится.',
    color: 'orange',
  },
  {
    id: 'sup_pack',
    name: 'Pack Pro',
    manager: 'Елена Ким',
    phone: '+7 705 888 41 27',
    supplies: 'Стаканы, крышки, трубочки, пакеты, салфетки',
    terms: 'Раз в 2 недели. Доставка от 30 000 ₸, иначе самовывоз со склада.',
    color: 'purple',
  },
  {
    id: 'sup_bakery',
    name: 'Morning Bake',
    manager: 'Андрей Юсупов',
    phone: '+7 747 560 09 33',
    supplies: 'Круассаны, десерты, выпечка к витрине',
    terms: 'Ежедневно к открытию. Непроданное не возвращается. Корректировка заявки до 20:00.',
    color: 'pink',
  },
  {
    id: 'sup_chem',
    name: 'Clean Service',
    manager: 'Ольга Бекмухамбетова',
    phone: '+7 700 612 75 90',
    supplies: 'Моющие средства, расходники, перчатки',
    terms: 'По заявке в течение 48 часов. Счёт с отсрочкой 7 дней.',
    color: 'gray',
  },
]
