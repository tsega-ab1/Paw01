import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../lib/api.js'
import MoodWheel from './shared/MoodWheel.jsx'

// ── PAW Energy Score ──────────────────────────────────────────────
// Transparent formula: sleep 35% + steps 25% + screen 20% + mood 20%
function calcEnergyScore({ sleep_hours = 0, steps = 0, passive_minutes = 0, mood = 0 }) {
  const sleep  = Math.min(100, (sleep_hours / 8) * 100)
  const stepsS = Math.min(100, (steps / 8000) * 100)
  const screen = Math.max(0, 100 - passive_minutes / 2)
  const moodS  = (mood / 5) * 100
  return Math.round(sleep * 0.35 + stepsS * 0.25 + screen * 0.20 + moodS * 0.20)
}

function energyLabel(score) {
  if (score >= 85) return { label: 'Peak',    color: '#2d9e55' }
  if (score >= 65) return { label: 'Good',    color: '#f59e0b' }
  if (score >= 45) return { label: 'Low',     color: '#f97316' }
  return                  { label: 'Depleted',color: '#ef4444' }
}

export default function Profile({ state }) {
  const { profile, setProfile, summary } = state

  const [editing,    setEditing]    = useState(false)
  const [form,       setForm]       = useState({ name: '', field: '' })
  const [moduleData, setModuleData] = useState({})
  const [logForm,    setLogForm]    = useState({})
  const [saving,     setSaving]     = useState(false)
  const [analyses,   setAnalyses]   = useState([])
  const [showMood,   setShowMood]   = useState(false)
  const [analysing,  setAnalysing]  = useState(false)

  // ── Live native health data ───────────────────────────────────────
  const [liveHealth, setLiveHealth] = useState(window._pawHealthData || null)
  const [liveSteps,  setLiveSteps]  = useState(window._pawSteps?.steps || 0)
  const [liveUsage,  setLiveUsage]  = useState(window._pawUsageData || null)

  useEffect(() => {
    const onHealth = (e) => setLiveHealth(e.detail)
    const onSteps  = (e) => setLiveSteps(e.detail?.steps || 0)
    const onUsage  = (e) => setLiveUsage(e.detail)
    window.addEventListener('paw:health:react', onHealth)
    window.addEventListener('paw:steps:react',  onSteps)
    window.addEventListener('paw:usage:react',  onUsage)
    return () => {
      window.removeEventListener('paw:health:react', onHealth)
      window.removeEventListener('paw:steps:react',  onSteps)
      window.removeEventListener('paw:usage:react',  onUsage)
    }
  }, [])

  useEffect(() => {
    setForm({ name: profile?.name || '', field: profile?.field || '' })
    loadModuleData()
    api.getAnalyses().then(setAnalyses).catch(() => {})
  }, [profile])

  async function loadModuleData() {
    try {
      const sum = await api.getSummary()
      setModuleData(sum?.today?.modules || {})
    } catch {}
  }

  async function saveProfile() {
    setSaving(true)
    try {
      await api.saveProfile(form)
      setProfile(prev => ({ ...prev, ...form }))
      setEditing(false)
    } catch {}
    setSaving(false)
  }

  async function logModule(moduleId) {
    const data = logForm[moduleId] || {}
    if (!Object.keys(data).filter(k => data[k] != null).length) return
    setSaving(true)
    try {
      await api.logModule(moduleId, data)
      setLogForm(prev => ({ ...prev, [moduleId]: {} }))
      loadModuleData()
    } catch {}
    setSaving(false)
  }

  async function requestSync() {
    if (window.pawSend) {
      window.pawSend('GET_HEALTH_DATA')
      window.pawSend('GET_STEPS')
      window.pawSend('GET_USAGE_SUMMARY')
    }
  }

  // ── Compute energy score from best available data ─────────────────
  const healthSrc  = liveHealth || moduleData?.health || {}
  const moodSrc    = moduleData?.mood || {}
  const usageSrc   = liveUsage  || moduleData?.screen_time || {}
  const energyScore = calcEnergyScore({
    sleep_hours:      healthSrc.sleep_hours      || 0,
    steps:            liveSteps || healthSrc.steps || 0,
    passive_minutes:  usageSrc.passive_minutes   || 0,
    mood:             moodSrc.rating             || 0,
  })
  const { label: energyLbl, color: energyColor } = energyLabel(energyScore)

  const avatarLetter = (profile?.name || 'U')[0].toUpperCase()

  // ── Live data tiles ───────────────────────────────────────────────
  const LIVE_TILES = [
    {
      icon: '👣', label: 'Steps',
      value: (liveSteps || healthSrc.steps || 0).toLocaleString(),
      sub:   `${((liveSteps || 0) / 8000 * 100).toFixed(0)}% of goal`,
      color: '#2d9e55',
      live:  !!window._pawSteps,
    },
    {
      icon: '😴', label: 'Sleep',
      value: healthSrc.sleep_hours ? `${Math.floor(healthSrc.sleep_hours)}h ${Math.round((healthSrc.sleep_hours % 1) * 60)}m` : '—',
      sub:   healthSrc.sleep_hours >= 7 ? 'On target' : healthSrc.sleep_hours > 0 ? 'Below target' : 'No data yet',
      color: '#6366f1',
      live:  !!liveHealth,
    },
    {
      icon: '❤️', label: 'Resting HR',
      value: healthSrc.resting_hr ? `${healthSrc.resting_hr} bpm` : '—',
      sub:   healthSrc.resting_hr ? (healthSrc.resting_hr < 70 ? 'Excellent' : 'Normal') : 'Tap to measure',
      color: '#ef4444',
      live:  !!liveHealth,
    },
    {
      icon: '🔥', label: 'Calories',
      value: healthSrc.calories ? `${healthSrc.calories}` : '—',
      sub:   'Active today',
      color: '#f97316',
      live:  !!liveHealth,
    },
    {
      icon: '📱', label: 'Screen Time',
      value: usageSrc.screen_time_minutes ? `${Math.floor(usageSrc.screen_time_minutes / 60)}h ${usageSrc.screen_time_minutes % 60}m` : '—',
      sub:   usageSrc.top_app ? `Most: ${usageSrc.top_app}` : 'Today total',
      color: '#7c3aed',
      live:  !!liveUsage,
    },
    {
      icon: '⚡', label: 'Energy Score',
      value: `${energyScore}`,
      sub:   energyLbl,
      color: energyColor,
      live:  energyScore > 0,
    },
  ]

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div className="scroll-area" style={{ flex:1, padding:'0 0 100px' }}>

        {/* Profile header */}
        <div style={{ background:'var(--primary)', padding:'28px 20px 24px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div style={{
              width:64, height:64, borderRadius:'50%',
              background:'rgba(255,255,255,0.2)', border:'2px solid rgba(255,255,255,0.4)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:'"Playfair Display",serif', fontStyle:'italic',
              fontSize:28, color:'#fff', fontWeight:700,
            }}>{avatarLetter}</div>

            <div style={{ flex:1 }}>
              {editing ? (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Your name"
                    style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)', borderRadius:8, padding:'6px 10px', fontSize:14, color:'#fff', fontFamily:'"DM Sans",sans-serif', outline:'none' }} />
                  <input value={form.field} onChange={e => setForm(f => ({ ...f, field: e.target.value }))} placeholder="Field / Occupation"
                    style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)', borderRadius:8, padding:'6px 10px', fontSize:13, color:'#fff', fontFamily:'"DM Sans",sans-serif', outline:'none' }} />
                  <div style={{ display:'flex', gap:8 }}>
                    <motion.button whileTap={{ scale:0.92 }} onClick={saveProfile} style={{ background:'rgba(255,255,255,0.25)', border:'none', borderRadius:8, padding:'6px 16px', fontSize:13, color:'#fff', cursor:'pointer', fontWeight:600 }}>
                      {saving ? 'Saving...' : 'Save'}
                    </motion.button>
                    <motion.button whileTap={{ scale:0.92 }} onClick={() => setEditing(false)} style={{ background:'transparent', border:'1px solid rgba(255,255,255,0.3)', borderRadius:8, padding:'6px 14px', fontSize:13, color:'#fff', cursor:'pointer' }}>
                      Cancel
                    </motion.button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize:20, fontWeight:700, color:'#fff' }}>{profile?.name || 'Set your name'}</div>
                  <div style={{ fontSize:13, color:'rgba(255,255,255,0.75)', marginTop:3 }}>{profile?.field || 'Add your field'}</div>
                </>
              )}
            </div>

            {!editing && (
              <motion.button whileTap={{ scale:0.88 }} onClick={() => setEditing(true)} style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:10, padding:7, cursor:'pointer', color:'#fff', display:'flex' }}>
                <span className="material-symbols-outlined" style={{ fontSize:18 }}>edit</span>
              </motion.button>
            )}
          </div>
        </div>

        {/* Streak strip */}
        {summary && (
          <div style={{ display:'flex', gap:8, padding:'14px 14px 0' }}>
            {[
              { icon:'local_fire_department', label:'Streak',    value:`${summary.streak||0}d`,  color:'#ef4444' },
              { icon:'trending_up',           label:'Week Rate', value:`${summary.weekRate||0}%`, color:'#2d9e55' },
              { icon:'check_circle',          label:'Today',     value:`${(summary.today?.logs||[]).filter(l=>l.done).length} done`, color:'#6366f1' },
            ].map(s => (
              <div key={s.label} style={{ flex:1, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:'10px 8px', textAlign:'center' }}>
                <span className="material-symbols-outlined fill-icon" style={{ fontSize:20, color:s.color, display:'block', marginBottom:3 }}>{s.icon}</span>
                <div style={{ fontSize:17, fontWeight:700, color:'var(--text)', lineHeight:1.1 }}>{s.value}</div>
                <div style={{ fontSize:9, color:'var(--text-muted)', marginTop:2, textTransform:'uppercase', letterSpacing:'0.07em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Live health tiles */}
        <div style={{ padding:'14px 14px 0' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>
              Health Dashboard
            </div>
            <motion.button whileTap={{ scale:0.88 }} onClick={requestSync} style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:4, color:'var(--primary)', fontSize:11, fontWeight:600 }}>
              <span className="material-symbols-outlined" style={{ fontSize:14 }}>sync</span>
              Sync
            </motion.button>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
            {LIVE_TILES.map(tile => (
              <motion.div
                key={tile.label}
                initial={{ opacity:0, y:8 }}
                animate={{ opacity:1, y:0 }}
                style={{
                  background:'var(--surface)', border:`1px solid ${tile.color}22`,
                  borderRadius:14, padding:'12px 10px', textAlign:'center',
                  position:'relative',
                }}
              >
                {tile.live && (
                  <motion.div
                    animate={{ opacity:[1,0.3,1] }}
                    transition={{ duration:2, repeat:Infinity }}
                    style={{ position:'absolute', top:6, right:6, width:5, height:5, borderRadius:'50%', background:tile.color }}
                  />
                )}
                <div style={{ fontSize:20, marginBottom:4 }}>{tile.icon}</div>
                <div style={{ fontSize:15, fontWeight:700, color:tile.color, lineHeight:1.1 }}>{tile.value}</div>
                <div style={{ fontSize:9, color:'var(--text-muted)', marginTop:3, textTransform:'uppercase', letterSpacing:'0.06em' }}>{tile.label}</div>
                <div style={{ fontSize:9, color:'var(--text-faint)', marginTop:1 }}>{tile.sub}</div>
              </motion.div>
            ))}
          </div>

          {/* Energy score explanation */}
          {energyScore > 0 && (
            <div style={{ background:`${energyColor}10`, border:`1px solid ${energyColor}30`, borderRadius:12, padding:'10px 14px', marginTop:10 }}>
              <div style={{ fontSize:12, fontWeight:700, color:energyColor, marginBottom:4 }}>
                ⚡ Energy {energyScore} · {energyLbl}
              </div>
              <div style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.6 }}>
                Sleep {Math.round(Math.min(100, (healthSrc.sleep_hours||0)/8*100))}% ·
                Steps {Math.round(Math.min(100, (liveSteps||0)/8000*100))}% ·
                Screen {Math.round(Math.max(0,100-(usageSrc.passive_minutes||0)/2))}% ·
                Mood {Math.round(((moodSrc.rating||0)/5)*100)}%
              </div>
            </div>
          )}
        </div>

        {/* App usage breakdown (from Digital Wellbeing) */}
        {liveUsage?.app_usage?.length > 0 && (
          <div style={{ padding:'14px 14px 0' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>
              App Usage Today
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {liveUsage.app_usage.slice(0, 5).map((app, i) => {
                const pct = Math.min(100, (app.minutes_used / Math.max(1, liveUsage.screen_time_minutes)) * 100)
                return (
                  <div key={i} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'8px 12px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                      <span style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{app.app_name}</span>
                      <span style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'"DM Mono",monospace' }}>
                        {app.minutes_used}m
                      </span>
                    </div>
                    <div style={{ height:4, background:'var(--surface-mid)', borderRadius:2, overflow:'hidden' }}>
                      <motion.div
                        initial={{ width:0 }}
                        animate={{ width:`${pct}%` }}
                        transition={{ duration:0.8, delay:i*0.1 }}
                        style={{ height:'100%', background:'#7c3aed', borderRadius:2 }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Manual log fallback (when no native data) */}
        {!liveHealth && (
          <div style={{ padding:'14px 14px 0' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>
              Log Manually
            </div>
            {[
              { id:'health',      name:'Health',      keys:[{key:'steps',label:'Steps'},{key:'sleep_hours',label:'Sleep hrs'}] },
              { id:'mood',        name:'Mood',        keys:[{key:'rating',label:'Rating /5'}] },
              { id:'screen_time', name:'Screen Time', keys:[{key:'total_minutes',label:'Total min'}] },
            ].map(mod => (
              <div key={mod.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:'12px 14px', marginBottom:10 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:10 }}>{mod.name}</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
                  {mod.keys.map(k => (
                    <input key={k.key} type="number" placeholder={k.label}
                      value={(logForm[mod.id] || {})[k.key] || ''}
                      onChange={e => setLogForm(prev => ({ ...prev, [mod.id]: { ...prev[mod.id], [k.key]: e.target.value ? Number(e.target.value) : undefined } }))}
                      style={{ width:100, borderRadius:8, border:'1px solid var(--border)', padding:'7px 10px', fontSize:13, color:'var(--text)', background:'var(--input-bg)', outline:'none', fontFamily:'"DM Mono",monospace' }}
                    />
                  ))}
                </div>
                <motion.button whileTap={{ scale:0.92 }} onClick={() => logModule(mod.id)}
                  style={{ background:'var(--primary-soft)', border:'1px solid var(--border)', borderRadius:8, padding:'7px 14px', fontSize:12, color:'var(--primary)', fontWeight:600, cursor:'pointer' }}>
                  Log
                </motion.button>
              </div>
            ))}
          </div>
        )}

        {/* Mood wheel trigger */}
        <div style={{ padding:'0 14px' }}>
          <motion.button whileTap={{ scale:0.96 }} onClick={() => setShowMood(true)} style={{
            width:'100%', background:'var(--surface)', border:'1px solid var(--border)',
            borderRadius:14, padding:'14px', fontSize:15, fontWeight:600, cursor:'pointer',
            color:'var(--text)', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          }}>
            <span style={{ fontSize:20 }}>😊</span> How was your day?
          </motion.button>
        </div>

        {/* Recent analyses */}
        {analyses.length > 0 && (
          <div style={{ padding:'14px 14px 0' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>
              PAW Insights
            </div>
            {analyses.slice(-2).reverse().map((a, i) => (
              <div key={i} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:'12px 14px', marginBottom:10 }}>
                <p style={{ fontSize:13, color:'var(--text-dim)', lineHeight:1.6, margin:0 }}>{a.analysis}</p>
                <p style={{ fontSize:10, color:'var(--text-faint)', marginTop:8 }}>
                  {new Date(a.date).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Analyse button */}
        <div style={{ padding:'14px' }}>
          <motion.button whileTap={{ scale:0.96 }} disabled={analysing}
            onClick={async () => {
              setAnalysing(true)
              try { const r = await api.analyse(); setAnalyses(prev => [...prev, r]) } catch {}
              setAnalysing(false)
            }}
            style={{
              width:'100%', background: analysing ? 'var(--surface-mid)' : 'var(--primary)',
              color: analysing ? 'var(--text-muted)' : '#fff',
              border:'none', borderRadius:14, padding:'14px',
              fontSize:15, fontWeight:600, cursor: analysing ? 'default' : 'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              transition:'background 0.2s',
            }}>
            <span className="material-symbols-outlined" style={{ fontSize:18 }}>psychology</span>
            {analysing ? 'Analysing...' : 'Ask PAW to analyse my week'}
          </motion.button>
        </div>
      </div>

      {/* Mood Wheel overlay */}
      <AnimatePresence>
        {showMood && (
          <MoodWheel
            question="How was your day?"
            onSubmit={async (data) => {
              try {
                await api.logModule('mood', {
                  rating:   +(data.value * 5 / 6).toFixed(1),
                  moodName: data.moodName,
                })
                loadModuleData()
              } catch {}
            }}
            onClose={() => setShowMood(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
