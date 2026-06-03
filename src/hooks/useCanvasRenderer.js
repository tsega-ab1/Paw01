import { useCallback } from 'react'

// ── PAW node visual config ─────────────────────────────────────────
// Night theme (dark background)
const NIGHT = {
  root:     { fill: '#0d2a1a', stroke: '#2d9e55', label: '#7fda91', size: 14 },
  week:     { fill: '#1a1040', stroke: '#7F77DD', label: '#CECBF6', size: 10 },
  activity_type: { fill: '#2e1e06', stroke: '#EF9F27', label: '#FAC775', size: 8  },
  photo:    { fill: '#1a0a2e', stroke: '#ec4899', label: '#f9a8d4', size: 7  },
  event:    { fill: '#0a2030', stroke: '#06b6d4', label: '#67e8f9', size: 9  },
  win:      { fill: '#0d2a1a', stroke: '#2d9e55', label: '#7fda91', size: 7  },
  struggle: { fill: '#2e0c0c', stroke: '#E24B4A', label: '#F7C1C1', size: 7  },
  decision: { fill: '#1a0a2e', stroke: '#8b5cf6', label: '#c4b5fd', size: 7  },
  insight:  { fill: '#1a1040', stroke: '#a78bfa', label: '#ddd6fe', size: 7  },
  dormant:  { fill: '#1a1a1a', stroke: '#4b5563', label: '#6b7280', size: 7  },
  chaos:    { fill: '#2e0c0c', stroke: '#E24B4A', label: '#F7C1C1', size: 10 },
}

// Day theme (light background)
const DAY = {
  root:     { fill: '#d1fae5', stroke: '#00602a', label: '#004d22', size: 14 },
  week:     { fill: '#ede9fe', stroke: '#5b21b6', label: '#3730a3', size: 10 },
  activity_type: { fill: '#fef3c7', stroke: '#b45309', label: '#78350f', size: 8  },
  photo:    { fill: '#fce7f3', stroke: '#9d174d', label: '#831843', size: 7  },
  event:    { fill: '#e0f2fe', stroke: '#0369a1', label: '#075985', size: 9  },
  win:      { fill: '#d1fae5', stroke: '#00602a', label: '#004d22', size: 7  },
  struggle: { fill: '#fee2e2', stroke: '#b91c1c', label: '#991b1b', size: 7  },
  decision: { fill: '#ede9fe', stroke: '#5b21b6', label: '#3730a3', size: 7  },
  insight:  { fill: '#f3e8ff', stroke: '#7e22ce', label: '#6b21a8', size: 7  },
  dormant:  { fill: '#f3f4f6', stroke: '#9ca3af', label: '#6b7280', size: 7  },
  chaos:    { fill: '#fee2e2', stroke: '#b91c1c', label: '#991b1b', size: 10 },
}

const NODE_ICONS = {
  root:          '🎯',
  week:          '📅',
  activity_type: '⚡',
  photo:         '📸',
  event:         '⚡',
  win:           '💪',
  struggle:      '😔',
  decision:      '🎯',
  insight:       '💡',
  dormant:       '⚠️',
  chaos:         '💥',
}

