import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../lib/api.js'
import { ACTIVITY_COLORS } from '../lib/constants.js'

const DAY_LABELS = ['S','M','T','W','T','F','S']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function Calendar({ state, navigate }) {
  const { routine, summary, compare, journey } = state
  const today = new Date()
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [logs,      setLogs]      = useState([])
  const [selected,  setSelected]  = useState(null)  // selected date string 'YYYY-MM-DD'
  const [dayDetail, setDayDetail] = useState(null)   // popup data

  useEffect(() => {
    api.getCompare().then(d => {
      // Build a log map from compare data
    }).catch(() => {})

    // Load all logs for calendar coloring
    fetch('/api/data/logs-all').then(r => r.json()).then(setLogs).catch(() => {})
  }, [])

  // Build calendar grid
  const grid = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    return { cells, firstDay, daysInMonth }
  }, [viewMonth, viewYear])

  // Build score map from compare data
  const scoreMap = useMemo(() => {
    const map = {}
    if (compare?.days) {
      compare.days.forEach(d => { map[d.date] = d })
    }
    return map
  }, [compare])

  // Build activity color dots for each day from routine start
  function getDayDots(day) {
    if (!routine || !day) return []
    const date = new Date(viewYear, viewMonth, day)
    const dateStr = date.toISOString().split('T')[0]
    const dayOfWeek = date.getDay() + 1 // 1=Sunday

    // Which activities are scheduled on this day
    const scheduled = (routine.activities || []).filter(a =>
      (a.daysOfWeek || [1,2,3,4,5,6,7]).includes(dayOfWeek)
    )
    if (!scheduled.length) return []

    const score = scoreMap[dateStr]
    if (score?.logCount > 0) {
      // Show actual done colors
      const pct = score.breakdown?.completion || 0
      return scheduled.slice(0, 4).map(a => ({
        color: a.color || ACTIVITY_COLORS[a.type] || '#2d9e55',
        done: pct > 50,
      }))
    }

    const isToday = dateStr === today.toISOString().split('T')[0]
    const isPast  = date < today && !isToday

    return scheduled.slice(0, 4).map(a => ({
      color: a.color || ACTIVITY_COLORS[a.type] || '#2d9e55',
      done: false,
      faint: isPast,
    }))
  }

  function isToday(day) {
    return day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()
  }

  function isSelected(day) {
    if (!selected || !day) return false
    const [sy, sm, sd] = selected.split('-').map(Number)
    return sy === viewYear && (sm - 1) === viewMonth && sd === day
  }

  function getRoutineStartDay() {
    if (!routine?.startDate) return null
    const d = new Date(routine.startDate)
    if (d.getMonth() === viewMonth && d.getFullYear() === viewYear) return d.getDate()
    return null
  }

  async function selectDay(day) {
    if (!day) return
    const dateStr = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    setSelected(dateStr)

    // Build day detail
    const dayOfWeek = new Date(viewYear, viewMonth, day).getDay() + 1
    const scheduled = (routine?.activities || []).filter(a =>
      (a.daysOfWeek || [1,2,3,4,5,6,7]).includes(dayOfWeek)
    )
    const score     = scoreMap[dateStr]
    const dayJourney = (journey || []).filter(j => j.timestamp?.startsWith(dateStr))

    setDayDetail({ date: dateStr, day, scheduled, score, journey: dayJourney })
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1) }
    else setViewMonth(m => m-1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1) }
    else setViewMonth(m => m+1)
  }

  const routineStart = getRoutineStartDay()

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div className="scroll-area" style={{ flex:1 }}>
        <div style={{ padding:'0 0 80px' }}>

          {/* Month header */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'16px 20px 10px',
          }}>
            <motion.button whileTap={{ scale:0.88 }} onClick={prevMonth} style={navBtnStyle}>
              <span className="material-symbols-outlined" style={{ fontSize:20 }}>chevron_left</span>
            </motion.button>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:18, fontWeight:700, color:'var(--text)' }}>
                {MONTH_NAMES[viewMonth]}
              </div>
              <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'"DM Mono",monospace' }}>
                {viewYear}
                {routine && ` · ${routine.title}`}
              </div>
            </div>
            <motion.button whileTap={{ scale:0.88 }} onClick={nextMonth} style={navBtnStyle}>
              <span className="material-symbols-outlined" style={{ fontSize:20 }}>chevron_right</span>
            </motion.button>
          </div>

          {/* Summary strip */}
          {summary && (
            <div style={{
              display:'flex', gap:8, padding:'0 16px 14px', overflowX:'auto',
            }}>
              {[
                { label:'Streak', value:`${summary.streak || 0}d`, icon:'local_fire_department' },
                { label:'This Week', value:`${summary.weekRate || 0}%`, icon:'trending_up' },
                { label:'Day', value:routine ? `${routine.currentDay||1}/${routine.totalDays||30}` : '—', icon:'flag' },
              ].map(s => (
                <div key={s.label} style={{
                  flex:1, minWidth:80,
                  background:'var(--surface)',
                  border:'1px solid var(--border)',
                  borderRadius:14,
                  padding:'10px 12px',
                  textAlign:'center',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize:16, color:'var(--primary)' }}>{s.icon}</span>
                  <div style={{ fontSize:18, fontWeight:700, color:'var(--text)', lineHeight:1.2, marginTop:2 }}>{s.value}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Day labels */}
          <div style={{
            display:'grid', gridTemplateColumns:'repeat(7,1fr)',
            padding:'0 12px', marginBottom:4,
          }}>
            {DAY_LABELS.map((d,i) => (
              <div key={i} style={{
                textAlign:'center', fontSize:10, fontWeight:700,
                color:'var(--text-faint)', fontFamily:'"DM Mono",monospace',
                padding:'4px 0',
              }}>{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{
            display:'grid', gridTemplateColumns:'repeat(7,1fr)',
            padding:'0 12px', gap:'4px 0',
          }}>
            {grid.cells.map((day, idx) => {
              const dots     = getDayDots(day)
              const todayDay = isToday(day)
              const selDay   = isSelected(day)
              const score    = day ? scoreMap[`${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`] : null
              const hasDone  = score?.logCount > 0
              const pct      = score?.breakdown?.completion || 0

              return (
                <motion.button
                  key={idx}
                  whileTap={day ? { scale:0.88 } : {}}
                  onClick={() => selectDay(day)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: day ? 'pointer' : 'default',
                    padding: '3px 2px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 3,
                    borderRadius: 10,
                    position: 'relative',
                  }}
                >
                  {day && (
                    <>
                      {/* Day number circle */}
                      <div style={{
                        width: 32, height: 32,
                        borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: todayDay
                          ? 'var(--primary)'
                          : selDay
                            ? 'var(--primary-soft)'
                            : hasDone
                              ? pct > 70 ? 'rgba(45,158,85,0.15)' : 'rgba(245,158,11,0.12)'
                              : 'transparent',
                        border: selDay && !todayDay ? '1.5px solid var(--primary)' : 'none',
                        fontSize: 13,
                        fontWeight: todayDay ? 700 : 500,
                        color: todayDay ? '#fff' : 'var(--text)',
                        position: 'relative',
                        transition: 'background 0.2s',
                      }}>
                        {day}
                        {/* Routine start marker */}
                        {routineStart === day && (
                          <div style={{
                            position:'absolute', top:-3, right:-3,
                            width:8, height:8, borderRadius:'50%',
                            background:'var(--primary)', border:'2px solid var(--bg)',
                          }} />
                        )}
                      </div>

                      {/* Activity color dots */}
                      {dots.length > 0 && (
                        <div style={{ display:'flex', gap:2, justifyContent:'center', height:5 }}>
                          {dots.slice(0, 4).map((dot, di) => (
                            <div key={di} style={{
                              width: 4, height: 4, borderRadius:'50%',
                              background: dot.color,
                              opacity: dot.faint ? 0.3 : dot.done ? 1 : 0.6,
                            }} />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </motion.button>
              )
            })}
          </div>

          {/* Legend */}
          {routine && (
            <div style={{ padding:'16px 16px 0', display:'flex', flexWrap:'wrap', gap:8 }}>
              {[...new Set((routine.activities||[]).map(a => a.type))].map(type => (
                <div key={type} style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background: ACTIVITY_COLORS[type] || '#2d9e55' }} />
                  <span style={{ fontSize:11, color:'var(--text-muted)' }}>{type}</span>
                </div>
              ))}
            </div>
          )}

          {/* No routine placeholder */}
          {!routine && (
            <div style={{ textAlign:'center', padding:'40px 24px', color:'var(--text-muted)' }}>
              <span className="material-symbols-outlined" style={{ fontSize:48, display:'block', marginBottom:12 }}>calendar_month</span>
              <p style={{ fontSize:14 }}>Tell PAW your goal in Chat to generate your routine and see it mapped across the calendar.</p>
            </div>
          )}
        </div>
      </div>

      {/* Day detail popup */}
      <AnimatePresence>
        {dayDetail && (
          <DayDetailSheet
            detail={dayDetail}
            routine={routine}
            onClose={() => { setDayDetail(null); setSelected(null) }}
            onNavigate={navigate}
            onJournalAdded={state.refreshJourney}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function DayDetailSheet({ detail, routine, onClose, onNavigate, onJournalAdded }) {
  const [addingJournal, setAddingJournal] = useState(false)
  const [caption,       setCaption]       = useState('')
  const [saving,        setSaving]        = useState(false)

  const dateObj  = new Date(detail.date + 'T12:00:00')
  const dateLabel = dateObj.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })
  const score    = detail.score
  const isPast   = dateObj < new Date()

  async function saveJournal() {
    if (!caption.trim()) return
    setSaving(true)
    try {
      await api.addJourney({ activity: 'General', caption: caption.trim(), date: detail.date })
      setCaption('')
      setAddingJournal(false)
      onJournalAdded?.()
    } catch {}
    setSaving(false)
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity:0 }}
        animate={{ opacity:1 }}
        exit={{ opacity:0 }}
        onClick={onClose}
        style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:80 }}
      />
      {/* Sheet */}
      <motion.div
        initial={{ y:'100%' }}
        animate={{ y:0 }}
        exit={{ y:'100%' }}
        transition={{ type:'spring', stiffness:320, damping:36 }}
        style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          background: 'var(--sheet-bg)',
          borderRadius: '24px 24px 0 0',
          padding: '0 0 32px',
          zIndex: 90,
          maxHeight: '82vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Handle */}
        <div style={{ display:'flex', justifyContent:'center', padding:'10px 0 0' }}>
          <div style={{ width:36, height:4, borderRadius:2, background:'var(--surface-mid)' }} />
        </div>

        {/* Header */}
        <div style={{ padding:'12px 20px 0', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:'var(--text)' }}>{dateLabel}</div>
            {score && score.logCount > 0 ? (
              <div style={{ fontSize:12, color:'var(--primary)', marginTop:2 }}>
                {score.breakdown?.completion || 0}% complete · score {score.score}
              </div>
            ) : isPast ? (
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>No logs recorded</div>
            ) : (
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
                {detail.scheduled.length} activities planned
              </div>
            )}
          </div>
          <motion.button whileTap={{ scale:0.88 }} onClick={onClose} style={iconBtnStyle}>
            <span className="material-symbols-outlined">close</span>
          </motion.button>
        </div>

        <div className="scroll-area" style={{ flex:1, padding:'12px 16px 0' }}>
          {/* Score breakdown */}
          {score && score.logCount > 0 && (
            <div style={{
              display:'flex', gap:8, marginBottom:14,
              background:'var(--surface-low)', borderRadius:14, padding:'10px 12px',
            }}>
              {[
                { label:'Completion', value:`${score.breakdown?.completion||0}%` },
                { label:'Timing',     value:`${score.breakdown?.timing||0}%`     },
                { label:'Modules',    value:`${score.breakdown?.modules||0}%`    },
              ].map(b => (
                <div key={b.label} style={{ flex:1, textAlign:'center' }}>
                  <div style={{ fontSize:16, fontWeight:700, color:'var(--text)' }}>{b.value}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)' }}>{b.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Activities timeline */}
          {detail.scheduled.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>
                Schedule
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, position:'relative', paddingLeft:24 }}>
                {/* Timeline line */}
                <div style={{
                  position:'absolute', left:8, top:8, bottom:8, width:1,
                  background:'var(--border)',
                }} />
                {detail.scheduled.map((act, i) => (
                  <motion.div
                    key={act.id || i}
                    initial={{ opacity:0, x:-8 }}
                    animate={{ opacity:1, x:0 }}
                    transition={{ delay:i*0.05 }}
                    style={{
                      display:'flex', alignItems:'center', gap:10,
                      position:'relative',
                    }}
                  >
                    {/* Dot on timeline */}
                    <div style={{
                      position:'absolute', left:-20,
                      width:9, height:9, borderRadius:'50%',
                      background: act.color || ACTIVITY_COLORS[act.type] || '#2d9e55',
                      border:'2px solid var(--sheet-bg)',
                    }} />
                    <div style={{ fontFamily:'"DM Mono",monospace', fontSize:11, color:'var(--text-muted)', width:38, flexShrink:0 }}>
                      {act.time}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{act.name}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>{act.duration} · {act.type}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Journal entries for this day */}
          {detail.journey?.length > 0 && (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>
                Journal
              </div>
              {detail.journey.map((j, i) => (
                <div key={i} style={{
                  background:'var(--surface-low)', borderRadius:12,
                  padding:'10px 12px', marginBottom:8,
                }}>
                  {j.photo && (
                    <img src={j.photo} alt="" style={{ width:'100%', borderRadius:8, marginBottom:8, maxHeight:180, objectFit:'cover' }} />
                  )}
                  <p style={{ fontSize:13, color:'var(--text)', lineHeight:1.5 }}>{j.caption}</p>
                  <p style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>
                    {j.activity} · {new Date(j.timestamp).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Add journal */}
          <AnimatePresence>
            {addingJournal ? (
              <motion.div
                initial={{ opacity:0, height:0 }}
                animate={{ opacity:1, height:'auto' }}
                exit={{ opacity:0, height:0 }}
                style={{ marginBottom:12 }}
              >
                <textarea
                  autoFocus
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  placeholder="What happened today..."
                  style={{
                    width:'100%', borderRadius:12, border:'1px solid var(--border)',
                    padding:'10px 12px', fontSize:14, color:'var(--text)',
                    background:'var(--input-bg)', resize:'none', minHeight:80,
                    fontFamily:'"DM Sans",sans-serif', outline:'none',
                  }}
                />
                <div style={{ display:'flex', gap:8, marginTop:8 }}>
                  <motion.button whileTap={{ scale:0.92 }} onClick={saveJournal} disabled={saving} style={{
                    flex:1, background:'var(--primary)', color:'#fff', border:'none',
                    borderRadius:10, padding:'10px', fontSize:14, fontWeight:600, cursor:'pointer',
                  }}>
                    {saving ? 'Saving...' : 'Save'}
                  </motion.button>
                  <motion.button whileTap={{ scale:0.92 }} onClick={() => setAddingJournal(false)} style={{
                    padding:'10px 16px', background:'var(--surface-low)', border:'none',
                    borderRadius:10, fontSize:14, cursor:'pointer', color:'var(--text)',
                  }}>
                    Cancel
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.button
                whileTap={{ scale:0.95 }}
                onClick={() => setAddingJournal(true)}
                style={{
                  width:'100%', background:'var(--surface-low)', border:'1px dashed var(--border)',
                  borderRadius:12, padding:'12px', fontSize:14, color:'var(--text-muted)',
                  cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  marginBottom:12,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize:18 }}>edit_note</span>
                Add journal entry
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  )
}

const navBtnStyle = {
  background: 'var(--surface-low)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '6px 8px',
  cursor: 'pointer',
  color: 'var(--text-dim)',
  display: 'flex', alignItems: 'center',
}

const iconBtnStyle = {
  background: 'var(--surface-low)',
  border: 'none',
  borderRadius: '50%',
  padding: 6,
  cursor: 'pointer',
  color: 'var(--text-muted)',
  display: 'flex',
}
