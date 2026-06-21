import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const HEALTH_DIMENSIONS = [
  { id:'mental',       icon:'🧠', label:'Mental',       desc:'Focus, learning, clarity of thought' },
  { id:'social',       icon:'🤝', label:'Social',       desc:'Relationships, community, belonging' },
  { id:'physical',     icon:'💪', label:'Physical',     desc:'Movement, nutrition, sleep, body' },
  { id:'psychological',icon:'🌱', label:'Psychological', desc:'Emotions, resilience, self-awareness' },
  { id:'spiritual',    icon:'🤲', label:'Spiritual',    desc:'Purpose, meaning, faith, inner peace' },
]

const INTEREST_CHIPS = [
  '📚 Reading', '🎵 Music', '🎨 Art', '🏃 Running', '🧘 Yoga',
  '💻 Tech', '🌿 Nature', '✍️ Writing', '🍳 Cooking', '🎭 Theatre',
  '🏋️ Gym', '🎮 Gaming', '📸 Photography', '🌍 Travel', '🎯 Productivity',
]

const STEPS = ['welcome', 'dimensions', 'interests', 'location', 'done']

export default function Onboarding({ onComplete }) {
  const [step,       setStep]       = useState(0)
  const [name,       setName]       = useState('')
  const [dims,       setDims]       = useState([])
  const [interests,  setInterests]  = useState([])
  const [locationOk, setLocationOk] = useState(null)

  function toggleDim(id) {
    setDims(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id])
  }
  function toggleInterest(i) {
    setInterests(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])
  }

  function next() {
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else finish()
  }

  function finish() {
    const prefs = { name, dimensions: dims, interests, locationConsent: locationOk }
    if (name) {
      fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).catch(() => {})
    }
    // Save all prefs to server so PAW's system prompt has them
    fetch('/api/profile/prefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dimensions: dims, interests, locationConsent: locationOk }),
    }).catch(() => {})
    onComplete(prefs)
  }

  function requestLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => setLocationOk(true),
        () => setLocationOk(false)
      )
    } else setLocationOk(false)
  }

  const current = STEPS[step]

  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(160deg,#0f1f14 0%,#1a3a28 60%,#1f4d35 100%)',
      color: '#e8faf0', overflow: 'hidden',
    }}>
      {/* Progress dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '24px 20px 0' }}>
        {STEPS.map((_, i) => (
          <motion.div key={i}
            animate={{ width: i === step ? 24 : 8, background: i <= step ? '#7fda91' : 'rgba(255,255,255,0.2)' }}
            style={{ height: 8, borderRadius: 4 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ type: 'spring', stiffness: 340, damping: 30 }}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '32px 24px 24px', overflow: 'hidden' }}
        >
          {current === 'welcome' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 24 }}>
              <div>
                <div style={{ fontFamily: '"Playfair Display",serif', fontStyle: 'italic', fontSize: 48, color: '#7fda91', marginBottom: 8 }}>paw</div>
                <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.4 }}>Your personal<br />wellness companion</div>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: 10, lineHeight: 1.6 }}>
                  PAW helps you grow across all 5 dimensions of health — mental, social, physical, psychological, and spiritual.
                </p>
              </div>
              <div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>What should PAW call you?</p>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  style={{
                    width: '100%', borderRadius: 14, border: '1px solid rgba(127,218,145,0.3)',
                    background: 'rgba(255,255,255,0.06)', padding: '14px 16px',
                    fontSize: 16, color: '#e8faf0', outline: 'none',
                    fontFamily: '"DM Sans",sans-serif',
                  }}
                />
              </div>
            </div>
          )}

          {current === 'dimensions' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Which dimensions matter most to you right now?</div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>Select all that apply. PAW will tailor your routine around these.</p>
              </div>
              {HEALTH_DIMENSIONS.map(d => {
                const active = dims.includes(d.id)
                return (
                  <motion.button
                    key={d.id}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => toggleDim(d.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      background: active ? 'rgba(127,218,145,0.12)' : 'rgba(255,255,255,0.04)',
                      border: `1.5px solid ${active ? '#7fda91' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: 16, padding: '14px 16px', cursor: 'pointer',
                      textAlign: 'left', transition: 'all 0.2s', color: '#e8faf0',
                    }}
                  >
                    <span style={{ fontSize: 28, flexShrink: 0 }}>{d.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: active ? '#7fda91' : '#e8faf0' }}>{d.label}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{d.desc}</div>
                    </div>
                    {active && <span style={{ fontSize: 18, color: '#7fda91' }}>✓</span>}
                  </motion.button>
                )
              })}
            </div>
          )}

          {current === 'interests' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>What are you into?</div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>PAW will suggest relevant events, cohorts and activities that match your world.</p>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {INTEREST_CHIPS.map(ic => {
                  const active = interests.includes(ic)
                  return (
                    <motion.button
                      key={ic}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => toggleInterest(ic)}
                      style={{
                        padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                        background: active ? '#7fda91' : 'rgba(255,255,255,0.08)',
                        color: active ? '#0f1f14' : 'rgba(255,255,255,0.7)',
                        transition: 'all 0.18s',
                      }}
                    >{ic}</motion.button>
                  )
                })}
              </div>
            </div>
          )}

          {current === 'location' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 24 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>📍 Location & activity</div>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
                  PAW can use your location to understand your physical activity — step counting, how often you go out, and whether you might benefit from going somewhere new.
                </p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6, marginTop: 8 }}>
                  If you're mostly home and consuming lots of screen time, PAW will suggest events, art galleries, parks, and friend meetups based on your interests.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => { requestLocation(); setLocationOk(true) }}
                  style={{
                    padding: '14px', borderRadius: 14,
                    background: locationOk === true ? 'rgba(127,218,145,0.15)' : 'rgba(255,255,255,0.06)',
                    border: `1.5px solid ${locationOk === true ? '#7fda91' : 'rgba(255,255,255,0.12)'}`,
                    color: '#e8faf0', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  <span>📍</span>
                  {locationOk === true ? '✓ Location enabled' : 'Enable location'}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setLocationOk(false)}
                  style={{
                    padding: '14px', borderRadius: 14,
                    background: locationOk === false ? 'rgba(255,255,255,0.06)' : 'transparent',
                    border: '1.5px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.45)', fontSize: 13, cursor: 'pointer',
                  }}
                >
                  Skip for now
                </motion.button>
              </div>
            </div>
          )}

          {current === 'done' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 20, textAlign: 'center' }}>
              <motion.div
                animate={{ scale: [0.8, 1.05, 1], opacity: [0, 1, 1] }}
                transition={{ duration: 0.6 }}
                style={{ fontSize: 64 }}
              >🌱</motion.div>
              <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.3 }}>
                {name ? `You're ready, ${name}.` : "You're ready."}
              </div>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, maxWidth: 280 }}>
                PAW will grow with you. Tell PAW your first goal in the chat — or pick from a template to start immediately.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {dims.slice(0, 3).map(d => {
                  const dim = HEALTH_DIMENSIONS.find(h => h.id === d)
                  return dim ? (
                    <div key={d} style={{ background: 'rgba(127,218,145,0.12)', border: '1px solid rgba(127,218,145,0.3)', borderRadius: 20, padding: '6px 14px', fontSize: 12, color: '#7fda91' }}>
                      {dim.icon} {dim.label}
                    </div>
                  ) : null
                })}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Bottom button */}
      <div style={{ padding: '16px 24px 32px', flexShrink: 0 }}>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={current === 'done' ? finish : next}
          disabled={current === 'welcome' && !name.trim()}
          style={{
            width: '100%', padding: '16px', borderRadius: 16, border: 'none',
            background: name.trim() || current !== 'welcome' ? '#7fda91' : 'rgba(255,255,255,0.1)',
            color: name.trim() || current !== 'welcome' ? '#0f1f14' : 'rgba(255,255,255,0.3)',
            fontSize: 16, fontWeight: 700, cursor: name.trim() || current !== 'welcome' ? 'pointer' : 'default',
            transition: 'all 0.2s',
          }}
        >
          {current === 'done' ? 'Start my journey →' : current === 'location' && locationOk === null ? 'Skip →' : 'Continue →'}
        </motion.button>
        {current !== 'welcome' && current !== 'done' && (
          <button onClick={next} style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 13, cursor: 'pointer', padding: '6px' }}>
            Skip this step
          </button>
        )}
      </div>
    </div>
  )
}
