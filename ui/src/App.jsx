import { useState, useCallback, useEffect, useRef } from 'react'
import FlowEditor from './components/FlowEditor'
import NodeLibrary from './components/NodeLibrary'
import CodePanel from './components/CodePanel'
import Terminal from './components/Terminal'
import LogPanel from './components/LogPanel'
import { getNodes, saveGraph, runGraph, connectWebSocket } from './utils/api'

// Actual Python code for nodes (minimalist - no EVENT)
const NODE_CODE = {
  terminal_write: `async def terminal_write(value: str):
    """Display value in terminal."""
    yield ("done", value)`,
  logger: `async def logger(msg: str):
    """Send message to log panel."""
    yield ("logged", msg)`,
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
  constant: `async def constant(value: int = 0):
    yield ("out", value)`,
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
  const [logPanelMessages, setLogPanelMessages] = useState([])
  const [isRunning, setIsRunning] = useState(false)
  const [showLibrary, setShowLibrary] = useState(true)
  const [showCode, setShowCode] = useState(true)
  const [showLog, setShowLog] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    getNodes().then(data => {
      setNodeSpecs(data.map(n => ({ ...n, code: NODE_CODE[n.name] || `# ${n.name}` })))
      addLog('info', 'Connected to backend')
    }).catch(() => {
      addLog('error', 'Backend not running: python -m core.server')
    })
  }, [])

  useEffect(() => {
    const ws = connectWebSocket((msg) => {
      if (msg.type === 'node_start') {
        addLog('event', `▶ ${msg.data?.node_id}`)
      } else if (msg.type === 'terminal_write') {
        // Terminal write node output
        addLog('output', msg.data?.value)
      } else if (msg.type === 'log') {
        // Logger node output
        setLogPanelMessages(prev => [...prev, { time: new Date(), node: msg.data?.node_id, message: msg.data?.value }])
        if (!showLog) setShowLog(true)
      } else if (msg.type === 'node_output') {
        addLog('event', `  → ${msg.data?.branch}`)
      } else if (msg.type === 'node_done') {
        addLog('event', `✓ ${msg.data?.node_id}`)
      } else if (msg.type === 'node_error') {
        addLog('error', `✗ ${msg.data?.node_id}: ${msg.data?.error}`)
      }
    })
    return () => ws.close()
  }, [showLog])

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
    const result = await saveGraph(nodes, edges, subgraphs)
    
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
      addLog('info', '  log          Toggle log panel')
      return
    }
    if (command === 'clear') { setTerminalLogs([]); return }
    if (command === 'log') { setShowLog(!showLog); return }
    if (command === 'unknown') { addLog('error', `Unknown: ${extra}`); return }
    
    if (value === null && command !== 'run') return
    
    setIsRunning(true)
    
    try {
      // First save graph to get entry points
      const eps = await handleSaveGraph()
      if (!eps) { setIsRunning(false); return }
      
      if (eps.length === 0) {
        // No entry points needed - run directly
        addLog('event', 'Running (no inputs needed)...')
        const result = await runGraph({})
        if (result.error) addLog('error', result.error)
        addLog('info', 'Done')
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
              <option value="math_chain">Math Chain + Logger</option>
              <option value="branching">Positive/Negative</option>
            </select>
          </div>
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
          />
        </div>
        <Terminal onRun={handleTerminalRun} logs={terminalLogs} isRunning={isRunning} entryPoints={entryPoints} />
      </div>
      
      {showLog && <LogPanel messages={logPanelMessages} onClear={() => setLogPanelMessages([])} onCollapse={() => setShowLog(false)} />}
      {showCode && <CodePanel node={selectedNode} onCodeChange={handleCodeChange} onCollapse={() => setShowCode(false)} />}
    </div>
  )
}

