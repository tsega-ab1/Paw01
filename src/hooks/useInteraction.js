import { useRef, useCallback, useEffect } from 'react'

const SIZES = {
  root: 14, week: 10, activity_type: 8,
  photo: 7, event: 9, win: 7, struggle: 7,
  decision: 7, insight: 7, dormant: 7, chaos: 10,
}

export function useInteraction({ canvasRef, nodesRef, viewRef, onSelect, onDoubleSelect, onKick }) {
  const activePointers = useRef({})
  const dragNodeRef    = useRef(null)
  const dragMovedRef   = useRef(false)
  const panStartRef    = useRef(null)
  const pinchStartRef  = useRef(null)
  const tapStateRef    = useRef({ id: null, time: 0 })

  function getRect() {
    return canvasRef.current?.getBoundingClientRect() || { left: 0, top: 0 }
  }

  function toWorld(sx, sy) {
    const { zoom, panX, panY } = viewRef.current
    const W = canvasRef.current?.clientWidth  || 400
    const H = canvasRef.current?.clientHeight || 400
    return {
      x: (sx - panX - W / 2 * (1 - zoom)) / zoom,
      y: (sy - panY - H / 2 * (1 - zoom)) / zoom,
    }
  }

  function nodeAt(sx, sy) {
    const w = toWorld(sx, sy)
    const { zoom } = viewRef.current
    let best = null, bestD = Infinity
    for (const n of (nodesRef.current || [])) {
      const hitR = ((SIZES[n.type] || 7) + 10) / zoom
      const dx = n.x - w.x, dy = n.y - w.y
      const d  = Math.sqrt(dx * dx + dy * dy)
      if (d < hitR && d < bestD) { bestD = d; best = n }
    }
    return best
  }

  const onPointerDown = useCallback((e) => {
    canvasRef.current?.setPointerCapture(e.pointerId)
    const rect = getRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    activePointers.current[e.pointerId] = { x: e.clientX, y: e.clientY }

    const ids = Object.keys(activePointers.current)
    if (ids.length === 2) {
      const p1 = activePointers.current[ids[0]]
      const p2 = activePointers.current[ids[1]]
      pinchStartRef.current = {
        dist: Math.hypot(p1.x - p2.x, p1.y - p2.y),
        zoom: viewRef.current.zoom,
        cx: (p1.x + p2.x) / 2 - rect.left,
        cy: (p1.y + p2.y) / 2 - rect.top,
      }
      dragNodeRef.current = null
      panStartRef.current = null
      return
    }

    const n = nodeAt(sx, sy)
    if (n) {
      dragNodeRef.current  = n
      dragMovedRef.current = false
      n.pinned = true
    } else {
      panStartRef.current = { sx, sy, ox: viewRef.current.panX, oy: viewRef.current.panY }
    }
  }, [canvasRef, nodesRef, viewRef])

  const onPointerMove = useCallback((e) => {
    activePointers.current[e.pointerId] = { x: e.clientX, y: e.clientY }
    const ids = Object.keys(activePointers.current)

    if (ids.length === 2 && pinchStartRef.current) {
      const p1 = activePointers.current[ids[0]]
      const p2 = activePointers.current[ids[1]]
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y)
      const { dist: startDist, zoom: startZoom } = pinchStartRef.current
      viewRef.current.zoom = Math.max(0.25, Math.min(4, startZoom * (dist / startDist)))
      return
    }

    const rect = getRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top

    if (dragNodeRef.current) {
      const w = toWorld(sx, sy)
      dragNodeRef.current.x  = w.x
      dragNodeRef.current.y  = w.y
      dragNodeRef.current.vx = 0
      dragNodeRef.current.vy = 0
      dragMovedRef.current   = true
    } else if (panStartRef.current) {
      const { sx: ox, sy: oy, ox: opx, oy: opy } = panStartRef.current
      viewRef.current.panX = opx + (sx - ox)
      viewRef.current.panY = opy + (sy - oy)
    }
  }, [canvasRef, viewRef])

  const onPointerUp = useCallback((e) => {
    delete activePointers.current[e.pointerId]
    if (Object.keys(activePointers.current).length < 2) pinchStartRef.current = null

    if (dragNodeRef.current) {
      const n     = dragNodeRef.current
      n.pinned    = false
      const moved = dragMovedRef.current
      dragNodeRef.current  = null
      dragMovedRef.current = false

      if (!moved) {
        const now = Date.now()
        const tap = tapStateRef.current
        if (now - tap.time < 320 && tap.id === n.id) {
          onDoubleSelect?.(n)
          tapStateRef.current = { id: null, time: 0 }
        } else {
          tapStateRef.current = { id: n.id, time: now }
          onSelect?.(n)
        }
      } else {
        onKick?.()
      }
    } else {
      panStartRef.current = null
    }
  }, [onSelect, onDoubleSelect, onKick])

  const onWheel = useCallback((e) => {
    e.preventDefault()
    const rect = getRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const dz = e.deltaY > 0 ? 0.92 : 1.09
    const oldZ = viewRef.current.zoom
    const newZ = Math.max(0.25, Math.min(4, oldZ * dz))
    viewRef.current.panX = (viewRef.current.panX - mx) * (newZ / oldZ) + mx
    viewRef.current.panY = (viewRef.current.panY - my) * (newZ / oldZ) + my
    viewRef.current.zoom = newZ
  }, [viewRef])

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [canvasRef, onWheel])

  return { onPointerDown, onPointerMove, onPointerUp }
}
