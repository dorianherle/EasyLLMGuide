import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import FlowEditor from './components/FlowEditor'
import NodeLibrary from './components/NodeLibrary'
import CodePanel from './components/CodePanel'
import LogPanel from './components/LogPanel'
import RunPanel from './components/RunPanel'
import ResizeHandle from './components/ResizeHandle'
import { getNodes, saveGraph, runGraph, connectWebSocket, sendInputResponse, getExamples, getExample, exportGraph, uploadNodeFiles, clearCustomNodes } from './utils/api'

const STORAGE_KEY = 'easyLLMGuide_graph'

// Load state from localStorage
function loadFromStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch {}
  return null
}

// Save state to localStorage
function saveToStorage(nodes, edges, subgraphs, folderPath) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges, subgraphs, folderPath }))
  } catch {}
}

// Normalize all IDs in a graph to clean sequential format
function normalizeGraph(nodes, edges, subgraphs = [], existingNodes = []) {
  const idMap = {}  // oldId -> newId
  const typeCounts = {}
  
  // Count existing nodes to continue numbering
  existingNodes.forEach(node => {
    const nodeType = node.type === 'subgraph' ? 'subgraph' : node.data.label
    const match = node.id.match(/_(\d+)$/)
    if (match) {
      typeCounts[nodeType] = Math.max(typeCounts[nodeType] || 0, parseInt(match[1]))
    }
  })
  
  // First pass: build ID mapping for nodes
  const newNodes = nodes.map(node => {
    const nodeType = node.type === 'subgraph' ? 'subgraph' : node.data.label
    typeCounts[nodeType] = (typeCounts[nodeType] || 0) + 1
    const newId = `${nodeType}_${typeCounts[nodeType]}`
    idMap[node.id] = newId
    return { ...node, id: newId }
  })
  
  // Second pass: update edge references
  const newEdges = edges.map((edge, i) => ({
    ...edge,
    id: `e_${Date.now()}_${i}`,
    source: idMap[edge.source] || edge.source,
    target: idMap[edge.target] || edge.target
  }))
  
  // Third pass: update subgraph references and their internal nodes/edges
  const newSubgraphs = subgraphs.map(sg => {
    const newSgId = idMap[sg.id] || sg.id
    
    // Normalize internal nodes
    const internalIdMap = {}
    const internalCounts = {}
    const newSgNodes = sg.nodes.map(node => {
      const nodeType = node.type === 'subgraph' ? 'subgraph' : node.data.label
      internalCounts[nodeType] = (internalCounts[nodeType] || 0) + 1
      const newId = `${nodeType}_${internalCounts[nodeType]}`
      internalIdMap[node.id] = newId
      return { ...node, id: newId }
    })
    
    // Update internal edges
    const newSgEdges = (sg.edges || []).map((edge, i) => ({
      ...edge,
      id: `e_${i + 1}`,
      source: internalIdMap[edge.source] || edge.source,
      target: internalIdMap[edge.target] || edge.target
    }))
    
    // Update port keys in parent node (they reference internal node IDs)
    const parentNode = newNodes.find(n => n.id === newSgId)
    if (parentNode) {
      const updatePortKeys = (ports) => {
        const newPorts = {}
        Object.entries(ports || {}).forEach(([key, val]) => {
          const lastUnderscore = key.lastIndexOf('_')
          if (lastUnderscore > 0) {
            const oldNodeId = key.substring(0, lastUnderscore)
            const portName = key.substring(lastUnderscore + 1)
            const newNodeId = internalIdMap[oldNodeId] || oldNodeId
            newPorts[`${newNodeId}_${portName}`] = val
          } else {
            newPorts[key] = val
          }
        })
        return newPorts
      }
      parentNode.data.inputs = updatePortKeys(parentNode.data.inputs)
      parentNode.data.outputs = updatePortKeys(parentNode.data.outputs)
    }
    
    return { ...sg, id: newSgId, name: sg.name, nodes: newSgNodes, edges: newSgEdges }
  })
  
  return { nodes: newNodes, edges: newEdges, subgraphs: newSubgraphs }
}

