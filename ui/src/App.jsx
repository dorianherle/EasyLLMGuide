import { useState, useCallback, useEffect, useRef } from 'react'
import FlowEditor from './components/FlowEditor'
import NodeLibrary from './components/NodeLibrary'
import CodePanel from './components/CodePanel'
import LogPanel from './components/LogPanel'
import RunPanel from './components/RunPanel'
import { getNodes, saveGraph, runGraph, connectWebSocket, sendInputResponse } from './utils/api'

const NODE_CODE = {
  terminal_input: `async def terminal_input(value: int):
    yield ("out", value)`,
  terminal_output: `async def terminal_output(value):
    yield ("done", str(value))`,
  const_int: `async def const_int():
    yield ("out", 0)`,
  const_str: `async def const_str():
    yield ("out", "")`,
  logger: `async def logger(msg):
    yield ("logged", str(msg))`,
  add: `async def add(a: int, b: int):
    yield ("result", a + b)`,
  multiply: `async def multiply(a: int, b: int):
    yield ("result", a * b)`,
  double: `async def double(value: int):
    yield ("result", value * 2)`,
  triple: `async def triple(value: int):
    yield ("result", value * 3)`,
  square: `async def square(value: int):
    yield ("result", value * value)`,
  negate: `async def negate(value: int):
    yield ("result", -value)`,
  is_even: `async def is_even(value: int):
    if value % 2 == 0:
        yield ("yes", value)
    else:
        yield ("no", value)`,
  is_positive: `async def is_positive(value: int):
    if value > 0:
        yield ("positive", value)
    elif value < 0:
        yield ("negative", value)
    else:
        yield ("zero", value)`,
  compare: `async def compare(a: int, b: int):
    if a > b: yield ("greater", a)
    elif a < b: yield ("less", b)
    else: yield ("equal", a)`,
  to_string: `async def to_string(value: int):
    yield ("result", str(value))`,
  format_text: `async def format_text(template: str, value: int):
    yield ("result", template.format(value))`,
  concat: `async def concat(a: str, b: str):
    yield ("result", a + b)`,
  delay: `async def delay(value: int, seconds: float = 0.5):
    import asyncio
    await asyncio.sleep(seconds)
    yield ("out", value)`,
  passthrough: `async def passthrough(value: int):
    yield ("out", value)`,
}

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
  
  // Run panel state
  const [showRunPanel, setShowRunPanel] = useState(false)
  const [pendingInputs, setPendingInputs] = useState([])  // Array of { nodeId, inputName, type }
  const [terminalOutputs, setTerminalOutputs] = useState([])
  const [runError, setRunError] = useState(null)
  
  const fileInputRef = useRef(null)

  useEffect(() => {
    getNodes().then(data => {
      setNodeSpecs(data.map(n => ({ ...n, code: NODE_CODE[n.name] || `# ${n.name}` })))
      setConnected(true)
    }).catch(() => setConnected(false))
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
      setSelectedNode({ ...spec, instanceId: node.id })
      if (!showCode) setShowCode(true)
    }
  }, [nodeSpecs, showCode])

  const handleCodeChange = useCallback((newCode) => {
    if (!selectedNode) return
    setSelectedNode(prev => prev ? { ...prev, code: newCode } : null)
  }, [selectedNode])

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

  const handleLoadExample = (key) => {
    const data = EXAMPLES[key]
    if (data) {
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
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleLoad} style={{ display: 'none' }} />
          </div>
          <div className="toolbar-group">
            <select onChange={(e) => e.target.value && handleLoadExample(e.target.value)} defaultValue="">
              <option value="">Examples...</option>
              <option value="even_odd">Even/Odd Flow</option>
              <option value="math_chain">Math Chain + Logger</option>
              <option value="branching">Positive/Negative</option>
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
      {showCode && <CodePanel node={selectedNode} onCodeChange={handleCodeChange} onCollapse={() => setShowCode(false)} />}
    </div>
  )
}

