import { useEffect, useState } from 'react'
import EquipmentList from './EquipmentList'
import EquipmentDetail from './EquipmentDetail'

/**
 * Раздел «Инструкции по оборудованию» (отдельный пункт меню).
 */
export default function EquipmentHub({
  items = [],
  loading,
  error,
  onEditCard,
  focusTarget,
  onFocusConsumed,
}) {
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    if (!focusTarget?.focusId || focusTarget.kind !== 'equipment') return
    setSelectedId(focusTarget.focusId)
    onFocusConsumed?.()
  }, [focusTarget, onFocusConsumed])

  const selected = items.find((item) => item.id === selectedId) || null

  if (selected) {
    return (
      <EquipmentDetail
        item={selected}
        onBack={() => setSelectedId(null)}
        onEdit={onEditCard}
      />
    )
  }

  return (
    <EquipmentList
      items={items}
      loading={loading}
      error={error}
      onSelect={(item) => setSelectedId(item.id)}
    />
  )
}
