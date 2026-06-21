import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const MOODS = [
  { name:'AWFUL',   bg:'#C0392B', text:'#7B1A10', chatR:['That sounds really hard. What happened?','You don\'t have to carry that alone.'],         thanks:{ title:'Thank you for sharing.', sub:'We\'re here, always.' },           draw:(t)=>`<ellipse cx="65" cy="62" rx="18" ry="20" fill="#7B1A10"/><ellipse cx="115" cy="62" rx="18" ry="20" fill="#7B1A10"/><path d="M52 45 L65 55" stroke="#7B1A10" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M78 45 L65 55" stroke="#7B1A10" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M102 45 L115 55" stroke="#7B1A10" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M128 45 L115 55" stroke="#7B1A10" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M55 105 Q90 82 125 105" stroke="#7B1A10" stroke-width="5" stroke-linecap="round" fill="none"/><ellipse cx="68" cy="122" rx="4" ry="7" fill="#F1A8A8" opacity="${0.4+t*0.6}"/><ellipse cx="112" cy="125" rx="4" ry="7" fill="#F1A8A8" opacity="${0.3+t*0.6}"/>` },
  { name:'SAD',     bg:'#4A55D8', text:'#1E2580', chatR:['It\'s okay to feel sad. What\'s been weighing on you?','You\'re not alone in this.'],       thanks:{ title:'Thank you for opening up.', sub:'What you feel matters deeply.' }, draw:(t)=>`<ellipse cx="62" cy="65" rx="13" ry="16" fill="#1E2580"/><ellipse cx="118" cy="65" rx="13" ry="16" fill="#1E2580"/><ellipse cx="58" cy="60" rx="5" ry="6" fill="rgba(255,255,255,0.28)"/><ellipse cx="114" cy="60" rx="5" ry="6" fill="rgba(255,255,255,0.28)"/><path d="M55 102 Q90 120 125 102" stroke="#1E2580" stroke-width="5" stroke-linecap="round" fill="none"/><ellipse cx="62" cy="87" rx="4" ry="6" fill="#8BE0FF" opacity="${t}"/><path d="M62 93 Q60 100 62 104 Q64 100 62 93" fill="#8BE0FF" opacity="${t}"/>` },
  { name:'MEH',     bg:'#D4AC30', text:'#6B5200', chatR:['Meh days happen. Anything dragging things down?','No pressure. I\'m here.'],                thanks:{ title:'Thanks for checking in.', sub:'Here\'s to a better tomorrow.' },  draw:(t)=>`<rect x="44" y="57" width="36" height="16" rx="8" fill="#6B5200"/><rect x="100" y="57" width="36" height="16" rx="8" fill="#6B5200"/><rect x="58" y="100" width="64" height="10" rx="5" fill="#6B5200"/>` },
  { name:'OKAY',    bg:'#E07B30', text:'#7A3300', chatR:['Just okay? What\'s on your mind?','Even okay days have a story.'],                           thanks:{ title:'Thanks for sharing!', sub:'Good enough is a start.' },           draw:(t)=>`<rect x="48" y="54" width="32" height="20" rx="10" fill="#7A3300"/><rect x="100" y="54" width="32" height="20" rx="10" fill="#7A3300"/><path d="M60 98 Q90 114 120 98" stroke="#7A3300" stroke-width="5" stroke-linecap="round" fill="none"/>` },
  { name:'GOOD',    bg:'#27AE60', text:'#0D4F2A', chatR:['Good is good! What made today work for you?','That energy is everything!'],                   thanks:{ title:'Love to hear it!', sub:'Keep that energy.' },                   draw:(t)=>`<ellipse cx="63" cy="62" rx="15" ry="18" fill="#0D4F2A"/><ellipse cx="117" cy="62" rx="15" ry="18" fill="#0D4F2A"/><ellipse cx="58" cy="57" rx="5" ry="6" fill="rgba(255,255,255,0.3)"/><ellipse cx="112" cy="57" rx="5" ry="6" fill="rgba(255,255,255,0.3)"/><path d="M55 95 Q90 122 125 95" stroke="#0D4F2A" stroke-width="6" stroke-linecap="round" fill="none"/><circle cx="54" cy="82" r="8" fill="#FF9E9E" opacity="0.5"/><circle cx="126" cy="82" r="8" fill="#FF9E9E" opacity="0.5"/>` },
  { name:'GREAT',   bg:'#16A085', text:'#07362C', chatR:['Yesss! What made it so great?','Something amazing happened, didn\'t it?'],                   thanks:{ title:'That\'s wonderful!', sub:'Hold onto this feeling.' },           draw:(t)=>`<ellipse cx="63" cy="60" rx="18" ry="20" fill="#07362C"/><ellipse cx="117" cy="60" rx="18" ry="20" fill="#07362C"/><ellipse cx="57" cy="53" rx="6" ry="7" fill="rgba(255,255,255,0.35)"/><ellipse cx="111" cy="53" rx="6" ry="7" fill="rgba(255,255,255,0.35)"/><path d="M50 92 Q90 128 130 92" stroke="#07362C" stroke-width="6" stroke-linecap="round" fill="none"/><circle cx="50" cy="80" r="10" fill="#FFB3B3" opacity="0.55"/><circle cx="130" cy="80" r="10" fill="#FFB3B3" opacity="0.55"/>` },
  { name:'AMAZING', bg:'#7D3C98', text:'#3D0E61', chatR:['AMAZING?! I need every detail!','You\'re literally glowing through the screen!'],            thanks:{ title:'You\'re absolutely glowing!', sub:'The universe noticed. So did we.' }, draw:(t)=>`<ellipse cx="63" cy="58" rx="20" ry="22" fill="#3D0E61"/><ellipse cx="117" cy="58" rx="20" ry="22" fill="#3D0E61"/><ellipse cx="56" cy="50" rx="7" ry="8" fill="rgba(255,255,255,0.4)"/><ellipse cx="110" cy="50" rx="7" ry="8" fill="rgba(255,255,255,0.4)"/><path d="M46 90 Q90 136 134 90" stroke="#3D0E61" stroke-width="7" stroke-linecap="round" fill="none"/><circle cx="46" cy="78" r="12" fill="#FFBDD1" opacity="0.6"/><circle cx="134" cy="78" r="12" fill="#FFBDD1" opacity="0.6"/><text x="90" y="34" text-anchor="middle" font-size="22" fill="#3D0E61" opacity="${0.5+t*0.5}">★</text>` },
]

