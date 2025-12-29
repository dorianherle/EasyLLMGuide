import { getTypeColor } from '../utils/typeColors'

const CATEGORIES = {
  'Input': ['number_input', 'text_input'],
  'Math': ['add', 'multiply', 'double', 'triple', 'square'],
  'Branch': ['is_even', 'is_positive', 'compare'],
  'String': ['to_string', 'format_result', 'concat'],
  'Output': ['display', 'display_number'],
  'Utility': ['delay', 'log']
}

function NodeLibrary({ specs, onCollapse }) {
  const onDragStart = (event, spec) => {
    event.dataTransfer.setData('application/json', JSON.stringify(spec))
    event.dataTransfer.effectAllowed = 'move'
  }

  const getCategory = (name) => {
    for (const [cat, nodes] of Object.entries(CATEGORIES)) {
      if (nodes.includes(name)) return cat
    }
    return 'Other'
  }

  const grouped = {}
  specs.forEach(spec => {
    const cat = getCategory(spec.name)
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(spec)
  })

  return (
    <div className="node-library">
      <div className="panel-header">
        <h2>Nodes</h2>
        <button className="collapse-btn" onClick={onCollapse} title="Collapse">×</button>
      </div>
      <div className="panel-content">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="node-category">
            <h3 className="category-title">{category}</h3>
            {items.map((spec) => (
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
