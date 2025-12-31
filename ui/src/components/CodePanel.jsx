import Editor from '@monaco-editor/react'

function CodePanel({ node, packetData, onCollapse, style }) {
  // Show packet data if selected, otherwise show node code
  const showingPacket = packetData && packetData.length > 0

  const getPacketDisplay = () => {
    if (!packetData || packetData.length === 0) return ''
    
    if (packetData.length === 1) {
      // Single value - pretty print it
      const val = packetData[0]
      if (typeof val === 'object') {
        return JSON.stringify(val, null, 2)
      }
      return String(val)
    }
    
    // Multiple values - show as array
    return JSON.stringify(packetData, null, 2)
  }

  return (
    <div className="code-panel" style={style}>
      <div className="panel-header">
        <div>
          <h3>{showingPacket ? 'Data' : (node ? node.name : 'Code')}</h3>
          <div className="subtitle">
            {showingPacket 
              ? `${packetData.length} value${packetData.length > 1 ? 's' : ''} in queue`
              : (node ? 'Node source code (read-only)' : '')}
          </div>
        </div>
        <button className="collapse-btn" onClick={onCollapse} title="Collapse">×</button>
      </div>
      
      {showingPacket ? (
        <div className="code-panel-editor">
          <Editor
            height="100%"
            language="json"
            theme="vs-dark"
            value={getPacketDisplay()}
            options={{
              fontSize: 16,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              minimap: { enabled: false },
              lineNumbers: 'off',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              padding: { top: 16 },
              readOnly: true,
              wordWrap: 'on'
            }}
          />
        </div>
      ) : !node ? (
        <div className="code-panel-empty">
          Select a node or click a data packet
        </div>
      ) : (
        <div className="code-panel-editor">
          <Editor
            height="100%"
            language="python"
            theme="vs-dark"
            value={node.code || '# No code available'}
            options={{
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              minimap: { enabled: false },
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              padding: { top: 16 },
              readOnly: true
            }}
          />
        </div>
      )}
    </div>
  )
}

export default CodePanel
