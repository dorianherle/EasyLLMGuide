import { useState, useRef, useEffect } from 'react'

function RunPanel({ 
  triggers,
  outputs,
  onSubmitInput,
  onClose,
  onClear,
  isRunning 
}) {
  const [inputValues, setInputValues] = useState({})
  const firstInputRef = useRef(null)
  const outputsEndRef = useRef(null)

  // Focus first input when triggers appear
  useEffect(() => {
    if (triggers.length > 0) {
      setTimeout(() => firstInputRef.current?.focus(), 50)
    }
  }, [triggers])

  // Scroll to bottom when new outputs arrive
  useEffect(() => {
    outputsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [outputs])

  const handleSubmit = (nodeId, type) => {
    const val = inputValues[nodeId] || ''
    if (val.toString().trim() === '') return
    
    const converted = type === 'int' ? parseInt(val) || 0 : val
    onSubmitInput(nodeId, converted)
    setInputValues(prev => ({ ...prev, [nodeId]: '' }))
  }

  const handleKeyDown = (e, nodeId, type) => {
    if (e.key === 'Enter') {
      handleSubmit(nodeId, type)
    }
  }

  return (
    <div className="run-panel">
      <div className="run-panel-header">
        <span>Terminal</span>
        <div className="run-panel-actions">
          {outputs.length > 0 && <button onClick={onClear} className="panel-btn" title="Clear">⌫</button>}
          <button onClick={onClose} className="panel-close">×</button>
        </div>
      </div>
      
      <div className="run-panel-content">
        {/* Outputs */}
        {outputs.length > 0 && (
          <div className="run-outputs">
            {outputs.map((out, i) => (
              <div key={i} className="run-output-line">
                <span className="output-arrow">→</span>
                <span className="output-value">{out}</span>
              </div>
            ))}
            <div ref={outputsEndRef} />
          </div>
        )}

        {/* Trigger inputs */}
        {triggers.length > 0 ? (
          <div className="run-triggers">
            {triggers.map((trig, i) => (
              <div key={trig.nodeId} className="run-trigger-row">
                <input
                  ref={i === 0 ? firstInputRef : null}
                  type={trig.type === 'int' ? 'number' : 'text'}
                  value={inputValues[trig.nodeId] || ''}
                  onChange={(e) => setInputValues(prev => ({
                    ...prev,
                    [trig.nodeId]: e.target.value
                  }))}
                  onKeyDown={(e) => handleKeyDown(e, trig.nodeId, trig.type)}
                  placeholder={`Enter ${trig.type}...`}
                />
                <button 
                  onClick={() => handleSubmit(trig.nodeId, trig.type)}
                  disabled={!inputValues[trig.nodeId]?.toString().trim()}
                >
                  →
                </button>
              </div>
            ))}
          </div>
        ) : (
          outputs.length === 0 && (
            <div className="run-status">
              {isRunning ? 'Starting...' : 'Waiting...'}
            </div>
          )
        )}
      </div>
    </div>
  )
}

export default RunPanel
