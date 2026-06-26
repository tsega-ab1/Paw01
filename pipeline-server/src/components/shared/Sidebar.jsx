import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../lib/api.js'

export default function Sidebar({ open, onClose, state, navigate }) {
  const { profile, online } = state
  const [convos, setConvos] = useState([])

  useEffect(() => {
    if (open) {
      api.getConversations().then(setConvos).catch(()=>{})
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity:0 }}
            animate={{ opacity:1 }}
            exit={{ opacity:0 }}
            onClick={onClose}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:200, backdropFilter:'blur(4px)' }}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x:'-100%' }}
            animate={{ x:0 }}
            exit={{ x:'-100%' }}
            transition={{ type:'spring', stiffness:320, damping:36 }}
            className="sidebar-bg"
            style={{
              position:'fixed', top:0, left:0, bottom:0,
              width: 280,
              zIndex: 210,
              display:'flex', flexDirection:'column',
              borderRight:'1px solid rgba(127,218,145,0.1)',
              overflow:'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding:'52px 20px 16px',
              borderBottom:'1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{
                  width:40, height:40, borderRadius:'50%',
                  background:'var(--primary)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:'"Playfair Display",serif', fontStyle:'italic',
                  fontSize:18, color:'#fff', fontWeight:700,
                }}>
                  {(profile?.name || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize:15, fontWeight:600, color:'#fff' }}>{profile?.name || 'PAW User'}</div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', display:'flex', alignItems:'center', gap:5 }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background: online ? '#4bc76e' : '#ef4444' }} />
                    {online ? 'Online' : 'Offline'}
                  </div>
                </div>
              </div>
            </div>

            {/* Nav links */}
            <div style={{ padding:'12px 12px 0' }}>
              {[
                { id:'chat',      icon:'forum',          label:'Chat' },
                { id:'calendar',  icon:'calendar_month', label:'Calendar' },
                { id:'routine',   icon:'account_tree',   label:'Routine' },
                { id:'community', icon:'groups',         label:'Community' },
                { id:'profile',   icon:'person',         label:'Profile' },
              ].map(item => (
                <motion.button
                  key={item.id}
                  whileTap={{ scale:0.96 }}
                  onClick={() => { navigate(item.id); onClose() }}
                  style={{
                    width:'100%', display:'flex', alignItems:'center', gap:12,
                    background:'none', border:'none', cursor:'pointer',
                    padding:'10px 12px', borderRadius:12,
                    color:'rgba(255,255,255,0.6)',
                    fontSize:14, fontWeight:500,
                    transition:'background 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
                    e.currentTarget.style.color = '#fff'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'none'
                    e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize:20, color:'rgba(255,255,255,0.5)' }}>{item.icon}</span>
                  {item.label}
                </motion.button>
              ))}
            </div>

            {/* Conversations */}
            <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', marginTop:16 }}>
              <div style={{
                fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.3)',
                textTransform:'uppercase', letterSpacing:'0.12em',
                padding:'0 20px 8px',
              }}>
                Recent conversations
              </div>
              <div style={{ flex:1, overflowY:'auto' }}>
                {convos.length === 0 && (
                  <div style={{ padding:'0 20px', fontSize:12, color:'rgba(255,255,255,0.25)' }}>
                    No conversations yet
                  </div>
                )}
                {convos.map(c => (
                  <motion.button
                    key={c.sessionId}
                    whileTap={{ scale:0.97 }}
                    onClick={() => { navigate('chat'); onClose() }}
                    style={{
                      width:'100%', display:'block', background:'none', border:'none',
                      cursor:'pointer', padding:'8px 20px', textAlign:'left',
                    }}
                  >
                    <div style={{
                      fontSize:13, color:'rgba(255,255,255,0.65)',
                      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                    }}>
                      {c.preview || 'Conversation'}
                    </div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.25)', marginTop:2 }}>
                      {new Date(c.date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Version */}
            <div style={{ padding:'12px 20px', fontSize:10, color:'rgba(255,255,255,0.2)', fontFamily:'"DM Mono",monospace' }}>
              PAW v1.0 · Wellness OS
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
