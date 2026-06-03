import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const URGE_TOOLS = [
  { id:'breathe',  icon:'🌬️', label:'Box Breathing',    color:'#06b6d4', desc:'4-4-4-4 breath. Activates parasympathetic. Proven to reduce urge intensity by 40% within 90 seconds.' },
  { id:'surf',     icon:'🌊', label:'Urge Surfing',      color:'#6366f1', desc:'Observe the urge as a wave. Don\'t fight it — watch it peak and fall. Most urges peak at 20 minutes then drop.' },
  { id:'cold',     icon:'🧊', label:'Cold Water Face',   color:'#7c3aed', desc:'Splash cold water on your face. Triggers the dive reflex — heart rate drops, focus sharpens immediately.' },
  { id:'move',     icon:'🏃', label:'5-Min Walk',        color:'#2d9e55', desc:'Movement floods the brain with dopamine. Even 5 minutes outside disrupts the urge cycle.' },
  { id:'call',     icon:'📞', label:'Call Someone',      color:'#f59e0b', desc:'Social connection overrides the craving circuit. It doesn\'t have to be about the urge. Just connect.' },
  { id:'write',    icon:'✍️', label:'Write it Out',      color:'#ec4899', desc:'Write what you feel right now without editing. The act of naming the urge reduces its grip.' },
]

const STORIES = [
  { name:'Marcus', years:6,  from:'Alcohol',   story:'Day 1 I couldn\'t imagine a week. Day 7 I couldn\'t imagine a month. Year 1 changed everything. The person I am today wasn\'t built in a moment — he was built in a thousand moments of choosing differently.', loc:'Nairobi' },
  { name:'Amina',  years:3,  from:'Substances', story:'Recovery gave me back my mornings. I\'d forgotten what it felt like to wake up and just be. Now I run at 6am. The same energy that fed the addiction now feeds my life.', loc:'Addis Ababa' },
  { name:'James',  years:8,  from:'Gambling',   story:'I thought I\'d lost everything. The recovery community showed me I\'d lost things I could rebuild. Eight years later I\'m helping others do the same.', loc:'Kampala' },
  { name:'Sana',   years:2,  from:'Social media addiction', story:'I was scrolling 9 hours a day. PAW helped me see the pattern. Now I have a screen time routine and I\'ve reclaimed 3 hours a day — time I spend with my kids.', loc:'Addis Ababa' },
]

const EDUCATION = [
  { title:'Why urges feel so powerful', content:'The brain releases dopamine in anticipation, not just during use. This is why "just this once" thinking is dangerous — your brain has already rewarded you for the decision before you act.', icon:'🧠' },
  { title:'The 90-second rule', content:'Research by neuroscientist Jill Bolte Taylor shows any emotional wave, including urges, naturally dissolves within 90 seconds if you don\'t feed it. Sit with it. Let it pass.', icon:'⏱️' },
  { title:'Cravings vs triggers', content:'A craving is a feeling. A trigger is what caused it. Most people fight the craving but ignore the trigger. Ask: what happened in the 30 minutes before this urge appeared?', icon:'🔑' },
  { title:'The HALT check', content:'Most relapses happen when you\'re Hungry, Angry, Lonely, or Tired. Before acting on an urge, check your HALT status. Often it\'s not the substance you need — it\'s sleep, food, or connection.', icon:'✋' },
]

const SECTIONS = ['SOS', 'Stories', 'Education', 'Progress']

