import { useState } from 'react'

function GlobalVariablesPanel({ variables, onSave, onClose }) {
  const [items, setItems] = useState(variables || [])

  const addVariable = () => {
    setItems([...items, { name: '', value: '' }])
  }

  const updateVariable = (index, field, value) => {
    const newItems = [...items]
    newItems[index][field] = value
    setItems(newItems)
  }

  const removeVariable = (index) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleSave = () => {
    const validItems = items.filter(item => item.name.trim())
    onSave(validItems)
    onClose()
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" style={{ minWidth: '450px' }} onClick={e => e.stopPropagation()}>
        <h3>⚙️ Global Variables</h3>
        
        <div style={{ marginBottom: '16px', color: '#8b949e', fontSize: '12px' }}>
          Define variables that can be used across all nodes (API keys, configs, etc.)
        </div>

        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {items.map((item, index) => (
            <div key={index} style={{ 
              display: 'flex', 
              gap: '8px', 
              marginBottom: '12px',
              alignItems: 'flex-start'
            }}>
              <input
                type="text"
                placeholder="Variable name"
                value={item.name}
                onChange={e => updateVariable(index, 'name', e.target.value)}
                style={{
                  flex: '0 0 140px',
                  background: '#0d1117',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  color: '#f0f6fc',
                  fontSize: '13px',
                  fontFamily: 'monospace'
                }}
              />
              <textarea
                placeholder="Value (string, number, JSON)"
                value={item.value}
                onChange={e => updateVariable(index, 'value', e.target.value)}
                style={{
                  flex: 1,
                  background: '#0d1117',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  color: '#f0f6fc',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  minHeight: '36px',
                  resize: 'vertical'
                }}
              />
              <button
                onClick={() => removeVariable(index)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#f85149',
                  cursor: 'pointer',
                  fontSize: '18px',
                  padding: '8px'
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addVariable}
          style={{
            background: '#21262d',
            border: '1px solid #30363d',
            color: '#c9d1d9',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            cursor: 'pointer',
            marginBottom: '16px',
            width: '100%'
          }}
        >
          + Add Variable
        </button>

        <div className="dialog-buttons">
          <button className="dialog-cancel" onClick={onClose}>Cancel</button>
          <button className="dialog-confirm" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}

export default GlobalVariablesPanel
