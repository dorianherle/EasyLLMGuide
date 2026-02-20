import { useState, useRef, useEffect } from 'react'

function ChatInterface({ interfaceData, messages, onSendMessage, onClose }) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSend = () => {
    if (!input.trim()) return
    onSendMessage(interfaceData.nodeId, input.trim())
    setInput('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Get participant names
  const userParticipant = interfaceData.participants?.find(p => p.can_send) || { name: 'User' }
  const botParticipant = interfaceData.participants?.find(p => p.can_receive) || { name: 'Bot' }

  return (
    <div className="chat-interface">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-title">
          <span className="chat-icon">💬</span>
          <span>Chat Interface</span>
        </div>
        <div className="chat-participants">
          {interfaceData.participants?.map(p => (
            <span key={p.id} className={`participant-badge ${p.can_send ? 'sender' : 'receiver'}`}>
              {p.name}
            </span>
          ))}
        </div>
        <button onClick={onClose} className="chat-close">×</button>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon">🗨️</div>
            <div className="chat-empty-text">Start the conversation</div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`chat-message ${msg.role === 'user' ? 'user' : 'bot'}`}>
            <div className="message-header">
              <span className="message-sender">
                {msg.role === 'user' ? userParticipant.name : botParticipant.name}
              </span>
            </div>
            <div className="message-content">
              {typeof msg.content === 'object' ? JSON.stringify(msg.content, null, 2) : msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Type as ${userParticipant.name}...`}
          rows={1}
        />
        <button onClick={handleSend} disabled={!input.trim()} className="send-btn">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

export default ChatInterface