export default function RecoveryHub({ state }) {
  const [section, setSection] = useState('SOS')
  const [breathing, setBreathing] = useState(false)
  const [phase, setPhase] = useState('inhale')  // inhale|hold|exhale|hold2
  const [phaseCount, setPhaseCount] = useState(4)
  const breathRef = React.useRef(null)

  function startBreathing() {
    setBreathing(true)
    const phases = ['inhale','hold','exhale','hold2']
    let pi = 0, count = 4
    setPhase('inhale'); setPhaseCount(4)

    breathRef.current = setInterval(() => {
      count--
      setPhaseCount(count)
      if (count === 0) {
        pi = (pi + 1) % 4
        count = 4
        setPhase(phases[pi])
        setPhaseCount(4)
      }
    }, 1000)

    setTimeout(() => { clearInterval(breathRef.current); setBreathing(false) }, 90000)
  }

  function stopBreathing() {
    clearInterval(breathRef.current)
    setBreathing(false)
  }

  const phaseLabel = { inhale:'Breathe in', hold:'Hold', exhale:'Breathe out', hold2:'Hold' }
  const phaseColor = { inhale:'#06b6d4', hold:'#6366f1', exhale:'#2d9e55', hold2:'#6366f1' }

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--bg)' }}>

      {/* Header */}
      <div style={{ padding:'14px 16px 10px', background:'var(--surface)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        <div style={{ fontSize:18, fontWeight:700, color:'var(--text)', marginBottom:2 }}>
          🌊 Recovery Hub
        </div>
        <div style={{ fontSize:12, color:'var(--text-muted)' }}>
          Tools, stories, and understanding — always available
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)', background:'var(--surface)', flexShrink:0 }}>
        {SECTIONS.map(s => (
          <motion.button key={s} whileTap={{ scale:0.96 }} onClick={() => setSection(s)} style={{
            flex:1, padding:'10px 4px', background:'none', border:'none', cursor:'pointer',
            fontSize:11, fontWeight:700, letterSpacing:'0.04em', textTransform:'uppercase',
            color: section===s ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: section===s ? '2px solid var(--primary)' : '2px solid transparent',
            transition:'color 0.2s',
          }}>{s}</motion.button>
        ))}
      </div>

      <div className="scroll-area" style={{ flex:1 }}>
        <AnimatePresence mode="wait">
          {/* SOS — immediate urge tools */}
          {section === 'SOS' && (
            <motion.div key="sos" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} style={{ padding:'14px 14px 100px' }}>

              {/* Emergency breathing overlay */}
              <AnimatePresence>
                {breathing && (
                  <motion.div
                    initial={{ opacity:0, scale:0.9 }}
                    animate={{ opacity:1, scale:1 }}
                    exit={{ opacity:0, scale:0.9 }}
                    style={{ position:'fixed', inset:0, background:'rgba(6,6,14,0.97)', zIndex:200, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:32 }}
                  >
                    <div style={{ fontSize:14, color:'rgba(255,255,255,0.5)', letterSpacing:'0.12em', textTransform:'uppercase' }}>Box Breathing</div>
                    <motion.div
                      animate={{ scale: phase==='inhale' ? [1,1.4] : phase==='exhale' ? [1.4,1] : 1.4 }}
                      transition={{ duration: 4, ease:'easeInOut' }}
                      style={{ width:160, height:160, borderRadius:'50%', background:'rgba(6,182,212,0.15)', border:'1.5px solid rgba(6,182,212,0.5)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}
                    >
                      <div style={{ fontSize:32, fontWeight:900, color:'#67e8f9' }}>{phaseCount}</div>
                      <div style={{ fontSize:13, color:'rgba(255,255,255,0.6)', marginTop:4 }}>{phaseLabel[phase]}</div>
                    </motion.div>
                    <motion.button whileTap={{ scale:0.92 }} onClick={stopBreathing} style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:20, padding:'10px 24px', fontSize:13, color:'rgba(255,255,255,0.6)', cursor:'pointer' }}>
                      Stop
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:16, padding:'14px 16px', marginBottom:16 }}>
                <div style={{ fontSize:15, fontWeight:700, color:'#fca5a5', marginBottom:4 }}>🆘 Urge right now?</div>
                <p style={{ fontSize:13, color:'rgba(255,255,255,0.6)', lineHeight:1.6, margin:0 }}>
                  Choose any tool below. Most urges peak and fall within 20 minutes. You just have to outlast the wave.
                </p>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {URGE_TOOLS.map(tool => (
                  <motion.button
                    key={tool.id}
                    whileTap={{ scale:0.97 }}
                    onClick={() => { if (tool.id==='breathe') startBreathing() }}
                    style={{
                      background:'var(--surface)', border:`1px solid ${tool.color}30`,
                      borderRadius:14, padding:'14px 16px', cursor:'pointer', textAlign:'left', width:'100%',
                      display:'flex', alignItems:'flex-start', gap:14,
                    }}
                  >
                    <span style={{ fontSize:24, flexShrink:0, marginTop:2 }}>{tool.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:tool.color, marginBottom:4 }}>{tool.label}</div>
                      <div style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.6 }}>{tool.desc}</div>
                    </div>
                    {tool.id === 'breathe' && (
                      <div style={{ flexShrink:0, background:`${tool.color}20`, color:tool.color, borderRadius:8, padding:'4px 8px', fontSize:10, fontWeight:700 }}>
                        START
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Stories */}
          {section === 'Stories' && (
            <motion.div key="stories" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} style={{ padding:'14px 14px 100px', display:'flex', flexDirection:'column', gap:14 }}>
              <p style={{ fontSize:13, color:'var(--text-muted)', lineHeight:1.6 }}>
                Real stories from real people. Recovery is possible. These voices prove it.
              </p>
              {STORIES.map((s,i) => (
                <motion.div key={i} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.06 }}
                  style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:'16px' }}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:'var(--primary-soft)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:'var(--primary)' }}>
                      {s.name[0]}
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{s.name} · {s.loc}</div>
                      <div style={{ fontSize:11, color:'var(--primary)' }}>{s.years} years free from {s.from}</div>
                    </div>
                  </div>
                  <p style={{ fontSize:13, color:'var(--text-dim)', lineHeight:1.75, margin:0, fontStyle:'italic' }}>
                    "{s.story}"
                  </p>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Education */}
          {section === 'Education' && (
            <motion.div key="edu" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} style={{ padding:'14px 14px 100px', display:'flex', flexDirection:'column', gap:12 }}>
              <p style={{ fontSize:13, color:'var(--text-muted)', lineHeight:1.6 }}>
                Understanding what happens in your brain during urges removes some of their power.
              </p>
              {EDUCATION.map((e,i) => (
                <motion.div key={i} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.05 }}
                  style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:'14px 16px' }}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                    <span style={{ fontSize:22 }}>{e.icon}</span>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>{e.title}</div>
                  </div>
                  <p style={{ fontSize:13, color:'var(--text-dim)', lineHeight:1.7, margin:0 }}>{e.content}</p>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Progress */}
          {section === 'Progress' && (
            <motion.div key="prog" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} style={{ padding:'14px 14px 100px' }}>
              <div style={{ textAlign:'center', padding:'32px 24px', color:'var(--text-muted)' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>🌱</div>
                <div style={{ fontSize:16, fontWeight:700, color:'var(--text)', marginBottom:8 }}>
                  Every day counts
                </div>
                <p style={{ fontSize:13, lineHeight:1.7 }}>
                  Your recovery progress integrates with the main calendar and routine screens. Every logged day is a brick in the wall.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
