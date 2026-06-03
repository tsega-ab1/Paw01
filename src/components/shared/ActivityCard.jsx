import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../lib/api.js'
import { ACTIVITY_COLORS } from '../../lib/constants.js'

export default function ActivityCard({ activity, todayLog, date, journalEntries = [], onLogToggle, onJournalAdded, onShare }) {
  const [expanded, setExpanded] = useState(false)
  const [caption,  setCaption]  = useState('')
  const [saving,   setSaving]   = useState(false)

  const color    = activity.color || ACTIVITY_COLORS[activity.type] || '#2d9e55'
  const isDone   = todayLog?.done === true
  const myJournal = journalEntries.filter(j => j.activity === activity.name)

  async function toggleDone(e) {
    e.stopPropagation()
    await onLogToggle?.(activity, !isDone)
  }

  async function saveJournal() {
    if (!caption.trim()) return
    setSaving(true)
    try {
      await api.addJourney({
        activity: activity.name,
        caption: caption.trim(),
        date: date,
      })
      setCaption('')
      onJournalAdded?.()
    } catch {}
    setSaving(false)
  }

  function openCamera(e) {
    e.stopPropagation()
    api.openCamera(activity.name, activity.id)
    // If Flutter responds, window._pendingPhoto will be set
    const checkPhoto = setInterval(() => {
      if (window._pendingPhoto?.activityId === activity.id) {
        const photo = window._pendingPhoto
        window._pendingPhoto = null
        clearInterval(checkPhoto)
        api.addJourney({
          activity: activity.name,
          caption: photo.caption || `${activity.name} · captured`,
          imageData: photo.imageData,
          date: date,
        }).then(() => onJournalAdded?.())
      }
    }, 500)
    setTimeout(() => clearInterval(checkPhoto), 60000)
  }

  return (
    <motion.div
      layout
      style={{
        background: 'var(--surface)',
        border: `1px solid ${isDone ? color + '44' : 'var(--border)'}`,
        borderRadius: 16,
        overflow: 'hidden',
        transition: 'border-color 0.3s',
      }}
    >
      {/* Color bar */}
      <div style={{ height: 3, background: color, opacity: isDone ? 1 : 0.35, transition:'opacity 0.3s' }} />

      {/* Collapsed header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px 14px',
          cursor: 'pointer',
          gap: 12,
        }}
      >
        {/* Checkbox */}
        <motion.button
          whileTap={{ scale: 0.82 }}
          onClick={toggleDone}
          style={{
            width: 26, height: 26,
            borderRadius: '50%',
            border: `2px solid ${isDone ? color : 'var(--border)'}`,
            background: isDone ? color : 'transparent',
            cursor: 'pointer',
            flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.25s',
          }}
        >
          {isDone && (
            <motion.span
              initial={{ scale:0 }} animate={{ scale:1 }}
              className="material-symbols-outlined fill-icon"
              style={{ fontSize:14, color:'#fff' }}
            >check</motion.span>
          )}
        </motion.button>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 600,
            color: isDone ? 'var(--text-muted)' : 'var(--text)',
            textDecoration: isDone ? 'line-through' : 'none',
            transition: 'all 0.25s',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{activity.name}</div>
          <div style={{ fontSize:11, color:'var(--text-muted)', display:'flex', gap:8, marginTop:2 }}>
            <span style={{ fontFamily:'"DM Mono",monospace' }}>{activity.time}</span>
            <span>{activity.duration}</span>
            <span style={{ color, fontWeight:600 }}>{activity.type}</span>
          </div>
        </div>

        {/* Journal count + expand */}
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          {myJournal.length > 0 && (
            <div style={{
              background:'var(--primary-soft)', borderRadius:10,
              padding:'2px 7px', fontSize:11, color:'var(--primary)', fontWeight:600,
            }}>
              {myJournal.length} 📸
            </div>
          )}
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            className="material-symbols-outlined"
            style={{ fontSize:18, color:'var(--text-faint)' }}
          >expand_more</motion.span>
        </div>
      </div>

      {/* Expanded body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expanded"
            initial={{ height:0, opacity:0 }}
            animate={{ height:'auto', opacity:1 }}
            exit={{ height:0, opacity:0 }}
            transition={{ type:'spring', stiffness:320, damping:34 }}
            style={{ overflow:'hidden' }}
          >
            <div style={{ padding:'0 14px 14px', display:'flex', flexDirection:'column', gap:12 }}>
              {/* Why */}
              {activity.why && (
                <p style={{
                  fontSize:12, color:'var(--text-dim)', lineHeight:1.6,
                  borderLeft:`2px solid ${color}`, paddingLeft:10, margin:0,
                }}>
                  {activity.why}
                </p>
              )}

              {/* Past journal entries */}
              {myJournal.length > 0 && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>
                    Your moments
                  </div>
                  <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:4 }}>
                    {myJournal.slice(-6).map((j, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity:0, scale:0.9 }}
                        animate={{ opacity:1, scale:1 }}
                        transition={{ delay:i*0.05 }}
                        style={{
                          flexShrink:0, width:120,
                          background:'var(--surface-low)', borderRadius:10,
                          overflow:'hidden',
                          border:'1px solid var(--border)',
                        }}
                      >
                        {j.photo ? (
                          <img src={j.photo} alt="" style={{ width:'100%', height:80, objectFit:'cover', display:'block' }} />
                        ) : (
                          <div style={{ height:40, background:'var(--surface-mid)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <span style={{ fontSize:18 }}>📝</span>
                          </div>
                        )}
                        <div style={{ padding:'6px 8px' }}>
                          <p style={{ fontSize:10, color:'var(--text-dim)', lineHeight:1.4, margin:0 }}>
                            {j.caption?.slice(0, 50)}
                          </p>
                          <p style={{ fontSize:9, color:'var(--text-muted)', marginTop:3 }}>
                            {new Date(j.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add caption */}
              <div style={{ display:'flex', gap:8 }}>
                <textarea
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  placeholder={`How did "${activity.name}" go?`}
                  rows={2}
                  style={{
                    flex:1, borderRadius:10, border:'1px solid var(--border)',
                    padding:'8px 10px', fontSize:13, color:'var(--text)',
                    background:'var(--input-bg)', resize:'none',
                    fontFamily:'"DM Sans",sans-serif', outline:'none',
                  }}
                />
              </div>

              {/* Action buttons */}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {/* Camera */}
                <motion.button
                  whileTap={{ scale:0.92 }}
                  onClick={openCamera}
                  style={actionBtnStyle}
                >
                  <span className="material-symbols-outlined" style={{ fontSize:15 }}>photo_camera</span>
                  Capture
                </motion.button>

                {/* Save journal */}
                {caption.trim() && (
                  <motion.button
                    whileTap={{ scale:0.92 }}
                    onClick={saveJournal}
                    disabled={saving}
                    style={{ ...actionBtnStyle, background:'var(--primary)', color:'#fff', border:'none' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize:15 }}>save</span>
                    {saving ? 'Saving...' : 'Save note'}
                  </motion.button>
                )}

                {/* Share to community */}
                {myJournal.length > 0 && (
                  <motion.button
                    whileTap={{ scale:0.92 }}
                    onClick={() => onShare?.(activity, myJournal)}
                    style={{ ...actionBtnStyle, marginLeft:'auto' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize:15 }}>share</span>
                    Share journey
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

const actionBtnStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  padding: '7px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface-low)',
  color: 'var(--text-dim)',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
}