const EXAMPLES = {
  even_odd: {
    name: 'Even/Odd Flow',
    nodes: [
      { id: 'in-1', type: 'custom', position: { x: 50, y: 150 }, data: { label: 'terminal_input', inputs: { value: { type: 'int' } }, outputs: { out: { type: 'int' } } } },
      { id: 'check-1', type: 'custom', position: { x: 260, y: 150 }, data: { label: 'is_even', inputs: { value: { type: 'int' } }, outputs: { yes: { type: 'int' }, no: { type: 'int' } } } },
      { id: 'double-1', type: 'custom', position: { x: 480, y: 50 }, data: { label: 'double', inputs: { value: { type: 'int' } }, outputs: { result: { type: 'int' } } } },
      { id: 'triple-1', type: 'custom', position: { x: 480, y: 250 }, data: { label: 'triple', inputs: { value: { type: 'int' } }, outputs: { result: { type: 'int' } } } },
      { id: 'out-1', type: 'custom', position: { x: 700, y: 150 }, data: { label: 'terminal_output', inputs: { value: { type: 'Any' } }, outputs: { done: { type: 'str' } } } }
    ],
    edges: [
      { id: 'e1', source: 'in-1', target: 'check-1', sourceHandle: 'out', targetHandle: 'value' },
      { id: 'e2', source: 'check-1', target: 'double-1', sourceHandle: 'yes', targetHandle: 'value' },
      { id: 'e3', source: 'check-1', target: 'triple-1', sourceHandle: 'no', targetHandle: 'value' },
      { id: 'e4', source: 'double-1', target: 'out-1', sourceHandle: 'result', targetHandle: 'value' },
      { id: 'e5', source: 'triple-1', target: 'out-1', sourceHandle: 'result', targetHandle: 'value' }
    ]
  },
  math_chain: {
    name: 'Math Chain + Logger',
    nodes: [
      { id: 'in-1', type: 'custom', position: { x: 50, y: 100 }, data: { label: 'terminal_input', inputs: { value: { type: 'int' } }, outputs: { out: { type: 'int' } } } },
      { id: 'sq-1', type: 'custom', position: { x: 250, y: 100 }, data: { label: 'square', inputs: { value: { type: 'int' } }, outputs: { result: { type: 'int' } } } },
      { id: 'dbl-1', type: 'custom', position: { x: 450, y: 100 }, data: { label: 'double', inputs: { value: { type: 'int' } }, outputs: { result: { type: 'int' } } } },
      { id: 'log-1', type: 'custom', position: { x: 450, y: 220 }, data: { label: 'logger', inputs: { msg: { type: 'Any' } }, outputs: { logged: { type: 'str' } } } },
      { id: 'out-1', type: 'custom', position: { x: 650, y: 100 }, data: { label: 'terminal_output', inputs: { value: { type: 'Any' } }, outputs: { done: { type: 'str' } } } }
    ],
    edges: [
      { id: 'e1', source: 'in-1', target: 'sq-1', sourceHandle: 'out', targetHandle: 'value' },
      { id: 'e2', source: 'sq-1', target: 'dbl-1', sourceHandle: 'result', targetHandle: 'value' },
      { id: 'e3', source: 'sq-1', target: 'log-1', sourceHandle: 'result', targetHandle: 'msg' },
      { id: 'e4', source: 'dbl-1', target: 'out-1', sourceHandle: 'result', targetHandle: 'value' }
    ]
  },
  branching: {
    name: 'Positive/Negative',
    nodes: [
      { id: 'in-1', type: 'custom', position: { x: 50, y: 150 }, data: { label: 'terminal_input', inputs: { value: { type: 'int' } }, outputs: { out: { type: 'int' } } } },
      { id: 'check-1', type: 'custom', position: { x: 260, y: 150 }, data: { label: 'is_positive', inputs: { value: { type: 'int' } }, outputs: { positive: { type: 'int' }, negative: { type: 'int' }, zero: { type: 'int' } } } },
      { id: 'out-1', type: 'custom', position: { x: 500, y: 150 }, data: { label: 'terminal_output', inputs: { value: { type: 'Any' } }, outputs: { done: { type: 'str' } } } }
    ],
    edges: [
      { id: 'e1', source: 'in-1', target: 'check-1', sourceHandle: 'out', targetHandle: 'value' },
      { id: 'e2', source: 'check-1', target: 'out-1', sourceHandle: 'positive', targetHandle: 'value' },
      { id: 'e3', source: 'check-1', target: 'out-1', sourceHandle: 'negative', targetHandle: 'value' },
      { id: 'e4', source: 'check-1', target: 'out-1', sourceHandle: 'zero', targetHandle: 'value' }
    ]
  }
}

export default App
