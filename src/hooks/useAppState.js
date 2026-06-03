import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../lib/api.js'

// ═══════════════════════════════════════════
// Central app state — one source of truth
// ═══════════════════════════════════════════

export function useAppState() {
  const [routine,     setRoutine]     = useState(null)
  const [standard,    setStandard]    = useState(null)
  const [profile,     setProfile]     = useState({})
  const [summary,     setSummary]     = useState(null)
  const [compare,     setCompare]     = useState(null)
  const [memories,    setMemories]    = useState([])
  const [mapNodes,    setMapNodes]    = useState([])
  const [journey,     setJourney]     = useState([])
  const [community,   setCommunity]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [online,      setOnline]      = useState(navigator.onLine)
  const initialized = useRef(false)

  // Network status
  useEffect(() => {
    const on  = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const loadAll = useCallback(async () => {
    try {
      const [r, s, p, sum, cmp] = await Promise.allSettled([
        api.getRoutine(),
        api.getStandard(),
        api.getProfile(),
        api.getSummary(),
        api.getCompare(),
      ])
      if (r.status === 'fulfilled' && r.value?.exists) setRoutine(r.value)
      if (s.status === 'fulfilled' && s.value?.exists) setStandard(s.value)
      if (p.status === 'fulfilled') setProfile(p.value)
      if (sum.status === 'fulfilled') setSummary(sum.value)
      if (cmp.status === 'fulfilled') setCompare(cmp.value)

      // Load memories and mind map nodes (may not exist yet)
      try { const m = await api.getMemories(); setMemories(m) } catch {}
      try { const n = await api.getNodes();    setMapNodes(n)  } catch {}
      try { const j = await api.getJourney();  setJourney(j)   } catch {}
      try { const c = await api.getCommunity();setCommunity(c)  } catch {}
    } catch (e) {
      console.error('loadAll error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      loadAll()
    }
  }, [loadAll])

  const refreshRoutine = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([api.getRoutine(), api.getStandard()])
      if (r?.exists) setRoutine(r)
      if (s?.exists) setStandard(s)
    } catch {}
  }, [])

  const refreshSummary = useCallback(async () => {
    try {
      const [sum, cmp] = await Promise.all([api.getSummary(), api.getCompare()])
      setSummary(sum)
      setCompare(cmp)
    } catch {}
  }, [])

  const refreshJourney = useCallback(async () => {
    try { const j = await api.getJourney(); setJourney(j) } catch {}
  }, [])

  const refreshNodes = useCallback(async () => {
    try { const n = await api.getNodes(); setMapNodes(n) } catch {}
  }, [])

  const refreshCommunity = useCallback(async () => {
    try { const c = await api.getCommunity(); setCommunity(c) } catch {}
  }, [])

  return {
    routine, setRoutine,
    standard, setStandard,
    profile, setProfile,
    summary, setSummary,
    compare, setCompare,
    memories, setMemories,
    mapNodes, setMapNodes,
    journey, setJourney,
    community, setCommunity,
    loading,
    online,
    loadAll,
    refreshRoutine,
    refreshSummary,
    refreshJourney,
    refreshNodes,
    refreshCommunity,
  }
}
