import { useState, useCallback, useEffect, useRef } from 'react'
import FlowEditor from './components/FlowEditor'
import NodeLibrary from './components/NodeLibrary'
import CodePanel from './components/CodePanel'
import Terminal from './components/Terminal'
import { getNodes, saveGraph, runGraph, connectWebSocket } from './utils/api'

// Actual Python code for nodes
const NODE_CODE = {
  number_input: `async def number_input(value: int):
    yield ("status", f"Received: {value}", "EVENT")
    yield ("out", value, "DATA")`,
  is_even: `async def is_even(value: int):
    if value % 2 == 0:
        yield ("status", f"{value} is even", "EVENT")
        yield ("yes", value, "DATA")
    else:
        yield ("status", f"{value} is odd", "EVENT")
        yield ("no", value, "DATA")`,
  double: `async def double(value: int):
    yield ("status", "Doubling...", "EVENT")
    yield ("result", value * 2, "DATA")`,
  triple: `async def triple(value: int):
    yield ("status", "Tripling...", "EVENT")
    yield ("result", value * 3, "DATA")`,
  square: `async def square(value: int):
    yield ("result", value * value, "DATA")`,
  add: `async def add(a: int, b: int):
    yield ("result", a + b, "DATA")`,
  multiply: `async def multiply(a: int, b: int):
    yield ("result", a * b, "DATA")`,
  display_number: `async def display_number(value: int):
    yield ("output", f"Result: {value}", "DATA")`,
  display: `async def display(value: str):
    yield ("output", value, "DATA")`,
}

function App() {
  const [selectedNode, setSelectedNode] = useState(null)
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [subgraphs, setSubgraphs] = useState([])
  const [nodeSpecs, setNodeSpecs] = useState([])
  const [entryPoints, setEntryPoints] = useState([])
  const [terminalLogs, setTerminalLogs] = useState([
    { type: 'info', message: 'Welcome! Build a graph and run it.' },
    { type: 'info', message: 'Type "help" for commands.' }
  ])
  const [isRunning, setIsRunning] = useState(false)
  const [showLibrary, setShowLibrary] = useState(true)
  const [showCode, setShowCode] = useState(true)
  const fileInputRef = useRef(null)

  useEffect(() => {
    getNodes().then(data => {
      setNodeSpecs(data.map(n => ({ ...n, code: NODE_CODE[n.name] || `# ${n.name}` })))
      addLog('info', 'Connected to backend')
    }).catch(() => {
      const fallback = [
        { name: 'number_input', inputs: { value: { type: 'int' } }, outputs: { out: { type: 'int' } } },
        { name: 'is_even', inputs: { value: { type: 'int' } }, outputs: { yes: { type: 'int' }, no: { type: 'int' } } },
        { name: 'double', inputs: { value: { type: 'int' } }, outputs: { result: { type: 'int' } } },
        { name: 'triple', inputs: { value: { type: 'int' } }, outputs: { result: { type: 'int' } } },
        { name: 'square', inputs: { value: { type: 'int' } }, outputs: { result: { type: 'int' } } },
        { name: 'display_number', inputs: { value: { type: 'int' } }, outputs: { output: { type: 'str' } } },
      ]
      setNodeSpecs(fallback.map(n => ({ ...n, code: NODE_CODE[n.name] || '' })))
      addLog('error', 'Backend not running: python -m core.server')
    })
  }, [])

  useEffect(() => {
    const ws = connectWebSocket((msg) => {
      if (msg.type === 'node_start') addLog('event', `▶ ${msg.data?.node_id}`)
      else if (msg.type === 'node_yield_event') addLog('event', `  ${msg.data?.value}`)
      else if (msg.type === 'node_yield_data') {
        if (msg.data?.branch === 'output') addLog('output', msg.data?.value)
        else addLog('event', `  → ${msg.data?.branch}`)
      }
      else if (msg.type === 'node_done') addLog('event', `✓ ${msg.data?.node_id}`)
    })
    return () => ws.close()
  }, [])

  const addLog = (type, message) => setTerminalLogs(prev => [...prev, { type, message }])

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

  // Save graph and get entry points
  const handleSaveGraph = async () => {
    if (nodes.length === 0) {
      addLog('error', 'No nodes in graph')
      return null
    }
    
    addLog('event', 'Saving graph...')
    const result = await saveGraph(nodes, edges)
    
    if (result.errors?.length > 0) {
      result.errors.forEach(err => addLog('error', err))
      return null
    }
    
    setEntryPoints(result.entry_points || [])
    
    if (result.entry_points?.length > 0) {
      addLog('info', `Graph needs ${result.entry_points.length} input(s):`)
      result.entry_points.forEach(ep => {
        addLog('info', `  • ${ep.instance}.${ep.input} (${ep.type})`)
      })
    }
    
    return result.entry_points || []
  }

  const handleTerminalRun = async (value, command, extra) => {
    if (command === 'help') {
      addLog('info', '── Commands ──')
      addLog('info', '  <value>      Run with single input')
      addLog('info', '  run          Save and show required inputs')
      addLog('info', '  clear        Clear terminal')
      return
    }
    if (command === 'clear') { setTerminalLogs([]); return }
    if (command === 'unknown') { addLog('error', `Unknown: ${extra}`); return }
    
    if (value === null && command !== 'run') return
    
    setIsRunning(true)
    
    try {
      // First save graph to get entry points
      const eps = await handleSaveGraph()
      if (!eps) { setIsRunning(false); return }
      
      if (eps.length === 0) {
        addLog('error', 'Graph has no inputs to provide')
        setIsRunning(false)
        return
      }
      
      // Build inputs object
      const inputs = {}
      if (value !== null) {
        // Simple case: single value for all inputs
        eps.forEach(ep => {
          inputs[`${ep.instance}.${ep.input}`] = value
        })
        addLog('input', `run ${value}`)
      } else {
        addLog('info', 'Provide values for each input above')
        setIsRunning(false)
        return
      }
      
      addLog('event', 'Running...')
      const result = await runGraph(inputs)
      
      if (result.error) {
        addLog('error', result.error)
      }
      // Outputs already shown via WebSocket events
      addLog('info', 'Done')
    } catch (err) {
      addLog('error', `Failed: ${err.message}`)
    }
    
    setIsRunning(false)
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
    addLog('info', 'Saved to graph.json')
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
        addLog('info', `Loaded: ${data.name || file.name}`)
      } catch { addLog('error', 'Invalid JSON') }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleLoadExample = (key) => {
    const data = EXAMPLES[key]
    if (data) {
      setNodes(data.nodes)
      setEdges(data.edges)
      addLog('info', `Loaded: ${data.name}`)
    }
  }

  return (
    <div className="app">
      {showLibrary && <NodeLibrary specs={nodeSpecs} onCollapse={() => setShowLibrary(false)} />}
      
      <div className="main-area">
        <div className="toolbar">
          {!showLibrary && <button onClick={() => setShowLibrary(true)} className="toggle-btn">☰</button>}
          <div className="toolbar-group">
            <button onClick={handleSave}>Save</button>
            <button onClick={() => fileInputRef.current?.click()}>Load</button>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleLoad} style={{ display: 'none' }} />
          </div>
          <div className="toolbar-group">
            <select onChange={(e) => e.target.value && handleLoadExample(e.target.value)} defaultValue="">
              <option value="">Examples...</option>
              <option value="even_odd">Even/Odd Flow</option>
              <option value="math_chain">Math Chain</option>
            </select>
          </div>
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
          />
        </div>
        <Terminal onRun={handleTerminalRun} logs={terminalLogs} isRunning={isRunning} entryPoints={entryPoints} />
      </div>
      
      {showCode && <CodePanel node={selectedNode} onCodeChange={handleCodeChange} onCollapse={() => setShowCode(false)} />}
    </div>
  )
}

