// ╔═══════════════════════════════════════════════════════════════╗
// ║  PAW — Personal Routine OS · Local Termux Backend            ║
// ║                                                               ║
// ║  SETUP (run once in Termux):                                  ║
// ║    pkg install nodejs                                         ║
// ║    npm install express cors                                   ║
// ║                                                               ║
// ║  SET YOUR GEMINI KEY (one time):                              ║
// ║    export GEMINI_API_KEY="AIza..."                            ║
// ║    (add this line to ~/.bashrc to make it permanent)          ║
// ║                                                               ║
// ║  RUN:                                                         ║
// ║    node paw-server.js                                         ║
// ║                                                               ║
// ║  OPEN APP:                                                     ║
// ║    http://localhost:3000  in your phone browser               ║
// ╚═══════════════════════════════════════════════════════════════╝

import express  from 'express'
import cors     from 'cors'
import fs       from 'fs'
import path     from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app  = express()
const PORT = 3000

// ─────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const LOCAL_AI_URL = process.env.LOCAL_AI_URL || 'http://127.0.0.1:8080'
const DB_FILE      = path.join(__dirname, 'paw-data.json')
const MODULES_DIR  = path.join(__dirname, 'modules')

// ── API Key Pool — add multiple keys, system rotates on rate limit ─
// Set: GEMINI_API_KEY=key1,key2,key3  (comma-separated)
// Or individual: GEMINI_KEY_1=..., GEMINI_KEY_2=..., GEMINI_KEY_3=...
const KEY_POOL = (() => {
  const keys = []
  // Comma-separated pool
  const poolEnv = process.env.GEMINI_API_KEY || ''
  poolEnv.split(',').map(k => k.trim()).filter(Boolean).forEach(k => keys.push(k))
  // Individual numbered keys
  for (let i = 1; i <= 10; i++) {
    const k = process.env[`GEMINI_KEY_${i}`]
    if (k && !keys.includes(k)) keys.push(k)
  }
  return keys
})()

let currentKeyIdx = 0
const keyErrors   = {}   // key → error count

function getNextKey() {
  if (!KEY_POOL.length) return null
  // Skip keys with too many recent errors
  let attempts = 0
  while (attempts < KEY_POOL.length) {
    const key = KEY_POOL[currentKeyIdx % KEY_POOL.length]
    if ((keyErrors[key] || 0) < 3) return key
    currentKeyIdx++
    attempts++
  }
  // All keys errored — reset and try anyway
  Object.keys(keyErrors).forEach(k => { keyErrors[k] = 0 })
  return KEY_POOL[0]
}

function rotateKey(failedKey) {
  keyErrors[failedKey] = (keyErrors[failedKey] || 0) + 1
  currentKeyIdx = (currentKeyIdx + 1) % KEY_POOL.length
  console.log(`[PAW] Key rotated. Next key index: ${currentKeyIdx % KEY_POOL.length}`)
}

// ─────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────
app.use(cors())
app.use(express.json({ limit: '10mb' })) // allow photo uploads
app.use(express.static(__dirname))       // serves index.html at /

// ─────────────────────────────────────────────────────────────────
// DATABASE — simple JSON file, no install needed
// ─────────────────────────────────────────────────────────────────
const EMPTY_DB = {
  profile:       {},
  routine:       null,   // active routine (fixed once generated)
  standard:      null,   // ideal benchmark (fixed once generated)
  logs:          [],     // daily activity completion logs
  checkins:      [],     // daily text/photo check-ins
  moduleData:    {},     // data from each module keyed by module id
  conversations: [],     // all chat messages
  analyses:      [],     // stored AI analysis results
  community:     [],     // community shared posts
  journey:       [],     // journey log entries (photo + caption)
  memories:      [],     // extracted memories from conversations
  mindMapNodes:  [],     // mind map event/branch nodes
  challenges:    [],     // community challenges sent/received
}

function db() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(EMPTY_DB, null, 2))
    return EMPTY_DB
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
  } catch {
    return EMPTY_DB
  }
}

function save(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2))
}

// ─────────────────────────────────────────────────────────────────
// GEMINI — key rotation + local AI fallback
// ─────────────────────────────────────────────────────────────────
async function geminiWithKey(key, messages, system, opts) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const body = {
    contents,
    generationConfig: { maxOutputTokens: opts.maxTokens || 2000, temperature: opts.temperature || 0.7 },
  }
  if (system) body.systemInstruction = { parts: [{ text: system }] }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini ${res.status}: ${err.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.filter(p => p.text)?.map(p => p.text)?.join('') || ''
}

