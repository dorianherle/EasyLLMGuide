import { useState, useCallback, useEffect, useRef } from 'react'
import FlowEditor from './components/FlowEditor'
import NodeLibrary from './components/NodeLibrary'
import CodePanel from './components/CodePanel'
import LogPanel from './components/LogPanel'
import RunPanel from './components/RunPanel'
import { getNodes, saveGraph, runGraph, connectWebSocket, sendInputResponse, getExamples, getExample, exportGraph } from './utils/api'

function App() {
  const [selectedNode, setSelectedNode] = useState(null)
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [subgraphs, setSubgraphs] = useState([])
  const [nodeSpecs, setNodeSpecs] = useState([])
  const [logMessages, setLogMessages] = useState([])
  const [isRunning, setIsRunning] = useState(false)
  const [highlightedNode, setHighlightedNode] = useState(null)
  const [showLibrary, setShowLibrary] = useState(true)
  const [showCode, setShowCode] = useState(true)
  const [showLog, setShowLog] = useState(false)
  const [connected, setConnected] = useState(false)
  const [examplesList, setExamplesList] = useState({})
  
  // Run panel state
  const [showRunPanel, setShowRunPanel] = useState(false)
  const [pendingInputs, setPendingInputs] = useState([])  // Array of { nodeId, inputName, type }
  const [terminalOutputs, setTerminalOutputs] = useState([])
  const [runError, setRunError] = useState(null)
  
  const fileInputRef = useRef(null)

  useEffect(() => {
    getNodes().then(data => {
      setNodeSpecs(data)
      setConnected(true)
    }).catch(() => setConnected(false))
    getExamples().then(setExamplesList).catch(() => {})
  }, [])

  useEffect(() => {
    const ws = connectWebSocket((msg) => {
      if (msg.type === 'input_needed') {
        // Collect all input requests (they may come in rapid succession)
        setPendingInputs(prev => {
          // Avoid duplicates
          if (prev.some(p => p.nodeId === msg.data?.node_id)) return prev
          return [...prev, {
            nodeId: msg.data?.node_id,
            inputName: msg.data?.input || 'value',
            type: msg.data?.type || 'int'
          }]
        })
      } else if (msg.type === 'terminal_output') {
        setTerminalOutputs(prev => [...prev, msg.data?.value])
      } else if (msg.type === 'log') {
        setLogMessages(prev => [...prev, { time: new Date(), node: msg.data?.node_id, message: msg.data?.value }])
        setShowLog(true)
      } else if (msg.type === 'node_error') {
        setRunError(`${msg.data?.node_id}: ${msg.data?.error}`)
        setIsRunning(false)
        setPendingInputs([])
      } else if (msg.type === 'run_complete') {
        setIsRunning(false)
        setPendingInputs([])
        setHighlightedNode(null)
      } else if (msg.type === 'run_error') {
        setRunError(msg.data?.error)
        setIsRunning(false)
        setPendingInputs([])
      }
    })
    return () => ws.close()
  }, [])

  const handleNodeSelect = useCallback((node) => {
    const spec = nodeSpecs.find(s => s.name === node.data.label)
    if (spec) {
      setSelectedNode(spec)
      if (!showCode) setShowCode(true)
    }
  }, [nodeSpecs, showCode])

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
    setTerminalOutputs([])
    setLogMessages([])
    setPendingInputs([])
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

  const handleSubmitInputs = (values) => {
    // values is { nodeId: value, ... }
    Object.entries(values).forEach(([nodeId, value]) => {
      sendInputResponse(nodeId, value)
    })
    setPendingInputs([])
    setHighlightedNode(null)
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
        setNodes(data.nodes || [])
        setEdges(data.edges || [])
        setSubgraphs(data.subgraphs || [])
      } catch { /* invalid json */ }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleLoadExample = async (key) => {
    const data = await getExample(key)
    if (data && !data.error) {
      setNodes(data.nodes)
      setEdges(data.edges)
    }
  }

  const handleCloseRunPanel = () => {
    setShowRunPanel(false)
    setPendingInputs([])
    setTerminalOutputs([])
    setRunError(null)
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

  return (
    <div className="app">
      {showLibrary && <NodeLibrary specs={nodeSpecs} onCollapse={() => setShowLibrary(false)} />}
      
      <div className="main-area">
        <div className="toolbar">
          {!showLibrary && <button onClick={() => setShowLibrary(true)} className="toggle-btn">☰</button>}
          <button onClick={handleRunClick} disabled={isRunning && pendingInputs.length === 0} className="run-btn">
            {isRunning && pendingInputs.length === 0 ? '⏳' : '▶'} Run
          </button>
          <div className="toolbar-group">
            <button onClick={handleSave}>Save</button>
            <button onClick={() => fileInputRef.current?.click()}>Load</button>
            <button onClick={handleExport} className="export-btn">📤 Export</button>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleLoad} style={{ display: 'none' }} />
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
          />
        </div>
        
        {showRunPanel && (
          <RunPanel
            pendingInputs={pendingInputs}
            outputs={terminalOutputs}
            onSubmitInputs={handleSubmitInputs}
            onClose={handleCloseRunPanel}
            isRunning={isRunning}
          />
        )}
      </div>
      
      {showLog && <LogPanel messages={logMessages} onClear={() => setLogMessages([])} onCollapse={() => setShowLog(false)} onNodeClick={handleLogNodeClick} />}
      {showCode && <CodePanel node={selectedNode} onCollapse={() => setShowCode(false)} />}
    </div>
  )
}

export default App
