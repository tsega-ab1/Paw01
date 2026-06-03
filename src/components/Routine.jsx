import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../lib/api.js'
import MindMap from './mindmap/MindMap.jsx'
import MoodWheel from './shared/MoodWheel.jsx'
import { ACTIVITY_COLORS } from '../lib/constants.js'

const TODAY = new Date().toISOString().split('T')[0]
const DAYS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// ── expand animation (same spring as StackedCardDeck) ─────────────
const SPRING = { type:'spring', stiffness:280, damping:30, mass:0.85 }

export default function Routine({ state, navigate, isDark = true }) {
  const { routine, mapNodes, journey, refreshJourney, refreshNodes } = state
  const [todayLogs,  setTodayLogs]  = useState([])
  const [section,    setSection]    = useState('today')
  const [expanded,   setExpanded]   = useState(null)   // expanded activity id
  const [showMood,   setShowMood]   = useState(false)
  const [sharing,    setSharing]    = useState(null)
  const [shareNote,  setShareNote]  = useState('')
  const timelineRef = useRef(null)

  useEffect(() => { loadTodayLogs() }, [])

  useEffect(() => {
    if (!timelineRef.current || section !== 'today') return
    const now = new Date()
    const pct = (now.getHours() * 60 + now.getMinutes()) / (24 * 60)
    const el  = timelineRef.current
    el.scrollLeft = (el.scrollWidth - el.clientWidth) * pct
  }, [section, routine])

  async function loadTodayLogs() {
    try {
      const sum = await api.getSummary()
      setTodayLogs(sum?.today?.logs || [])
    } catch {}
  }

  async function toggleLog(activity, done) {
    const now    = new Date()
    const doneAt = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
    try {
      await api.logActivity({ activity:activity.name, activityId:activity.id, done, doneAt, date:TODAY })
      await loadTodayLogs()
      state.refreshSummary?.()
    } catch {}
  }

  async function capturePhoto(activity) {
    // Opens native camera via Flutter bridge
    window._pendingCameraActivity = { activityName: activity.name, activityId: activity.id }
    if (window.pawSend) window.pawSend('CAPTURE_PHOTO', { lens: 'back' })
    else {
      // Web fallback — file input
      const input = document.createElement('input')
      input.type   = 'file'
      input.accept = 'image/*'
      input.capture = 'environment'
      input.onchange = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = async (ev) => {
          await api.addJourney({ activity:activity.name, caption:`${activity.name} · captured`, imageData:ev.target.result })
          refreshJourney?.()
        }
        reader.readAsDataURL(file)
      }
      input.click()
    }
  }

  async function submitShare() {
    if (!sharing) return
    const lastEntry = sharing.entries[sharing.entries.length - 1]
    try {
      await api.postCommunity({
        category:    routine?.goalCategory || 'general',
        quote:       shareNote || lastEntry?.caption || `${sharing.activity.name} — Day ${routine?.currentDay || 1}`,
        weeks:       Math.ceil((routine?.currentDay || 1) / 7),
        blocks:      [1,1,0,1,1,0,1],
        title:       `${sharing.activity.name} · ${routine?.title}`,
        photo:       lastEntry?.photo || false,
        routineJSON: routine,
      })
      setSharing(null); setShareNote('')
      state.refreshCommunity?.()
    } catch {}
  }

  if (!routine) {
    return (
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:32, gap:16 }}>
        <span className="material-symbols-outlined" style={{ fontSize:56, color:'var(--text-faint)' }}>account_tree</span>
        <p style={{ textAlign:'center', color:'var(--text-muted)', fontSize:15, lineHeight:1.6 }}>
          No routine yet. Tell PAW your goal in Chat to generate one.
        </p>
        <motion.button whileTap={{ scale:0.92 }} onClick={() => navigate('chat')} style={{
          background:'var(--primary)', color:'#fff', border:'none',
          borderRadius:14, padding:'12px 24px', fontSize:15, fontWeight:600, cursor:'pointer',
        }}>Go to Chat</motion.button>
      </div>
    )
  }

  const today          = new Date()
  const dayOfWeek      = today.getDay() + 1
  const todayActivities= (routine.activities || [])
    .filter(a => (a.daysOfWeek || [1,2,3,4,5,6,7]).includes(dayOfWeek))
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  const doneCount      = todayLogs.filter(l => l.done).length
  const expandedAct    = expanded ? todayActivities.find(a => a.id === expanded) : null

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

      {/* ── Top strip ────────────────────────────────────────────── */}
      <div style={{ padding:'14px 16px 10px', background:'var(--surface)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--text)' }}>{routine.title}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
              Day {routine.currentDay || 1} of {routine.totalDays} · {DAYS[today.getDay()]}
            </div>
          </div>
          <div style={{ background:'var(--primary-soft)', border:'1px solid var(--border)', borderRadius:10, padding:'4px 10px', textAlign:'center' }}>
            <div style={{ fontSize:17, fontWeight:700, color:'var(--primary)', lineHeight:1 }}>{doneCount}/{todayActivities.length}</div>
            <div style={{ fontSize:9, color:'var(--text-muted)', textTransform:'uppercase' }}>Done</div>
          </div>
        </div>
        <WeekStrip routine={routine} today={today} />
      </div>

      {/* ── Section tabs ─────────────────────────────────────────── */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)', background:'var(--surface)', flexShrink:0 }}>
        {[{ id:'today', label:'Today', icon:'today' }, { id:'map', label:'Mind Map', icon:'account_tree' }].map(tab => (
          <motion.button key={tab.id} whileTap={{ scale:0.96 }} onClick={() => setSection(tab.id)} style={{
            flex:1, padding:'10px 8px', background:'none', border:'none', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', gap:6,
            color: section===tab.id ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: section===tab.id ? '2px solid var(--primary)' : '2px solid transparent',
            fontSize:13, fontWeight:600, transition:'color 0.2s',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize:16 }}>{tab.icon}</span>
            {tab.label}
          </motion.button>
        ))}
      </div>

      {/* ── Content ──────────────────────────────────────────────── */}
      <div className="scroll-area" style={{ flex:1 }}>
        <AnimatePresence mode="wait">

          {/* TODAY — 2-column photo card grid */}
          {section === 'today' && (
            <motion.div key="today" initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }} transition={SPRING} style={{ padding:'0 0 120px' }}>

              {/* Day Timeline */}
              <DayTimeline ref={timelineRef} activities={todayActivities} logs={todayLogs} onActivityTap={act => setExpanded(act.id)} />

              {/* 2-column photo card grid */}
              <div style={{ padding:'14px 12px 0', display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {todayActivities.length === 0 && (
                  <p style={{ gridColumn:'1/-1', textAlign:'center', color:'var(--text-muted)', fontSize:14, padding:32 }}>
                    No activities scheduled for today.
                  </p>
                )}
                {todayActivities.map((act, i) => {
                  const log      = todayLogs.find(l => l.activity === act.name)
                  const isDone   = log?.done === true
                  const actJourney = (journey || []).filter(j => j.activity === act.name)
                  const lastPhoto  = actJourney.slice().reverse().find(j => j.photo)
                  const color      = act.color || ACTIVITY_COLORS[act.type] || '#2d9e55'

                  return (
                    <motion.div
                      key={act.id}
                      layoutId={`card_${act.id}`}
                      initial={{ opacity:0, y:16 }}
                      animate={{ opacity:1, y:0 }}
                      transition={{ ...SPRING, delay: i * 0.05 }}
                      onClick={() => setExpanded(act.id)}
                      style={{
                        borderRadius: 18,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        position: 'relative',
                        aspectRatio: '3/4',
                        background: lastPhoto ? 'transparent' : color,
                        border: `1.5px solid ${isDone ? color : 'transparent'}`,
                      }}
                    >
                      {/* Photo background */}
                      {lastPhoto ? (
                        <img src={lastPhoto.photo} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }} />
                      ) : (
                        <div style={{
                          position:'absolute', inset:0,
                          background: `linear-gradient(150deg,${color} 0%,${color}cc 100%)`,
                        }}>
                          {/* Pattern overlay like StackedCardDeck */}
                          <div style={{
                            position:'absolute', inset:0,
                            background: 'radial-gradient(ellipse at 30% 30%,rgba(255,255,255,0.18) 0%,transparent 60%),radial-gradient(ellipse at 80% 80%,rgba(0,0,0,0.12) 0%,transparent 55%)',
                          }} />
                        </div>
                      )}

                      {/* Shade gradient */}
                      <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.72) 0%,rgba(0,0,0,0.1) 50%,transparent 100%)' }} />

                      {/* Done check */}
                      {isDone && (
                        <div style={{
                          position:'absolute', top:10, right:10,
                          width:26, height:26, borderRadius:'50%',
                          background: color, display:'flex', alignItems:'center', justifyContent:'center',
                          boxShadow:`0 2px 8px ${color}88`,
                        }}>
                          <span className="material-symbols-outlined fill-icon" style={{ fontSize:15, color:'#fff' }}>check</span>
                        </div>
                      )}

                      {/* Camera capture button */}
                      {!lastPhoto && (
                        <motion.button
                          whileTap={{ scale:0.88 }}
                          onClick={e => { e.stopPropagation(); capturePhoto(act) }}
                          style={{
                            position:'absolute', top:10, left:10,
                            width:30, height:30, borderRadius:'50%',
                            background:'rgba(255,255,255,0.18)', border:'1px solid rgba(255,255,255,0.3)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            cursor:'pointer', color:'#fff',
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize:15 }}>photo_camera</span>
                        </motion.button>
                      )}

                      {/* Bottom info */}
                      <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'12px 12px 14px' }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'#fff', lineHeight:1.2, marginBottom:3 }}>{act.name}</div>
                        <div style={{ fontSize:10, color:'rgba(255,255,255,0.65)', fontFamily:'"DM Mono",monospace' }}>{act.time} · {act.duration}</div>
                        {actJourney.length > 0 && (
                          <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', marginTop:3 }}>
                            {actJourney.length} moment{actJourney.length !== 1 ? 's' : ''} captured
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              {/* Mood check-in strip */}
              <motion.button
                whileTap={{ scale:0.97 }}
                onClick={() => setShowMood(true)}
                style={{
                  margin:'16px 12px 0', width:'calc(100% - 24px)',
                  background:'var(--surface)', border:'1px solid var(--border)',
                  borderRadius:16, padding:'14px 16px',
                  display:'flex', alignItems:'center', gap:12,
                  cursor:'pointer', textAlign:'left',
                }}
              >
                <span style={{ fontSize:28 }}>😊</span>
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>How are you feeling?</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)' }}>Log your mood for today</div>
                </div>
                <span className="material-symbols-outlined" style={{ marginLeft:'auto', color:'var(--text-faint)', fontSize:20 }}>chevron_right</span>
              </motion.button>
            </motion.div>
          )}

          {/* MIND MAP */}
          {section === 'map' && (
            <motion.div key="map" initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }} transition={SPRING} style={{ padding:'0 0 100px' }}>
              <div style={{ padding:'14px 16px 8px' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>Your Growth Map</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Tap any node · double-tap to collapse · pinch to zoom</div>
              </div>
              <div style={{ margin:'0 12px', borderRadius:16, overflow:'hidden', border:'1px solid var(--border)' }}>
                <MindMap nodes={mapNodes} routine={routine} journey={journey} isDark={isDark}
                  onNodeTap={node => console.log('node', node)}
                  onAddNode={async data => { await api.addNode(data); refreshNodes?.() }}
                />
              </div>

              {/* Legend */}
              <div style={{ padding:'12px 16px', display:'flex', flexWrap:'wrap', gap:10 }}>
                {[['🎯','Goal'],['📅','Week'],['📸','Moment'],['⚡','Event'],['⚠️','Dormant']].map(([icon,label]) => (
                  <div key={label} style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ fontSize:13 }}>{icon}</span>
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}>{label}</span>
                  </div>
                ))}
              </div>

              {/* Recent journey photos horizontal scroll */}
              {journey.length > 0 && (
                <div style={{ padding:'0 14px' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>
                    Recent moments
                  </div>
                  <div style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:8 }}>
                    {journey.slice(-8).reverse().map((j, i) => (
                      <motion.div key={i} initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} transition={{ delay:i*0.04 }}
                        style={{ flexShrink:0, width:120, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
                        {j.photo
                          ? <img src={j.photo} alt="" style={{ width:'100%', height:90, objectFit:'cover', display:'block' }} />
                          : <div style={{ height:60, background:'var(--surface-mid)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>📝</div>
                        }
                        <div style={{ padding:'8px 10px' }}>
                          <p style={{ fontSize:11, color:'var(--text-dim)', margin:0, lineHeight:1.4 }}>{j.caption?.slice(0,45)}</p>
                          <p style={{ fontSize:10, color:'var(--text-muted)', marginTop:4 }}>{j.activity}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Expanded card overlay (StackedCardDeck morph style) ──── */}
      <AnimatePresence>
        {expanded && expandedAct && (
          <ActivityExpanded
            activity={expandedAct}
            log={todayLogs.find(l => l.activity === expandedAct.name)}
            journalEntries={(journey || []).filter(j => j.activity === expandedAct.name)}
            onClose={() => setExpanded(null)}
            onToggleDone={(done) => { toggleLog(expandedAct, done); setExpanded(null) }}
            onCapture={() => capturePhoto(expandedAct)}
            onShare={() => {
              const entries = (journey || []).filter(j => j.activity === expandedAct.name)
              setSharing({ activity: expandedAct, entries })
              setExpanded(null)
            }}
            onJournalAdded={refreshJourney}
          />
        )}
      </AnimatePresence>

      {/* ── Mood Wheel ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showMood && (
          <MoodWheel
            question="How are you feeling today?"
            onSubmit={async (data) => {
              try { await api.logModule('mood', { rating: +(data.value * 5 / 6).toFixed(1), moodName: data.moodName }) } catch {}
            }}
            onClose={() => setShowMood(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Share sheet ───────────────────────────────────────────── */}
      <AnimatePresence>
        {sharing && (
          <ShareSheet
            post={sharing}
            note={shareNote}
            onNoteChange={setShareNote}
            onShare={submitShare}
            onClose={() => { setSharing(null); setShareNote('') }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Expanded activity overlay — StackedCardDeck morph ─────────────
function ActivityExpanded({ activity, log, journalEntries, onClose, onToggleDone, onCapture, onShare, onJournalAdded }) {
  const [caption,  setCaption]  = useState('')
  const [saving,   setSaving]   = useState(false)
  const isDone  = log?.done === true
  const color   = activity.color || ACTIVITY_COLORS[activity.type] || '#2d9e55'
  const photos  = journalEntries.filter(j => j.photo)
  const lastPhoto = photos.slice(-1)[0]

  async function saveNote() {
    if (!caption.trim()) return
    setSaving(true)
    try {
      await api.addJourney({ activity: activity.name, caption: caption.trim() })
      setCaption('')
      onJournalAdded?.()
    } catch {}
    setSaving(false)
  }

  return (
    <>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        onClick={onClose}
        style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:80, backdropFilter:'blur(4px)' }}
      />
      <motion.div
        layoutId={`card_${activity.id}`}
        initial={{ opacity:0, scale:0.92 }}
        animate={{ opacity:1, scale:1 }}
        exit={{ opacity:0, scale:0.92 }}
        transition={SPRING}
        style={{
          position:'fixed', inset:0, zIndex:90,
          display:'flex', flexDirection:'column', justifyContent:'flex-end',
          borderRadius: 28, overflow:'hidden',
          margin: 0,
        }}
      >
        {/* Background — photo or gradient */}
        {lastPhoto
          ? <img src={lastPhoto.photo} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }} />
          : <div style={{ position:'absolute', inset:0,
              background:`linear-gradient(150deg,${color} 0%,${color}99 100%)`,
            }}>
              <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 28% 28%,rgba(255,255,255,0.2) 0%,transparent 55%),radial-gradient(ellipse at 75% 75%,rgba(0,0,0,0.15) 0%,transparent 50%)' }} />
            </div>
        }
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.3) 55%,rgba(0,0,0,0.1) 100%)' }} />

        {/* Close */}
        <motion.button whileTap={{ scale:0.88 }} onClick={onClose}
          initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.15 }}
          style={{ position:'absolute', top:52, right:16, zIndex:3, width:36, height:36, borderRadius:'50%', background:'rgba(0,0,0,0.3)', border:'none', color:'#fff', fontSize:20, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
          ✕
        </motion.button>

        {/* Photo strip */}
        {photos.length > 1 && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.2 }}
            style={{ position:'absolute', top:52, left:16, display:'flex', gap:6 }}>
            {photos.slice(-4).map((p, i) => (
              <img key={i} src={p.photo} alt="" style={{ width:44, height:44, borderRadius:10, objectFit:'cover', border:'2px solid rgba(255,255,255,0.4)' }} />
            ))}
          </motion.div>
        )}

        {/* Content */}
        <div style={{ position:'relative', zIndex:2, padding:'24px 20px 40px' }}>
          <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.08 }}>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.55)', marginBottom:6, fontFamily:'"DM Mono",monospace' }}>
              {activity.time} · {activity.duration} · {activity.type}
            </div>
            <div style={{ fontSize:32, fontWeight:700, color:'#fff', lineHeight:1.1, marginBottom:6 }}>{activity.name}</div>
            {activity.why && (
              <p style={{ fontSize:14, color:'rgba(255,255,255,0.75)', lineHeight:1.65, marginBottom:20 }}>{activity.why}</p>
            )}
          </motion.div>

          {/* Note input */}
          <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.18 }} style={{ marginBottom:16 }}>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="How did this go? Add a note..."
              rows={2}
              style={{
                width:'100%', borderRadius:14, border:'1px solid rgba(255,255,255,0.2)',
                background:'rgba(255,255,255,0.1)', padding:'10px 14px',
                fontSize:14, color:'#fff', resize:'none',
                fontFamily:'"DM Sans",sans-serif', outline:'none',
                backdropFilter:'blur(8px)',
              }}
            />
          </motion.div>

          {/* Action buttons */}
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.24 }}
            style={{ display:'flex', gap:10 }}>
            {/* Done toggle */}
            <motion.button whileTap={{ scale:0.92 }} onClick={() => onToggleDone(!isDone)}
              style={{
                flex:1, padding:'13px', borderRadius:50,
                background: isDone ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.15)',
                border: isDone ? 'none' : '1.5px solid rgba(255,255,255,0.35)',
                color: isDone ? color : '#fff',
                fontSize:14, fontWeight:700, cursor:'pointer',
                letterSpacing:'0.05em',
              }}>
              {isDone ? '✓ Done' : 'Mark done'}
            </motion.button>

            {/* Camera */}
            <motion.button whileTap={{ scale:0.92 }} onClick={onCapture}
              style={{ width:50, height:50, borderRadius:'50%', background:'rgba(255,255,255,0.15)', border:'1.5px solid rgba(255,255,255,0.3)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
              <span className="material-symbols-outlined" style={{ fontSize:20 }}>photo_camera</span>
            </motion.button>

            {/* Save note */}
            {caption.trim() && (
              <motion.button whileTap={{ scale:0.92 }} onClick={saveNote} disabled={saving}
                style={{ width:50, height:50, borderRadius:'50%', background:'rgba(255,255,255,0.15)', border:'1.5px solid rgba(255,255,255,0.3)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                <span className="material-symbols-outlined" style={{ fontSize:20 }}>save</span>
              </motion.button>
            )}

            {/* Share */}
            {journalEntries.length > 0 && (
              <motion.button whileTap={{ scale:0.92 }} onClick={onShare}
                style={{ width:50, height:50, borderRadius:'50%', background:'rgba(255,255,255,0.15)', border:'1.5px solid rgba(255,255,255,0.3)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                <span className="material-symbols-outlined" style={{ fontSize:20 }}>share</span>
              </motion.button>
            )}
          </motion.div>
        </div>
      </motion.div>
    </>
  )
}

// ── Share sheet ───────────────────────────────────────────────────
function ShareSheet({ post, note, onNoteChange, onShare, onClose }) {
  return (
    <>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:120 }} />
      <motion.div initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
        transition={{ type:'spring', stiffness:320, damping:36 }}
        style={{ position:'fixed', bottom:0, left:0, right:0, background:'var(--sheet-bg)', borderRadius:'22px 22px 0 0', padding:'0 16px 40px', zIndex:130 }}>
        <div style={{ display:'flex', justifyContent:'center', padding:'10px 0' }}>
          <div style={{ width:36, height:4, borderRadius:2, background:'var(--surface-mid)' }} />
        </div>
        <div style={{ fontSize:16, fontWeight:700, color:'var(--text)', marginBottom:12 }}>Share to Community</div>
        <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:12 }}>
          Sharing <strong style={{ color:'var(--text)' }}>{post.activity.name}</strong> · {post.entries.length} entries
        </p>
        {post.entries.slice(-1)[0]?.photo && (
          <img src={post.entries.slice(-1)[0].photo} alt="" style={{ width:'100%', borderRadius:12, marginBottom:12, maxHeight:160, objectFit:'cover' }} />
        )}
        <textarea value={note} onChange={e => onNoteChange(e.target.value)} placeholder="Add a note (optional)..." rows={3}
          style={{ width:'100%', borderRadius:12, border:'1px solid var(--border)', padding:'10px 12px', fontSize:14, color:'var(--text)', background:'var(--input-bg)', resize:'none', fontFamily:'"DM Sans",sans-serif', outline:'none', marginBottom:12 }} />
        <div style={{ display:'flex', gap:10 }}>
          <motion.button whileTap={{ scale:0.92 }} onClick={onShare}
            style={{ flex:1, background:'var(--primary)', color:'#fff', border:'none', borderRadius:12, padding:'13px', fontSize:15, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            <span className="material-symbols-outlined" style={{ fontSize:18 }}>share</span>Post to Community
          </motion.button>
          <motion.button whileTap={{ scale:0.92 }} onClick={onClose}
            style={{ padding:'13px 18px', background:'var(--surface-low)', border:'none', borderRadius:12, fontSize:14, cursor:'pointer', color:'var(--text)' }}>
            Cancel
          </motion.button>
        </div>
      </motion.div>
    </>
  )
}

// ── Day Timeline ─────────────────────────────────────────────────
const DayTimeline = React.forwardRef(function DayTimeline({ activities, logs, onActivityTap }, ref) {
  const now    = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const START_H = 5, END_H = 23
  const TOTAL_M = (END_H - START_H) * 60
  const PX_PER_MIN = 3.2
  const WIDTH = TOTAL_M * PX_PER_MIN

  function toX(timeStr) {
    if (!timeStr) return 0
    const [h, m] = timeStr.split(':').map(Number)
    return ((h * 60 + (m||0)) - START_H * 60) * PX_PER_MIN
  }
  const nowX = (nowMin - START_H * 60) * PX_PER_MIN

  return (
    <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)', paddingTop:12, paddingBottom:8 }}>
      <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', padding:'0 16px', marginBottom:8 }}>
        Today's Timeline
      </div>
      <div ref={ref} style={{ overflowX:'auto', paddingBottom:4 }}>
        <div style={{ width: WIDTH + 60, height:68, position:'relative', padding:'0 20px' }}>
          <div style={{ position:'absolute', left:20, right:20, top:30, height:2, background:'var(--border)', borderRadius:1 }} />
          {Array.from({ length: END_H - START_H + 1 }, (_, i) => {
            const h = START_H + i, x = i * 60 * PX_PER_MIN
            return (
              <div key={h} style={{ position:'absolute', left:20+x, top:24, display:'flex', flexDirection:'column', alignItems:'center' }}>
                <div style={{ width:1, height:8, background:'var(--border)' }} />
                {i % 2 === 0 && <div style={{ fontSize:8, color:'var(--text-faint)', fontFamily:'"DM Mono",monospace', marginTop:2, whiteSpace:'nowrap' }}>{h>12?`${h-12}pm`:h===12?'12pm':`${h}am`}</div>}
              </div>
            )
          })}
          {activities.map((act, i) => {
            const x    = toX(act.time)
            const done = logs.find(l => l.activity === act.name)?.done
            const color = act.color || '#2d9e55'
            return (
              <motion.button key={act.id || i} initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.06 }}
                whileTap={{ scale:0.88 }} onClick={() => onActivityTap(act)}
                style={{ position:'absolute', left:20+x-14, top:0, background:'none', border:'none', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', width:28 }}>
                <div style={{ fontSize:8, color:done?color:'var(--text-muted)', whiteSpace:'nowrap', maxWidth:60, overflow:'hidden', textOverflow:'ellipsis', marginBottom:2, textAlign:'center' }}>
                  {act.name.split(' ')[0]}
                </div>
                <div style={{ width:14, height:14, borderRadius:'50%', background:done?color:'var(--surface)', border:`2px solid ${color}`, transition:'background 0.25s', zIndex:2 }} />
                <div style={{ width:1, height:8, background:color, opacity:0.5 }} />
              </motion.button>
            )
          })}
          {nowX > 0 && nowX < WIDTH && (
            <div style={{ position:'absolute', left:20+nowX, top:14, display:'flex', flexDirection:'column', alignItems:'center', zIndex:5 }}>
              <div style={{ width:2, height:20, background:'var(--primary)', borderRadius:1 }} />
              <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--primary)', marginTop:-2 }} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

// ── Week strip ────────────────────────────────────────────────────
function WeekStrip({ routine, today }) {
  const days    = ['S','M','T','W','T','F','S']
  const todayIdx = today.getDay()
  return (
    <div style={{ display:'flex', gap:4, marginTop:10 }}>
      {days.map((d, i) => {
        const isToday    = i === todayIdx
        const scheduled  = (routine.activities||[]).some(a => (a.daysOfWeek||[1,2,3,4,5,6,7]).includes(i+1))
        return (
          <div key={i} style={{
            flex:1, textAlign:'center',
            background: isToday ? 'var(--primary)' : scheduled ? 'var(--primary-soft)' : 'var(--surface-low)',
            borderRadius:8, padding:'4px 0',
          }}>
            <div style={{ fontSize:9, fontWeight:700, color: isToday ? '#fff' : 'var(--text-muted)', letterSpacing:'0.05em' }}>{d}</div>
          </div>
        )
      })}
    </div>
  )
}
