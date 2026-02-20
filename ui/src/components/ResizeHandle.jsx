import { useCallback, useEffect, useState } from 'react'

function ResizeHandle({ side, onResize }) {
  const [dragging, setDragging] = useState(false)

  const handleMouseDown = useCallback((e) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  useEffect(() => {
    if (!dragging) return

    const handleMouseMove = (e) => {
      onResize(e.clientX)
    }

    const handleMouseUp = () => {
      setDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragging, onResize])

  return (
    <div 
      className={`resize-handle resize-handle-${side} ${dragging ? 'dragging' : ''}`}
      onMouseDown={handleMouseDown}
    />
  )
}

export default ResizeHandle