function App() {
  // Load initial state from localStorage
  const savedState = loadFromStorage()
  
  const [selectedNode, setSelectedNode] = useState(null)
  const [nodes, setNodes] = useState(savedState?.nodes || [])
  const [edges, setEdges] = useState(savedState?.edges || [])
  const [subgraphs, setSubgraphs] = useState(savedState?.subgraphs || [])
  const [nodeSpecs, setNodeSpecs] = useState([])
  const [logMessages, setLogMessages] = useState([])
  const [isRunning, setIsRunning] = useState(false)
  const [highlightedNode, setHighlightedNode] = useState(null)
  const [showLibrary, setShowLibrary] = useState(true)
  const [showCode, setShowCode] = useState(true)
  const [showLog, setShowLog] = useState(false)
  const [connected, setConnected] = useState(false)
  const [examplesList, setExamplesList] = useState({})
  const [folderPath, setFolderPath] = useState(savedState?.folderPath || null)
  
  // Run panel state
  const [showRunPanel, setShowRunPanel] = useState(false)
  const [availableTriggers, setAvailableTriggers] = useState([])
  const [edgePackets, setEdgePackets] = useState({})  // { edgeId: [values] }
  const [terminalOutputs, setTerminalOutputs] = useState([])  // final outputs from terminal_output nodes
  const [selectedPacketData, setSelectedPacketData] = useState(null)  // packet data to show in code panel
  const [runError, setRunError] = useState(null)
  const [activeSubgraphs, setActiveSubgraphs] = useState(new Set())  // subgraphs with data inside
  
  const fileInputRef = useRef(null)
  const importInputRef = useRef(null)
  
  // Panel widths
  const [libraryWidth, setLibraryWidth] = useState(220)
  const [codeWidth, setCodeWidth] = useState(400)
  const [logWidth, setLogWidth] = useState(300)

  // Save to localStorage whenever state changes
  useEffect(() => {
    saveToStorage(nodes, edges, subgraphs, folderPath)
  }, [nodes, edges, subgraphs, folderPath])

  useEffect(() => {
    getNodes().then(data => {
      setNodeSpecs(data)
      setConnected(true)
    }).catch(() => setConnected(false))
    getExamples().then(setExamplesList).catch(() => {})
  }, [])

  const handleFolderChange = useCallback(async (folderName, files) => {
    if (!folderName || !files) {
      // Clear custom nodes
      await clearCustomNodes()
      setFolderPath(null)
      const data = await getNodes()
      setNodeSpecs(data)
    } else {
      // Upload files and reload nodes
      await uploadNodeFiles(files)
      setFolderPath(folderName)
      const data = await getNodes()
      setNodeSpecs(data)
    }
  }, [])

  // Need access to current state in websocket handler
  const edgesRef = useRef(edges)
  const subgraphsRef = useRef(subgraphs)
  useEffect(() => { edgesRef.current = edges }, [edges])
  useEffect(() => { subgraphsRef.current = subgraphs }, [subgraphs])
  
  // Find which subgraph(s) contain a node (recursively)
  const findParentSubgraphs = useCallback((nodeId) => {
    const parents = []
    const check = (sgs, path = []) => {
      for (const sg of sgs) {
        if (sg.nodes?.some(n => n.id === nodeId)) {
          parents.push(...path, sg.id)
        }
        // Check nested subgraphs
        const nestedSgs = sg.nodes?.filter(n => n.type === 'subgraph') || []
        if (nestedSgs.length > 0) {
          const nestedData = nestedSgs.map(n => sgs.find(s => s.id === n.id)).filter(Boolean)
          check(nestedData, [...path, sg.id])
        }
      }
    }
    check(subgraphsRef.current)
    return parents
  }, [])

  useEffect(() => {
    const ws = connectWebSocket((msg) => {
      if (msg.type === 'trigger_available') {
        setAvailableTriggers(prev => {
          if (prev.some(p => p.nodeId === msg.data?.node_id)) return prev
          return [...prev, {
            nodeId: msg.data?.node_id,
            inputName: msg.data?.input || 'value',
            type: msg.data?.type || 'int'
          }]
        })
      } else if (msg.type === 'node_start') {
        const nodeId = msg.data?.node_id
        setHighlightedNode(nodeId)
        
        // Track which subgraphs have active data
        const parentSgs = findParentSubgraphs(nodeId)
        if (parentSgs.length > 0) {
          setActiveSubgraphs(prev => new Set([...prev, ...parentSgs]))
        }
        
        // Remove packets from edges going INTO this node (data consumed)
        setEdgePackets(prev => {
          const next = { ...prev }
          const allEdges = [...edgesRef.current]
          subgraphsRef.current.forEach(sg => {
            if (sg.edges) allEdges.push(...sg.edges)
          })
          allEdges.forEach(e => {
            // Direct edge to this node
            if (e.target === nodeId && next[e.id]?.length > 0) {
              next[e.id] = next[e.id].slice(1)
              if (next[e.id].length === 0) delete next[e.id]
            }
            // Also consume from external edges going to parent subgraph
            // (targetHandle format: internalNodeId_inputName)
            if (parentSgs.includes(e.target) && e.targetHandle?.startsWith(nodeId + '_') && next[e.id]?.length > 0) {
              next[e.id] = next[e.id].slice(1)
              if (next[e.id].length === 0) delete next[e.id]
            }
          })
          return next
        })
      } else if (msg.type === 'node_output') {
        // Add packet to edges FROM this node's output branch
        // Check both root edges and subgraph edges
        const sourceNode = msg.data?.node_id
        const branch = msg.data?.branch
        const value = msg.data?.value
        setEdgePackets(prev => {
          const next = { ...prev }
          const allEdges = [...edgesRef.current]
          subgraphsRef.current.forEach(sg => {
            if (sg.edges) allEdges.push(...sg.edges)
          })
          allEdges.forEach(e => {
            if (e.source === sourceNode && e.sourceHandle === branch) {
              next[e.id] = [...(next[e.id] || []), value]
            }
          })
          return next
        })
      } else if (msg.type === 'node_done') {
        setHighlightedNode(null)
        // Clear subgraph active state if no more packets inside
        // We'll just let run_complete clear everything
      } else if (msg.type === 'terminal_output') {
        setTerminalOutputs(prev => [...prev, msg.data?.value])
      } else if (msg.type === 'log') {
        setLogMessages(prev => [...prev, { time: new Date(), node: msg.data?.node_id, message: msg.data?.value }])
        setShowLog(true)
      } else if (msg.type === 'node_error') {
        setRunError(`${msg.data?.node_id}: ${msg.data?.error}`)
        setIsRunning(false)
        setHighlightedNode(null)
      } else if (msg.type === 'run_complete') {
        setIsRunning(false)
        setAvailableTriggers([])
        setHighlightedNode(null)
        setEdgePackets({})
        setActiveSubgraphs(new Set())
      } else if (msg.type === 'run_error') {
        setRunError(msg.data?.error)
        setIsRunning(false)
        setAvailableTriggers([])
        setHighlightedNode(null)
        setEdgePackets({})
        setActiveSubgraphs(new Set())
      }
    })
    return () => ws.close()
  }, [])

  const handleNodeSelect = useCallback((node) => {
    const spec = nodeSpecs.find(s => s.name === node.data.label)
    if (spec) {
      setSelectedNode(spec)
      setSelectedPacketData(null)  // Clear packet selection when selecting node
      if (!showCode) setShowCode(true)
    }
  }, [nodeSpecs, showCode])

  const handlePacketClick = useCallback((packets) => {
    setSelectedPacketData(packets)
    setSelectedNode(null)  // Clear node selection when selecting packet
    if (!showCode) setShowCode(true)
  }, [showCode])

  const handleLogNodeClick = useCallback((nodeId) => {
    setHighlightedNode(nodeId)
    setTimeout(() => setHighlightedNode(null), 2000)
  }, [])

  const handleRunClick = async () => {
    if (nodes.length === 0) {
      setRunError('No nodes in graph')
      return
    }
    
    setRunError(null)
    setEdgePackets({})
    setTerminalOutputs([])
    setLogMessages([])
    setAvailableTriggers([])
    setShowRunPanel(true)
    setIsRunning(true)
    
    // Save graph
    const result = await saveGraph(nodes, edges, subgraphs)
    if (result.errors?.length > 0) {
      setRunError(result.errors.join('\n'))
      setIsRunning(false)
      return
    }
    
    // Start execution - returns immediately, progress via websocket
    const runResult = await runGraph()
    if (runResult.error) {
      setRunError(runResult.error)
      setIsRunning(false)
    }
    // Don't set isRunning=false here - wait for run_complete via websocket
  }

  const handleSubmitInput = (nodeId, value) => {
    sendInputResponse(nodeId, value)
  }

  const handleSave = () => {
    const data = { name: 'My Graph', nodes, edges, subgraphs }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'graph.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleLoad = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result)
        const normalized = normalizeGraph(data.nodes || [], data.edges || [], data.subgraphs || [])
        setNodes(normalized.nodes)
        setEdges(normalized.edges)
        setSubgraphs(normalized.subgraphs)
      } catch { /* invalid json */ }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result)
        // Offset imported nodes to the right
        const offsetX = nodes.length > 0 
          ? Math.max(...nodes.map(n => n.position.x)) + 300 
          : 0
        const offsetNodes = (data.nodes || []).map(n => ({
          ...n,
          position: { x: n.position.x + offsetX, y: n.position.y }
        }))
        const normalized = normalizeGraph(offsetNodes, data.edges || [], data.subgraphs || [], nodes)
        setNodes([...nodes, ...normalized.nodes])
        setEdges([...edges, ...normalized.edges])
        setSubgraphs([...subgraphs, ...normalized.subgraphs])
      } catch { /* invalid json */ }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleClear = () => {
    setNodes([])
    setEdges([])
    setSubgraphs([])
  }

  const handleLoadExample = async (key) => {
    const data = await getExample(key)
    if (data && !data.error) {
      const normalized = normalizeGraph(data.nodes || [], data.edges || [], [])
      setNodes(normalized.nodes)
      setEdges(normalized.edges)
    }
  }

  const handleCloseRunPanel = () => {
    setShowRunPanel(false)
    setAvailableTriggers([])
    setEdgePackets({})
    setTerminalOutputs([])
    setRunError(null)
    setActiveSubgraphs(new Set())
  }

  const handleExport = async () => {
    if (nodes.length === 0) {
      setRunError('No nodes to export')
      return
    }
    
    const result = await exportGraph(nodes, edges, subgraphs)
    if (result.code) {
      const blob = new Blob([result.code], { type: 'text/x-python' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'workflow.py'
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  const handleLibraryResize = useCallback((x) => {
    setLibraryWidth(Math.max(150, Math.min(500, x)))
  }, [])

  const handleCodeResize = useCallback((x) => {
    setCodeWidth(Math.max(200, Math.min(700, window.innerWidth - x)))
  }, [])

  const handleLogResize = useCallback((x) => {
    setLogWidth(Math.max(200, Math.min(500, window.innerWidth - x)))
  }, [])

  return (
    <div className="app">
      {showLibrary && (
        <>
          <NodeLibrary specs={nodeSpecs} onCollapse={() => setShowLibrary(false)} folderPath={folderPath} onFolderChange={handleFolderChange} style={{ width: libraryWidth }} />
          <ResizeHandle side="left" onResize={handleLibraryResize} />
        </>
      )}
      
      <div className="main-area">
        <div className="toolbar">
          {!showLibrary && <button onClick={() => setShowLibrary(true)} className="toggle-btn">☰</button>}
          <button onClick={handleRunClick} disabled={isRunning} className="run-btn">
            {isRunning ? '⏳' : '▶'} Run
          </button>
          <div className="toolbar-group">
            <button onClick={handleSave}>Save</button>
            <button onClick={() => fileInputRef.current?.click()}>Load</button>
            <button onClick={() => importInputRef.current?.click()}>Import</button>
            <button onClick={handleClear} className="clear-btn">Clear</button>
            <button onClick={handleExport} className="export-btn">📤 Export</button>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleLoad} style={{ display: 'none' }} />
            <input ref={importInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
          </div>
          <div className="toolbar-group">
            <select onChange={(e) => e.target.value && handleLoadExample(e.target.value)} defaultValue="">
              <option value="">Examples...</option>
              {Object.entries(examplesList).map(([key, val]) => (
                <option key={key} value={key}>{val.name}</option>
              ))}
            </select>
          </div>
          {runError && <span className="run-error">{runError}</span>}
          <div className="toolbar-spacer" />
          {!connected && <span className="connection-error">⚠ Backend not connected</span>}
          <button onClick={() => setShowLog(!showLog)} className={showLog ? 'toggle-btn active' : 'toggle-btn'}>📋</button>
          {!showCode && <button onClick={() => setShowCode(true)} className="toggle-btn">{'</>'}</button>}
        </div>
        
        <div className="flow-container">
          <FlowEditor 
            nodes={nodes} 
            setNodes={setNodes} 
            edges={edges} 
            setEdges={setEdges} 
            onNodeSelect={handleNodeSelect}
            subgraphs={subgraphs}
            setSubgraphs={setSubgraphs}
            highlightedNode={highlightedNode}
            edgePackets={edgePackets}
            onPacketClick={handlePacketClick}
            activeSubgraphs={activeSubgraphs}
          />
        </div>
        
        {showRunPanel && (
          <RunPanel
            triggers={availableTriggers}
            outputs={terminalOutputs}
            onSubmitInput={handleSubmitInput}
            onClose={handleCloseRunPanel}
            onClear={() => setTerminalOutputs([])}
            isRunning={isRunning}
          />
        )}
      </div>
      
      {showLog && (
        <>
          <ResizeHandle side="right" onResize={handleLogResize} />
          <LogPanel messages={logMessages} onClear={() => setLogMessages([])} onCollapse={() => setShowLog(false)} onNodeClick={handleLogNodeClick} style={{ width: logWidth }} />
        </>
      )}
      {showCode && (
        <>
          <ResizeHandle side="right" onResize={handleCodeResize} />
          <CodePanel node={selectedNode} packetData={selectedPacketData} onCollapse={() => setShowCode(false)} style={{ width: codeWidth }} />
        </>
      )}
    </div>
  )
}

export default App
