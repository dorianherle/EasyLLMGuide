import { useState, useEffect, useRef } from 'react'

function RunPanel({ 
  pendingInputs,  // Array of { nodeId, inputName, type }
  outputs, 
  onSubmitInputs,
  onClose,
  isRunning 
}) {
  const [inputValues, setInputValues] = useState({})
  const firstInputRef = useRef(null)

  // Reset values when new inputs needed
  useEffect(() => {
    if (pendingInputs.length > 0) {
      const init = {}
      pendingInputs.forEach(inp => {
        init[inp.nodeId] = ''
      })
      setInputValues(init)
      setTimeout(() => firstInputRef.current?.focus(), 50)
    }
  }, [pendingInputs])

  const handleSubmit = (e) => {
    e.preventDefault()
    const converted = {}
    pendingInputs.forEach(inp => {
      const val = inputValues[inp.nodeId]
      converted[inp.nodeId] = inp.type === 'int' ? parseInt(val) || 0 : val
    })
    onSubmitInputs(converted)
    setInputValues({})
  }

  const allFilled = pendingInputs.every(inp => 
    inputValues[inp.nodeId]?.toString().trim() !== ''
  )

  const showInputForm = pendingInputs.length > 0
  const showRunning = isRunning && pendingInputs.length === 0 && outputs.length === 0
  const showOutputs = outputs.length > 0

  return (
    <div className="run-panel">
      <div className="run-panel-header">
        <span>Terminal</span>
        <button onClick={onClose} className="panel-close">×</button>
      </div>
      
      <div className="run-panel-content">
        {/* Input prompts */}
        {showInputForm && (
          <form onSubmit={handleSubmit} className="run-inputs">
            {pendingInputs.map((inp, i) => (
              <div key={inp.nodeId} className="run-input-row">
                <label>{inp.inputName} ({inp.type})</label>
                <input
                  ref={i === 0 ? firstInputRef : null}
                  type={inp.type === 'int' ? 'number' : 'text'}
                  value={inputValues[inp.nodeId] || ''}
                  onChange={(e) => setInputValues(prev => ({
                    ...prev,
                    [inp.nodeId]: e.target.value
                  }))}
                  placeholder={`Enter ${inp.type}`}
                />
              </div>
            ))}
            <button type="submit" disabled={!allFilled} className="run-submit">
              {pendingInputs.length > 1 ? 'Submit All →' : 'Submit →'}
            </button>
          </form>
        )}

        {/* Running indicator */}
        {showRunning && (
          <div className="run-status">Running...</div>
        )}

        {/* Output section */}
        {showOutputs && (
          <div className="run-outputs">
            {outputs.map((out, i) => (
              <div key={i} className="run-output-line">
                <span className="output-arrow">→</span>
                <span className="output-value">{out}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default RunPanel
