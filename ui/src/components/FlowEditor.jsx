import { useCallback, useEffect, useState, useRef, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge
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

function FlowEditor({ nodes, setNodes, edges, setEdges, onNodeSelect, subgraphs, setSubgraphs, highlightedNode, edgePackets = {}, onPacketClick }) {
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
    setFlowNodes(currentContext.nodes.map(n => ({ 
      ...n, 
      selected: selectedIds.has(n.id),
      className: n.id === highlightedNode ? 'highlighted' : ''
    })))
    
    if (currentContext.isRoot) {
      setFlowEdges(currentContext.edges.map(e => ({ 
        ...e, 
        type: 'custom',
        data: { 
          ...e.data, 
          packets: edgePackets[e.id] || [],
          onPacketClick 
        }
      })))
    } else {
      setFlowEdges(currentContext.edges.map(e => ({ ...e, type: 'custom' })))
    }
  }, [currentContext, selectedIds, highlightedNode, edgePackets, onPacketClick, setFlowNodes, setFlowEdges])

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
        { label: 'Edit Subgraph', icon: '✏️', action: () => handleEditSubgraph(node) },
        { label: 'Expand Subgraph', icon: '📤', action: () => handleExpandSubgraph(node) },
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

    selectedNodeData.forEach(node => {
      if (node.type === 'custom') {
        Object.entries(node.data.inputs || {}).forEach(([inputName, inputDef]) => {
          const hasSource = internalEdges.some(e => e.target === node.id && e.targetHandle === inputName)
          const key = `${node.id}_${inputName}`
          if (!hasSource && !externalInputs[key]) externalInputs[key] = { type: inputDef.type }
        })
      }
    })

    const avgX = selectedNodeData.reduce((sum, n) => sum + n.position.x, 0) / selectedNodeData.length
    const avgY = selectedNodeData.reduce((sum, n) => sum + n.position.y, 0) / selectedNodeData.length

    // Count existing subgraphs for sequential ID
    const subgraphCount = currentContext.nodes.filter(n => n.type === 'subgraph').length
    const subgraphId = `subgraph_${subgraphCount + 1}`
    const subgraphNode = {
      id: subgraphId,
      type: 'subgraph',
      position: { x: avgX, y: avgY },
      data: { label: name, nodeCount: selectedNodeData.length, inputs: externalInputs, outputs: externalOutputs }
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
  }, [selectedIds, currentContext, updateCurrentContext, setSubgraphs])

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
      >
        <Background color={editPath.length > 0 ? '#3d2e5c' : '#30363d'} gap={16} size={1} />
        <Controls />
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
