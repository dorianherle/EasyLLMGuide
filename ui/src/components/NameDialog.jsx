import { useState, useEffect, useRef } from 'react'

function NameDialog({ isOpen, title, placeholder, onConfirm, onCancel }) {
  const [value, setValue] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setValue('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (value.trim()) {
      onConfirm(value.trim())
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={placeholder}
            autoFocus
          />
          <div className="dialog-buttons">
            <button type="button" onClick={onCancel} className="dialog-cancel">Cancel</button>
            <button type="submit" className="dialog-confirm" disabled={!value.trim()}>Create</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default NameDialog

