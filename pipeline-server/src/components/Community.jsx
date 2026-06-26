import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../lib/api.js'

const FILTERS = ['All','Spiritual','Learning','Health','Recovery','Professional','Creative']

const CATEGORY_COLOR = {
  spiritual:'#6366f1', learning:'#f59e0b', health:'#2d9e55',
  recovery:'#06b6d4', professional:'#8b5cf6', creative:'#ec4899', general:'#2d9e55',
}

// Simulate live participants (in real app this comes from a polling endpoint)
function useLiveCount(base = 0) {
  const [count, setCount] = useState(base)
  useEffect(() => {
    if (!base) return
    const id = setInterval(() => {
      setCount(c => c + (Math.random() > 0.7 ? 1 : 0))
    }, 8000)
    return () => clearInterval(id)
  }, [base])
  return count
}

export default function Community({ state, navigate }) {
  const { community, refreshCommunity, profile, routine } = state
  const [filter,    setFilter]    = useState('All')
  const [adapting,  setAdapting]  = useState(null)
  const [challenge, setChallenge] = useState(null)  // post being challenged
  const [sending,   setSending]   = useState(false)
  const [incoming,  setIncoming]  = useState(null)  // incoming challenge popup
  const pollRef = useRef(null)

  // Poll for new challenges (simulated — in real app WebSocket)
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const challenges = await fetch('/api/community/challenges/incoming').then(r => r.json())
        if (challenges?.length) setIncoming(challenges[0])
      } catch {}
    }, 15000)
    return () => clearInterval(pollRef.current)
  }, [])

  useEffect(() => { refreshCommunity() }, [])

  const filtered = filter === 'All'
    ? community
    : community.filter(p => p.category?.toLowerCase() === filter.toLowerCase())

  async function adapt(idx) {
    setAdapting(idx)
    try {
      await api.adaptRoutine(idx)
      await state.refreshRoutine()
      navigate('chat')
    } catch {}
    setAdapting(null)
  }

  async function sendChallenge(post) {
    setSending(true)
    try {
      await fetch('/api/community/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromName: profile?.name || 'A PAW user',
          routineTitle: post.routineJSON?.title || post.title,
          days: post.routineJSON?.totalDays || 7,
          routineJSON: post.routineJSON,
          postId: community.indexOf(post),
        }),
      })
      setChallenge(null)
      alert(`Challenge sent! Others can now accept your "${post.routineJSON?.title || post.title}" challenge.`)
    } catch {}
    setSending(false)
  }

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

      {/* Filter chips */}
      <div style={{ display:'flex', gap:8, padding:'12px 14px', overflowX:'auto', flexShrink:0, borderBottom:'1px solid var(--border)', background:'var(--surface)' }}>
        {FILTERS.map(f => (
          <motion.button key={f} whileTap={{ scale:0.92 }} onClick={() => setFilter(f)} style={{
            flexShrink:0, padding:'6px 14px', borderRadius:20, border:'none',
            background: filter===f ? 'var(--chip-bg)' : 'var(--surface-low)',
            color: filter===f ? 'var(--chip-text)' : 'var(--text-muted)',
            fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.2s',
          }}>{f}</motion.button>
        ))}
      </div>

      <div className="scroll-area" style={{ flex:1, padding:'12px 14px 100px', display:'flex', flexDirection:'column', gap:14 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'48px 24px' }}>
            <span className="material-symbols-outlined" style={{ fontSize:48, color:'var(--text-faint)', display:'block', marginBottom:12 }}>groups</span>
            <p style={{ color:'var(--text-muted)', fontSize:14 }}>
              No community posts yet. Share your journey from the Routine screen to be the first.
            </p>
          </div>
        )}

        <AnimatePresence>
          {filtered.map((post, idx) => (
            <CommunityCard
              key={idx}
              post={post}
              idx={idx}
              adapting={adapting === idx}
              onAdapt={() => adapt(idx)}
              onChallenge={() => setChallenge(post)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Challenge send sheet */}
      <AnimatePresence>
        {challenge && (
          <ChallengeSheet
            post={challenge}
            sending={sending}
            onSend={() => sendChallenge(challenge)}
            onClose={() => setChallenge(null)}
          />
        )}
      </AnimatePresence>

      {/* Incoming challenge popup */}
      <AnimatePresence>
        {incoming && (
          <IncomingChallenge
            challenge={incoming}
            onAccept={async () => {
              try {
                await fetch(`/api/community/challenge/${incoming.id}/respond`, {
                  method:'POST', headers:{'Content-Type':'application/json'},
                  body: JSON.stringify({ accepted: true }),
                })
                await state.refreshRoutine()
                navigate('routine')
              } catch {}
              setIncoming(null)
            }}
            onDecline={async () => {
              try {
                await fetch(`/api/community/challenge/${incoming.id}/respond`, {
                  method:'POST', headers:{'Content-Type':'application/json'},
                  body: JSON.stringify({ accepted: false }),
                })
              } catch {}
              setIncoming(null)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function CommunityCard({ post, idx, adapting, onAdapt, onChallenge }) {
  const [expanded, setExpanded] = useState(false)
  const color = CATEGORY_COLOR[post.category?.toLowerCase()] || '#2d9e55'
  const completion = post.blocks ? Math.round((post.blocks.filter(Boolean).length/post.blocks.length)*100) : 0
  const isLive = post.liveCount > 0 || (post.adapts > 0 && idx < 3)
  const liveCount = useLiveCount(post.liveCount || (isLive ? Math.floor(Math.random()*4)+1 : 0))

  return (
    <motion.div
      initial={{ opacity:0, y:16 }}
      animate={{ opacity:1, y:0 }}
      exit={{ opacity:0, y:-8 }}
      transition={{ delay: idx * 0.04 }}
      style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:18, overflow:'hidden' }}
    >
      <div style={{ height:3, background:color }} />

      {/* Live indicator */}
      {isLive && (
        <div style={{ padding:'6px 16px 0', display:'flex', alignItems:'center', gap:6 }}>
          <motion.div
            animate={{ opacity:[1,0.3,1] }}
            transition={{ duration:1.5, repeat:Infinity }}
            style={{ width:6, height:6, borderRadius:'50%', background:'#ef4444', flexShrink:0 }}
          />
          <span style={{ fontSize:10, color:'#ef4444', fontWeight:700, letterSpacing:'0.08em' }}>
            LIVE · {liveCount} participating now
          </span>
        </div>
      )}

      {/* Photo */}
      {post.photo && typeof post.photo === 'string' && post.photo.startsWith('data:') && (
        <img src={post.photo} alt="" style={{ width:'100%', maxHeight:200, objectFit:'cover', display:'block', marginTop:8 }} />
      )}

      <div style={{ padding:'12px 16px' }}>
        {/* Category pill */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
          <div style={{ background:`${color}20`, color, borderRadius:10, padding:'2px 9px', fontSize:11, fontWeight:700, textTransform:'capitalize' }}>
            {post.category}
          </div>
          {post.adapts > 0 && (
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>
              {post.adapts} adapted
            </div>
          )}
          <div style={{ marginLeft:'auto', fontSize:16, fontWeight:700, color }}>
            {completion}%
          </div>
        </div>

        <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:8, lineHeight:1.4 }}>
          {post.title || post.quote?.slice(0,60)}
        </div>

        <p style={{ fontSize:13, color:'var(--text-dim)', fontStyle:'italic', lineHeight:1.6, marginBottom:10, borderLeft:`2px solid ${color}`, paddingLeft:10 }}>
          "{post.quote}"
        </p>

        {/* Week blocks */}
        <div style={{ display:'flex', gap:4, marginBottom:12, alignItems:'center' }}>
          <span style={{ fontSize:11, color:'var(--text-muted)', marginRight:4 }}>Wk {post.weeks}</span>
          {(post.blocks||[]).map((b,i) => (
            <div key={i} style={{ width:10, height:10, borderRadius:3, background:b?color:'var(--surface-mid)', opacity:b?1:0.4 }} />
          ))}
        </div>

        {/* Activities preview */}
        {post.routineJSON?.activities && (
          <>
            <motion.button whileTap={{ scale:0.96 }} onClick={() => setExpanded(e=>!e)} style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:6, color:'var(--text-muted)', fontSize:12, marginBottom:expanded?8:0, padding:0 }}>
              <span className="material-symbols-outlined" style={{ fontSize:14 }}>{expanded?'expand_less':'expand_more'}</span>
              {expanded?'Hide':'See'} {post.routineJSON.activities.length} activities
            </motion.button>
            <AnimatePresence>
              {expanded && (
                <motion.div initial={{ height:0,opacity:0 }} animate={{ height:'auto',opacity:1 }} exit={{ height:0,opacity:0 }} style={{ overflow:'hidden', marginBottom:10 }}>
                  {post.routineJSON.activities.map((a,i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'5px 0', borderBottom:'1px solid var(--border)' }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:a.color||color, flexShrink:0 }} />
                      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:'var(--text-muted)', width:36 }}>{a.time}</span>
                      <span style={{ fontSize:12, color:'var(--text)', flex:1 }}>{a.name}</span>
                      <span style={{ fontSize:11, color:'var(--text-muted)' }}>{a.duration}</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Footer actions */}
        <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
          <motion.button whileTap={{ scale:0.88 }} onClick={onAdapt} disabled={adapting} style={{
            flex:1, background:adapting?'var(--surface-mid)':'var(--primary)', color:adapting?'var(--text-muted)':'#fff',
            border:'none', borderRadius:10, padding:'8px 14px', fontSize:12, fontWeight:600, cursor:adapting?'default':'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'background 0.2s',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize:14 }}>{adapting?'sync':'alt_route'}</span>
            {adapting?'Adapting...':'Adapt routine'}
          </motion.button>

          {/* Challenge button */}
          <motion.button whileTap={{ scale:0.88 }} onClick={onChallenge} style={{
            padding:'8px 14px', border:'1px solid var(--border)', background:'var(--surface-low)',
            borderRadius:10, fontSize:12, fontWeight:600, cursor:'pointer', color:'var(--text-dim)',
            display:'flex', alignItems:'center', gap:6,
          }}>
            <span style={{ fontSize:14 }}>⚡</span>
            Challenge
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}

function ChallengeSheet({ post, sending, onSend, onClose }) {
  const color = CATEGORY_COLOR[post.category?.toLowerCase()] || '#2d9e55'
  const days  = post.routineJSON?.totalDays || 7

  return (
    <>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={onClose}
        style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:120 }}
      />
      <motion.div initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }} transition={{ type:'spring', stiffness:320, damping:36 }}
        style={{ position:'fixed', bottom:0, left:0, right:0, background:'var(--sheet-bg)', borderRadius:'22px 22px 0 0', padding:'0 16px 40px', zIndex:130 }}
      >
        <div style={{ display:'flex', justifyContent:'center', padding:'10px 0' }}>
          <div style={{ width:36, height:4, borderRadius:2, background:'var(--surface-mid)' }} />
        </div>

        <div style={{ fontSize:16, fontWeight:700, color:'var(--text)', marginBottom:6 }}>⚡ Send as Challenge</div>

        <div style={{ background:`${color}12`, border:`1px solid ${color}30`, borderRadius:14, padding:'12px 14px', marginBottom:16 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:4 }}>
            {post.routineJSON?.title || post.title}
          </div>
          <div style={{ fontSize:12, color:'var(--text-muted)' }}>
            {days}-day challenge · {post.routineJSON?.activities?.length || '?'} daily activities
          </div>
        </div>

        <p style={{ fontSize:13, color:'var(--text-muted)', lineHeight:1.6, marginBottom:16 }}>
          This will be posted to the community feed as an open challenge. Anyone can accept, decline, or adapt it.
          Their progress will show as live participants on this post.
        </p>

        {/* Challenge options */}
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
          {[
            { icon:'🌍', label:'Post to community', sub:'Anyone can accept', type:'community' },
            { icon:'👥', label:'Send to friends', sub:'Coming soon', type:'friends', disabled:true },
          ].map(opt => (
            <div key={opt.type} style={{
              display:'flex', alignItems:'center', gap:12,
              background:'var(--surface-low)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 14px',
              opacity: opt.disabled ? 0.45 : 1,
            }}>
              <span style={{ fontSize:22 }}>{opt.icon}</span>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{opt.label}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>{opt.sub}</div>
              </div>
              {!opt.disabled && (
                <div style={{ marginLeft:'auto', width:20, height:20, borderRadius:'50%', background:'var(--primary)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize:14, color:'#fff' }}>check</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <motion.button whileTap={{ scale:0.92 }} onClick={onSend} disabled={sending} style={{
            flex:1, background:'var(--primary)', color:'#fff', border:'none', borderRadius:12,
            padding:'14px', fontSize:15, fontWeight:600, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          }}>
            <span style={{ fontSize:18 }}>⚡</span>
            {sending ? 'Sending...' : `Send ${days}-day challenge`}
          </motion.button>
          <motion.button whileTap={{ scale:0.92 }} onClick={onClose} style={{ padding:'14px 18px', background:'var(--surface-low)', border:'none', borderRadius:12, fontSize:14, cursor:'pointer', color:'var(--text)' }}>
            Cancel
          </motion.button>
        </div>
      </motion.div>
    </>
  )
}

function IncomingChallenge({ challenge, onAccept, onDecline }) {
  return (
    <>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:200, backdropFilter:'blur(6px)' }}
      />
      <motion.div
        initial={{ scale:0.88, opacity:0, y:30 }}
        animate={{ scale:1, opacity:1, y:0 }}
        exit={{ scale:0.88, opacity:0, y:30 }}
        transition={{ type:'spring', stiffness:360, damping:28 }}
        style={{
          position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
          width:'min(90vw,360px)',
          background:'var(--sheet-bg)', borderRadius:24, padding:24, zIndex:210,
          border:'1px solid var(--border)',
        }}
      >
        <div style={{ textAlign:'center', marginBottom:16 }}>
          <div style={{ fontSize:40, marginBottom:10 }}>⚡</div>
          <div style={{ fontSize:18, fontWeight:700, color:'var(--text)', marginBottom:6 }}>
            Challenge incoming!
          </div>
          <div style={{ fontSize:14, color:'var(--text-muted)', lineHeight:1.6 }}>
            <strong style={{ color:'var(--text)' }}>{challenge.fromName}</strong> challenged you to:
          </div>
          <div style={{
            marginTop:12, background:'var(--surface-low)', borderRadius:12, padding:'12px 14px',
            fontSize:15, fontWeight:700, color:'var(--text)',
          }}>
            {challenge.routineTitle}
          </div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:6 }}>
            {challenge.days}-day challenge
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <motion.button whileTap={{ scale:0.95 }} onClick={onAccept} style={{
            width:'100%', background:'var(--primary)', color:'#fff', border:'none',
            borderRadius:14, padding:'14px', fontSize:15, fontWeight:700, cursor:'pointer',
          }}>
            ✓ Accept challenge
          </motion.button>
          <motion.button whileTap={{ scale:0.95 }} onClick={onDecline} style={{
            width:'100%', background:'none', border:'1px solid var(--border)',
            borderRadius:14, padding:'13px', fontSize:14, cursor:'pointer', color:'var(--text-muted)',
          }}>
            Decline
          </motion.button>
        </div>
      </motion.div>
    </>
  )
}