export function useCanvasRenderer({ canvasRef, viewRef, isDark = true }) {
  const render = useCallback((nodes, edges, collapsedSet, selectedId) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const W   = canvas.width  / dpr
    const H   = canvas.height / dpr
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const COLORS = isDark ? NIGHT : DAY
    const { zoom, panX, panY } = viewRef.current

    function toScreen(wx, wy) {
      return {
        x: wx * zoom + panX + (W / 2) * (1 - zoom),
        y: wy * zoom + panY + (H / 2) * (1 - zoom),
      }
    }

    function isHidden(n) {
      if (!collapsedSet || n.type === 'root' || n.type === 'chaos' || n.type === 'event') return false
      return collapsedSet.has(n.parentId)
    }

    // ── Edges ─────────────────────────────────────────────────────
    for (let i = 0; i < edges.length; i++) {
      const [ai, bi] = edges[i]
      const a = nodes[ai], b = nodes[bi]
      if (!a || !b) continue
      if (isHidden(a) || isHidden(b)) continue

      const sa = toScreen(a.x, a.y)
      const sb = toScreen(b.x, b.y)
      const isChaos   = a.type === 'chaos' || b.type === 'chaos'
      const isDormant = a.type === 'dormant' || b.type === 'dormant'
      const isRoot    = a.type === 'root'   || b.type === 'root'

      ctx.beginPath()
      ctx.moveTo(sa.x, sa.y)
      ctx.lineTo(sb.x, sb.y)

      if (isChaos) {
        ctx.strokeStyle = isDark ? 'rgba(226,75,74,0.6)' : 'rgba(185,28,28,0.5)'
        ctx.lineWidth   = 1.8 * zoom
        ctx.setLineDash([3, 5])
      } else if (isDormant) {
        ctx.strokeStyle = isDark ? 'rgba(107,114,128,0.35)' : 'rgba(156,163,175,0.5)'
        ctx.lineWidth   = 1.0 * zoom
        ctx.setLineDash([2, 4])
      } else if (isRoot) {
        ctx.strokeStyle = isDark ? 'rgba(45,158,85,0.55)' : 'rgba(0,96,42,0.4)'
        ctx.lineWidth   = 2.0 * zoom
        ctx.setLineDash([])
      } else {
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)'
        ctx.lineWidth   = 1.4 * zoom
        ctx.setLineDash([])
      }
      ctx.stroke()
      ctx.setLineDash([])
    }

    // ── Nodes ─────────────────────────────────────────────────────
    // Draw order: chaos last (on top), root on top of all
    const order = [
      ...nodes.filter(n => n.type !== 'root' && n.type !== 'chaos'),
      ...nodes.filter(n => n.type === 'chaos'),
      ...nodes.filter(n => n.type === 'root'),
    ]

    for (const n of order) {
      if (isHidden(n)) continue
      const s     = toScreen(n.x, n.y)
      const cfg   = COLORS[n.type] || COLORS.event
      const r     = (cfg.size || 7) * Math.max(0.6, Math.min(1.4, zoom))
      const sel   = n.id === selectedId
      const isDom = n.type === 'dormant'

      // Glow ring for selected
      if (sel) {
        const grad = ctx.createRadialGradient(s.x, s.y, r, s.x, s.y, r + 14)
        grad.addColorStop(0, cfg.stroke + '55')
        grad.addColorStop(1, cfg.stroke + '00')
        ctx.beginPath()
        ctx.arc(s.x, s.y, r + 14, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()
      }

      // Collapsed indicator ring
      if (collapsedSet?.has(n.id)) {
        ctx.beginPath()
        ctx.arc(s.x, s.y, r + 5, 0, Math.PI * 2)
        ctx.strokeStyle = cfg.stroke + '55'
        ctx.lineWidth   = 1
        ctx.stroke()
      }

      // Shadow
      if (!isDom) {
        ctx.shadowColor = cfg.stroke + '66'
        ctx.shadowBlur  = sel ? 16 : 8
      }

      // Circle fill
      ctx.beginPath()
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
      ctx.fillStyle   = cfg.fill
      ctx.fill()
      ctx.strokeStyle = cfg.stroke
      ctx.lineWidth   = sel ? 2.5 : 1.6
      ctx.globalAlpha = isDom ? 0.45 : 1
      ctx.stroke()
      ctx.shadowBlur  = 0
      ctx.globalAlpha = 1

      // Icon (emoji) center
      if (zoom > 0.4) {
        const icon = NODE_ICONS[n.type] || '●'
        const fs   = Math.max(8, r * 0.95)
        ctx.font          = `${fs}px serif`
        ctx.textAlign     = 'center'
        ctx.textBaseline  = 'middle'
        ctx.globalAlpha   = isDom ? 0.4 : 1
        ctx.fillText(icon, s.x, s.y)
        ctx.globalAlpha   = 1
      }

      // Label below — root + week always, others only when zoomed in
      const showLabel = n.type === 'root' || n.type === 'week' || zoom > 0.85
      if (showLabel && n.label) {
        const fs = Math.max(7, Math.min(12, 9 * zoom))
        ctx.font          = `500 ${fs}px 'DM Mono', monospace`
        ctx.fillStyle     = cfg.label
        ctx.textAlign     = 'center'
        ctx.textBaseline  = 'top'
        ctx.globalAlpha   = isDom ? 0.35 : 0.9
        ctx.fillText(n.label.slice(0, 18), s.x, s.y + r + 4)
        ctx.globalAlpha   = 1
      }
    }
  }, [canvasRef, viewRef, isDark])

  return { render }
}
