import { useRef, useCallback } from 'react'

/**
 * Force-directed physics — ported from Life Graph engine
 * Forces: repulsion · spring · centering · damping
 */
export function useForceSimulation({ getW, getH }) {
  const alphaRef = useRef(1)

  const kick = useCallback((strength = 0.4) => {
    alphaRef.current = Math.min(1, alphaRef.current + strength)
  }, [])

  const tick = useCallback((nodes, edges, collapsedSet) => {
    const alpha = alphaRef.current
    if (alpha < 0.001) return

    const W = getW()
    const H = getH()
    const REPULSE  = 2200
    const SPRING_K = 0.014
    const CENTER_K = 0.003
    const DECAY    = 0.74

    const hidden = (n) => {
      if (n.type === 'root' || n.type === 'chaos' || n.type === 'event') return false
      return collapsedSet?.has(n.parentId)
    }

    const visible = nodes.filter(n => !hidden(n))

    // 1. Repulsion
    for (let i = 0; i < visible.length; i++) {
      const a = visible[i]
      for (let j = i + 1; j < visible.length; j++) {
        const b  = visible[j]
        const dx = a.x - b.x
        const dy = a.y - b.y
        const d2 = dx * dx + dy * dy || 1
        const d  = Math.sqrt(d2)
        const avg = (a.mass + b.mass) * 0.5
        const f  = REPULSE / (d2 * avg)
        const fx = (dx / d) * f
        const fy = (dy / d) * f
        if (!a.pinned) { a.vx += fx; a.vy += fy }
        if (!b.pinned) { b.vx -= fx; b.vy -= fy }
      }
    }

    // 2. Spring
    for (const [ai, bi] of edges) {
      const a = nodes[ai], b = nodes[bi]
      if (!a || !b) continue
      if (hidden(a) || hidden(b)) continue
      const dx   = b.x - a.x
      const dy   = b.y - a.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const isRoot = a.type === 'root' || b.type === 'root'
      const target = isRoot ? 160 : 90
      const f  = (dist - target) * SPRING_K * (a.mass + b.mass) * 0.4
      const fx = (dx / dist) * f
      const fy = (dy / dist) * f
      if (!a.pinned) { a.vx += fx; a.vy += fy }
      if (!b.pinned) { b.vx -= fx; b.vy -= fy }
    }

    // 3. Center + damp + integrate
    for (const n of visible) {
      if (n.pinned) continue
      n.vx += (W / 2 - n.x) * CENTER_K
      n.vy += (H / 2 - n.y) * CENTER_K
      n.vx *= DECAY
      n.vy *= DECAY
      n.x  += n.vx * alpha
      n.y  += n.vy * alpha
    }

    alphaRef.current *= 0.995
  }, [getW, getH])

  return { tick, kick }
}
