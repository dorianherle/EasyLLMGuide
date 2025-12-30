import { memo } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import { getTypeColor } from '../utils/typeColors'

function SubgraphNode({ id, data, selected }) {
  const { deleteElements } = useReactFlow()
  
  const inputs = Object.entries(data.inputs || {})
  const outputs = Object.entries(data.outputs || {})
  const maxPorts = Math.max(inputs.length, outputs.length, 1)
  
  const handleDelete = (e) => {
    e.stopPropagation()
    deleteElements({ nodes: [{ id }] })
  }
  
  return (
    <div className={`custom-node subgraph-node ${selected ? 'selected' : ''}`}>
      <div className="custom-node-header subgraph-header">
        <span>📦 {data.label}</span>
        <button className="node-delete-btn" onClick={handleDelete} title="Delete">×</button>
      </div>
      <div className="subgraph-info">
        {data.nodeCount} nodes
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
                    style={{
                      background: getTypeColor(input[1].type),
                      top: `${68 + i * 28}px`
                    }}
                  />
                  <span style={{ color: getTypeColor(input[1].type) }}>●</span>
                  <span>{input[0]}</span>
                </div>
              ) : <div />}
              
              {output ? (
                <div className="custom-node-port output">
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={output[0]}
                    style={{
                      background: getTypeColor(output[1].type),
                      top: `${68 + i * 28}px`
                    }}
                  />
                  <span style={{ color: getTypeColor(output[1].type) }}>●</span>
                  <span>{output[0]}</span>
                </div>
              ) : <div />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default memo(SubgraphNode)

