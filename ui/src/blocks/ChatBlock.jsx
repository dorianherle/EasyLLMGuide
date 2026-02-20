import { useState, useRef, useEffect } from 'react'
import './blocks.css'

function ChatBlock({ nodeId, config, data, onInput, disabled }) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [data.messages])

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus()
    }
  }, [disabled])

  const handleSend = () => {
    if (!input.trim() || disabled) return
    onInput(nodeId, input.trim())
    setInput('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="block-chat">
      <div className="chat-messages">
        {data.messages.length === 0 && (
          <div className="chat-empty">
            {disabled ? 'Click Start to begin' : 'Type a message to start'}
          </div>
        )}
        {data.messages.map((msg, i) => (
          <div key={i} className={`chat-message ${msg.role}`}>
            <div className="message-content">
              {typeof msg.content === 'object' 
                ? JSON.stringify(msg.content, null, 2) 
                : msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-area">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Click Start first...' : 'Type a message...'}
          disabled={disabled}
        />
        <button onClick={handleSend} disabled={disabled || !input.trim()}>
          ➤
        </button>
      </div>
    </div>
  )
}

export default ChatBlock
