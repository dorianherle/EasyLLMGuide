function ContextMenu({ x, y, items, onClose }) {
  return (
    <>
      <div className="context-menu-backdrop" onClick={onClose} />
      <div className="context-menu" style={{ left: x, top: y }}>
        {items.map((item, i) => (
          item.divider ? (
            <div key={i} className="context-menu-divider" />
          ) : (
            <button
              key={i}
              className="context-menu-item"
              onClick={() => { item.action(); onClose(); }}
              disabled={item.disabled}
            >
              {item.icon && <span className="context-menu-icon">{item.icon}</span>}
              {item.label}
            </button>
          )
        ))}
      </div>
    </>
  )
}

export default ContextMenu


