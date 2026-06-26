import React, { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import './index.css'
import { useAppState }   from './hooks/useAppState.js'
import { useTimeTheme }  from './hooks/useTimeTheme.js'
import { useNativeBridge } from './hooks/useNativeBridge.js'
import Chat        from './components/Chat.jsx'
import Calendar    from './components/Calendar.jsx'
import Routine     from './components/Routine.jsx'
import Community   from './components/Community.jsx'
import Profile     from './components/Profile.jsx'
import RecoveryHub from './components/RecoveryHub.jsx'
import Sidebar     from './components/shared/Sidebar.jsx'
import Onboarding  from './components/Onboarding.jsx'

const BASE_SCREENS = [
  { id:'chat',      icon:'forum',          label:'Chat'      },
  { id:'calendar',  icon:'calendar_month', label:'Calendar'  },
  { id:'routine',   icon:'account_tree',   label:'Routine'   },
  { id:'community', icon:'groups',         label:'Community' },
  { id:'profile',   icon:'person',         label:'Profile'   },
]

// Special screens unlocked by routine category
const SPECIAL_SCREENS = {
  recovery:  { id:'recovery',  icon:'water_drop',  label:'Recovery', component: RecoveryHub, categories:['recovery','addiction'] },
  // future: learning, spiritual, etc.
}

const slideVariants = {
  enter:  d => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
  center:  ({ x: 0, opacity: 1 }),
  exit:   d => ({ x: d < 0 ? '100%' : '-100%', opacity: 0 }),
}

export default function App() {
  const state        = useAppState()
  const { timeStr }  = useTimeTheme()

  // Mount native bridge — listens to all Flutter → React events
  useNativeBridge({ state })
  const [screen,     setScreen]    = useState('chat')
  const [direction,  setDir]       = useState(1)
  const [sidebar,    setSidebar]   = useState(false)
  const [onboarded,  setOnboarded] = useState(() => !!localStorage.getItem('paw-onboarded'))
  const [unlockedSpecial, setUnlocked] = useState(() => {
    try { return JSON.parse(localStorage.getItem('paw-unlocked') || '[]') } catch { return [] }
  })

  // ── Chat state lifted here so it survives screen switches ──────
  const [chatMessages,    setChatMessages]    = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('paw-chat') || '[]') } catch { return [] }
  })

  useEffect(() => {
    try { sessionStorage.setItem('paw-chat', JSON.stringify(chatMessages.slice(-40))) } catch {}
  }, [chatMessages])

  // ── Special screen unlock detection ───────────────────────────
  useEffect(() => {
    const cat = state.routine?.goalCategory?.toLowerCase() || ''
    const title = state.routine?.title?.toLowerCase() || ''
    const isRecovery = cat.includes('recovery') || cat.includes('addiction') ||
      title.includes('recovery') || title.includes('sobriety') || title.includes('addiction')

    if (isRecovery && !unlockedSpecial.includes('recovery')) {
      const next = [...unlockedSpecial, 'recovery']
      setUnlocked(next)
      localStorage.setItem('paw-unlocked', JSON.stringify(next))
    }
  }, [state.routine])

  // ── Build active nav screens ───────────────────────────────────
  const screens = [
    ...BASE_SCREENS,
    ...unlockedSpecial.map(id => SPECIAL_SCREENS[id]).filter(Boolean),
  ]

  // ── Flutter bridge ─────────────────────────────────────────────
  useEffect(() => {
    window.onNativeHealthData = (data) => {
      fetch('/api/log/module/health', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).catch(() => {})
    }
    window.onNativeCameraResult = (data) => { window._pendingPhoto = data }
  }, [])

  function navigate(id) {
    const cur = screens.findIndex(s => s.id === screen)
    const nxt = screens.findIndex(s => s.id === id)
    setDir(nxt >= cur ? 1 : -1)
    setScreen(id)
  }

  // If unlocked screen no longer in nav, reset to chat
  useEffect(() => {
    if (!screens.find(s => s.id === screen)) setScreen('chat')
  }, [screens])

  if (!onboarded) {
    return (
      <Onboarding onComplete={(prefs) => {
        localStorage.setItem('paw-onboarded', '1')
        localStorage.setItem('paw-prefs', JSON.stringify(prefs))
        setOnboarded(true)
      }} />
    )
  }

  const isDark = document.body.className.includes('evening') || document.body.className.includes('night')
  const screenProps = { state, navigate, chatMessages, setChatMessages, isDark }

  return (
    <div style={{ height:'100dvh', display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>
      <Sidebar open={sidebar} onClose={() => setSidebar(false)} state={state} navigate={navigate} />

      {/* Header */}
      <header style={{
        background:'var(--header-bg)', backdropFilter:'blur(20px)',
        borderBottom:'1px solid var(--border)', flexShrink:0, zIndex:50,
        transition:'background 1.2s ease',
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px' }}>
          <motion.button whileTap={{ scale:0.88 }} onClick={() => setSidebar(true)}
            style={{ background:'none', border:'none', cursor:'pointer', padding:6, color:'var(--text-dim)' }}>
            <span className="material-symbols-outlined">menu</span>
          </motion.button>

          <div style={{ fontFamily:'"Playfair Display",serif', fontStyle:'italic', fontSize:22, color:'var(--text)', display:'flex', alignItems:'center' }}>
            <span className="p-glow" style={{ color:'var(--primary)', position:'relative' }}>
              <span className="p-dot" style={{ position:'relative' }}>p</span>
            </span>
            <span>aw</span>
          </div>

          {/* Online/offline + time */}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {!state.online && (
              <div style={{ fontSize:9, color:'#ef4444', fontWeight:700, letterSpacing:'0.08em', background:'rgba(239,68,68,0.1)', borderRadius:8, padding:'2px 7px' }}>
                OFFLINE
              </div>
            )}
            <div style={{ fontFamily:'"DM Mono",monospace', fontSize:11, color:'var(--text-muted)' }}>{timeStr}</div>
          </div>
        </div>
      </header>

      {/* Screen area */}
      <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={screen}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type:'spring', stiffness:300, damping:34, mass:0.85 }}
            style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', overflow:'hidden' }}
          >
            {screen === 'chat'      && <Chat      {...screenProps} />}
            {screen === 'calendar'  && <Calendar  {...screenProps} />}
            {screen === 'routine'   && <Routine   {...screenProps} />}
            {screen === 'community' && <Community {...screenProps} />}
            {screen === 'profile'   && <Profile   {...screenProps} />}
            {screen === 'recovery'  && <RecoveryHub {...screenProps} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom nav — dynamic, shows unlocked screens */}
      <nav style={{
        background:'var(--nav-bg)', backdropFilter:'blur(20px)',
        borderTop:'1px solid var(--border)', flexShrink:0,
        display:'flex', justifyContent:'space-around', alignItems:'center',
        padding:'8px 4px 10px', zIndex:50,
        transition:'background 1.2s ease',
      }}>
        {screens.map(s => {
          const active = screen === s.id
          const isNew  = unlockedSpecial.includes(s.id)
          return (
            <motion.button
              key={s.id}
              onClick={() => navigate(s.id)}
              whileTap={{ scale:0.85 }}
              style={{
                background:'none', border:'none', cursor:'pointer',
                display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                padding:'4px 10px', borderRadius:12, position:'relative',
                color: active ? 'var(--primary)' : 'var(--text-muted)',
                opacity: active ? 1 : 0.6,
                transition:'color 0.2s, opacity 0.2s',
              }}
            >
              {/* New badge for unlocked screens */}
              {isNew && !active && (
                <motion.div
                  initial={{ scale:0 }} animate={{ scale:1 }}
                  style={{ position:'absolute', top:2, right:6, width:7, height:7, borderRadius:'50%', background:'#ef4444', border:'1.5px solid var(--nav-bg)' }}
                />
              )}
              <span className={`material-symbols-outlined ${active ? 'fill-icon' : ''}`} style={{ fontSize: screens.length > 5 ? 20 : 22 }}>{s.icon}</span>
              <span style={{ fontSize: screens.length > 5 ? 8 : 9, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' }}>{s.label}</span>
              {active && <motion.div layoutId="nav-dot" style={{ width:4, height:4, borderRadius:'50%', background:'var(--primary)' }} />}
            </motion.button>
          )
        })}
      </nav>
    </div>
  )
}
