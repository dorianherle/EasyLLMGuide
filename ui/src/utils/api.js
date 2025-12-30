const API_URL = 'http://localhost:8000'
const WS_URL = 'ws://localhost:8000'

export async function getNodes() {
  const res = await fetch(`${API_URL}/nodes`)
  if (!res.ok) throw new Error('Failed to fetch nodes')
  return res.json()
}

export function expandSubgraphs(nodes, edges, subgraphs) {
  let expandedNodes = []
  let expandedEdges = [...edges]
  
  nodes.forEach(node => {
    if (node.type === 'subgraph') {
      const subgraph = subgraphs?.find(s => s.id === node.id)
      if (!subgraph || !subgraph.nodes?.length) {
        return
      }
      
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
      
      ;(subgraph.edges || []).forEach(e => {
        expandedEdges.push({ ...e, id: `expanded-${e.id}-${Math.random()}` })
      })
      
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
  
  const hasMoreSubgraphs = expandedNodes.some(n => n.type === 'subgraph')
  if (hasMoreSubgraphs) {
    return expandSubgraphs(expandedNodes, expandedEdges, subgraphs)
  }
  
  return { nodes: expandedNodes, edges: expandedEdges }
}

export async function saveGraph(nodes, edges, subgraphs = []) {
  const { nodes: expandedNodes, edges: expandedEdges } = expandSubgraphs(nodes, edges, subgraphs)
  
  const graphDef = {
    instances: expandedNodes.map(n => ({ id: n.id, type: n.data.label })),
    edges: expandedEdges.map(e => ({
      source: e.source,
      sourceHandle: e.sourceHandle,
      target: e.target,
      targetHandle: e.targetHandle
    }))
  }
  
  const res = await fetch(`${API_URL}/graph`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(graphDef)
  })
  if (!res.ok) throw new Error('Failed to save graph')
  return res.json()
}

export async function runGraph() {
  const res = await fetch(`${API_URL}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  })
  if (!res.ok) throw new Error('Failed to run graph')
  return res.json()
}

// Websocket with send capability
let wsInstance = null

export function connectWebSocket(onMessage) {
  try {
    wsInstance = new WebSocket(`${WS_URL}/ws/events`)
    
    wsInstance.onopen = () => console.log('WebSocket connected')
    
    wsInstance.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessage(data)
      } catch (e) {
        console.error('Failed to parse WebSocket message', e)
      }
    }
    
    wsInstance.onerror = (err) => console.error('WebSocket error:', err)
    wsInstance.onclose = () => console.log('WebSocket closed')
  } catch (e) {
    console.error('Failed to connect WebSocket:', e)
    return { close: () => {}, send: () => {} }
  }
  
  return wsInstance || { close: () => {}, send: () => {} }
}

export function sendInputResponse(nodeId, value) {
  if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
    wsInstance.send(JSON.stringify({
      type: 'input_response',
      node_id: nodeId,
      value: value
    }))
  }
}

export async function getExamples() {
  const res = await fetch(`${API_URL}/examples`)
  if (!res.ok) throw new Error('Failed to fetch examples')
  return res.json()
}

export async function getExample(key) {
  const res = await fetch(`${API_URL}/examples/${key}`)
  if (!res.ok) throw new Error('Failed to fetch example')
  return res.json()
}

export async function exportGraph(nodes, edges, subgraphs = []) {
  const { nodes: expandedNodes, edges: expandedEdges } = expandSubgraphs(nodes, edges, subgraphs)
  
  const graphDef = {
    instances: expandedNodes.map(n => ({ id: n.id, type: n.data.label })),
    edges: expandedEdges.map(e => ({
      source: e.source,
      sourceHandle: e.sourceHandle,
      target: e.target,
      targetHandle: e.targetHandle
    }))
  }
  
  const res = await fetch(`${API_URL}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(graphDef)
  })
  if (!res.ok) throw new Error('Failed to export graph')
  return res.json()
}