async function localAI(messages, system, opts) {
  // OpenAI-compatible local endpoint (MNN Chat, Ollama, LM Studio)
  const res = await fetch(`${LOCAL_AI_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'local',
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...messages,
      ],
      max_tokens: opts.maxTokens || 800,
      temperature: opts.temperature || 0.7,
    }),
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`Local AI ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

async function gemini(messages, system = '', opts = {}) {
  // 1. Try Gemini with key rotation
  if (KEY_POOL.length) {
    let lastError = null
    let attempts  = 0
    while (attempts < Math.min(KEY_POOL.length, 3)) {
      const key = getNextKey()
      if (!key) break
      try {
        const result = await geminiWithKey(key, messages, system, opts)
        return result
      } catch (err) {
        lastError = err
        const isRateLimit = err.message.includes('429') || err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED')
        console.log(`[PAW] Key attempt ${attempts + 1} failed: ${err.message.slice(0, 80)}`)
        if (isRateLimit) rotateKey(key)
        else throw err  // Non-rate-limit error, don't rotate
        attempts++
      }
    }
    console.log('[PAW] All Gemini keys exhausted, trying local AI...')
  }

  // 2. Fall back to local AI
  try {
    return await localAI(messages, system, opts)
  } catch (localErr) {
    console.log('[PAW] Local AI also failed:', localErr.message)
  }

  // 3. Rule-based fallback
  const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || ''
  if (lastMsg.includes('hello') || lastMsg.includes('hi')) return "I'm here. I'm currently offline but I'll be back soon."
  return "I'm having trouble connecting right now. Please check your API key or local AI setup, then try again."
}

// ─────────────────────────────────────────────────────────────────
// MODULE SYSTEM — reads manifests from ./modules/ folder
// Each module is a folder with a manifest.json
// Drop a new folder in → it's automatically discovered
// ─────────────────────────────────────────────────────────────────
function getModules() {
  // Built-in modules (no folder needed for these)
  const builtIn = [
    {
      id:          'health',
      name:        'Health Data',
      description: 'Steps, sleep hours, heart rate from Health Connect',
      dataKeys:    ['steps', 'sleep_hours', 'resting_hr', 'calories', 'workout_done'],
      active:      true,
      builtin:     true,
    },
    {
      id:          'screen_time',
      name:        'Screen Time',
      description: 'Daily phone usage, top apps, passive scroll time',
      dataKeys:    ['total_minutes', 'top_app', 'top_app_minutes', 'passive_minutes', 'pickups'],
      active:      true,
      builtin:     true,
    },
    {
      id:          'calendar',
      name:        'Calendar Load',
      description: 'Meeting count, busy hours, free windows today',
      dataKeys:    ['meeting_count', 'busy_hours', 'next_free_window'],
      active:      false,
      builtin:     true,
    },
    {
      id:          'mood',
      name:        'Mood Tracker',
      description: 'Daily mood rating 1-5 with optional note',
      dataKeys:    ['rating', 'note', 'energy'],
      active:      true,
      builtin:     true,
    },
  ]

  // Load any external modules from ./modules/ folder
  const external = []
  if (fs.existsSync(MODULES_DIR)) {
    for (const dir of fs.readdirSync(MODULES_DIR)) {
      const manifestPath = path.join(MODULES_DIR, dir, 'manifest.json')
      if (fs.existsSync(manifestPath)) {
        try {
          external.push(JSON.parse(fs.readFileSync(manifestPath, 'utf8')))
        } catch { /* skip bad manifests */ }
      }
    }
  }

  return [...builtIn, ...external]
}

// ─────────────────────────────────────────────────────────────────
// SCORING ENGINE — pure math, no AI, no tokens
// Compares actual logs vs the standard plan
// ─────────────────────────────────────────────────────────────────
function scoreDay(dayLogs, standard, moduleData) {
  if (!standard || !dayLogs?.length) return { score: 0, breakdown: {} }

  const weights    = standard.scoringWeights || { completion: 0.5, timing: 0.2, modules: 0.3 }
  const activities = standard.activities     || []

  // Completion score — what % of planned activities were done
  const planned    = activities.length
  const completed  = dayLogs.filter(l => l.done).length
  const completion = planned > 0 ? (completed / planned) : 0

  // Timing score — how many were done within the time window
  let onTime = 0
  for (const log of dayLogs.filter(l => l.done)) {
    const act = activities.find(a => a.name === log.activity)
    if (!act || !log.doneAt || !act.time) continue
    const planned = toMinutes(act.time)
    const actual  = toMinutes(log.doneAt)
    if (Math.abs(actual - planned) <= 60) onTime++ // within 1 hour = on time
  }
  const timing = completed > 0 ? (onTime / completed) : 0

  // Module score — how well module targets were hit
  let moduleScore = 1 // default full score if no targets defined
  const moduleTargets = standard.moduleTargets || {}
  const targetKeys = Object.keys(moduleTargets)
  if (targetKeys.length > 0) {
    let hits = 0
    for (const key of targetKeys) {
      const [moduleId, dataKey] = key.split('.')
      const actual = moduleData?.[moduleId]?.[dataKey]
      const target = moduleTargets[key]
      if (actual !== undefined) {
        hits += evaluateTarget(actual, target) ? 1 : 0
      }
    }
    moduleScore = hits / targetKeys.length
  }

  const score = Math.round(
    (completion * weights.completion +
     timing     * weights.timing     +
     moduleScore* weights.modules) * 100
  )

  return {
    score:    Math.min(100, Math.max(0, score)),
    breakdown: {
      completion: Math.round(completion * 100),
      timing:     Math.round(timing * 100),
      modules:    Math.round(moduleScore * 100),
    }
  }
}

function evaluateTarget(actual, target) {
  // target format: "< 60" or "> 7" or "= true"
  if (typeof target === 'string') {
    const [op, val] = target.trim().split(' ')
    const num = parseFloat(val)
    if (op === '<')  return actual < num
    if (op === '>')  return actual > num
    if (op === '<=') return actual <= num
    if (op === '>=') return actual >= num
    if (op === '=')  return String(actual) === val
  }
  return actual >= target
}

function toMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + (m || 0)
}

function detectPatterns(logs, standard) {
  if (!logs?.length || !standard) return []
  const patterns = []
  const byDay = {}

  // Group logs by day of week
  for (const log of logs) {
    const day = new Date(log.date).getDay()
    if (!byDay[day]) byDay[day] = { done: 0, total: 0 }
    byDay[day].total++
    if (log.done) byDay[day].done++
  }

  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  for (const [day, data] of Object.entries(byDay)) {
    const rate = data.done / data.total
    if (rate < 0.5 && data.total >= 3) {
      patterns.push({
        type:    'weak_day',
        day:     dayNames[day],
        rate:    Math.round(rate * 100),
        message: `${dayNames[day]} is consistently your hardest day (${Math.round(rate*100)}% completion)`,
      })
    }
    if (rate > 0.9 && data.total >= 3) {
      patterns.push({
        type:    'strong_day',
        day:     dayNames[day],
        rate:    Math.round(rate * 100),
        message: `${dayNames[day]} is your strongest day (${Math.round(rate*100)}% completion)`,
      })
    }
  }

  // Check activity-level patterns
  const byActivity = {}
  for (const log of logs) {
    if (!byActivity[log.activity]) byActivity[log.activity] = { done: 0, total: 0 }
    byActivity[log.activity].total++
    if (log.done) byActivity[log.activity].done++
  }
  for (const [act, data] of Object.entries(byActivity)) {
    const rate = data.done / data.total
    if (rate < 0.4 && data.total >= 5) {
      patterns.push({
        type:     'weak_activity',
        activity: act,
        rate:     Math.round(rate * 100),
        message:  `"${act}" is skipped frequently (only ${Math.round(rate*100)}% completion)`,
      })
    }
  }

  return patterns
}

function calculateStreak(logs) {
  if (!logs?.length) return 0
  const today    = new Date()
  today.setHours(0, 0, 0, 0)
  const byDate   = {}
  for (const log of logs) {
    const d = log.date?.split('T')[0]
    if (!byDate[d]) byDate[d] = { done: 0, total: 0 }
    byDate[d].total++
    if (log.done) byDate[d].done++
  }
  let streak = 0
  let check  = new Date(today)
  while (true) {
    const key  = check.toISOString().split('T')[0]
    const data = byDate[key]
    if (!data || data.done / data.total < 0.5) break
    streak++
    check.setDate(check.getDate() - 1)
  }
  return streak
}

// ─────────────────────────────────────────────────────────────────
// SYSTEM PROMPTS
// ─────────────────────────────────────────────────────────────────
function goalGenerationPrompt(profile, goalStatement, research) {
  return `You are PAW — a personal routine OS. Your job is to generate a complete routine system for a user's goal.

USER PROFILE:
${JSON.stringify(profile, null, 2)}

GOAL STATED BY USER:
"${goalStatement}"

RESEARCH FINDINGS (what actually works for this goal type):
${research}

INSTRUCTIONS:
Generate two JSON objects:

1. ROUTINE — the fixed daily schedule the user will follow
2. STANDARD — the ideal execution benchmark to measure against

Respond with ONLY valid JSON in exactly this structure, nothing else:

{
  "routine": {
    "title": "short routine name",
    "goalStatement": "the goal as stated",
    "goalCategory": "recovery|spiritual|learning|health|professional|creative|travel|other",
    "totalDays": 30,
    "startDate": "${new Date().toISOString().split('T')[0]}",
    "featureFlags": {
      "pomodoroTimer": false,
      "urgeLog": false,
      "countdownVisible": true,
      "subjectTracker": false,
      "emergencyChat": false,
      "prayerTimes": false
    },
    "activities": [
      {
        "id": "act_1",
        "name": "Activity name",
        "time": "06:00",
        "duration": "20 min",
        "type": "Spiritual|Health|Learning|Recovery|Professional|Creative",
        "color": "#6366f1",
        "why": "One sentence reason specific to this goal",
        "daysOfWeek": [1,2,3,4,5,6,7],
        "critical": true
      }
    ],
    "checkInQuestions": [
      "Specific question for week 1-2",
      "Specific question for week 2-3",
      "Specific question for week 3-4"
    ],
    "quotePool": "quran|bible|stoic|sufi|african|universal",
    "communityFilter": "recovery|spiritual|learning|health|professional|creative|travel"
  },
  "standard": {
    "description": "What perfect execution looks like",
    "weeklyTargets": {
      "completionRate": 85,
      "consistencyScore": 80
    },
    "moduleTargets": {
      "health.sleep_hours": "> 7",
      "screen_time.passive_minutes": "< 60"
    },
    "scoringWeights": {
      "completion": 0.5,
      "timing": 0.2,
      "modules": 0.3
    },
    "weeklyMilestones": {
      "week1": "What week 1 success looks like",
      "week2": "What week 2 success looks like",
      "week4": "What month 1 completion looks like"
    },
    "activities": []
  }
}

ACTIVITY TYPE COLORS:
Spiritual=#6366f1  Learning=#f59e0b  Health=#2d9e55
Recovery=#06b6d4  Professional=#8b5cf6  Creative=#ec4899  Travel=#f97316

Make the activities specific and evidence-based from the research. The "why" for each must reference the actual goal, not generic reasons.
Include 4-8 activities. Keep it achievable.`
}

function chatSystemPrompt(profile, routine, patterns, memories = [], prefs = {}) {
  const name       = profile?.name || 'friend'
  const goal       = routine?.goalStatement || 'none yet'
  const startDate  = routine?.startDate ? new Date(routine.startDate) : null
  const day        = startDate ? Math.floor((Date.now() - startDate) / 86400000) + 1 : 0
  const total      = routine?.totalDays || 30
  const hasRoutine = !!routine
  const patStr     = patterns?.map(p => p.message).join('\n') || 'not enough data yet'

  // ── Memory context ─────────────────────────────────────────────
  // Group memories by type and recency for natural injection
  const recent   = memories.slice(-20)
  const wins     = recent.filter(m => m.type === 'win').slice(-3)
  const struggles= recent.filter(m => m.type === 'struggle').slice(-3)
  const insights = recent.filter(m => m.type === 'insight').slice(-4)
  const decisions= recent.filter(m => m.type === 'decision').slice(-2)
  const events   = recent.filter(m => m.type === 'event').slice(-3)

  function memBlock(label, items) {
    if (!items.length) return ''
    return `${label}:\n${items.map(m => {
      const daysAgo = m.createdAt
        ? Math.round((Date.now() - new Date(m.createdAt)) / 86400000)
        : null
      const when = daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : daysAgo != null ? `${daysAgo} days ago` : 'recently'
      return `  - "${m.summary || m.content}" (${when})`
    }).join('\n')}`
  }

  const memorySection = [
    memBlock('Recent wins', wins),
    memBlock('Recent struggles', struggles),
    memBlock('Insights PAW has noted', insights),
    memBlock('Decisions made', decisions),
    memBlock('Life events', events),
  ].filter(Boolean).join('\n\n')

  // ── User preferences from onboarding ──────────────────────────
  const dimensions = prefs.dimensions?.length
    ? `Health dimensions they care about: ${prefs.dimensions.join(', ')}`
    : ''
  const interests = prefs.interests?.length
    ? `Personal interests: ${prefs.interests.slice(0,8).join(', ')}`
    : ''
  const locationEnabled = prefs.locationConsent
    ? 'Location tracking enabled — PAW can reference physical movement patterns.'
    : ''

  // ── Dormant branch detection ───────────────────────────────────
  const dormantNote = memories.some(m => {
    if (!m.createdAt) return false
    const daysSince = (Date.now() - new Date(m.createdAt)) / 86400000
    return daysSince > 10 && m.type !== 'win'
  }) ? `⚠️ Some life areas haven't been mentioned in a while. Consider checking in on them naturally.` : ''

  return `You are PAW — a personal routine OS and life companion for ${name}.

════════════════════════════════════
WHO ${name.toUpperCase()} IS
════════════════════════════════════
Name: ${name}
Field: ${profile?.field || 'not set'}
${dimensions}
${interests}
${locationEnabled}

════════════════════════════════════
CURRENT ROUTINE
════════════════════════════════════
${hasRoutine
  ? `Title: ${routine.title}
Day: ${day} of ${total}
Goal: ${goal}
Start date: ${routine.startDate}
Activities: ${routine.activities?.map(a => `${a.time} ${a.name}`).join(' · ')}`
  : 'No active routine yet. User needs to set their first goal.'}

════════════════════════════════════
BEHAVIOURAL PATTERNS (from data)
════════════════════════════════════
${patStr || 'Not enough data yet.'}
${dormantNote}

════════════════════════════════════
MEMORY — WHAT PAW KNOWS ABOUT ${name.toUpperCase()}
════════════════════════════════════
${memorySection || 'No memories recorded yet. This is an early conversation.'}

════════════════════════════════════
HOW PAW SPEAKS
════════════════════════════════════
- Address ${name} by name naturally — not every message, but when it lands well
- Reference specific memories and patterns above when relevant. Say things like:
  "Last week you mentioned..." or "You've been struggling with X since..." or
  "Remember when you said... that's showing up in your data now."
- Warm, direct, honest. Zero filler. Zero toxic positivity.
- Never ask more than one question. Make it the right one.
- Respond in the same language the user writes in.
- Short reply for simple check-ins. Longer when they share something important.
- When patterns show struggle, acknowledge it specifically — don't rush to fix.
- When patterns show growth, name it precisely — vague praise means nothing.

════════════════════════════════════
MEMORY EXTRACTION
════════════════════════════════════
After your reply, if this conversation reveals something worth remembering, add on a new line:
MEMORY: {"type":"win|struggle|insight|decision|event","content":"what happened","summary":"one short phrase"}

Types:
- win: achievement, streak, something they're proud of
- struggle: difficulty, missed days, emotional weight
- insight: something they realised about themselves
- decision: a commitment or choice they made
- event: a life event (course, travel, job change, health event)

Only add MEMORY if something genuinely notable was shared. Not every message.

════════════════════════════════════
ROUTINE GENERATION
════════════════════════════════════
When the user states a goal or picks a template:
→ Generate IMMEDIATELY. Do not ask more questions first.
→ Give one warm sentence acknowledging their goal.
→ Then on its own line add exactly:
GENERATE_ROUTINE: "their goal as a clear statement"

The system handles generation. Your job is just to signal it with confidence.
Do NOT ask what time they wake up, what they've tried, how busy they are.
The system generates smart defaults. The user can adjust later in chat.

When NO routine: invite them to share their goal. Keep it open, not interrogative.
When routine EXISTS: be a daily companion. Encourage. Notice what the data shows.`
}


function analysisPrompt(profile, routine, standard, patterns, logs, checkins) {
  return `You are PAW's analysis engine. Analyse this user's routine data honestly.

GOAL: "${routine?.goalStatement}"
ROUTINE: "${routine?.title}" — Day ${Math.floor((Date.now() - new Date(routine?.startDate)) / 86400000) + 1} of ${routine?.totalDays}

DETECTED PATTERNS (mathematical):
${patterns.map(p => `- ${p.message}`).join('\n') || 'not enough data'}

RECENT CHECK-INS (last 5):
${checkins.slice(-5).map(c => `"${c.text}" (${c.date?.split('T')[0]})`).join('\n') || 'none'}

LOG SUMMARY (last 14 days):
Total activities planned: ${logs.slice(-100).length}
Completed: ${logs.slice(-100).filter(l => l.done).length}

Give:
1. One key insight from the patterns (specific, not generic)
2. The single highest-leverage change they could make right now
3. One honest observation about what the check-ins reveal

Under 150 words total. Be the mentor who tells the truth.`
}

// ─────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  const hasKey = KEY_POOL.length > 0
  res.json({
    status:   'ok',
    service:  'PAW Local',
    ai:       hasKey ? 'gemini ready' : `NO KEY SET — run: export GEMINI_API_KEY="AIza..."`,
    storage:  DB_FILE,
    modules:  getModules().filter(m => m.active).map(m => m.id),
    time:     new Date().toISOString(),
  })
})

