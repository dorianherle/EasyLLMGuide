const API_URL = 'http://localhost:8000'
const WS_URL = 'ws://localhost:8000'

export async function getApplications() {
  const res = await fetch(`${API_URL}/applications`)
  if (!res.ok) throw new Error('Failed to fetch applications')
  return res.json()
}

export async function getNodes(application) {
  const url = application ? `${API_URL}/nodes?application=${application}` : `${API_URL}/nodes`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch nodes')
  return res.json()
}

export async function setApplication(application) {
  const res = await fetch(`${API_URL}/set-application`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ application })
  })
  if (!res.ok) throw new Error('Failed to set application')
  return res.json()
}

export async function uploadNodeFiles(files) {
  const formData = new FormData()
  for (const file of files) {
    if (file.name.endsWith('.py') && !file.name.startsWith('_')) {
      formData.append('files', file, file.webkitRelativePath || file.name)
    }
  }
  
  const res = await fetch(`${API_URL}/upload-nodes`, {
    method: 'POST',
    body: formData
  })
  if (!res.ok) throw new Error('Failed to upload nodes')
  return res.json()
}

export async function clearCustomNodes() {
  const res = await fetch(`${API_URL}/clear-custom-nodes`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to clear custom nodes')
  return res.json()
}

export function expandSubgraphs(nodes, edges, subgraphs) {
  let expandedNodes = []
  let expandedEdges = [...edges]
  
  // Helper to parse handle by matching against actual node IDs
  const parseHandle = (handle, contextNodes) => {
    for (const n of contextNodes) {
      if (handle.startsWith(n.id + '_')) {
        return {
          nodeId: n.id,
          portName: handle.substring(n.id.length + 1)
        }
      }
    }
    // Fallback to lastIndexOf
    const lastUnderscore = handle.lastIndexOf('_')
    if (lastUnderscore > 0) {
      return {
        nodeId: handle.substring(0, lastUnderscore),
        portName: handle.substring(lastUnderscore + 1)
      }
    }
    return null
  }
  
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
          const parsed = parseHandle(e.targetHandle, subgraph.nodes)
          if (parsed) {
            expandedEdges.push({
              id: `reconnect-${Date.now()}-${Math.random()}`,
              source: e.source,
              sourceHandle: e.sourceHandle,
              target: parsed.nodeId,
              targetHandle: parsed.portName
            })
          }
        }
        if (e.source === node.id && e.sourceHandle) {
          const parsed = parseHandle(e.sourceHandle, subgraph.nodes)
          if (parsed) {
            expandedEdges.push({
              id: `reconnect-${Date.now()}-${Math.random()}`,
              source: parsed.nodeId,
              sourceHandle: parsed.portName,
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

export async function saveGraph(nodes, edges, subgraphs = [], globalVariables = []) {
  const { nodes: expandedNodes, edges: expandedEdges } = expandSubgraphs(nodes, edges, subgraphs)
  
  const graphDef = {
    instances: expandedNodes.map(n => ({
      id: n.id,
      type: n.data.label,
      defaults: n.data.defaults || {},
      globalBindings: n.data.globalBindings || {}
    })),
    edges: expandedEdges.map(e => ({
      source: e.source,
      sourceHandle: e.sourceHandle,
      target: e.target,
      targetHandle: e.targetHandle
    })),
    globalVariables: globalVariables.reduce((acc, v) => {
      acc[v.name] = v.value
      return acc
    }, {})
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

export async function updateNodeCode(nodeName, code) {
  const res = await fetch(`${API_URL}/update-node-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ node_name: nodeName, code: code })
  })
  if (!res.ok) throw new Error('Failed to update node code')
  return res.json()
}

export function getGraph() {
  const saved = localStorage.getItem('easyLLMGuide_graph')
  if (!saved) {
    return { nodes: [], edges: [], subgraphs: [], globalVariables: {} }
  }
  return JSON.parse(saved)
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
