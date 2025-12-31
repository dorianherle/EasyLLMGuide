import { memo } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import { getTypeColor } from '../utils/typeColors'

const TRIGGER_TYPES = ['terminal_input', 'trigger']

function CustomNode({ id, data, selected }) {
  const { deleteElements } = useReactFlow()
  
  const isTrigger = TRIGGER_TYPES.includes(data.label)
  
  // Triggers don't show input ports - they get input from RunPanel
  const inputs = isTrigger ? [] : Object.entries(data.inputs || {})
  const outputs = Object.entries(data.outputs || {})
  const maxPorts = Math.max(inputs.length, outputs.length)
  
  const handleDelete = (e) => {
    e.stopPropagation()
    deleteElements({ nodes: [{ id }] })
  }

  const headerStyle = data.color ? { background: data.color } : {}
  const displayTitle = data.customTitle || data.label
  
  return (
    <div className={`custom-node ${selected ? 'selected' : ''}`}>
      <div className="custom-node-header" style={headerStyle}>
        <span>{displayTitle}</span>
        <button className="node-delete-btn" onClick={handleDelete} title="Delete node">×</button>
      </div>
      <div className="custom-node-body">
        {maxPorts === 0 ? (
          <div className="custom-node-row">
            <div className="custom-node-port-empty" />
          </div>
        ) : (
          Array.from({ length: maxPorts }).map((_, i) => {
            const input = inputs[i]
            const output = outputs[i]
            
            return (
              <div key={i} className="custom-node-row">
                {input ? (
                  <div className="custom-node-port input">
                    <Handle
                      type="target"
                      position={Position.Left}
                      id={input[0]}
                      className="port-handle"
                      style={{ background: getTypeColor(input[1].type) }}
                    />
                    <span className="port-name">{input[1].label || input[0]}</span>
                    <span className="port-type" style={{ color: getTypeColor(input[1].type) }}>{input[1].type}</span>
                  </div>
                ) : <div className="custom-node-port-empty" />}
                
                {output ? (
                  <div className="custom-node-port output">
                    <span className="port-name">{output[1].label || output[0]}</span>
                    <span className="port-type" style={{ color: getTypeColor(output[1].type) }}>{output[1].type}</span>
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={output[0]}
                      className="port-handle"
                      style={{ background: getTypeColor(output[1].type) }}
                    />
                  </div>
                ) : <div className="custom-node-port-empty" />}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default memo(CustomNode)
