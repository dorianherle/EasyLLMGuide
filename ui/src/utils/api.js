const API_URL = 'http://localhost:8000'
const WS_URL = 'ws://localhost:8000'

export async function getNodes() {
  const res = await fetch(`${API_URL}/nodes`)
  if (!res.ok) throw new Error('Failed to fetch nodes')
  return res.json()
}

export async function saveGraph(instances, edges) {
  // Convert to API format
  const graphDef = {
    instances: instances.map(n => ({ id: n.id, type: n.data.label })),
    edges: edges.map(e => ({
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
