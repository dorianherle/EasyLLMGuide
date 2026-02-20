import { useCallback, useEffect, useState, useRef, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  useViewport,
  useReactFlow
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import CustomNode from './CustomNode'
import CustomEdge from './CustomEdge'
import SubgraphNode from './SubgraphNode'
import ContextMenu from './ContextMenu'
import NameDialog from './NameDialog'
import PropertiesDialog from './PropertiesDialog'

const nodeTypes = { custom: CustomNode, subgraph: SubgraphNode }
const edgeTypes = { custom: CustomEdge }

// Generate short random ID for edges
const shortId = () => Math.random().toString(36).substring(2, 6)

// Ghost edges component - shows faded connections to outside world
function GhostEdges({ nodes, inputs, outputs }) {
  const { x: vpX, y: vpY, zoom } = useViewport()
  
  // Build paths for ghost edges
  const paths = useMemo(() => {
    const result = []
    
    // Helper to get node port position
    const getPortPos = (nodeId, portName, isInput) => {
      let node = nodes.find(n => n.id === nodeId)
      let actualPortName = portName
      
      // If node not found directly, check if it's inside a subgraph
      if (!node) {
        const handle = `${nodeId}_${portName}`
        // Look for a subgraph that exposes this port
        node = nodes.find(n => 
          n.type === 'subgraph' && 
          (isInput ? n.data?.inputs?.[handle] : n.data?.outputs?.[handle])
        )
        if (node) {
          actualPortName = handle
        }
      }
      
      if (!node) return null
      
      // Use actual measured width from React Flow, fallback to min-width
      const nodeWidth = node.measured?.width || node.width || 180
      const headerHeight = node.type === 'subgraph' ? 58 : 38 // subgraph has info row
      const bodyPadding = 6
      const rowHeight = 28
      
      // Find port index
      const ports = isInput ? Object.keys(node.data?.inputs || {}) : Object.keys(node.data?.outputs || {})
      const portIndex = ports.indexOf(actualPortName)
      if (portIndex === -1) return null
      
      const portY = headerHeight + bodyPadding + rowHeight * portIndex + rowHeight / 2
      const strokeOffset = 1 // half of stroke width (2px)
      
      return {
        x: node.position.x + (isInput ? 0 : nodeWidth),
        y: node.position.y + portY + strokeOffset
      }
    }
    
    // Ghost edges for inputs (coming from left)
    inputs.forEach((inp, i) => {
      const pos = getPortPos(inp.nodeId, inp.portName, true)
      if (!pos) return
      
      const endX = pos.x
      const endY = pos.y
      const startX = endX - 150
      const startY = endY
      
      result.push({
        id: `ghost-in-${i}`,
        type: 'input',
        d: `M ${startX} ${startY} C ${startX + 50} ${startY}, ${endX - 50} ${endY}, ${endX} ${endY}`,
        label: inp.fromLabel,
        labelX: startX,
        labelY: startY - 8
      })
    })
    
    // Ghost edges for outputs (going to right)
    outputs.forEach((out, i) => {
      const pos = getPortPos(out.nodeId, out.portName, false)
      if (!pos) return
      
      const startX = pos.x
      const startY = pos.y
      const endX = startX + 150
      const endY = startY
      
      result.push({
        id: `ghost-out-${i}`,
        type: 'output',
        d: `M ${startX} ${startY} C ${startX + 50} ${startY}, ${endX - 50} ${endY}, ${endX} ${endY}`,
        label: out.toLabel,
        labelX: endX,
        labelY: endY - 8
      })
    })
    
    return result
  }, [nodes, inputs, outputs])
  
  return (
    <svg className="ghost-edges-layer" style={{ overflow: 'visible' }}>
      <g transform={`translate(${vpX}, ${vpY}) scale(${zoom})`}>
        {paths.map(p => (
          <g key={p.id}>
            <path
              d={p.d}
              fill="none"
              stroke="#8957e5"
              strokeWidth={2}
              strokeOpacity={0.6}
              strokeDasharray="8 4"
            />
            {p.label && (
              <text
                x={p.labelX}
                y={p.labelY}
                fill="#8957e5"
                fontSize={11}
                fontFamily="JetBrains Mono, monospace"
                textAnchor={p.type === 'input' ? 'start' : 'end'}
                opacity={0.8}
              >
                {p.label}
              </text>
            )}
          </g>
        ))}
      </g>
    </svg>
  )
}

function FlowEditor({ nodes, setNodes, edges, setEdges, onNodeSelect, subgraphs, setSubgraphs, highlightedNode, edgePackets = {}, onPacketClick, activeSubgraphs = new Set() }) {
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState([])
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState([])
  const [contextMenu, setContextMenu] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showNameDialog, setShowNameDialog] = useState(false)
  const [propertiesNode, setPropertiesNode] = useState(null)
  const reactFlowInstance = useRef(null)
  
  // Navigation stack for infinite nesting - array of subgraph IDs
  const [editPath, setEditPath] = useState([])
  
  // Get current context based on edit path
  const currentContext = useMemo(() => {
    if (editPath.length === 0) {
      return { nodes, edges, isRoot: true }
    }
    const subgraph = subgraphs.find(s => s.id === editPath[editPath.length - 1])
    return { 
      nodes: subgraph?.nodes || [], 
      edges: subgraph?.edges || [], 
      isRoot: false,
      subgraph 
    }
  }, [editPath, nodes, edges, subgraphs])

  // Get breadcrumb path names
  const breadcrumbs = useMemo(() => {
    return editPath.map(id => {
      const sg = subgraphs.find(s => s.id === id)
      return sg?.name || id
    })
  }, [editPath, subgraphs])

  // Get external connections for current subgraph (for ghost edges)
  // Traces connections up through nested subgraphs to find ultimate source/target
  const externalConnections = useMemo(() => {
    if (editPath.length === 0) return { inputs: [], outputs: [] }
    
    // Helper to get context (nodes/edges) at a given level
    const getContext = (level) => {
      if (level < 0) return { nodes, edges }
      const sg = subgraphs.find(s => s.id === editPath[level])
      return { nodes: sg?.nodes || [], edges: sg?.edges || [] }
    }
    
    // Trace an input connection up through hierarchy to find real source
    const traceInputSource = (subgraphId, handle, level) => {
      const parentCtx = getContext(level - 1)
      
      // Find edge targeting this subgraph with this handle
      const edge = parentCtx.edges.find(e => 
        e.target === subgraphId && e.targetHandle === handle
      )
      
      if (edge) {
        const sourceNode = parentCtx.nodes.find(n => n.id === edge.source)
        if (sourceNode?.type === 'subgraph' && edge.sourceHandle) {
          // Source is a subgraph - trace through it (but this gets complex, just use name)
          return edge.source
        }
        return edge.source
      }
      
      // No edge at this level - check if handle passes through to parent subgraph
      if (level > 0) {
        const parentSubgraphId = editPath[level - 1]
        const grandparentCtx = getContext(level - 2)
        const parentNode = grandparentCtx.nodes.find(n => n.id === parentSubgraphId)
        
        // If parent subgraph exposes this same handle, trace up
        if (parentNode?.data?.inputs?.[handle]) {
          return traceInputSource(parentSubgraphId, handle, level - 1)
        }
      }
      
      return null
    }
    
    // Trace an output connection up through hierarchy to find real target
    const traceOutputTarget = (subgraphId, handle, level) => {
      const parentCtx = getContext(level - 1)
      
      // Find edge from this subgraph with this handle
      const edge = parentCtx.edges.find(e => 
        e.source === subgraphId && e.sourceHandle === handle
      )
      
      if (edge) {
        const targetNode = parentCtx.nodes.find(n => n.id === edge.target)
        if (targetNode?.type === 'subgraph' && edge.targetHandle) {
          return edge.target
        }
        return edge.target
      }
      
      // No edge at this level - check if handle passes through to parent subgraph
      if (level > 0) {
        const parentSubgraphId = editPath[level - 1]
        const grandparentCtx = getContext(level - 2)
        const parentNode = grandparentCtx.nodes.find(n => n.id === parentSubgraphId)
        
        if (parentNode?.data?.outputs?.[handle]) {
          return traceOutputTarget(parentSubgraphId, handle, level - 1)
        }
      }
      
      return null
    }
    
    const currentSubgraphId = editPath[editPath.length - 1]
    const currentLevel = editPath.length - 1
    const parentCtx = getContext(currentLevel - 1)
    const currentNode = parentCtx.nodes.find(n => n.id === currentSubgraphId)
    
    const inputs = []
    const outputs = []
    
    // Helper to parse handle into nodeId and portName by matching against actual nodes
    const parseHandle = (handle, contextNodes) => {
      // Try to find a node whose ID is a prefix of the handle
      for (const node of contextNodes) {
        if (handle.startsWith(node.id + '_')) {
          return {
            nodeId: node.id,
            portName: handle.substring(node.id.length + 1)
          }
        }
      }
      // Fallback to lastIndexOf for simple cases
      const lastUnderscore = handle.lastIndexOf('_')
      if (lastUnderscore > 0) {
        return {
          nodeId: handle.substring(0, lastUnderscore),
          portName: handle.substring(lastUnderscore + 1)
        }
      }
      return null
    }
    
    const currentSubgraphData = subgraphs.find(s => s.id === currentSubgraphId)
    const internalNodes = currentSubgraphData?.nodes || []
    
    // For each exposed input, trace to find source
    Object.keys(currentNode?.data?.inputs || {}).forEach(handle => {
      const source = traceInputSource(currentSubgraphId, handle, currentLevel)
      if (source) {
        const parsed = parseHandle(handle, internalNodes)
        if (parsed) {
          inputs.push({
            nodeId: parsed.nodeId,
            portName: parsed.portName,
            fromLabel: source
          })
        }
      }
    })
    
    // For each exposed output, trace to find target
    Object.keys(currentNode?.data?.outputs || {}).forEach(handle => {
      const target = traceOutputTarget(currentSubgraphId, handle, currentLevel)
      if (target) {
        const parsed = parseHandle(handle, internalNodes)
        if (parsed) {
          outputs.push({
            nodeId: parsed.nodeId,
            portName: parsed.portName,
            toLabel: target
          })
        }
      }
    })
    
    return { inputs, outputs }
  }, [editPath, nodes, edges, subgraphs])

  // Update nodes/edges in current context
  const updateCurrentContext = useCallback((newNodes, newEdges) => {
    if (editPath.length === 0) {
      if (newNodes) setNodes(newNodes)
      if (newEdges) setEdges(newEdges)
    } else {
      const currentId = editPath[editPath.length - 1]
      setSubgraphs(prev => prev.map(s => 
        s.id === currentId 
          ? { ...s, nodes: newNodes ?? s.nodes, edges: newEdges ?? s.edges }
          : s
      ))
    }
  }, [editPath, setNodes, setEdges, setSubgraphs])

  // Update a single node in current context
  const updateNodeInContext = useCallback((nodeId, updater) => {
    if (editPath.length === 0) {
      setNodes(prev => prev.map(n => n.id === nodeId ? updater(n) : n))
    } else {
      const currentId = editPath[editPath.length - 1]
      setSubgraphs(prev => prev.map(s => 
        s.id === currentId 
          ? { ...s, nodes: s.nodes.map(n => n.id === nodeId ? updater(n) : n) }
          : s
      ))
    }
  }, [editPath, setNodes, setSubgraphs])

  // Sync flow display with current context
  useEffect(() => {
    setFlowNodes(currentContext.nodes.map(n => {
      let className = ''
      if (n.id === highlightedNode) className = 'highlighted'
      else if (n.type === 'subgraph' && activeSubgraphs.has(n.id)) className = 'subgraph-active'
      else if (n.data?.nodeType?.startsWith('ui_')) className = 'ui-node'
      return { ...n, selected: selectedIds.has(n.id), className }
    }))
    
    // Show packets on all edges (root or inside subgraph)
    setFlowEdges(currentContext.edges.map(e => ({ 
      ...e, 
      type: 'custom',
      data: { 
        ...e.data, 
        packets: edgePackets[e.id] || [],
        onPacketClick 
      }
    })))
  }, [currentContext, selectedIds, highlightedNode, edgePackets, onPacketClick, activeSubgraphs, setFlowNodes, setFlowEdges])

  const handleNodesChange = useCallback((changes) => {
    onNodesChange(changes)
    
    changes.forEach(change => {
      if (change.type === 'position' && change.position && !change.dragging) {
        updateNodeInContext(change.id, n => ({ ...n, position: change.position }))
      } else if (change.type === 'remove') {
        updateCurrentContext(
          currentContext.nodes.filter(n => n.id !== change.id),
          currentContext.edges.filter(e => e.source !== change.id && e.target !== change.id)
        )
        setSelectedIds(prev => { const next = new Set(prev); next.delete(change.id); return next })
      }
    })
  }, [onNodesChange, updateNodeInContext, updateCurrentContext, currentContext])

  const handleEdgesChange = useCallback((changes) => {
    onEdgesChange(changes)
    changes.forEach(change => {
      if (change.type === 'remove') {
        updateCurrentContext(null, currentContext.edges.filter(e => e.id !== change.id))
      }
    })
  }, [onEdgesChange, updateCurrentContext, currentContext])

  const onConnect = useCallback((params) => {
    const alreadyConnected = currentContext.edges.some(
      e => e.target === params.target && e.targetHandle === params.targetHandle
    )
    if (alreadyConnected) return
    
    const newEdge = { ...params, id: `e-${shortId()}`, type: 'custom' }
    setFlowEdges((eds) => addEdge(newEdge, eds))
    updateCurrentContext(null, [...currentContext.edges, { ...newEdge, type: undefined }])
  }, [currentContext, setFlowEdges, updateCurrentContext])

  const onNodeClick = useCallback((event, node) => {
    if (event.ctrlKey || event.metaKey) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        if (next.has(node.id)) next.delete(node.id)
        else next.add(node.id)
        return next
      })
    } else {
      setSelectedIds(new Set([node.id]))
      onNodeSelect(node)
    }
  }, [onNodeSelect])

  const onPaneClick = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleDeleteNode = useCallback((nodeId) => {
    updateCurrentContext(
      currentContext.nodes.filter(n => n.id !== nodeId),
      currentContext.edges.filter(e => e.source !== nodeId && e.target !== nodeId)
    )
    // Also remove from subgraphs if it's a subgraph node
    const node = currentContext.nodes.find(n => n.id === nodeId)
    if (node?.type === 'subgraph') {
      setSubgraphs(prev => prev.filter(s => s.id !== nodeId))
    }
  }, [currentContext, updateCurrentContext, setSubgraphs])

  const handleEditSubgraph = useCallback((node) => {
    setEditPath(prev => [...prev, node.id])
    setSelectedIds(new Set())
  }, [])

  const handleExpandSubgraph = useCallback((node) => {
    const subgraph = subgraphs.find(s => s.id === node.id)
    if (!subgraph?.nodes?.length) return

    const avgX = subgraph.nodes.reduce((sum, n) => sum + n.position.x, 0) / subgraph.nodes.length
    const avgY = subgraph.nodes.reduce((sum, n) => sum + n.position.y, 0) / subgraph.nodes.length
    const offsetX = node.position.x - avgX
    const offsetY = node.position.y - avgY

    // New nodes = current minus subgraph node plus subgraph contents
    const newNodes = currentContext.nodes.filter(n => n.id !== node.id)
    subgraph.nodes.forEach(n => {
      newNodes.push({ ...n, position: { x: n.position.x + offsetX, y: n.position.y + offsetY } })
    })
    
    // New edges = current minus subgraph edges plus internal edges plus reconnected external
    const newEdges = currentContext.edges.filter(e => e.source !== node.id && e.target !== node.id)
    ;(subgraph.edges || []).forEach(e => newEdges.push({ ...e, id: `e-${shortId()}` }))
    
    currentContext.edges.forEach(e => {
      if (e.target === node.id && e.targetHandle) {
        const lastUnderscore = e.targetHandle.lastIndexOf('_')
        if (lastUnderscore > 0) {
          const origNode = e.targetHandle.substring(0, lastUnderscore)
          const origHandle = e.targetHandle.substring(lastUnderscore + 1)
          newEdges.push({ id: `e-${shortId()}`, source: e.source, sourceHandle: e.sourceHandle, target: origNode, targetHandle: origHandle })
        }
      }
      if (e.source === node.id && e.sourceHandle) {
        const lastUnderscore = e.sourceHandle.lastIndexOf('_')
        if (lastUnderscore > 0) {
          const origNode = e.sourceHandle.substring(0, lastUnderscore)
          const origHandle = e.sourceHandle.substring(lastUnderscore + 1)
          newEdges.push({ id: `e-${shortId()}`, source: origNode, sourceHandle: origHandle, target: e.target, targetHandle: e.targetHandle })
        }
      }
    })
    
    updateCurrentContext(newNodes, newEdges)
    setSubgraphs(prev => prev.filter(s => s.id !== node.id))
  }, [currentContext, subgraphs, updateCurrentContext, setSubgraphs])

  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault()
    const items = []
    
    // Properties for all node types
    items.push(
      { label: 'Properties', icon: '⚙️', action: () => setPropertiesNode(node) },
      { divider: true }
    )
    
    if (node.type === 'subgraph') {
      items.push(
        { label: 'Inspect', icon: '🔍', action: () => handleEditSubgraph(node) },
        { label: 'Expand', icon: '📤', action: () => handleExpandSubgraph(node) },
        { divider: true }
      )
    }
    
    items.push({ label: 'Delete', icon: '🗑️', action: () => handleDeleteNode(node.id) })
    setContextMenu({ x: event.clientX, y: event.clientY, items })
  }, [handleEditSubgraph, handleExpandSubgraph, handleDeleteNode])

  const deleteSelected = useCallback(() => {
    const newNodes = currentContext.nodes.filter(n => !selectedIds.has(n.id))
    const newEdges = currentContext.edges.filter(e => !selectedIds.has(e.source) && !selectedIds.has(e.target))
    updateCurrentContext(newNodes, newEdges)
    
    // Remove any subgraphs that were deleted
    selectedIds.forEach(id => {
      const node = currentContext.nodes.find(n => n.id === id)
      if (node?.type === 'subgraph') {
        setSubgraphs(prev => prev.filter(s => s.id !== id))
      }
    })
    
    setSelectedIds(new Set())
  }, [selectedIds, currentContext, updateCurrentContext, setSubgraphs])

  const onPaneContextMenu = useCallback((event) => {
    event.preventDefault()
    if (selectedIds.size > 1) {
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        items: [
          { label: `Create Subgraph (${selectedIds.size} nodes)`, icon: '📦', action: () => setShowNameDialog(true) },
          { divider: true },
          { label: 'Delete Selected', icon: '🗑️', action: deleteSelected }
        ]
      })
    }
  }, [selectedIds, deleteSelected])

  const doCreateSubgraph = useCallback((name) => {
    const selectedNodeData = currentContext.nodes.filter(n => selectedIds.has(n.id))
    const internalEdges = currentContext.edges.filter(e => selectedIds.has(e.source) && selectedIds.has(e.target))
    
    const externalInputs = {}
    const externalOutputs = {}
    
    // Check edges in current context
    currentContext.edges.forEach(e => {
      if (selectedIds.has(e.target) && !selectedIds.has(e.source)) {
        const key = `${e.target}_${e.targetHandle}`
        const targetNode = selectedNodeData.find(n => n.id === e.target)
        externalInputs[key] = { type: targetNode?.data.inputs?.[e.targetHandle]?.type || 'Any' }
      }
      if (selectedIds.has(e.source) && !selectedIds.has(e.target)) {
        const key = `${e.source}_${e.sourceHandle}`
        const sourceNode = selectedNodeData.find(n => n.id === e.source)
        externalOutputs[key] = { type: sourceNode?.data.outputs?.[e.sourceHandle]?.type || 'Any' }
      }
    })
    
    // If inside a subgraph, also preserve pass-through connections from parent
    if (editPath.length > 0) {
      const currentSubgraphId = editPath[editPath.length - 1]
      const parentNodes = editPath.length === 1 ? nodes : 
        (subgraphs.find(s => s.id === editPath[editPath.length - 2])?.nodes || [])
      const currentSubgraphNode = parentNodes.find(n => n.id === currentSubgraphId)
      
      // Check parent subgraph's exposed inputs - if they map to selected nodes, preserve them
      Object.entries(currentSubgraphNode?.data?.inputs || {}).forEach(([handle, def]) => {
        const lastUnderscore = handle.lastIndexOf('_')
        if (lastUnderscore > 0) {
          const nodeId = handle.substring(0, lastUnderscore)
          const portName = handle.substring(lastUnderscore + 1)
          if (selectedIds.has(nodeId)) {
            const key = `${nodeId}_${portName}`
            if (!externalInputs[key]) externalInputs[key] = { type: def.type }
          }
        }
      })
      
      // Check parent subgraph's exposed outputs - if they map to selected nodes, preserve them
      Object.entries(currentSubgraphNode?.data?.outputs || {}).forEach(([handle, def]) => {
        const lastUnderscore = handle.lastIndexOf('_')
        if (lastUnderscore > 0) {
          const nodeId = handle.substring(0, lastUnderscore)
          const portName = handle.substring(lastUnderscore + 1)
          if (selectedIds.has(nodeId)) {
            const key = `${nodeId}_${portName}`
            if (!externalOutputs[key]) externalOutputs[key] = { type: def.type }
          }
        }
      })
    }

    selectedNodeData.forEach(node => {
      if (node.type === 'custom') {
        // Expose unconnected inputs
        Object.entries(node.data.inputs || {}).forEach(([inputName, inputDef]) => {
          const hasSource = internalEdges.some(e => e.target === node.id && e.targetHandle === inputName)
          const key = `${node.id}_${inputName}`
          if (!hasSource && !externalInputs[key]) externalInputs[key] = { type: inputDef.type }
        })
        // Expose unconnected outputs (outputs not consumed internally)
        Object.entries(node.data.outputs || {}).forEach(([outputName, outputDef]) => {
          const hasConsumer = internalEdges.some(e => e.source === node.id && e.sourceHandle === outputName)
          const key = `${node.id}_${outputName}`
          if (!hasConsumer && !externalOutputs[key]) externalOutputs[key] = { type: outputDef.type }
        })
      }
    })

    // Helper to get Y position of a port
    const getPortY = (handle, isInput) => {
      const lastUnderscore = handle.lastIndexOf('_')
      const nodeId = handle.substring(0, lastUnderscore)
      const portName = handle.substring(lastUnderscore + 1)
      const node = selectedNodeData.find(n => n.id === nodeId)
      if (!node) return 0
      
      const ports = isInput ? Object.keys(node.data?.inputs || {}) : Object.keys(node.data?.outputs || {})
      const portIndex = ports.indexOf(portName)
      const rowHeight = 28
      return node.position.y + (portIndex * rowHeight)
    }
    
    // Sort inputs and outputs by Y position
    const sortedInputs = Object.entries(externalInputs)
      .sort((a, b) => getPortY(a[0], true) - getPortY(b[0], true))
    const sortedOutputs = Object.entries(externalOutputs)
      .sort((a, b) => getPortY(a[0], false) - getPortY(b[0], false))
    
    const sortedInputsObj = Object.fromEntries(sortedInputs)
    const sortedOutputsObj = Object.fromEntries(sortedOutputs)

    const avgX = selectedNodeData.reduce((sum, n) => sum + n.position.x, 0) / selectedNodeData.length
    const avgY = selectedNodeData.reduce((sum, n) => sum + n.position.y, 0) / selectedNodeData.length

    // Use random ID to ensure uniqueness
    const subgraphId = `subgraph_${shortId()}`
    const subgraphNode = {
      id: subgraphId,
      type: 'subgraph',
      position: { x: avgX, y: avgY },
      data: { label: name, nodeCount: selectedNodeData.length, inputs: sortedInputsObj, outputs: sortedOutputsObj }
    }

    // Add new subgraph to registry
    setSubgraphs(prev => [...prev, { id: subgraphId, name, nodes: selectedNodeData, edges: internalEdges }])

    // Build new nodes/edges with subgraph replacing selected
    const newNodes = currentContext.nodes.filter(n => !selectedIds.has(n.id))
    newNodes.push(subgraphNode)

    const newEdges = currentContext.edges.filter(e => !selectedIds.has(e.source) && !selectedIds.has(e.target))
    currentContext.edges.forEach(e => {
      if (selectedIds.has(e.target) && !selectedIds.has(e.source)) {
        newEdges.push({ id: `e-${shortId()}`, source: e.source, sourceHandle: e.sourceHandle, target: subgraphId, targetHandle: `${e.target}_${e.targetHandle}` })
      }
      if (selectedIds.has(e.source) && !selectedIds.has(e.target)) {
        newEdges.push({ id: `e-${shortId()}`, source: subgraphId, sourceHandle: `${e.source}_${e.sourceHandle}`, target: e.target, targetHandle: e.targetHandle })
      }
    })

    updateCurrentContext(newNodes, newEdges)
    setSelectedIds(new Set())
    setShowNameDialog(false)
  }, [selectedIds, currentContext, updateCurrentContext, setSubgraphs, editPath, nodes, subgraphs])

  const navigateBack = useCallback(() => {
    if (editPath.length === 0) return
    
    // Update node count in parent before leaving
    const currentId = editPath[editPath.length - 1]
    const currentSubgraph = subgraphs.find(s => s.id === currentId)
    
    if (editPath.length === 1) {
      // Going back to root - update node in main nodes
      setNodes(prev => prev.map(n => 
        n.id === currentId 
          ? { ...n, data: { ...n.data, nodeCount: currentSubgraph?.nodes?.length || 0 } }
          : n
      ))
    } else {
      // Going back to parent subgraph - update node in parent subgraph
      const parentId = editPath[editPath.length - 2]
      setSubgraphs(prev => prev.map(s => 
        s.id === parentId 
          ? { ...s, nodes: s.nodes.map(n => 
              n.id === currentId 
                ? { ...n, data: { ...n.data, nodeCount: currentSubgraph?.nodes?.length || 0 } }
                : n
            )}
          : s
      ))
    }
    
    setEditPath(prev => prev.slice(0, -1))
    setSelectedIds(new Set())
  }, [editPath, subgraphs, setNodes, setSubgraphs])

  const handleSaveProperties = useCallback((props) => {
    if (!propertiesNode) return
    
    updateNodeInContext(propertiesNode.id, n => {
      const inputs = { ...n.data.inputs }
      const outputs = { ...n.data.outputs }
      
      Object.entries(props.portLabels.inputs).forEach(([key, label]) => {
        if (inputs[key]) {
          inputs[key] = { ...inputs[key], label: label || null }
        }
      })
      Object.entries(props.portLabels.outputs).forEach(([key, label]) => {
        if (outputs[key]) {
          outputs[key] = { ...outputs[key], label: label || null }
        }
      })
      
      // Also update in subgraphs registry if it's a subgraph
      if (n.type === 'subgraph') {
        setSubgraphs(prev => prev.map(s => 
          s.id === n.id ? { ...s, name: props.customTitle || s.name } : s
        ))
      }
      
      return {
        ...n,
        data: {
          ...n.data,
          customTitle: props.customTitle,
          color: props.color,
          inputs,
          outputs
        }
      }
    })
    
    setPropertiesNode(null)
  }, [propertiesNode, updateNodeInContext, setSubgraphs])

  const onDrop = useCallback((event) => {
    event.preventDefault()
    const data = event.dataTransfer.getData('application/json')
    if (!data || !reactFlowInstance.current) return

    const spec = JSON.parse(data)

    // Don't allow dropping UI nodes - they should be created through the App page
    if (spec.interface_type === 'ui' || spec.name === 'chat') {
      return
    }

    const position = reactFlowInstance.current.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY
    })
    position.x -= 90
    position.y -= 30

    // Count existing nodes of this type for sequential ID
    const count = currentContext.nodes.filter(n => n.data.label === spec.name).length
    const newNode = {
      id: `${spec.name}_${count + 1}`,
      type: 'custom',
      position,
      data: { label: spec.name, inputs: spec.inputs, outputs: spec.outputs }
    }

    updateCurrentContext([...currentContext.nodes, newNode], null)
  }, [currentContext, updateCurrentContext])

  const onDragOver = useCallback((event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  return (
    <div className="flow-editor" onDrop={onDrop} onDragOver={onDragOver}>
      {editPath.length > 0 && (
        <div className="subgraph-edit-bar">
          <button onClick={navigateBack} className="back-btn">← Back</button>
          <div className="breadcrumbs">
            <span className="breadcrumb-item" onClick={() => setEditPath([])}>Root</span>
            {breadcrumbs.map((name, i) => (
              <span key={editPath[i]}>
                <span className="breadcrumb-sep">/</span>
                <span 
                  className={`breadcrumb-item ${i === breadcrumbs.length - 1 ? 'current' : ''}`}
                  onClick={() => i < breadcrumbs.length - 1 && setEditPath(editPath.slice(0, i + 1))}
                >
                  {name}
                </span>
              </span>
            ))}
          </div>
          <span className="edit-count">{currentContext.nodes.length} nodes</span>
        </div>
      )}
      
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onInit={(instance) => { reactFlowInstance.current = instance }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'custom' }}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        deleteKeyCode={['Backspace', 'Delete']}
        panOnDrag
        selectionOnDrag={false}
        minZoom={0.01}
        maxZoom={10}
      >
        <Background color={editPath.length > 0 ? '#3d2e5c' : '#30363d'} gap={16} size={1} />
        <Controls />
        
        {/* Ghost edges showing external connections */}
        {editPath.length > 0 && (externalConnections.inputs.length > 0 || externalConnections.outputs.length > 0) && (
          <GhostEdges 
            nodes={flowNodes} 
            inputs={externalConnections.inputs} 
            outputs={externalConnections.outputs}
          />
        )}
      </ReactFlow>
      
      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.items} onClose={() => setContextMenu(null)} />
      )}
      
      {selectedIds.size > 1 && (
        <div className="selection-toolbar">
          <span>{selectedIds.size} selected</span>
          <button onClick={() => setShowNameDialog(true)}>📦 Create Subgraph</button>
          <button onClick={() => setSelectedIds(new Set())} className="clear-btn">Clear</button>
        </div>
      )}

      <NameDialog
        isOpen={showNameDialog}
        title="Create Subgraph"
        placeholder="Enter subgraph name..."
        onConfirm={doCreateSubgraph}
        onCancel={() => setShowNameDialog(false)}
      />

      {propertiesNode && (
        <PropertiesDialog
          node={propertiesNode}
          onSave={handleSaveProperties}
          onClose={() => setPropertiesNode(null)}
        />
      )}
    </div>
  )
}

export default FlowEditor
