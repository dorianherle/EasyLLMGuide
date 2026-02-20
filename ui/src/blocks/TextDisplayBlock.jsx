import './blocks.css'

function TextDisplayBlock({ nodeId, config, data }) {
  const isChatDisplay = nodeId.includes('chat_display')

  if (isChatDisplay) {
    // Chat display mode - show conversation history
    return (
      <div className="block-chat-display">
        <label>{config.label || 'Chat Display'}</label>
        <div className="chat-messages">
          {data.messages?.map((msg, i) => (
            <div key={i} className={`chat-message ${msg.role}`}>
              <strong>{msg.role === 'user' ? 'You' : 'Bot'}:</strong> {msg.content}
            </div>
          )) || <div className="chat-placeholder">Waiting for messages...</div>}
        </div>
      </div>
    )
  }

  // Regular text display mode
  return (
    <div className="block-text-display">
      <label>{config.label || 'Output'}</label>
      <div className="display-content">
        {data.value || <span className="placeholder">Waiting for data...</span>}
      </div>
    </div>
  )
}

export default TextDisplayBlock
