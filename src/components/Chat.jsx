import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../lib/api.js'
import { QUOTE_LABELS, QUOTES } from '../lib/constants.js'

const SESSION_KEY = 'paw-session-id'
function getSession() {
  let s = sessionStorage.getItem(SESSION_KEY)
  if (!s) { s = `s_${Date.now()}`; sessionStorage.setItem(SESSION_KEY, s) }
  return s
}

const QUOTE_OPTIONS = [
  { key: 'quran',    label: 'Quran',           emoji: '☪️' },
  { key: 'bible',    label: 'Bible',            emoji: '✝️' },
  { key: 'stoic',    label: 'Stoic',            emoji: '⚖️' },
  { key: 'sufi',     label: 'Sufi Poetry',      emoji: '🌹' },
  { key: 'african',  label: 'African Proverbs', emoji: '🌍' },
  { key: 'universal',label: 'All Traditions',   emoji: '✨' },
]

// Short goal templates for quick selection
const GOAL_CHIPS = [
  '🌅 Wake up at 5AM',
  '📚 Read daily',
  '💪 Build fitness',
  '🧘 Mental wellness',
  '💼 Career focus',
  '🤲 Spiritual growth',
  '💒 Recovery journey',
  '🎨 Creative practice',
]

export default function Chat({ state, navigate, chatMessages, setChatMessages }) {
  const { profile, routine, refreshRoutine } = state
  const [input,   setInput]   = useState('')
  const [sending, setSending] = useState(false)
  const [quoteType, setQuoteType] = useState(localStorage.getItem('paw-quote-type') || null)
  const [phase, setPhase] = useState(() => {
    if (!localStorage.getItem('paw-quote-type')) return 'quote'
    if (!localStorage.getItem('paw-goal-set'))   return 'goal'
    return 'chat'
  })
  const [dailyQuote, setDailyQuote] = useState(null)
  const chatRef  = useRef(null)
  const inputRef = useRef(null)
  const sessionId = useRef(getSession())

  // Daily quote
  useEffect(() => {
    const qt = quoteType || 'universal'
    const pool = QUOTES[qt] || QUOTES.universal
    setDailyQuote(pool[new Date().getDate() % pool.length])
  }, [quoteType])

  // Welcome on first ever load
  useEffect(() => {
    if (chatMessages.length > 0) return
    const name = profile?.name || 'there'
    if (phase === 'quote') {
      addBubble('paw', `Salaam, ${name}. I'm PAW — your personal routine companion.\n\nWhat wisdom tradition grounds you?`)
    } else if (phase === 'goal') {
      addBubble('paw', `Welcome back, ${name}. What's one thing you want to build or change right now?\n\nPick a quick start or describe it yourself.`)
    } else {
      addBubble('paw', `Welcome back, ${name}. Day ${routine?.currentDay || 1} of ${routine?.title || 'your journey'}. How are you feeling today?`)
    }
  }, []) // eslint-disable-line

  function addBubble(role, text, extra = {}) {
    const msg = { role, text, ...extra, id: `${Date.now()}_${Math.random()}` }
    setChatMessages(prev => [...prev, msg])
    setTimeout(() => chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }), 60)
    return msg
  }

  async function send(overrideText) {
    const msg = (overrideText || input).trim()
    if (!msg || sending) return
    setInput('')
    addBubble('user', msg)
    setSending(true)

    try {
      // Phase: quote type selection
      if (phase === 'quote') {
        const match = QUOTE_OPTIONS.find(q =>
          msg.toLowerCase().includes(q.key) || msg.toLowerCase().includes(q.label.toLowerCase())
        )
        const chosen = match?.key || 'universal'
        setQuoteType(chosen)
        localStorage.setItem('paw-quote-type', chosen)
        setPhase('goal')
        setSending(false)
        setTimeout(() => {
          addBubble('paw', `Perfect — I'll anchor your journey with ${QUOTE_LABELS[chosen]}.\n\nNow, what's one thing you want to build? Pick below or write your own.`)
        }, 400)
        return
      }

      // Phase: goal setting — generate immediately, no back-and-forth
      if (phase === 'goal') {
        addBubble('paw', `Got it. Generating your routine now...`, { type: 'system' })
        const data = await api.generateGoal(msg)
        if (data.success) {
          await refreshRoutine()
          localStorage.setItem('paw-goal-set', '1')
          setPhase('chat')
          setSending(false)
          addBubble('paw', `✓ Done! Your "${data.routine?.title}" routine is ready — ${data.routine?.activities?.length} activities over ${data.routine?.totalDays} days.\n\nTap Routine to see your day mapped out. Tap Calendar to see the full month.\n\nNow — how are you feeling about starting?`)
          if (data.routine?.activities) api.scheduleAlarms(data.routine.activities)
        }
        return
      }

      // Phase: normal chat
      const history = chatMessages.slice(-14).map(m => ({
        role: m.role === 'paw' ? 'assistant' : 'user',
        content: m.text,
      }))
      const data = await api.chat(msg, sessionId.current, history)
      addBubble('paw', data.reply)

      if (data.routineGenerated) {
        await refreshRoutine()
        addBubble('paw', '✓ Routine updated. Tap Routine to see the changes.', { type: 'system' })
        if (state.routine?.activities) api.scheduleAlarms(state.routine.activities)
      }
      if (data.memory) {
        state.setMemories(prev => [...prev, data.memory])
      }
    } catch (err) {
      addBubble('paw', state.online
        ? 'Something went wrong. Try again in a moment.'
        : 'You appear to be offline. Your message will send when connectivity returns.'
      )
    } finally {
      setSending(false)
    }
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const showQuoteChips = phase === 'quote' && chatMessages.length <= 2
  const showGoalChips  = phase === 'goal'  && chatMessages.length <= 4

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Daily quote banner */}
      <AnimatePresence>
        {dailyQuote && quoteType && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ background: 'var(--primary-soft)', borderBottom: '1px solid var(--border)', padding: '8px 16px', flexShrink: 0 }}
          >
            <p style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.5 }}>"{dailyQuote.text}"</p>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>— {dailyQuote.source}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div ref={chatRef} className="scroll-area" style={{ flex: 1, padding: '12px 12px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <AnimatePresence initial={false}>
          {chatMessages.map(m => <ChatBubble key={m.id} message={m} />)}
        </AnimatePresence>

        {sending && <TypingIndicator />}

        {/* Quote chips */}
        {showQuoteChips && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '4px 0' }}>
            {QUOTE_OPTIONS.map(q => (
              <motion.button key={q.key} whileTap={{ scale: 0.92 }}
                onClick={() => send(q.label)}
                style={{ background: 'var(--chip-bg)', color: 'var(--chip-text)', border: 'none', borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                {q.emoji} {q.label}
              </motion.button>
            ))}
          </motion.div>
        )}

        {/* Goal chips — short, precise */}
        {showGoalChips && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '4px 0' }}>
            {GOAL_CHIPS.map(g => (
              <motion.button key={g} whileTap={{ scale: 0.92 }}
                onClick={() => send(g.replace(/^[\S]+\s/, ''))}
                style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                {g}
              </motion.button>
            ))}
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div style={{
        flexShrink: 0, borderTop: '1px solid var(--border)', padding: '10px 12px',
        display: 'flex', alignItems: 'flex-end', gap: 10,
        background: 'var(--header-bg)', backdropFilter: 'blur(20px)',
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder={phase === 'goal' ? 'Describe your goal...' : 'Talk to PAW...'}
          rows={1}
          style={{
            flex: 1, background: 'var(--input-bg)', border: '1px solid var(--border)',
            borderRadius: 20, padding: '10px 14px', fontSize: 15, color: 'var(--text)',
            resize: 'none', maxHeight: 120, fontFamily: '"DM Sans",sans-serif', outline: 'none', lineHeight: 1.5,
          }}
          onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
        />
        <motion.button
          whileTap={{ scale: 0.88 }} onClick={() => send()}
          disabled={!input.trim() || sending}
          style={{
            width: 44, height: 44, borderRadius: '50%',
            background: input.trim() && !sending ? 'var(--primary)' : 'var(--surface-mid)',
            border: 'none', cursor: input.trim() && !sending ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            transition: 'background 0.2s', color: input.trim() && !sending ? '#fff' : 'var(--text-faint)',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>send</span>
        </motion.button>
      </div>
    </div>
  )
}

function ChatBubble({ message }) {
  const isPaw    = message.role === 'paw'
  const isSystem = message.type === 'system'

  if (isSystem) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        style={{ textAlign: 'center', fontSize: 12, color: 'var(--primary)', padding: '6px 12px', background: 'var(--primary-soft)', borderRadius: 20, alignSelf: 'center', border: '1px solid var(--border)' }}>
        {message.text}
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{ display: 'flex', justifyContent: isPaw ? 'flex-start' : 'flex-end', alignItems: 'flex-end', gap: 8 }}
    >
      {isPaw && (
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: '"Playfair Display",serif', fontStyle: 'italic', color: '#fff', fontSize: 14, fontWeight: 700 }}>p</div>
      )}
      <div style={{
        maxWidth: '78%',
        background: isPaw ? 'var(--bubble-paw)' : 'var(--primary)',
        color: isPaw ? 'var(--text)' : '#fff',
        border: isPaw ? '1px solid var(--bubble-border)' : 'none',
        borderRadius: isPaw ? '4px 18px 18px 18px' : '18px 4px 18px 18px',
        padding: '10px 14px', fontSize: 14, lineHeight: 1.6,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {message.text}
      </div>
    </motion.div>
  )
}

function TypingIndicator() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Playfair Display",serif', fontStyle: 'italic', color: '#fff', fontSize: 14 }}>p</div>
      <div style={{ background: 'var(--bubble-paw)', border: '1px solid var(--bubble-border)', borderRadius: '4px 18px 18px 18px', padding: '12px 16px', display: 'flex', gap: 5, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <motion.div key={i}
            animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
            style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)' }}
          />
        ))}
      </div>
    </motion.div>
  )
}