// Profile
app.get('/api/profile', (req, res) => {
  res.json(db().profile || {})
})

app.patch('/api/profile', (req, res) => {
  const d = db()
  d.profile = { ...d.profile, ...req.body, updatedAt: new Date().toISOString() }
  save(d)
  res.json({ success: true })
})

// Save onboarding preferences (dimensions, interests, location)
app.post('/api/profile/prefs', (req, res) => {
  const { dimensions, interests, locationConsent } = req.body
  const d = db()
  d.profile = d.profile || {}
  d.profile.prefs = { dimensions, interests, locationConsent, savedAt: new Date().toISOString() }
  save(d)
  res.json({ success: true })
})

// ── GOAL GENERATION — the core intelligence route ──────────────────
// Generates both routine (fixed) and standard (benchmark) in one call
app.post('/api/goal/generate', async (req, res) => {
  try {
    const { goalStatement, researchEnabled = true } = req.body
    if (!goalStatement?.trim()) {
      return res.status(400).json({ error: 'goalStatement is required' })
    }

    const d       = db()
    const profile = d.profile || {}

    // Step 1 — Research what actually works (optional, uses Serper if key available)
    let research = 'No external research available — using Gemini training knowledge.'
    const serperKey = process.env.SERPER_API_KEY
    if (researchEnabled && serperKey) {
      try {
        const searchRes = await fetch('https://google.serper.dev/search', {
          method:  'POST',
          headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
          body:    JSON.stringify({ q: `evidence based approach ${goalStatement} habit routine what works`, num: 5 }),
          signal:  AbortSignal.timeout(8000),
        })
        if (searchRes.ok) {
          const searchData = await searchRes.json()
          research = (searchData.organic || []).slice(0, 4)
            .map(r => `• ${r.title}: ${r.snippet}`)
            .join('\n')
        }
      } catch { /* continue without research */ }
    }

    // Step 2 — Generate routine + standard in one Gemini call
    const prompt = goalGenerationPrompt(profile, goalStatement, research)
    const raw    = await gemini(
      [{ role: 'user', content: 'Generate the routine and standard plan now.' }],
      prompt,
      { maxTokens: 3000, temperature: 0.6 }
    )

    // Parse JSON from response
    let parsed
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found in response')
      parsed = JSON.parse(jsonMatch[0])
    } catch (e) {
      return res.status(500).json({
        error: 'Failed to parse routine from AI response',
        raw: raw.slice(0, 500),
      })
    }

    const { routine, standard } = parsed
    if (!routine?.activities?.length) {
      return res.status(500).json({ error: 'Routine generation failed — no activities returned' })
    }

    // Copy activities into standard for scoring reference
    standard.activities = routine.activities

    // Store both — fixed from this point
    d.routine  = { ...routine,  generatedAt: new Date().toISOString(), id: `routine_${Date.now()}` }
    d.standard = { ...standard, generatedAt: new Date().toISOString() }
    d.logs     = [] // reset logs for new routine
    save(d)

    res.json({
      success:  true,
      routine:  d.routine,
      standard: d.standard,
      message:  `Routine generated: ${routine.title} · ${routine.activities.length} activities · ${routine.totalDays} days`,
    })

  } catch (err) {
    console.error('/goal/generate error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Active routine
app.get('/api/routine/active', (req, res) => {
  const d = db()
  if (!d.routine) return res.json({ exists: false })
  const day = Math.floor((Date.now() - new Date(d.routine.startDate)) / 86400000) + 1
  res.json({ ...d.routine, currentDay: day, exists: true })
})

// Standard benchmark
app.get('/api/standard/active', (req, res) => {
  const d = db()
  if (!d.standard) return res.json({ exists: false })
  res.json({ ...d.standard, exists: true })
})

// ── ACTIVITY LOG — records completion, no AI ───────────────────────
app.post('/api/log/activity', (req, res) => {
  const { activity, done, doneAt, note } = req.body
  if (!activity) return res.status(400).json({ error: 'activity required' })

  const d   = db()
  const today = new Date().toISOString().split('T')[0]

  // Remove existing log for same activity today (allow re-logging)
  d.logs = d.logs.filter(l => !(l.date?.startsWith(today) && l.activity === activity))
  d.logs.push({
    activity,
    done:   !!done,
    doneAt: doneAt || (done ? new Date().toTimeString().slice(0, 5) : null),
    note:   note || '',
    date:   new Date().toISOString(),
  })
  save(d)
  res.json({ success: true })
})

// ── CHECK-IN — text + optional base64 photo ────────────────────────
app.post('/api/log/checkin', (req, res) => {
  const { text, photo, activityName, mood } = req.body
  const d = db()
  d.checkins = d.checkins || []
  d.checkins.push({
    text:         text || '',
    photo:        photo || null,  // base64 stored locally
    activityName: activityName || null,
    mood:         mood || null,
    date:         new Date().toISOString(),
  })
  save(d)
  res.json({ success: true })
})

// ── MODULE DATA — accepts data from any module by ID ──────────────
app.post('/api/log/module/:moduleId', (req, res) => {
  const { moduleId } = req.params
  const modules = getModules()
  const module  = modules.find(m => m.id === moduleId)
  if (!module) return res.status(404).json({ error: `Module '${moduleId}' not found` })

  const d = db()
  d.moduleData = d.moduleData || {}
  d.moduleData[moduleId] = d.moduleData[moduleId] || []
  d.moduleData[moduleId].push({
    ...req.body,
    recordedAt: new Date().toISOString(),
  })
  // Keep last 90 days of module data
  d.moduleData[moduleId] = d.moduleData[moduleId].slice(-90)
  save(d)
  res.json({ success: true, module: module.name })
})

// ── DATA SUMMARY — today's state, no AI ───────────────────────────
app.get('/api/data/summary', (req, res) => {
  const d     = db()
  const today = new Date().toISOString().split('T')[0]

  const todayLogs      = d.logs.filter(l => l.date?.startsWith(today))
  const todayCheckin   = d.checkins?.filter(c => c.date?.startsWith(today)).slice(-1)[0]
  const todayModules   = {}
  for (const [id, entries] of Object.entries(d.moduleData || {})) {
    const todayEntry = (entries || []).filter(e => e.recordedAt?.startsWith(today)).slice(-1)[0]
    if (todayEntry) todayModules[id] = todayEntry
  }

  const streak   = calculateStreak(d.logs)
  const patterns = detectPatterns(d.logs, d.standard)

  // This week completion
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const weekLogs   = d.logs.filter(l => new Date(l.date) >= weekStart)
  const weekRate   = weekLogs.length
    ? Math.round(weekLogs.filter(l => l.done).length / weekLogs.length * 100)
    : 0

  res.json({
    today: {
      date:       today,
      logs:       todayLogs,
      checkin:    todayCheckin || null,
      modules:    todayModules,
      completion: todayLogs.length
        ? Math.round(todayLogs.filter(l => l.done).length / todayLogs.length * 100)
        : 0,
    },
    streak,
    weekRate,
    patterns,
    totalDaysLogged: [...new Set(d.logs.map(l => l.date?.split('T')[0]))].length,
  })
})

// ── COMPARE — actual vs standard, pure math, no AI ────────────────
app.get('/api/data/compare', (req, res) => {
  const d = db()
  if (!d.standard || !d.routine) {
    return res.json({ hasData: false, message: 'No routine or standard set yet' })
  }

  // Score last 7 days
  const days      = []
  const today     = new Date()
  for (let i = 6; i >= 0; i--) {
    const date    = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    const dayLogs = d.logs.filter(l => l.date?.startsWith(dateStr))

    // Get module data for this day
    const dayModules = {}
    for (const [id, entries] of Object.entries(d.moduleData || {})) {
      const entry = (entries || []).filter(e => e.recordedAt?.startsWith(dateStr)).slice(-1)[0]
      if (entry) dayModules[id] = entry
    }

    const scored  = scoreDay(dayLogs, d.standard, dayModules)
    days.push({ date: dateStr, ...scored, logCount: dayLogs.length })
  }

  const avgScore = Math.round(days.reduce((s, d) => s + d.score, 0) / days.length)
  const patterns = detectPatterns(d.logs, d.standard)

  // Week milestone check
  const dayNumber    = Math.floor((Date.now() - new Date(d.routine.startDate)) / 86400000) + 1
  const weekNumber   = Math.ceil(dayNumber / 7)
  const milestone    = d.standard.weeklyMilestones?.[`week${weekNumber}`] || null

  res.json({
    hasData:        true,
    days,
    avgScore,
    patterns,
    weekNumber,
    milestone,
    target:         d.standard.weeklyTargets?.completionRate || 85,
    gap:            (d.standard.weeklyTargets?.completionRate || 85) - avgScore,
  })
})

// ── AI ANALYSE — on demand only, costs tokens ──────────────────────
app.post('/api/analyse', async (req, res) => {
  try {
    const d        = db()
    const patterns = detectPatterns(d.logs, d.standard)
    const prompt   = analysisPrompt(
      d.profile, d.routine, d.standard,
      patterns, d.logs, d.checkins || []
    )

    const analysis = await gemini(
      [{ role: 'user', content: 'Analyse my routine data now.' }],
      prompt,
      { maxTokens: 400, temperature: 0.5 }
    )

    // Store result so user can refer back without re-calling
    d.analyses = d.analyses || []
    d.analyses.push({ text: analysis, date: new Date().toISOString() })
    d.analyses = d.analyses.slice(-10) // keep last 10
    save(d)

    res.json({ analysis, date: new Date().toISOString() })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── AI REARRANGE — on demand, user must approve result ────────────
app.post('/api/routine/rearrange', async (req, res) => {
  try {
    const { request } = req.body
    const d = db()
    if (!d.routine) return res.status(400).json({ error: 'No active routine to rearrange' })

    const patterns = detectPatterns(d.logs, d.standard)
    const prompt   = `You are PAW. The user wants to rearrange their routine.

CURRENT ROUTINE:
${JSON.stringify(d.routine.activities, null, 2)}

USER REQUEST: "${request}"

PATTERNS FROM DATA:
${patterns.map(p => p.message).join('\n') || 'not enough data yet'}

Return ONLY a JSON array of the rearranged activities, same structure as input.
Make targeted changes based on the request and patterns.
Keep the same activity names — only change times, order, or duration.`

    const raw  = await gemini(
      [{ role: 'user', content: 'Rearrange my routine.' }],
      prompt,
      { maxTokens: 1500, temperature: 0.4 }
    )

    let newActivities
    try {
      const match = raw.match(/\[[\s\S]*\]/)
      if (!match) throw new Error('No array found')
      newActivities = JSON.parse(match[0])
    } catch {
      return res.status(500).json({ error: 'Could not parse rearranged routine', raw: raw.slice(0, 300) })
    }

    // Return proposal — user must call /api/routine/rearrange/confirm to apply
    res.json({
      proposal:     newActivities,
      current:      d.routine.activities,
      message:      'Review the proposed changes. Call /confirm to apply or /reject to keep current.',
    })

  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Confirm rearrangement
app.post('/api/routine/rearrange/confirm', (req, res) => {
  const { activities } = req.body
  if (!activities?.length) return res.status(400).json({ error: 'activities required' })
  const d = db()
  if (!d.routine) return res.status(400).json({ error: 'No active routine' })
  d.routine.activities   = activities
  d.routine.lastModified = new Date().toISOString()
  d.standard.activities  = activities // keep standard in sync
  save(d)
  res.json({ success: true, message: 'Routine updated. Standard benchmark updated to match.' })
})

// ── CHAT ───────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [], sessionId } = req.body
    if (!message?.trim()) return res.status(400).json({ error: 'message required' })

    const d        = db()
    const patterns = detectPatterns(d.logs, d.standard)

    // Load user preferences from profile (set during onboarding)
    const prefs = d.profile?.prefs || {}

    // Inject memories into system prompt
    const memories = d.memories || []
    const system   = chatSystemPrompt(d.profile, d.routine, patterns, memories, prefs)
    const messages = [...history.slice(-12), { role: 'user', content: message }]

    const raw     = await gemini(messages, system, { maxTokens: 1800 })
    const session = sessionId || `s_${Date.now()}`

    // ── Parse MEMORY signal ──────────────────────────────────────
    let extractedMemory = null
    const memoryMatch = raw.match(/MEMORY:\s*(\{[^\n]+\})/)
    if (memoryMatch) {
      try {
        const mem = JSON.parse(memoryMatch[1])
        if (mem.type && mem.content) {
          const newMem = {
            id:        `mem_${Date.now()}`,
            type:      mem.type,
            content:   mem.content,
            summary:   mem.summary || mem.content.slice(0, 60),
            tags:      mem.tags || [],
            createdAt: new Date().toISOString(),
          }
          d.memories = d.memories || []
          d.memories.push(newMem)
          d.memories = d.memories.slice(-500)
          extractedMemory = newMem
          console.log('[PAW] Memory saved:', newMem.summary)
        }
      } catch (e) {
        console.log('[PAW] Memory parse failed:', e.message)
      }
    }

    // ── Parse GENERATE_ROUTINE signal ────────────────────────────
    let routineGenerated = false
    const hasSignal = raw.includes('GENERATE_ROUTINE:')

    if (hasSignal) {
      try {
        const goalMatch = raw.match(/GENERATE_ROUTINE:\s*"([^"]+)"/)
        if (goalMatch) {
          const goalStatement = goalMatch[1]
          console.log('[PAW] Generating routine for:', goalStatement)
          const d2 = db()
          let research = 'Use your training knowledge. Make it practical and specific.'
          const serperKey = process.env.SERPER_API_KEY
          if (serperKey) {
            try {
              const sr = await fetch('https://google.serper.dev/search', {
                method:  'POST',
                headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
                body:    JSON.stringify({ q: `evidence based routine ${goalStatement} what works habit science`, num: 4 }),
                signal:  AbortSignal.timeout(6000),
              })
              if (sr.ok) {
                const sd = await sr.json()
                research = (sd.organic || []).slice(0, 4).map(r => `• ${r.title}: ${r.snippet}`).join('\n')
              }
            } catch {}
          }
          const genPrompt  = goalGenerationPrompt(d2.profile || {}, goalStatement, research)
          const rawRoutine = await gemini(
            [{ role: 'user', content: 'Generate the routine and standard plan now.' }],
            genPrompt,
            { maxTokens: 3000, temperature: 0.6 }
          )
          const cleaned   = rawRoutine.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim()
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            if (parsed.routine?.activities?.length) {
              parsed.standard.activities = parsed.routine.activities
              d2.routine  = { ...parsed.routine,  generatedAt: new Date().toISOString(), id: 'routine_' + Date.now() }
              d2.standard = { ...parsed.standard, generatedAt: new Date().toISOString() }
              d2.logs     = []
              // Auto-save a routine generation memory
              d2.memories = d2.memories || []
              d2.memories.push({
                id:        `mem_${Date.now()}`,
                type:      'decision',
                content:   `Started "${parsed.routine.title}" routine — ${goalStatement}`,
                summary:   `Started ${parsed.routine.title}`,
                tags:      ['routine', 'start'],
                createdAt: new Date().toISOString(),
              })
              save(d2)
              routineGenerated = true
              console.log('[PAW] Routine saved:', parsed.routine.title)
            }
          }
        }
      } catch (e) {
        console.error('[PAW] Routine generation failed:', e.message)
      }
    }

    // Strip signals from displayed reply
    const finalReply = raw
      .replace(/GENERATE_ROUTINE:[^\n]*/g, '')
      .replace(/MEMORY:\s*\{[^\n]+\}/g, '')
      .trim()

    // Save conversation turn
    const dFinal = db()
    dFinal.conversations = dFinal.conversations || []
    dFinal.conversations.push(
      { sessionId: session, role: 'user',      content: message,    ts: new Date().toISOString() },
      { sessionId: session, role: 'assistant', content: finalReply,  ts: new Date().toISOString() }
    )
    dFinal.conversations = dFinal.conversations.slice(-200)
    save(dFinal)

    res.json({
      reply:            finalReply,
      sessionId:        session,
      routineGenerated,
      memory:           extractedMemory,
    })

  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Conversation history list (sidebar)
app.get('/api/conversations', (req, res) => {
  const d = db()
  const sessions = {}
  for (const msg of (d.conversations || [])) {
    if (!sessions[msg.sessionId] && msg.role === 'user') {
      sessions[msg.sessionId] = {
        sessionId: msg.sessionId,
        preview:   msg.content.slice(0, 60),
        date:      msg.ts,
      }
    }
  }
  res.json(Object.values(sessions).reverse().slice(0, 30))
})

// Full session messages
app.get('/api/conversations/:sessionId', (req, res) => {
  const d = db()
  const msgs = (d.conversations || []).filter(m => m.sessionId === req.params.sessionId)
  res.json(msgs)
})

// Modules list
app.get('/api/modules', (req, res) => {
  res.json(getModules())
})

// ── Community: GET with routineJSON included ───────────────────────
// Override the earlier GET /api/community to include full JSON
app.get('/api/community/full', (req, res) => {
  const d = db()
  res.json(d.community || [])
})

// ── Community: DELETE post by index ───────────────────────────────
app.delete('/api/community/:idx', (req, res) => {
  const d   = db()
  const idx = parseInt(req.params.idx)
  if (isNaN(idx) || idx < 0 || idx >= (d.community||[]).length) {
    return res.status(404).json({ error: 'Post not found' })
  }
  d.community.splice(idx, 1)
  save(d)
  res.json({ success: true })
})

// ── Serve admin dashboard ──────────────────────────────────────────
app.get('/admin', (req, res) => {
  const adminPath = path.join(__dirname, 'paw-admin.html')
  if (fs.existsSync(adminPath)) {
    res.sendFile(adminPath)
  } else {
    res.status(404).send('Admin dashboard not found. Put paw-admin.html in ~/paw/')
  }
})

// ── Community: adapt routine (copy to user's active routine) ──────
app.post('/api/community/:idx/adapt', (req, res) => {
  const d   = db()
  const idx = parseInt(req.params.idx)
  const post = (d.community||[])[idx]
  if (!post?.routineJSON) return res.status(404).json({ error: 'No routine JSON for this post' })

  const { routine, standard } = post.routineJSON
  if (!routine?.activities?.length) return res.status(400).json({ error: 'Invalid routine JSON' })

  // Deactivate current routine, store new one
  standard.activities = routine.activities
  d.routine  = { ...routine, generatedAt: new Date().toISOString(), id: 'routine_' + Date.now(), adaptedFrom: post.title }
  d.standard = { ...standard, generatedAt: new Date().toISOString() }
  d.logs     = [] // fresh start
  save(d)

  res.json({ success: true, routine: d.routine, message: `Adapted: ${routine.title}` })
})

// Last AI analysis
app.get('/api/analyses', (req, res) => {
  const d = db()
  res.json((d.analyses || []).slice(-5))
})

// ── Community: POST new community share ───────────────────────────
app.post('/api/community', (req, res) => {
  const { category, quote, weeks, blocks, photo, routineJSON, title } = req.body
  if (!quote) return res.status(400).json({ error: 'quote required' })
  const d = db()
  d.community = d.community || []
  d.community.push({
    category:    category || 'general',
    quote:       quote,
    weeks:       weeks || 1,
    blocks:      blocks || [1,1,0,1,1,0,1],
    photo:       photo || false,
    title:       title || quote.slice(0, 60),
    routineJSON: routineJSON || null,
    sharedAt:    new Date().toISOString(),
    adapts:      0,
  })
  save(d)
  res.json({ success: true })
})

// ── Journey log: GET all entries ──────────────────────────────────
app.get('/api/journey', (req, res) => {
  const d = db()
  res.json((d.journey || []).slice(-100))
})

// ── Journey log: POST new entry (caption + optional photo) ────────
app.post('/api/journey', (req, res) => {
  const { activity, caption, imageData } = req.body
  if (!activity) return res.status(400).json({ error: 'activity required' })
  const d = db()
  d.journey = d.journey || []
  d.journey.push({
    activity:  activity,
    caption:   caption || '',
    photo:     imageData || null,
    timestamp: new Date().toISOString(),
  })
  // Keep last 200 journey entries
  d.journey = d.journey.slice(-200)
  save(d)
  res.json({ success: true })
})


// ── Dormant branch detection ─────────────────────────────────────
app.get('/api/mindmap/dormant', (req, res) => {
  const d = db()
  const nodes    = d.mindMapNodes || []
  const journey  = d.journey      || []
  const now      = Date.now()
  const DORMANT_DAYS = 10

  // Find nodes with no journal activity in last DORMANT_DAYS days
  const dormant = nodes.filter(n => {
    if (!n.date) return false
    const nodeDate = new Date(n.date).getTime()
    const daysSince = (now - nodeDate) / (1000 * 60 * 60 * 24)
    if (daysSince < DORMANT_DAYS) return false
    // Check if any journey entry references this node's date range
    const hasActivity = journey.some(j => {
      const jd = new Date(j.timestamp).getTime()
      return Math.abs(jd - nodeDate) < DORMANT_DAYS * 24 * 60 * 60 * 1000
    })
    return !hasActivity
  })

  res.json(dormant.map(n => ({
    ...n,
    type:       'dormant',
    suggestion: `This area of your life has been quiet for ${Math.round((now - new Date(n.date).getTime()) / (1000 * 60 * 60 * 24))} days. Want to revisit it?`,
  })))
})



// ── Community: like / unlike ──────────────────────────────────────
app.post('/api/community/:idx/like', (req, res) => {
  const idx = parseInt(req.params.idx)
  const { liked } = req.body
  const d = db()
  d.community = d.community || []
  if (!d.community[idx]) return res.status(404).json({ error: 'Post not found' })
  d.community[idx].likes = Math.max(0, (d.community[idx].likes || 0) + (liked ? 1 : -1))
  save(d)
  res.json({ success: true, likes: d.community[idx].likes })
})

// ── Community: add comment ────────────────────────────────────────
app.post('/api/community/:idx/comment', (req, res) => {
  const idx = parseInt(req.params.idx)
  const { text, author } = req.body
  if (!text) return res.status(400).json({ error: 'text required' })
  const d = db()
  d.community = d.community || []
  if (!d.community[idx]) return res.status(404).json({ error: 'Post not found' })
  d.community[idx].comments = d.community[idx].comments || []
  const comment = { text, author: author || 'PAW User', ts: new Date().toISOString() }
  d.community[idx].comments.push(comment)
  save(d)
  res.json({ success: true, comment })
})

// ── Community: get comments ───────────────────────────────────────
app.get('/api/community/:idx/comments', (req, res) => {
  const idx = parseInt(req.params.idx)
  const d = db()
  const post = d.community?.[idx]
  if (!post) return res.status(404).json({ error: 'Post not found' })
  res.json(post.comments || [])
})

// ── Community challenges ──────────────────────────────────────────

// POST a new open challenge to community feed
app.post('/api/community/challenge', (req, res) => {
  const { fromName, routineTitle, days, routineJSON, postId } = req.body
  if (!routineTitle) return res.status(400).json({ error: 'routineTitle required' })
  const d = db()
  d.challenges = d.challenges || []
  const challenge = {
    id:           `ch_${Date.now()}`,
    fromName:     fromName || 'A PAW user',
    routineTitle,
    days:         days || 7,
    routineJSON:  routineJSON || null,
    postId:       postId ?? null,
    accepted:     0,
    declined:     0,
    createdAt:    new Date().toISOString(),
    status:       'open',
  }
  d.challenges.push(challenge)
  // Also bump adapts count on the original post
  if (postId != null && d.community[postId]) {
    d.community[postId].adapts = (d.community[postId].adapts || 0) + 1
    d.community[postId].liveCount = (d.community[postId].liveCount || 0) + 1
  }
  save(d)
  res.json({ success: true, challenge })
})

// GET incoming challenges (open, not yet responded)
app.get('/api/community/challenges/incoming', (req, res) => {
  const d = db()
  const open = (d.challenges || []).filter(c => c.status === 'open').slice(-3)
  res.json(open)
})

// GET all challenges
app.get('/api/community/challenges', (req, res) => {
  const d = db()
  res.json(d.challenges || [])
})

// POST respond to a challenge (accept/decline)
app.post('/api/community/challenge/:id/respond', (req, res) => {
  const { accepted } = req.body
  const d = db()
  d.challenges = d.challenges || []
  const ch = d.challenges.find(c => c.id === req.params.id)
  if (!ch) return res.status(404).json({ error: 'Challenge not found' })

  ch.status = accepted ? 'accepted' : 'declined'
  if (accepted) {
    ch.accepted = (ch.accepted || 0) + 1
    // If challenge has a routineJSON, activate it
    if (ch.routineJSON) {
      d.routine  = { ...ch.routineJSON, startDate: new Date().toISOString().split('T')[0], currentDay: 1, id: `routine_${Date.now()}` }
      d.standard = ch.routineJSON.standard || d.standard
    }
  } else {
    ch.declined = (ch.declined || 0) + 1
  }
  save(d)
  res.json({ success: true, accepted })
})

// ── Memories: GET all ────────────────────────────────────────────
app.get('/api/memories', (req, res) => {
  const d = db()
  res.json(d.memories || [])
})

// ── Memories: POST new ───────────────────────────────────────────
app.post('/api/memories', (req, res) => {
  const { type, content, summary, tags } = req.body
  if (!content) return res.status(400).json({ error: 'content required' })
  const d = db()
  d.memories = d.memories || []
  d.memories.push({
    id:        `mem_${Date.now()}`,
    type:      type || 'general',
    content,
    summary:   summary || content.slice(0, 80),
    tags:      tags || [],
    createdAt: new Date().toISOString(),
  })
  d.memories = d.memories.slice(-500)
  save(d)
  res.json({ success: true })
})

// ── Mind map nodes: GET all ───────────────────────────────────────
app.get('/api/mindmap/nodes', (req, res) => {
  const d = db()
  res.json(d.mindMapNodes || [])
})

// ── Mind map nodes: POST new node ────────────────────────────────
app.post('/api/mindmap/nodes', (req, res) => {
  const { type, label, parentId, date, icon, metadata } = req.body
  if (!label) return res.status(400).json({ error: 'label required' })
  const d = db()
  d.mindMapNodes = d.mindMapNodes || []
  const node = {
    id:        `node_${Date.now()}`,
    type:      type || 'event',
    label,
    parentId:  parentId || null,
    date:      date || new Date().toISOString().split('T')[0],
    icon:      icon || null,
    metadata:  metadata || {},
    createdAt: new Date().toISOString(),
  }
  d.mindMapNodes.push(node)
  save(d)
  res.json(node)
})

// ── Logs all: GET all logs for calendar coloring ──────────────────
app.get('/api/data/logs-all', (req, res) => {
  const d = db()
  res.json(d.logs || [])
})

// ─────────────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  const hasKey = KEY_POOL.length > 0

  console.log(`
╔═══════════════════════════════════════╗
║  🐾  PAW Local Server is running      ║
╠═══════════════════════════════════════╣
║  App:     http://localhost:${PORT}        ║
║  Health:  http://localhost:${PORT}/api/health  ║
║  Data:    ${path.basename(DB_FILE)}                   ║
╠═══════════════════════════════════════╣
║  AI: ${hasKey ? '✓ Gemini ready              ' : '✗ NO KEY — set GEMINI_API_KEY  '}   ║
╚═══════════════════════════════════════╝

${!hasKey ? '⚠  Run this to set your key:\n   export GEMINI_API_KEY="AIza..."\n   Then restart: node paw-server.js\n' : ''}
Press Ctrl+C to stop
`)
})
