/**
 * LogPanel - Shows logger node outputs
 */
function LogPanel({ messages, onClear, onCollapse }) {
  return (
    <div className="panel log-panel">
      <div className="panel-header">
        <span>📋 Log</span>
        <div>
          <button onClick={onClear} className="panel-btn">Clear</button>
          <button onClick={onCollapse} className="panel-btn">×</button>
        </div>
      </div>
      <div className="log-content">
        {messages.length === 0 ? (
          <div className="log-empty">No log messages. Connect outputs to a Logger node.</div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className="log-entry">
              <span className="log-time">{msg.time.toLocaleTimeString()}</span>
              <span className="log-node">{msg.node}</span>
              <span className="log-msg">{msg.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default LogPanel

