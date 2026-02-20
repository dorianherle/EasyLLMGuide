import { useState } from 'react'
import './blocks.css'

function TextInputBlock({ nodeId, config, data, onInput, disabled }) {
  const [value, setValue] = useState('')
  const isChatInput = nodeId.includes('chat_input')

  const handleSubmit = () => {
    if (!value.trim() || disabled) return
    onInput(nodeId, value.trim())
    setValue('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSubmit()
    }
  }

  if (isChatInput) {
    // Chat input mode - show conversation history
    return (
      <div className="block-chat-input">
        <label>{config.label || 'Chat Input'}</label>
        <div className="chat-messages">
          {data.messages?.map((msg, i) => (
            <div key={i} className={`chat-message ${msg.role}`}>
              <strong>{msg.role === 'user' ? 'You' : 'Bot'}:</strong> {msg.content}
            </div>
          )) || <div className="chat-placeholder">No messages yet...</div>}
        </div>
        <div className="input-row">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            disabled={disabled}
          />
          <button onClick={handleSubmit} disabled={disabled || !value.trim()}>
            Send
          </button>
        </div>
      </div>
    )
  }

  // Regular text input mode
  return (
    <div className="block-text-input">
      <label>{config.label || 'Input'}</label>
      <div className="input-row">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={config.placeholder || 'Type here...'}
          disabled={disabled}
        />
        <button onClick={handleSubmit} disabled={disabled || !value.trim()}>
          →
        </button>
      </div>
    </div>
  )
}

export default TextInputBlock