const EXAMPLES = {
  even_odd: {
    name: 'Even/Odd Flow',
    nodes: [
      { id: 'const-1', type: 'custom', position: { x: 50, y: 150 }, data: { label: 'constant', inputs: { value: { type: 'int' } }, outputs: { out: { type: 'int' } } } },
      { id: 'check-1', type: 'custom', position: { x: 260, y: 150 }, data: { label: 'is_even', inputs: { value: { type: 'int' } }, outputs: { yes: { type: 'int' }, no: { type: 'int' } } } },
      { id: 'double-1', type: 'custom', position: { x: 480, y: 50 }, data: { label: 'double', inputs: { value: { type: 'int' } }, outputs: { result: { type: 'int' } } } },
      { id: 'triple-1', type: 'custom', position: { x: 480, y: 250 }, data: { label: 'triple', inputs: { value: { type: 'int' } }, outputs: { result: { type: 'int' } } } },
      { id: 'fmt-1', type: 'custom', position: { x: 700, y: 150 }, data: { label: 'format_text', inputs: { template: { type: 'str' }, value: { type: 'int' } }, outputs: { result: { type: 'str' } } } },
      { id: 'term-1', type: 'custom', position: { x: 920, y: 150 }, data: { label: 'terminal_write', inputs: { value: { type: 'str' } }, outputs: { done: { type: 'str' } } } }
    ],
    edges: [
      { id: 'e1', source: 'const-1', target: 'check-1', sourceHandle: 'out', targetHandle: 'value' },
      { id: 'e2', source: 'check-1', target: 'double-1', sourceHandle: 'yes', targetHandle: 'value' },
      { id: 'e3', source: 'check-1', target: 'triple-1', sourceHandle: 'no', targetHandle: 'value' },
      { id: 'e4', source: 'double-1', target: 'fmt-1', sourceHandle: 'result', targetHandle: 'value' },
      { id: 'e5', source: 'triple-1', target: 'fmt-1', sourceHandle: 'result', targetHandle: 'value' },
      { id: 'e6', source: 'fmt-1', target: 'term-1', sourceHandle: 'result', targetHandle: 'value' }
    ]
  },
  math_chain: {
    name: 'Math Chain + Logger',
    nodes: [
      { id: 'const-1', type: 'custom', position: { x: 50, y: 100 }, data: { label: 'constant', inputs: { value: { type: 'int' } }, outputs: { out: { type: 'int' } } } },
      { id: 'sq-1', type: 'custom', position: { x: 250, y: 100 }, data: { label: 'square', inputs: { value: { type: 'int' } }, outputs: { result: { type: 'int' } } } },
      { id: 'dbl-1', type: 'custom', position: { x: 450, y: 100 }, data: { label: 'double', inputs: { value: { type: 'int' } }, outputs: { result: { type: 'int' } } } },
      { id: 'str-1', type: 'custom', position: { x: 650, y: 100 }, data: { label: 'to_string', inputs: { value: { type: 'int' } }, outputs: { result: { type: 'str' } } } },
      { id: 'log-1', type: 'custom', position: { x: 650, y: 220 }, data: { label: 'logger', inputs: { msg: { type: 'str' } }, outputs: { logged: { type: 'str' } } } },
      { id: 'term-1', type: 'custom', position: { x: 850, y: 100 }, data: { label: 'terminal_write', inputs: { value: { type: 'str' } }, outputs: { done: { type: 'str' } } } }
    ],
    edges: [
      { id: 'e1', source: 'const-1', target: 'sq-1', sourceHandle: 'out', targetHandle: 'value' },
      { id: 'e2', source: 'sq-1', target: 'dbl-1', sourceHandle: 'result', targetHandle: 'value' },
      { id: 'e3', source: 'dbl-1', target: 'str-1', sourceHandle: 'result', targetHandle: 'value' },
      { id: 'e4', source: 'str-1', target: 'term-1', sourceHandle: 'result', targetHandle: 'value' },
      { id: 'e5', source: 'str-1', target: 'log-1', sourceHandle: 'result', targetHandle: 'msg' }
    ]
  },
  branching: {
    name: 'Positive/Negative',
    nodes: [
      { id: 'const-1', type: 'custom', position: { x: 50, y: 150 }, data: { label: 'constant', inputs: { value: { type: 'int' } }, outputs: { out: { type: 'int' } } } },
      { id: 'check-1', type: 'custom', position: { x: 260, y: 150 }, data: { label: 'is_positive', inputs: { value: { type: 'int' } }, outputs: { positive: { type: 'int' }, negative: { type: 'int' }, zero: { type: 'int' } } } },
      { id: 'str-pos', type: 'custom', position: { x: 500, y: 30 }, data: { label: 'format_text', inputs: { template: { type: 'str' }, value: { type: 'int' } }, outputs: { result: { type: 'str' } } } },
      { id: 'str-neg', type: 'custom', position: { x: 500, y: 150 }, data: { label: 'format_text', inputs: { template: { type: 'str' }, value: { type: 'int' } }, outputs: { result: { type: 'str' } } } },
      { id: 'str-zero', type: 'custom', position: { x: 500, y: 270 }, data: { label: 'format_text', inputs: { template: { type: 'str' }, value: { type: 'int' } }, outputs: { result: { type: 'str' } } } },
      { id: 'term-1', type: 'custom', position: { x: 750, y: 150 }, data: { label: 'terminal_write', inputs: { value: { type: 'str' } }, outputs: { done: { type: 'str' } } } }
    ],
    edges: [
      { id: 'e1', source: 'const-1', target: 'check-1', sourceHandle: 'out', targetHandle: 'value' },
      { id: 'e2', source: 'check-1', target: 'str-pos', sourceHandle: 'positive', targetHandle: 'value' },
      { id: 'e3', source: 'check-1', target: 'str-neg', sourceHandle: 'negative', targetHandle: 'value' },
      { id: 'e4', source: 'check-1', target: 'str-zero', sourceHandle: 'zero', targetHandle: 'value' },
      { id: 'e5', source: 'str-pos', target: 'term-1', sourceHandle: 'result', targetHandle: 'value' },
      { id: 'e6', source: 'str-neg', target: 'term-1', sourceHandle: 'result', targetHandle: 'value' },
      { id: 'e7', source: 'str-zero', target: 'term-1', sourceHandle: 'result', targetHandle: 'value' }
    ]
  }
}

export default App
