import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { connectWebSocket, sendInputResponse, saveGraph, runGraph, getGraph } from '../utils/api'
import ChatBlock from '../blocks/ChatBlock'
import TextInputBlock from '../blocks/TextInputBlock'
import TextDisplayBlock from '../blocks/TextDisplayBlock'
import './AppPage.css'

// Map node types to their UI block components
const BLOCK_COMPONENTS = {
  'ui_chat_full': ChatBlock,
  'ui_chat': ChatBlock, // Beautiful chat UI component
  'ui_text_input': TextInputBlock,
  'ui_text_display': TextDisplayBlock,
}

// Default sizes for blocks
const DEFAULT_SIZES = {
  'ui_chat_full': { width: 400, height: 500 },
  'ui_chat': { width: 400, height: 500 },
  'ui_text_input': { width: 300, height: 60 },
  'ui_text_display': { width: 300, height: 200 },
}

function AppPage() {
  const navigate = useNavigate()
  const [isRunning, setIsRunning] = useState(false)
  const [uiBlocks, setUiBlocks] = useState([])
  const [blockData, setBlockData] = useState({}) // nodeId -> { messages, value, etc }
  const [error, setError] = useState(null)
  const [showAddPanel, setShowAddPanel] = useState(false)
  const wsRef = useRef(null)

  // Load UI blocks from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('easyLLMGuide_ui_blocks')
    if (saved) {
      try {
        const blocks = JSON.parse(saved)
        setUiBlocks(blocks)

        // Initialize block data
        const initialData = {}
        blocks.forEach(b => {
          initialData[b.id] = { messages: [], value: '' }
        })
        setBlockData(initialData)
      } catch (e) {
        console.error('Failed to load UI blocks:', e)
        setUiBlocks([])
        setBlockData({})
      }
    } else {
      setUiBlocks([])
      setBlockData({})
    }
  }, [])

  // Save UI blocks to localStorage whenever they change
  useEffect(() => {
    if (uiBlocks.length > 0) {
      localStorage.setItem('easyLLMGuide_ui_blocks', JSON.stringify(uiBlocks))
    }
  }, [uiBlocks])

  // Connect websocket
  useEffect(() => {
    const ws = connectWebSocket((msg) => {
      if (msg.type === 'ui_update') {
        // Data arrived at a UI component
        const nodeId = msg.data?.node_id
        const input = msg.data?.input
        const value = msg.data?.value

        // For chat UI components, update by chat_id
        if (msg.data?.chat_id) {
          const chatId = msg.data.chat_id
          setBlockData(prev => {
            const current = prev[chatId] || { messages: [], value: '' }
            return {
              ...prev,
              [chatId]: {
                ...current,
                messages: [...current.messages, { role: 'bot', content: value }]
              }
            }
          })
        }
      } else if (msg.type === 'node_output') {
        // Handle chat_output nodes receiving messages from chat UI
        const nodeId = msg.data?.node_id
        const branch = msg.data?.branch
        const value = msg.data?.value

        // Find which chat_output node this is and send to it
        if (branch === 'message' && value) {
          // This would be handled by the executor sending to chat_output nodes
          // The chat UI would trigger chat_output nodes when messages are sent
        }
      } else if (msg.type === 'run_complete') {
        // Don't stop running - keep listening for more inputs
      } else if (msg.type === 'run_error') {
        setError(msg.data?.error)
        setIsRunning(false)
      } else if (msg.type === 'node_error') {
        setError(`${msg.data?.node_id}: ${msg.data?.error}`)
      }
    })

    wsRef.current = ws
    return () => ws.close()
  }, [])

  // Start execution
  const handleStart = async () => {
    setError(null)
    setIsRunning(true)
    
    // Clear previous data
    setBlockData(prev => {
      const cleared = {}
      Object.keys(prev).forEach(k => {
        cleared[k] = { messages: [], value: '' }
      })
      return cleared
    })

    // Load and save current graph
    const saved = localStorage.getItem('easyLLMGuide_graph')
    if (saved) {
      const { nodes, edges, subgraphs, globalVariables } = JSON.parse(saved)
      await saveGraph(nodes, edges, subgraphs || [], globalVariables || {})
    }

    // Start execution
    const result = await runGraph()
    if (result.error) {
      setError(result.error)
      setIsRunning(false)
    }
  }

  // Create a new UI element
  const createUIElement = useCallback((elementType) => {
    if (elementType === 'ui_chat') {
      // Generate unique chat ID for this UI element
      const chatId = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`

      // Get current graph
      const graph = getGraph()
      const nodes = graph.nodes || []
      const edges = graph.edges || []

      // Create single chat node
      const nodeId = `chat_${Date.now()}_1`

      const chatNode = {
        id: nodeId,
        type: 'custom',
        position: { x: 100, y: 100 },
        data: {
          label: 'Chat',
          nodeType: 'chat',
          inputs: { chat_id: { type: 'str' }, message: { type: 'str' } },
          outputs: { sent: { type: 'bool' }, user_message: { type: 'str' } },
          defaults: { chat_id: chatId }
        }
      }

      // Add to graph
      const updatedNodes = [...nodes, chatNode]
      saveGraph(updatedNodes, edges, graph.subgraphs || [], graph.globalVariables || {})

      // Update localStorage
      const saved = localStorage.getItem('easyLLMGuide_graph')
      if (saved) {
        const parsed = JSON.parse(saved)
        parsed.nodes = updatedNodes
        localStorage.setItem('easyLLMGuide_graph', JSON.stringify(parsed))
      }

      // Create UI block
      const uiBlock = {
        id: chatId,
        type: 'ui_chat',
        label: 'Chat',
        position: { x: 50 + (uiBlocks.length * 20), y: 50 + (uiBlocks.length * 20) },
        size: DEFAULT_SIZES['ui_chat'],
        config: {},
        chatId: chatId
      }

      setUiBlocks(prev => [...prev, uiBlock])
      setBlockData(prev => ({ ...prev, [chatId]: { messages: [], value: '' } }))
    }

    setShowAddPanel(false)
  }, [uiBlocks])

  // Remove a UI element
  const removeUIElement = useCallback((blockId) => {
    // Remove from UI blocks
    setUiBlocks(prev => prev.filter(b => b.id !== blockId))
    setBlockData(prev => {
      const next = { ...prev }
      delete next[blockId]
      return next
    })
  }, [])

  // Handle user input from a block
  const handleBlockInput = useCallback((blockId, value) => {
    const uiBlock = uiBlocks.find(b => b.id === blockId)

    // Add user message to chat UI
    if (uiBlock?.type === 'ui_chat') {
      setBlockData(prev => {
        const current = prev[blockId] || { messages: [], value: '' }
        return {
          ...prev,
          [blockId]: {
            ...current,
            messages: [...current.messages, { role: 'user', content: value }]
          }
        }
      })

      // Send chat message to trigger chat_output nodes
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'chat_message',
          chat_id: uiBlock.chatId,
          message: value
        }))
      }
    }
  }, [uiBlocks])

  // Render a single block
  const renderBlock = (block) => {
    const BlockComponent = BLOCK_COMPONENTS[block.type]
    if (!BlockComponent) {
      return (
        <div key={block.id} className="app-block unknown" style={{
          left: block.position.x,
          top: block.position.y,
          width: block.size.width,
          height: block.size.height,
        }}>
          <div className="block-header">
            <span className="block-title">Unknown: {block.type}</span>
            <button
              className="remove-btn"
              onClick={() => removeUIElement(block.id)}
              title="Remove element"
            >
              ×
            </button>
          </div>
        </div>
      )
    }

    const data = blockData[block.id] || { messages: [], value: '' }

    return (
      <div
        key={block.id}
        className="app-block"
        style={{
          left: block.position.x,
          top: block.position.y,
          width: block.size.width,
          height: block.size.height,
        }}
      >
        <div className="block-header">
          <span className="block-title">{block.label}</span>
          <button
            className="remove-btn"
            onClick={() => removeUIElement(block.id)}
            title="Remove element"
          >
            ×
          </button>
        </div>
        <BlockComponent
          nodeId={block.id}
          config={block.config}
          data={data}
          onInput={handleBlockInput}
          disabled={!isRunning}
        />
      </div>
    )
  }

  return (
    <div className="app-page">
      <div className="app-header">
        <button onClick={() => navigate('/')} className="back-btn">
          ← Editor
        </button>
        <div className="app-title">App Preview</div>
        <div className="app-header-actions">
          <button
            onClick={() => setShowAddPanel(!showAddPanel)}
            className="add-ui-btn"
          >
            + Add UI
          </button>
          <button
            onClick={handleStart}
            className={`start-btn ${isRunning ? 'running' : ''}`}
            disabled={isRunning}
          >
            {isRunning ? '● Running' : '▶ Start'}
          </button>
        </div>
      </div>

      {showAddPanel && (
        <div className="add-ui-panel">
          <div className="add-ui-title">Add UI Elements</div>
          <div className="add-ui-buttons">
            <button onClick={() => createUIElement('ui_chat')} className="ui-type-btn">
              <span className="icon">💬</span>
              <span>Chat UI</span>
              <div className="ui-type-desc">Beautiful chat interface</div>
            </button>
            <button onClick={() => createUIElement('ui_text_input')} className="ui-type-btn">
              <span className="icon">🔤</span>
              <span>Text Input</span>
            </button>
            <button onClick={() => createUIElement('ui_text_display')} className="ui-type-btn">
              <span className="icon">📄</span>
              <span>Text Display</span>
            </button>
          </div>
          <div className="add-ui-note">
            💡 Add "Chat Input" and "Chat Output" nodes from the graph library to connect multiple processing paths to your chat UI.
          </div>
        </div>
      )}

      {error && (
        <div className="app-error">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="app-canvas">
        {uiBlocks.length === 0 && !error && (
          <div className="app-empty">
            <div>No UI components found</div>
            <div className="app-empty-hint">
              Add <code>chat_box</code> or other UI nodes in the editor
            </div>
          </div>
        )}
        {uiBlocks.map(renderBlock)}
      </div>
    </div>
  )
}

export default AppPage
