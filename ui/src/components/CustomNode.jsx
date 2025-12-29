import { memo } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import { getTypeColor } from '../utils/typeColors'

function CustomNode({ id, data, selected }) {
  const { deleteElements } = useReactFlow()
  
  const inputs = Object.entries(data.inputs || {})
  const outputs = Object.entries(data.outputs || {})
  const maxPorts = Math.max(inputs.length, outputs.length)
  
  const handleDelete = (e) => {
    e.stopPropagation()
    deleteElements({ nodes: [{ id }] })
  }
  
  return (
    <div className={`custom-node ${selected ? 'selected' : ''}`}>
      <div className="custom-node-header">
        <span>{data.label}</span>
        <button className="node-delete-btn" onClick={handleDelete} title="Delete node">×</button>
      </div>
      <div className="custom-node-body">
        {Array.from({ length: maxPorts }).map((_, i) => {
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
                  <span className="port-name">{input[0]}</span>
                  <span className="port-type" style={{ color: getTypeColor(input[1].type) }}>{input[1].type}</span>
                </div>
              ) : <div className="custom-node-port-empty" />}
              
              {output ? (
                <div className="custom-node-port output">
                  <span className="port-name">{output[0]}</span>
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
        })}
      </div>
    </div>
  )
}

export default memo(CustomNode)
