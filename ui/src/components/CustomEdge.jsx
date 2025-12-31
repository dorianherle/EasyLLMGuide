import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow } from '@xyflow/react'

function CustomEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, data }) {
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

  const handlePacketClick = (e) => {
    e.stopPropagation()
    // Call the onPacketClick callback if provided
    if (data?.onPacketClick) {
      data.onPacketClick(data.packets)
    }
  }

  // Data packets on this edge
  const packets = data?.packets || []
  const hasPackets = packets.length > 0

  // Position packet at 60% along the edge (closer to target)
  const packetX = sourceX + (targetX - sourceX) * 0.6
  const packetY = sourceY + (targetY - sourceY) * 0.6

  return (
    <>
      <BaseEdge 
        path={edgePath} 
        style={{ 
          ...style, 
          stroke: hasPackets ? '#58a6ff' : '#484f58', 
          strokeWidth: hasPackets ? 3 : 2 
        }} 
      />
      <EdgeLabelRenderer>
        {/* Delete button - only show when no packets */}
        {!hasPackets && (
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
        )}
        
        {/* Data packet */}
        {hasPackets && (
          <div
            className="edge-packet"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${packetX}px,${packetY}px)`,
              pointerEvents: 'all',
            }}
            onClick={handlePacketClick}
          >
            <div className="packet-dot">
              {packets.length > 1 && <span className="packet-count">{packets.length}</span>}
            </div>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  )
}

export default CustomEdge
