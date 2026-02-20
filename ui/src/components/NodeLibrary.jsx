import { useRef } from 'react'
import { getTypeColor } from '../utils/typeColors'

function NodeLibrary({ specs, onCollapse, folderPath, onFolderChange, style, applications, currentApplication, onApplicationChange, onRemoveAllNodes, onAddNodes, loadedApplications }) {
  const folderInputRef = useRef(null)

  const onDragStart = (event, spec) => {
    event.dataTransfer.setData('application/json', JSON.stringify(spec))
    event.dataTransfer.effectAllowed = 'move'
  }

  // Group by category directly from spec
  const grouped = {}
  specs.forEach(spec => {
    const cat = spec.category || 'Other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(spec)
  })

  // Define preferred order
  const ORDER = ['Triggers', 'Outputs', 'Logic', 'String', 'Constants', 'Utility']

  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const idxA = ORDER.indexOf(a)
    const idxB = ORDER.indexOf(b)
    if (idxA !== -1 && idxB !== -1) return idxA - idxB
    if (idxA !== -1) return -1
    if (idxB !== -1) return 1
    return a.localeCompare(b)
  })

  const handleFolderSelect = (e) => {
    const files = e.target.files
    if (files && files.length > 0) {
      // Get folder path from webkitRelativePath
      const firstFile = files[0]
      const relativePath = firstFile.webkitRelativePath
      const folderName = relativePath.split('/')[0]
      onFolderChange(folderName, files)
    }
    e.target.value = ''
  }

  const handleClearFolder = () => {
    onFolderChange(null, null)
  }

  return (
    <div className="node-library" style={style}>
      <div className="panel-header">
        <h2>Nodes</h2>
        <button className="folder-btn" onClick={() => folderInputRef.current?.click()} title="Load nodes folder">📁</button>
        {folderPath && <button className="clear-folder-btn" onClick={handleClearFolder} title="Clear custom nodes">✕</button>}
        <button className="collapse-btn" onClick={onCollapse} title="Collapse">×</button>
        <input 
          ref={folderInputRef}
          type="file" 
          webkitdirectory="" 
          directory=""
          onChange={handleFolderSelect}
          style={{ display: 'none' }}
        />
      </div>
      
      {applications && applications.length > 0 && (
        <div className="application-selector" style={{ padding: '8px', borderBottom: '1px solid #333' }}>
          <select 
            value={currentApplication || ''} 
            onChange={(e) => onApplicationChange(e.target.value)}
            style={{ width: '100%', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', marginBottom: '8px' }}
          >
            {applications.map(app => (
              <option key={app} value={app}>{app}</option>
            ))}
          </select>
          {loadedApplications && loadedApplications.length > 1 && (
            <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '8px' }}>
              Loaded: {loadedApplications.join(', ')}
            </div>
          )}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button 
              onClick={onRemoveAllNodes}
              style={{ 
                flex: 1, 
                padding: '4px', 
                background: '#d32f2f', 
                color: '#fff', 
                border: 'none', 
                cursor: 'pointer',
                fontSize: '12px'
              }}
              title="Remove all nodes from graph"
            >
              Remove All Nodes
            </button>
            <button 
              onClick={onAddNodes}
              style={{ 
                flex: 1, 
                padding: '4px', 
                background: '#1976d2', 
                color: '#fff', 
                border: 'none', 
                cursor: 'pointer',
                fontSize: '12px'
              }}
              title="Add nodes from another application"
            >
              Add Nodes
            </button>
          </div>
        </div>
      )}
      
      {folderPath && (
        <div className="current-folder-bar">
          📂 {folderPath}
        </div>
      )}
      
      <div className="panel-content">
        {sortedCategories.map((category) => (
          <div key={category} className="node-category">
            <h3 className="category-title">{category}</h3>
            {grouped[category].map((spec, idx) => (
              <div
                key={`${spec.name}-${idx}`}
                className="node-library-item"
                draggable
                onDragStart={(e) => onDragStart(e, spec)}
              >
                <div className="name">
                  {spec.name}
                  {spec.interface_type && <span className="interface-badge">UI</span>}
                </div>
                <div className="ports">
                  <div className="inputs">
                    {Object.entries(spec.inputs).map(([name, def]) => (
                      <div key={name} className="port">
                        <span className="port-dot" style={{ background: getTypeColor(def.type) }} />
                        <span>{name}</span>
                      </div>
                    ))}
                  </div>
                  <div className="outputs">
                    {Object.entries(spec.outputs).map(([name, def]) => (
                      <div key={name} className="port">
                        <span>{name}</span>
                        <span className="port-dot" style={{ background: getTypeColor(def.type) }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default NodeLibrary
