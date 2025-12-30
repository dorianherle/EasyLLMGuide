import { useCallback, useEffect, useState } from 'react'
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

const nodeTypes = { custom: CustomNode, subgraph: SubgraphNode }
const edgeTypes = { custom: CustomEdge }

function FlowEditor({ nodes, setNodes, edges, setEdges, onNodeSelect, subgraphs, setSubgraphs, highlightedNode }) {
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState([])
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState([])
  const [contextMenu, setContextMenu] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showNameDialog, setShowNameDialog] = useState(false)
  const [editingSubgraphId, setEditingSubgraphId] = useState(null)

  // Get current subgraph if editing
  const editingSubgraph = editingSubgraphId ? subgraphs.find(s => s.id === editingSubgraphId) : null

  // Sync nodes - show either main graph or subgraph contents
  useEffect(() => {
    if (editingSubgraph) {
      setFlowNodes(editingSubgraph.nodes.map(n => ({ 
        ...n, 
        selected: selectedIds.has(n.id),
        className: n.id === highlightedNode ? 'highlighted' : ''
      })))
      setFlowEdges((editingSubgraph.edges || []).map(e => ({ ...e, type: 'custom' })))
    } else {
      setFlowNodes(nodes.map(n => ({ 
        ...n, 
        selected: selectedIds.has(n.id),
        className: n.id === highlightedNode ? 'highlighted' : ''
      })))
      setFlowEdges(edges.map(e => ({ ...e, type: 'custom' })))
    }
  }, [nodes, edges, selectedIds, editingSubgraph, setFlowNodes, setFlowEdges, highlightedNode])

  const handleNodesChange = useCallback((changes) => {
    onNodesChange(changes)
    
    changes.forEach(change => {
      if (change.type === 'position' && change.position && !change.dragging) {
        if (editingSubgraphId) {
          setSubgraphs(prev => prev.map(s => 
            s.id === editingSubgraphId 
              ? { ...s, nodes: s.nodes.map(n => n.id === change.id ? { ...n, position: change.position } : n) }
              : s
          ))
        } else {
          setNodes(prev => prev.map(n => n.id === change.id ? { ...n, position: change.position } : n))
        }
      } else if (change.type === 'remove') {
        if (editingSubgraphId) {
          setSubgraphs(prev => prev.map(s => 
            s.id === editingSubgraphId 
              ? { ...s, nodes: s.nodes.filter(n => n.id !== change.id) }
              : s
          ))
        } else {
          setNodes(prev => prev.filter(n => n.id !== change.id))
        }
        setSelectedIds(prev => { const next = new Set(prev); next.delete(change.id); return next })
      }
    })
  }, [onNodesChange, setNodes, editingSubgraphId, setSubgraphs])

  const handleEdgesChange = useCallback((changes) => {
    onEdgesChange(changes)
    changes.forEach(change => {
      if (change.type === 'remove') {
        if (editingSubgraphId) {
          setSubgraphs(prev => prev.map(s => 
            s.id === editingSubgraphId 
              ? { ...s, edges: (s.edges || []).filter(e => e.id !== change.id) }
              : s
          ))
        } else {
          setEdges(prev => prev.filter(e => e.id !== change.id))
        }
      }
    })
  }, [onEdgesChange, setEdges, editingSubgraphId, setSubgraphs])

  const onConnect = useCallback((params) => {
    const newEdge = { ...params, id: `e-${Date.now()}`, type: 'custom' }
    setFlowEdges((eds) => addEdge(newEdge, eds))
    
    if (editingSubgraphId) {
      setSubgraphs(prev => prev.map(s => 
        s.id === editingSubgraphId 
          ? { ...s, edges: [...(s.edges || []), { ...newEdge, type: undefined }] }
          : s
      ))
    } else {
      setEdges((eds) => addEdge({ ...newEdge, type: undefined }, eds))
    }
  }, [setFlowEdges, setEdges, editingSubgraphId, setSubgraphs])

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

  // Define these BEFORE onNodeContextMenu since they're used in its dependency array
  const handleDeleteNode = useCallback((nodeId) => {
    if (editingSubgraphId) {
      setSubgraphs(prev => prev.map(s => 
        s.id === editingSubgraphId ? { ...s, nodes: s.nodes.filter(n => n.id !== nodeId) } : s
      ))
    } else {
      setNodes(prev => prev.filter(n => n.id !== nodeId))
    }
  }, [setNodes, editingSubgraphId, setSubgraphs])

  const handleExpandSubgraph = useCallback((node) => {
    console.log('[Expand] Starting expand for node:', node.id)
    console.log('[Expand] Available subgraphs:', subgraphs)
    
    const subgraph = subgraphs?.find(s => s.id === node.id)
    if (!subgraph) {
      console.error('[Expand] Subgraph not found for id:', node.id)
      return
    }
    if (!subgraph.nodes?.length) {
      console.error('[Expand] Subgraph has no nodes')
      return
    }
    
    console.log('[Expand] Found subgraph:', subgraph)

    // Calculate position offset to place nodes where the subgraph was
    const avgX = subgraph.nodes.reduce((sum, n) => sum + n.position.x, 0) / subgraph.nodes.length
    const avgY = subgraph.nodes.reduce((sum, n) => sum + n.position.y, 0) / subgraph.nodes.length
    const offsetX = node.position.x - avgX
    const offsetY = node.position.y - avgY

    // Remove subgraph node, add back internal nodes
    const newNodes = nodes.filter(n => n.id !== node.id)
    subgraph.nodes.forEach(n => {
      newNodes.push({ 
        ...n, 
        position: { x: n.position.x + offsetX, y: n.position.y + offsetY } 
      })
    })
    
    // Keep edges not connected to subgraph, add back internal edges
    const newEdges = edges.filter(e => e.source !== node.id && e.target !== node.id)
    ;(subgraph.edges || []).forEach(e => newEdges.push({ ...e, id: `e-${Date.now()}-${Math.random()}` }))
    
    // Reconnect external edges to the original internal nodes
    edges.forEach(e => {
      if (e.target === node.id && e.targetHandle) {
        const lastUnderscore = e.targetHandle.lastIndexOf('_')
        if (lastUnderscore > 0) {
          const origNode = e.targetHandle.substring(0, lastUnderscore)
          const origHandle = e.targetHandle.substring(lastUnderscore + 1)
          newEdges.push({ 
            id: `e-${Date.now()}-${Math.random()}`, 
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
          newEdges.push({ 
            id: `e-${Date.now()}-${Math.random()}`, 
            source: origNode, 
            sourceHandle: origHandle, 
            target: e.target, 
            targetHandle: e.targetHandle 
          })
        }
      }
    })
    
    console.log('[Expand] New nodes:', newNodes.length, 'New edges:', newEdges.length)
    
    setNodes(newNodes)
    setEdges(newEdges)
    setSubgraphs(prev => prev.filter(s => s.id !== node.id))
  }, [nodes, edges, subgraphs, setNodes, setEdges, setSubgraphs])

  // Now define onNodeContextMenu AFTER the functions it depends on
  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault()
    const items = []
    
    if (node.type === 'subgraph') {
      items.push(
        { label: 'Edit Subgraph', icon: '✏️', action: () => { setEditingSubgraphId(node.id); setSelectedIds(new Set()) } },
        { label: 'Expand Subgraph', icon: '📤', action: () => handleExpandSubgraph(node) },
        { divider: true }
      )
    }
    
    items.push({ label: 'Delete', icon: '🗑️', action: () => handleDeleteNode(node.id) })
    setContextMenu({ x: event.clientX, y: event.clientY, items })
  }, [handleExpandSubgraph, handleDeleteNode])

  const deleteSelected = useCallback(() => {
    if (editingSubgraphId) {
      setSubgraphs(prev => prev.map(s => 
        s.id === editingSubgraphId ? { ...s, nodes: s.nodes.filter(n => !selectedIds.has(n.id)) } : s
      ))
    } else {
      setNodes(prev => prev.filter(n => !selectedIds.has(n.id)))
    }
    setSelectedIds(new Set())
  }, [selectedIds, setNodes, editingSubgraphId, setSubgraphs])

  const onPaneContextMenu = useCallback((event) => {
    event.preventDefault()
    if (selectedIds.size > 1 && !editingSubgraphId) {
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
  }, [selectedIds, editingSubgraphId, deleteSelected])

  const doCreateSubgraph = useCallback((name) => {
    const selectedNodeData = nodes.filter(n => selectedIds.has(n.id))
    const internalEdges = edges.filter(e => selectedIds.has(e.source) && selectedIds.has(e.target))
    
    const externalInputs = {}
    const externalOutputs = {}
    
    edges.forEach(e => {
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
      Object.entries(node.data.inputs || {}).forEach(([inputName, inputDef]) => {
        const hasSource = internalEdges.some(e => e.target === node.id && e.targetHandle === inputName)
        const key = `${node.id}_${inputName}`
        if (!hasSource && !externalInputs[key]) externalInputs[key] = { type: inputDef.type }
      })
    })

    const avgX = selectedNodeData.reduce((sum, n) => sum + n.position.x, 0) / selectedNodeData.length
    const avgY = selectedNodeData.reduce((sum, n) => sum + n.position.y, 0) / selectedNodeData.length

    const subgraphId = `subgraph-${Date.now()}`
    const subgraphNode = {
      id: subgraphId,
      type: 'subgraph',
      position: { x: avgX, y: avgY },
      data: { label: name, nodeCount: selectedNodeData.length, inputs: externalInputs, outputs: externalOutputs }
    }

    setSubgraphs(prev => [...prev, { id: subgraphId, name, nodes: selectedNodeData, edges: internalEdges }])

    const newNodes = nodes.filter(n => !selectedIds.has(n.id))
    newNodes.push(subgraphNode)
    setNodes(newNodes)

    const newEdges = edges.filter(e => !selectedIds.has(e.source) && !selectedIds.has(e.target))
    edges.forEach(e => {
      if (selectedIds.has(e.target) && !selectedIds.has(e.source)) {
        newEdges.push({ id: `e-${Date.now()}-${Math.random()}`, source: e.source, sourceHandle: e.sourceHandle, target: subgraphId, targetHandle: `${e.target}_${e.targetHandle}` })
      }
      if (selectedIds.has(e.source) && !selectedIds.has(e.target)) {
        newEdges.push({ id: `e-${Date.now()}-${Math.random()}`, source: subgraphId, sourceHandle: `${e.source}_${e.sourceHandle}`, target: e.target, targetHandle: e.targetHandle })
      }
    })
    setEdges(newEdges)
    setSelectedIds(new Set())
    setShowNameDialog(false)
  }, [selectedIds, nodes, edges, setNodes, setEdges, setSubgraphs])

  const exitSubgraphEdit = useCallback(() => {
    if (editingSubgraph) {
      setNodes(prev => prev.map(n => 
        n.id === editingSubgraphId 
          ? { ...n, data: { ...n.data, nodeCount: editingSubgraph.nodes.length } }
          : n
      ))
    }
    setEditingSubgraphId(null)
    setSelectedIds(new Set())
  }, [editingSubgraph, editingSubgraphId, setNodes])

  const onDrop = useCallback((event) => {
    event.preventDefault()
    const data = event.dataTransfer.getData('application/json')
    if (!data) return
    
    const spec = JSON.parse(data)
    const bounds = event.currentTarget.getBoundingClientRect()
    const position = { x: event.clientX - bounds.left - 90, y: event.clientY - bounds.top - 30 }
    
    const newNode = {
      id: `${spec.name}-${Date.now()}`,
      type: 'custom',
      position,
      data: { label: spec.name, inputs: spec.inputs, outputs: spec.outputs }
    }
    
    if (editingSubgraphId) {
      setSubgraphs(prev => prev.map(s => 
        s.id === editingSubgraphId ? { ...s, nodes: [...s.nodes, newNode] } : s
      ))
    } else {
      setNodes(nds => [...nds, newNode])
    }
  }, [setNodes, editingSubgraphId, setSubgraphs])

  const onDragOver = useCallback((event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  return (
    <div className="flow-editor" onDrop={onDrop} onDragOver={onDragOver}>
      {editingSubgraph && (
        <div className="subgraph-edit-bar">
          <button onClick={exitSubgraphEdit} className="back-btn">← Back</button>
          <span className="edit-label">Editing: <strong>{editingSubgraph.name}</strong></span>
          <span className="edit-count">{editingSubgraph.nodes.length} nodes</span>
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
        <Background color={editingSubgraph ? '#3d2e5c' : '#30363d'} gap={16} size={1} />
        <Controls />
      </ReactFlow>
      
      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.items} onClose={() => setContextMenu(null)} />
      )}
      
      {selectedIds.size > 1 && !editingSubgraphId && (
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
    </div>
  )
}

export default FlowEditor
