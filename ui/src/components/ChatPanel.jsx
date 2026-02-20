import { useState, useRef, useEffect } from 'react'

function ChatPanel({ trigger, onSendMessage, onClose, responses }) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [responses])

  const handleSend = () => {
    if (!input.trim()) return
    
    const userMessage = input.trim()
    setInput('')
    onSendMessage(trigger.nodeId, userMessage)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '400px',
      height: '500px',
      background: '#1e1e1e',
      border: '1px solid #444',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
    }}>
      <div style={{
        padding: '12px',
        borderBottom: '1px solid #444',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#252525'
      }}>
        <h3 style={{ margin: 0, color: '#fff', fontSize: '14px' }}>Chat</h3>
        <button onClick={onClose} style={{
          background: 'transparent',
          border: 'none',
          color: '#fff',
          fontSize: '20px',
          cursor: 'pointer',
          padding: '0 8px'
        }}>×</button>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {responses.map((msg, i) => (
          <div key={i} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '80%',
            padding: '8px 12px',
            borderRadius: '8px',
            background: msg.role === 'user' ? '#0066cc' : '#333',
            color: '#fff',
            fontSize: '13px',
            wordBreak: 'break-word'
          }}>
            {msg.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={{
        padding: '12px',
        borderTop: '1px solid #444',
        display: 'flex',
        gap: '8px',
        background: '#252525'
      }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          autoFocus
          style={{
            flex: 1,
            padding: '8px',
            background: '#333',
            border: '1px solid #444',
            borderRadius: '4px',
            color: '#fff',
            fontSize: '13px'
          }}
        />
        <button onClick={handleSend} style={{
          padding: '8px 16px',
          background: '#0066cc',
          border: 'none',
          borderRadius: '4px',
          color: '#fff',
          cursor: 'pointer',
          fontSize: '13px'
        }}>
          Send
        </button>
      </div>
    </div>
  )
}

export default ChatPanel
