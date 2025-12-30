import Editor from '@monaco-editor/react'

function CodePanel({ node, onCollapse }) {
  return (
    <div className="code-panel">
      <div className="panel-header">
        <div>
          <h3>{node ? node.name : 'Code'}</h3>
          {node && <div className="subtitle">Node source code (read-only)</div>}
        </div>
        <button className="collapse-btn" onClick={onCollapse} title="Collapse">×</button>
      </div>
      {!node ? (
        <div className="code-panel-empty">
          Select a node to view its code
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
