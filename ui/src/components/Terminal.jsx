import { useState, useRef, useEffect } from 'react'

function Terminal({ onRun, logs, isRunning, entryPoints = [] }) {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const inputRef = useRef(null)
  const outputRef = useRef(null)

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [logs])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!input.trim() || isRunning) return
    
    const cmd = input.trim()
    setHistory(prev => [...prev, cmd])
    setHistoryIndex(-1)
    setInput('')
    
    if (cmd === 'help') {
      onRun(null, 'help')
    } else if (cmd === 'clear') {
      onRun(null, 'clear')
    } else if (cmd === 'run') {
      onRun(null, 'run')
    } else {
      // Try as value
      const num = parseInt(cmd)
      if (!isNaN(num)) {
        onRun(cmd)
      } else {
        onRun(cmd) // Pass as string
      }
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length > 0) {
        const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex
        setHistoryIndex(newIndex)
        setInput(history[history.length - 1 - newIndex] || '')
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setInput(history[history.length - 1 - newIndex] || '')
      } else {
        setHistoryIndex(-1)
        setInput('')
      }
    }
  }

  return (
    <div className="terminal">
      <div className="terminal-header">
        <span className="terminal-title">Terminal</span>
        <span className="terminal-hint">
          {entryPoints.length > 0 
            ? `${entryPoints.length} input${entryPoints.length > 1 ? 's' : ''} needed`
            : 'Type a value to run'
          }
        </span>
      </div>
      <div className="terminal-output" ref={outputRef}>
        {logs.map((log, i) => (
          <div key={i} className={`terminal-line ${log.type}`}>
            {log.type === 'input' && <span className="prompt">{'>'}</span>}
            {log.type === 'event' && <span className="prompt">•</span>}
            {log.type === 'output' && <span className="prompt">→</span>}
            {log.type === 'error' && <span className="prompt">!</span>}
            {log.type === 'info' && <span className="prompt">i</span>}
            <span className="message">{log.message}</span>
          </div>
        ))}
        {isRunning && (
          <div className="terminal-line running">
            <span className="prompt">⋯</span>
            <span className="message">Running...</span>
          </div>
        )}
      </div>
      <form className="terminal-input" onSubmit={handleSubmit}>
        <span className="prompt">{'>'}</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRunning ? 'Running...' : 'Enter value and press Enter'}
          disabled={isRunning}
          autoFocus
        />
      </form>
    </div>
  )
}

export default Terminal
