import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { updateNodeCode } from '../utils/api'

function CodePanel({ node, nodeInstance, onNodeUpdate, packetData, onCollapse, style, onCodeSaved, globalVariables = [] }) {
  const [editedCode, setEditedCode] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Show packet data if selected, otherwise show node code
  const showingPacket = packetData && packetData.length > 0

  useEffect(() => {
    if (node?.code) {
      setEditedCode(node.code)
      setHasChanges(false)
    }
  }, [node?.code, node?.name])

  const handleCodeChange = (value) => {
    setEditedCode(value || '')
    setHasChanges(value !== node?.code)
  }

  const handleSave = async () => {
    if (!node || !hasChanges) return
    setSaving(true)
    try {
      await updateNodeCode(node.name, editedCode)
      setHasChanges(false)
      if (onCodeSaved) onCodeSaved()
    } catch (e) {
      alert('Failed to save: ' + e.message)
    }
    setSaving(false)
  }
  
  const handleDefaultChange = (name, value, type, useGlobal = null) => {
    if (!nodeInstance || !onNodeUpdate) return
    
    const currentDefaults = nodeInstance.data?.defaults || {}
    const currentGlobalBindings = nodeInstance.data?.globalBindings || {}
    
    if (useGlobal !== null) {
      // Setting global variable binding
      const newBindings = { ...currentGlobalBindings }
      if (useGlobal === '') {
        delete newBindings[name]
      } else {
        newBindings[name] = useGlobal
      }
      onNodeUpdate(nodeInstance.id, { globalBindings: newBindings })
    } else {
      // Setting custom value
      let parsedValue = value
      if (type === 'int' || type === 'float') {
        parsedValue = value === '' ? '' : Number(value)
      }
      onNodeUpdate(nodeInstance.id, {
        defaults: { ...currentDefaults, [name]: parsedValue }
      })
    }
  }

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
              : (node ? (hasChanges ? 'Unsaved changes' : 'Editable') : '')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!showingPacket && node && hasChanges && (
            <button 
              className="save-btn" 
              onClick={handleSave} 
              disabled={saving}
              style={{ 
                background: '#4CAF50', 
                border: 'none', 
                padding: '4px 12px', 
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
          <button className="collapse-btn" onClick={onCollapse} title="Collapse">×</button>
        </div>
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
        <div className="code-panel-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Default Values Section */}
            {Object.entries(node.inputs || {})
                .filter(([_, def]) => def.default !== undefined && def.default !== null && def.default !== '')
                .length > 0 && (
                <div style={{ padding: '16px', borderBottom: '1px solid #30363d', background: '#1c2128' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', textTransform: 'uppercase', color: '#8b949e' }}>
                        Parameters
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {Object.entries(node.inputs)
                            .filter(([_, def]) => def.default !== undefined && def.default !== null && def.default !== '')
                            .map(([name, def]) => {
                                const boundGlobal = nodeInstance?.data?.globalBindings?.[name]
                                const val = nodeInstance?.data?.defaults?.[name] ?? def.default
                                const type = def.type
                                return (
                                    <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '12px', color: '#c9d1d9', fontFamily: 'monospace' }}>
                                            {name}: <span style={{ color: '#8b949e' }}>{type}</span>
                                        </label>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <select
                                                value={boundGlobal || ''}
                                                onChange={(e) => handleDefaultChange(name, null, type, e.target.value)}
                                                style={{
                                                    background: '#0d1117',
                                                    border: '1px solid #30363d',
                                                    color: boundGlobal ? '#58a6ff' : '#8b949e',
                                                    padding: '6px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '12px',
                                                    fontFamily: 'monospace',
                                                    cursor: 'pointer',
                                                    minWidth: '90px'
                                                }}
                                            >
                                                <option value="">Custom</option>
                                                {globalVariables.map(v => (
                                                    <option key={v.name} value={v.name}>${v.name}</option>
                                                ))}
                                            </select>
                                            {!boundGlobal && (
                                                <input
                                                    type={type === 'int' || type === 'float' ? 'number' : 'text'}
                                                    value={val}
                                                    onChange={(e) => handleDefaultChange(name, e.target.value, type)}
                                                    style={{
                                                        flex: 1,
                                                        background: '#0d1117',
                                                        border: '1px solid #30363d',
                                                        color: '#c9d1d9',
                                                        padding: '6px 8px',
                                                        borderRadius: '4px',
                                                        fontSize: '13px',
                                                        fontFamily: 'monospace',
                                                        outline: 'none'
                                                    }}
                                                    step={type === 'float' ? 'any' : '1'}
                                                />
                                            )}
                                            {boundGlobal && (
                                                <div style={{
                                                    flex: 1,
                                                    background: '#0d1117',
                                                    border: '1px solid #30363d',
                                                    color: '#58a6ff',
                                                    padding: '6px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '13px',
                                                    fontFamily: 'monospace',
                                                }}>
                                                    ${boundGlobal}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                    </div>
                </div>
            )}
            
            <div className="code-panel-editor" style={{ flex: 1, minHeight: 0 }}>
              <Editor
                height="100%"
                language="python"
                theme="vs-dark"
                value={editedCode || '# No code available'}
                onChange={handleCodeChange}
                options={{
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  minimap: { enabled: false },
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 4,
                  padding: { top: 16 },
                  readOnly: false
                }}
              />
            </div>
        </div>
      )}
    </div>
  )
}

export default CodePanel