const EXAMPLES = {
  even_odd: {
    name: 'Even/Odd Flow',
    nodes: [
      { id: 'input-1', type: 'custom', position: { x: 50, y: 150 }, data: { label: 'number_input', inputs: { value: { type: 'int' } }, outputs: { out: { type: 'int' } } } },
      { id: 'check-1', type: 'custom', position: { x: 280, y: 150 }, data: { label: 'is_even', inputs: { value: { type: 'int' } }, outputs: { yes: { type: 'int' }, no: { type: 'int' } } } },
      { id: 'double-1', type: 'custom', position: { x: 510, y: 50 }, data: { label: 'double', inputs: { value: { type: 'int' } }, outputs: { result: { type: 'int' } } } },
      { id: 'triple-1', type: 'custom', position: { x: 510, y: 250 }, data: { label: 'triple', inputs: { value: { type: 'int' } }, outputs: { result: { type: 'int' } } } },
      { id: 'out-1', type: 'custom', position: { x: 740, y: 150 }, data: { label: 'display_number', inputs: { value: { type: 'int' } }, outputs: { output: { type: 'str' } } } }
    ],
    edges: [
      { id: 'e1', source: 'input-1', target: 'check-1', sourceHandle: 'out', targetHandle: 'value' },
      { id: 'e2', source: 'check-1', target: 'double-1', sourceHandle: 'yes', targetHandle: 'value' },
      { id: 'e3', source: 'check-1', target: 'triple-1', sourceHandle: 'no', targetHandle: 'value' },
      { id: 'e4', source: 'double-1', target: 'out-1', sourceHandle: 'result', targetHandle: 'value' },
      { id: 'e5', source: 'triple-1', target: 'out-1', sourceHandle: 'result', targetHandle: 'value' }
    ]
  },
  math_chain: {
    name: 'Math Chain',
    nodes: [
      { id: 'input-1', type: 'custom', position: { x: 50, y: 100 }, data: { label: 'number_input', inputs: { value: { type: 'int' } }, outputs: { out: { type: 'int' } } } },
      { id: 'sq-1', type: 'custom', position: { x: 280, y: 100 }, data: { label: 'square', inputs: { value: { type: 'int' } }, outputs: { result: { type: 'int' } } } },
      { id: 'dbl-1', type: 'custom', position: { x: 480, y: 100 }, data: { label: 'double', inputs: { value: { type: 'int' } }, outputs: { result: { type: 'int' } } } },
      { id: 'out-1', type: 'custom', position: { x: 680, y: 100 }, data: { label: 'display_number', inputs: { value: { type: 'int' } }, outputs: { output: { type: 'str' } } } }
    ],
    edges: [
      { id: 'e1', source: 'input-1', target: 'sq-1', sourceHandle: 'out', targetHandle: 'value' },
      { id: 'e2', source: 'sq-1', target: 'dbl-1', sourceHandle: 'result', targetHandle: 'value' },
      { id: 'e3', source: 'dbl-1', target: 'out-1', sourceHandle: 'result', targetHandle: 'value' }
    ]
  }
}

export default App
