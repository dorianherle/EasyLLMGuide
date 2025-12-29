import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow } from '@xyflow/react'

function CustomEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {} }) {
  const { deleteElements } = useReactFlow()
  
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const handleDelete = (e) => {
    e.stopPropagation()
    deleteElements({ edges: [{ id }] })
  }

  return (
    <>
      <BaseEdge path={edgePath} style={{ ...style, stroke: '#484f58', strokeWidth: 2 }} />
      <EdgeLabelRenderer>
        <div
          className="edge-delete-btn"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
        >
          <button onClick={handleDelete} title="Delete edge">×</button>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

export default CustomEdge

