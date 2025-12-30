import { getTypeColor } from '../utils/typeColors'

function NodeLibrary({ specs, onCollapse }) {
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

  return (
    <div className="node-library">
      <div className="panel-header">
        <h2>Nodes</h2>
        <button className="collapse-btn" onClick={onCollapse} title="Collapse">×</button>
      </div>
      <div className="panel-content">
        {sortedCategories.map((category) => (
          <div key={category} className="node-category">
            <h3 className="category-title">{category}</h3>
            {grouped[category].map((spec) => (
              <div
                key={spec.name}
                className="node-library-item"
                draggable
                onDragStart={(e) => onDragStart(e, spec)}
              >
                <div className="name">{spec.name}</div>
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
