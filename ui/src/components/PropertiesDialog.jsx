import { useState, useEffect, useMemo } from 'react'

const NODE_COLORS = [
  { name: 'Default', value: null },
  { name: 'Blue', value: '#1f6feb' },
  { name: 'Green', value: '#238636' },
  { name: 'Purple', value: '#8957e5' },
  { name: 'Orange', value: '#d29922' },
  { name: 'Red', value: '#da3633' },
  { name: 'Teal', value: '#0d9488' },
]

// Parse subgraph port key like "add-123456_result" into { nodeId, portName }
function parsePortKey(key) {
  const lastUnderscore = key.lastIndexOf('_')
  if (lastUnderscore > 0) {
    return {
      nodeId: key.substring(0, lastUnderscore),
      portName: key.substring(lastUnderscore + 1)
    }
  }
  return { nodeId: null, portName: key }
}

// Extract node type from ID like "add-123456" -> "add"
function getNodeType(nodeId) {
  const match = nodeId?.match(/^([a-z_]+)-/i)
  return match ? match[1] : nodeId
}

function PropertiesDialog({ node, onSave, onClose }) {
  const [title, setTitle] = useState('')
  const [color, setColor] = useState(null)
  const [portLabels, setPortLabels] = useState({ inputs: {}, outputs: {} })

  useEffect(() => {
    if (node) {
      setTitle(node.data.customTitle || '')
      setColor(node.data.color || null)
      
      const inputs = {}
      const outputs = {}
      Object.entries(node.data.inputs || {}).forEach(([key, val]) => {
        inputs[key] = val.label || ''
      })
      Object.entries(node.data.outputs || {}).forEach(([key, val]) => {
        outputs[key] = val.label || ''
      })
      setPortLabels({ inputs, outputs })
    }
  }, [node])

  // Group ports by parent node for subgraphs
  const groupedInputs = useMemo(() => {
    const inputs = Object.entries(node?.data.inputs || {})
    const isSubgraph = node?.type === 'subgraph'
    
    if (!isSubgraph) {
      return [{ nodeId: null, nodeType: null, ports: inputs }]
    }
    
    const groups = {}
    inputs.forEach(([key, val]) => {
      const { nodeId, portName } = parsePortKey(key)
      if (!groups[nodeId]) {
        groups[nodeId] = { nodeId, nodeType: getNodeType(nodeId), ports: [] }
      }
      groups[nodeId].ports.push([key, val, portName])
    })
    return Object.values(groups)
  }, [node])

  const groupedOutputs = useMemo(() => {
    const outputs = Object.entries(node?.data.outputs || {})
    const isSubgraph = node?.type === 'subgraph'
    
    if (!isSubgraph) {
      return [{ nodeId: null, nodeType: null, ports: outputs }]
    }
    
    const groups = {}
    outputs.forEach(([key, val]) => {
      const { nodeId, portName } = parsePortKey(key)
      if (!groups[nodeId]) {
        groups[nodeId] = { nodeId, nodeType: getNodeType(nodeId), ports: [] }
      }
      groups[nodeId].ports.push([key, val, portName])
    })
    return Object.values(groups)
  }, [node])

  const handleSave = () => {
    onSave({
      customTitle: title.trim() || null,
      color,
      portLabels
    })
  }

  if (!node) return null

  const isTrigger = ['terminal_input', 'trigger'].includes(node.data.label)
  const isSubgraph = node.type === 'subgraph'
  const displayName = isSubgraph ? `📦 ${node.data.label}` : node.data.label
  const hasInputs = groupedInputs.some(g => g.ports.length > 0)
  const hasOutputs = groupedOutputs.some(g => g.ports.length > 0)

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog properties-dialog" onClick={e => e.stopPropagation()}>
        <h3>Properties: {displayName}</h3>
        
        <div className="prop-section">
          <label>Title</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={node.data.label}
          />
        </div>

        <div className="prop-section">
          <label>Color</label>
          <div className="color-options">
            {NODE_COLORS.map(c => (
              <button
                key={c.name}
                className={`color-option ${color === c.value ? 'selected' : ''}`}
                style={{ background: c.value || '#21262d' }}
                onClick={() => setColor(c.value)}
                title={c.name}
              />
            ))}
          </div>
        </div>

        {!isTrigger && hasInputs && (
          <div className="prop-section">
            <label>Input Labels</label>
            {groupedInputs.map(group => (
              <div key={group.nodeId || 'default'} className="port-group">
                {group.nodeId && (
                  <div className="port-group-header">
                    <span className="port-group-type">{group.nodeType}</span>
                    <span className="port-group-id">{group.nodeId}</span>
                  </div>
                )}
                {group.ports.map(([key, val, originalName]) => (
                  <div key={key} className="port-label-row">
                    <span className="port-original">
                      {isSubgraph ? `${group.nodeType}.${originalName || key}` : key}
                    </span>
                    <input
                      type="text"
                      value={portLabels.inputs[key] || ''}
                      onChange={e => setPortLabels(prev => ({
                        ...prev,
                        inputs: { ...prev.inputs, [key]: e.target.value }
                      }))}
                      placeholder={originalName || key}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {hasOutputs && (
          <div className="prop-section">
            <label>Output Labels</label>
            {groupedOutputs.map(group => (
              <div key={group.nodeId || 'default'} className="port-group">
                {group.nodeId && (
                  <div className="port-group-header">
                    <span className="port-group-type">{group.nodeType}</span>
                    <span className="port-group-id">{group.nodeId}</span>
                  </div>
                )}
                {group.ports.map(([key, val, originalName]) => (
                  <div key={key} className="port-label-row">
                    <span className="port-original">
                      {isSubgraph ? `${group.nodeType}.${originalName || key}` : key}
                    </span>
                    <input
                      type="text"
                      value={portLabels.outputs[key] || ''}
                      onChange={e => setPortLabels(prev => ({
                        ...prev,
                        outputs: { ...prev.outputs, [key]: e.target.value }
                      }))}
                      placeholder={originalName || key}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="dialog-buttons">
          <button className="dialog-cancel" onClick={onClose}>Cancel</button>
          <button className="dialog-confirm" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}

export default PropertiesDialog
