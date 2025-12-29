const API_URL = 'http://localhost:8000'
const WS_URL = 'ws://localhost:8000'

export async function getNodes() {
  const res = await fetch(`${API_URL}/nodes`)
  if (!res.ok) throw new Error('Failed to fetch nodes')
  return res.json()
}

/**
 * Expand all subgraphs in the graph before sending to backend.
 * Returns flat lists of nodes and edges with all subgraphs expanded.
 */
function expandSubgraphs(nodes, edges, subgraphs) {
  let expandedNodes = []
  let expandedEdges = [...edges]
  
  nodes.forEach(node => {
    if (node.type === 'subgraph') {
      // Find the subgraph data
      const subgraph = subgraphs?.find(s => s.id === node.id)
      if (!subgraph || !subgraph.nodes?.length) {
        console.warn(`Subgraph ${node.id} not found or empty, skipping`)
        return
      }
      
      // Add internal nodes (with position offset)
      const avgX = subgraph.nodes.reduce((sum, n) => sum + n.position.x, 0) / subgraph.nodes.length
      const avgY = subgraph.nodes.reduce((sum, n) => sum + n.position.y, 0) / subgraph.nodes.length
      const offsetX = node.position.x - avgX
      const offsetY = node.position.y - avgY
      
      subgraph.nodes.forEach(n => {
        expandedNodes.push({
          ...n,
          position: { x: n.position.x + offsetX, y: n.position.y + offsetY }
        })
      })
      
      // Add internal edges
      ;(subgraph.edges || []).forEach(e => {
        expandedEdges.push({ ...e, id: `expanded-${e.id}-${Math.random()}` })
      })
      
      // Reconnect external edges
      expandedEdges = expandedEdges.filter(e => e.source !== node.id && e.target !== node.id)
      
      edges.forEach(e => {
        if (e.target === node.id && e.targetHandle) {
          const lastUnderscore = e.targetHandle.lastIndexOf('_')
          if (lastUnderscore > 0) {
            const origNode = e.targetHandle.substring(0, lastUnderscore)
            const origHandle = e.targetHandle.substring(lastUnderscore + 1)
            expandedEdges.push({
              id: `reconnect-${Date.now()}-${Math.random()}`,
              source: e.source,
              sourceHandle: e.sourceHandle,
              target: origNode,
              targetHandle: origHandle
            })
          }
        }
        if (e.source === node.id && e.sourceHandle) {
          const lastUnderscore = e.sourceHandle.lastIndexOf('_')
          if (lastUnderscore > 0) {
            const origNode = e.sourceHandle.substring(0, lastUnderscore)
            const origHandle = e.sourceHandle.substring(lastUnderscore + 1)
            expandedEdges.push({
              id: `reconnect-${Date.now()}-${Math.random()}`,
              source: origNode,
              sourceHandle: origHandle,
              target: e.target,
              targetHandle: e.targetHandle
            })
          }
        }
      })
    } else {
      expandedNodes.push(node)
    }
  })
  
  // Recursively expand if there are nested subgraphs
  const hasMoreSubgraphs = expandedNodes.some(n => n.type === 'subgraph')
  if (hasMoreSubgraphs) {
    return expandSubgraphs(expandedNodes, expandedEdges, subgraphs)
  }
  
  return { nodes: expandedNodes, edges: expandedEdges }
}

export async function saveGraph(nodes, edges, subgraphs = []) {
  // Expand any subgraphs before sending to backend
  const { nodes: expandedNodes, edges: expandedEdges } = expandSubgraphs(nodes, edges, subgraphs)
  
  // Convert to API format
  const graphDef = {
    instances: expandedNodes.map(n => ({ id: n.id, type: n.data.label })),
    edges: expandedEdges.map(e => ({
      source: e.source,
      sourceHandle: e.sourceHandle,
      target: e.target,
      targetHandle: e.targetHandle
    }))
  }
  
  console.log('[API] Saving graph with', expandedNodes.length, 'nodes and', expandedEdges.length, 'edges')
  
  const res = await fetch(`${API_URL}/graph`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(graphDef)
  })
  if (!res.ok) throw new Error('Failed to save graph')
  return res.json()
}

export async function runGraph(inputs) {
  const res = await fetch(`${API_URL}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs })
  })
  if (!res.ok) throw new Error('Failed to run graph')
  return res.json()
}

export function connectWebSocket(onMessage) {
  let ws = null
  
  try {
    ws = new WebSocket(`${WS_URL}/ws/events`)
    
    ws.onopen = () => console.log('WebSocket connected')
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessage(data)
      } catch (e) {
        console.error('Failed to parse WebSocket message', e)
      }
    }
    
    ws.onerror = (err) => console.error('WebSocket error:', err)
    ws.onclose = () => console.log('WebSocket closed')
  } catch (e) {
    console.error('Failed to connect WebSocket:', e)
    return { close: () => {} }
  }
  
  return ws || { close: () => {} }
}