const lerp     = (a, b, t) => a + (b - a) * t
const hx       = (h, i) => parseInt(h.slice(i, i + 2), 16)
const blendHex = (a, b, t) => `rgb(${Math.round(lerp(hx(a,1),hx(b,1),t))},${Math.round(lerp(hx(a,3),hx(b,3),t))},${Math.round(lerp(hx(a,5),hx(b,5),t))})`

function useSpring(target, K = 200, D = 22) {
  const sv  = useRef(target)
  const vel = useRef(0)
  const raf = useRef(null)
  const [display, setDisplay] = useState(target)

  useEffect(() => {
    if (raf.current) cancelAnimationFrame(raf.current)
    const tick = () => {
      const dt = 1 / 60
      const f  = K * (target - sv.current) - D * vel.current
      vel.current += f * dt
      sv.current  += vel.current * dt
      setDisplay(sv.current)
      if (Math.abs(sv.current - target) < 0.004 && Math.abs(vel.current) < 0.004) {
        sv.current = target; vel.current = 0; setDisplay(target); raf.current = null; return
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [target, K, D])

  return display
}

export default function MoodWheel({ onSubmit, onClose, question = 'How was your day?' }) {
  const [rawVal,     setRawVal]     = useState(3)
  const [showChat,   setShowChat]   = useState(false)
  const [showThanks, setShowThanks] = useState(false)
  const [chatMsgs,   setChatMsgs]   = useState([])
  const [chatInput,  setChatInput]  = useState('')
  const dialRef  = useRef(null)
  const dragging = useRef(false)
  const startX   = useRef(0)
  const startSv  = useRef(3)
  const bubbleRef = useRef(null)

  const sv      = useSpring(rawVal)
  const idx     = Math.min(6, Math.max(0, Math.round(sv)))
  const frac    = Math.max(0, Math.min(1, sv - Math.floor(sv)))
  const mood    = MOODS[idx]
  const nextMood= MOODS[Math.min(6, idx + 1)]
  const bg      = blendHex(mood.bg, nextMood.bg, frac)

  const W = 210, R = W / 2 - 3
  const angle = (sv / 6) * Math.PI
  const kx = W / 2 + R * Math.cos(Math.PI - angle)
  const ky = W / 2 - R * Math.sin(Math.PI - angle)

  const gx = e => e.touches ? e.touches[0].clientX : e.clientX

  const onKnobDown = useCallback(e => {
    dragging.current = true
    startX.current   = gx(e)
    startSv.current  = rawVal
    e.preventDefault?.()
  }, [rawVal])

  useEffect(() => {
    const onMove = e => {
      if (!dragging.current) return
      setRawVal(Math.max(0, Math.min(6, startSv.current + (gx(e) - startX.current) / 28)))
    }
    const onUp = () => {
      if (dragging.current) { dragging.current = false; setRawVal(v => Math.round(v)) }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchend', onUp)
    }
  }, [])

  const handleDialClick = e => {
    const r = dialRef.current?.getBoundingClientRect()
    if (!r) return
    const lx = e.clientX - r.left - W / 2
    const ly = W / 2 - (e.clientY - r.top)
    let a = Math.atan2(ly, lx)
    if (a < 0) a = Math.PI + a
    setRawVal(Math.round((Math.max(0, Math.min(Math.PI, a)) / Math.PI) * 6))
  }

  function addChat(text, type) {
    setChatMsgs(prev => [...prev, { text, type, id: Date.now() + Math.random() }])
    setTimeout(() => bubbleRef.current?.scrollTo({ top: bubbleRef.current.scrollHeight, behavior: 'smooth' }), 60)
  }

  function openChat() {
    setChatMsgs([{ text: mood.chatR[0], type: 'them', id: 0 }])
    setShowChat(true)
  }

  function sendChat() {
    const t = chatInput.trim()
    if (!t) return
    addChat(t, 'me')
    setChatInput('')
    const r = mood.chatR
    setTimeout(() => addChat(r[Math.floor(Math.random() * r.length)], 'them'), 700)
  }

  function handleSubmit() {
    onSubmit?.({ moodIndex: idx, moodName: mood.name, value: sv, bg })
    setShowThanks(true)
  }

  const svgContent = mood.draw(frac)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
    }}>
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.88, opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        style={{
          width: '100%', maxWidth: 390, height: '100%', maxHeight: 700,
          background: bg, color: mood.text,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          position: 'relative', overflow: 'hidden',
          borderRadius: 28,
          transition: 'background 0.25s ease',
        }}
      >
        {/* Top bar */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '18px 20px 0' }}>
          <button onClick={onClose} style={iconBtn(mood.text)}>✕</button>
          <button style={iconBtn(mood.text)}>ⓘ</button>
        </div>

        <p style={{ fontSize: 17, fontWeight: 700, textAlign: 'center', padding: '14px 28px 0', lineHeight: 1.35, color: mood.text }}>{question}</p>

        {/* Face */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="180" height="160" viewBox="0 0 180 160" style={{ overflow: 'visible' }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svgContent }} />
        </div>

        <p style={{ fontSize: 32, fontWeight: 900, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4, color: mood.text }}>{mood.name}</p>

        {/* Dial */}
        <div style={{ width: '100%', padding: '0 24px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div ref={dialRef} onClick={handleDialClick} style={{ position: 'relative', width: W, height: W / 2, cursor: 'pointer' }}>
            <svg width={W} height={W / 2} viewBox={`0 0 ${W} ${W / 2}`} style={{ position: 'absolute', top: 0, left: 0 }} aria-hidden="true">
              <path d={`M 3 ${W/2} A ${R} ${R} 0 0 1 ${W-3} ${W/2}`} fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="6" strokeLinecap="round"/>
              <path d={`M 3 ${W/2} A ${R} ${R} 0 0 1 ${kx} ${ky}`} fill="none" stroke={mood.text} strokeWidth="6" strokeLinecap="round" opacity="0.35"/>
            </svg>
            <div
              onMouseDown={onKnobDown}
              onTouchStart={onKnobDown}
              style={{
                position: 'absolute', width: 34, height: 34, borderRadius: '50%',
                background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.28)',
                cursor: 'grab', left: kx, top: ky, transform: 'translate(-50%,-50%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 10, touchAction: 'none',
              }}
            >
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(0,0,0,0.22)' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: W + 20, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', opacity: 0.55, color: mood.text }}>
            <span>AWFUL</span><span>MEH</span><span>AMAZING</span>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ width: '100%', display: 'flex', gap: 10, padding: '8px 20px 28px' }}>
          <button onClick={openChat} style={{ flex: 1, height: 46, borderRadius: 50, background: 'rgba(0,0,0,0.1)', border: '2px solid rgba(0,0,0,0.15)', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: mood.text, letterSpacing: '0.05em' }}>Add note</button>
          <button onClick={handleSubmit} style={{ flex: 1.6, height: 46, borderRadius: 50, background: 'rgba(0,0,0,0.25)', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: mood.text, letterSpacing: '0.05em' }}>Submit →</button>
        </div>

        {/* Chat overlay */}
        <AnimatePresence>
          {showChat && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', inset: 0, background: bg, color: mood.text, display: 'flex', flexDirection: 'column', zIndex: 20 }}
            >
              <button onClick={() => setShowChat(false)} style={{ alignSelf: 'flex-start', margin: '18px 0 0 18px', background: 'rgba(0,0,0,0.12)', border: 'none', borderRadius: 50, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: mood.text, letterSpacing: '0.05em' }}>← Back</button>
              <p style={{ fontSize: 16, fontWeight: 700, textAlign: 'center', padding: '10px 28px 0', lineHeight: 1.3, color: mood.text }}>Want to talk about it?</p>
              <div ref={bubbleRef} style={{ flex: 1, padding: '14px 18px 0', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
                {chatMsgs.map(m => (
                  <div key={m.id} style={{ maxWidth: '76%', padding: '11px 15px', borderRadius: 20, fontSize: 13, lineHeight: 1.5, fontWeight: 500, alignSelf: m.type === 'me' ? 'flex-end' : 'flex-start', background: m.type === 'me' ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.15)', color: m.type === 'me' ? '#222' : mood.text, borderRadius: m.type === 'me' ? '20px 20px 4px 20px' : '20px 20px 20px 4px' }}>
                    {m.text}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, padding: '10px 16px 28px' }}>
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChat()}
                  placeholder="Type something..."
                  style={{ flex: 1, height: 42, borderRadius: 50, border: '2px solid rgba(0,0,0,0.18)', background: 'rgba(255,255,255,0.18)', padding: '0 16px', fontSize: 13, outline: 'none', color: mood.text }}
                />
                <button onClick={sendChat} style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(0,0,0,0.25)', border: 'none', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: mood.text }}>→</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Thanks overlay */}
        <AnimatePresence>
          {showThanks && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', inset: 0, background: bg, color: mood.text, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 30 }}
            >
              <div style={{ width: '100%', display: 'flex', padding: '18px 20px 0' }}>
                <button onClick={() => { setShowThanks(false); onClose?.() }} style={iconBtn(mood.text)}>✕</button>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="140" height="130" viewBox="0 0 180 160" style={{ overflow: 'visible' }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: mood.draw(1) }} />
              </div>
              <p style={{ fontSize: 26, fontWeight: 900, textAlign: 'center', padding: '0 28px', lineHeight: 1.25, color: mood.text }}>{mood.thanks.title}</p>
              <p style={{ fontSize: 13, opacity: 0.65, textAlign: 'center', padding: '10px 30px 0', fontWeight: 500, lineHeight: 1.6, color: mood.text }}>{mood.thanks.sub}</p>
              <button onClick={() => { setShowThanks(false); onClose?.() }} style={{ width: 'calc(100% - 40px)', height: 50, margin: 'auto 20px 28px', borderRadius: 50, background: 'rgba(0,0,0,0.25)', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: mood.text, letterSpacing: '0.05em' }}>Continue →</button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

const iconBtn = (color) => ({
  width: 38, height: 38, borderRadius: '50%',
  background: 'rgba(0,0,0,0.12)', border: 'none',
  cursor: 'pointer', fontSize: 16, color,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
})
