import { useEffect, useState } from 'react'

function PinModal({ isOpen, onSuccess, onClose, title }) {
  const [digits, setDigits] = useState('')
  const [shake, setShake] = useState(false)
  const expectedPin = String(import.meta.env.VITE_PIN_CODE || '1234')

  useEffect(() => {
    if (!isOpen) {
      setDigits('')
      setShake(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (digits.length !== 4) return
    if (digits === expectedPin) {
      onSuccess()
      setDigits('')
      return
    }
    setShake(true)
    if (navigator.vibrate) navigator.vibrate(200)
    setTimeout(() => {
      setShake(false)
      setDigits('')
    }, 350)
  }, [digits, expectedPin, onSuccess])

  if (!isOpen) return null

  const handleTap = (val) => {
    if (val === 'back') {
      setDigits((prev) => prev.slice(0, -1))
      return
    }
    if (val === '*' || digits.length >= 4) return
    setDigits((prev) => prev + val)
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', 'back']

  return (
    <div className="pin-backdrop" onClick={onClose}>
      <div className="pin-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <div className={`pin-dots ${shake ? 'shake' : ''}`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={i < digits.length ? 'filled' : ''} />
          ))}
        </div>
        <div className="pin-pad">
          {keys.map((key) => (
            <button key={key} type="button" onClick={() => handleTap(key)} className="pin-key">
              {key === 'back' ? '←' : key}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default PinModal
