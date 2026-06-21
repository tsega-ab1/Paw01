// ═══════════════════════════════════════════
// PAW API — all backend calls
// ═══════════════════════════════════════════

const BASE = ((typeof window !== 'undefined' && window.PAW_API_BASE) || 'http://localhost:3000') + '/api'

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(BASE + path, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

export const api = {
  // Health
  health: ()                     => req('GET',  '/health'),

  // Profile
  getProfile: ()                 => req('GET',  '/profile'),
  saveProfile: (data)            => req('PATCH', '/profile', data),
  savePrefs:   (data)            => req('POST',  '/profile/prefs', data),

  // Routine
  getRoutine: ()                 => req('GET',  '/routine/active'),
  getStandard: ()                => req('GET',  '/standard/active'),

  // Goal generation
  generateGoal: (goalStatement)  => req('POST', '/goal/generate', { goalStatement }),

  // Logs
  logActivity: (data)            => req('POST', '/log/activity', data),
  logCheckin: (data)             => req('POST', '/log/checkin', data),
  logModule: (moduleId, data)    => req('POST', `/log/module/${moduleId}`, data),

  // Data
  getSummary: ()                 => req('GET',  '/data/summary'),
  getCompare: ()                 => req('GET',  '/data/compare'),

  // Analysis
  analyse: ()                    => req('POST', '/analyse', {}),

  // Chat
  chat: (message, sessionId, history) =>
    req('POST', '/chat', { message, sessionId, history }),

  // Conversations
  getConversations: ()           => req('GET',  '/conversations'),
  getConversation: (id)          => req('GET',  `/conversations/${id}`),

  // Journey
  getJourney: ()                 => req('GET',  '/journey'),
  addJourney: (data)             => req('POST', '/journey', data),

  // Community
  getCommunity: ()               => req('GET',  '/community/full'),
  postCommunity: (data)          => req('POST', '/community', data),
  adaptRoutine: (idx)            => req('POST', `/community/${idx}/adapt`),

  // Memory
  getMemories: ()                => req('GET',  '/memories'),
  addMemory: (data)              => req('POST', '/memories', data),

  // Mind map nodes
  getNodes: ()                   => req('GET',  '/mindmap/nodes'),
  addNode: (data)                => req('POST', '/mindmap/nodes', data),

  // Modules
  getModules: ()                 => req('GET',  '/modules'),

  // Rearrange
  proposeRearrange: (request)    => req('POST', '/routine/rearrange', { request }),
  confirmRearrange: (activities) => req('POST', '/routine/rearrange/confirm', { activities }),

  // Analyses history
  getAnalyses: ()                => req('GET',  '/analyses'),

  // Alarms (Flutter bridge) — matches SCHEDULE_NOTIFICATION handler in paw_app_screen.dart
  scheduleAlarms: (activities) => {
    if (!window.pawSend) return
    activities.forEach((act, i) => {
      const [h, m] = (act.time || '08:00').split(':')
      window.pawSend('SCHEDULE_NOTIFICATION', {
        id:     Math.abs(act.id?.split('').reduce((a, c) => a + c.charCodeAt(0), 0) || i + 100),
        title:  `🐾 ${act.name}`,
        body:   act.why || `Time for ${act.name}`,
        time:   `${h.padStart(2,'0')}:${(m||'00').padStart(2,'0')}`,
        repeat: 'daily',
      })
    })
  },

  // Camera (Flutter bridge) — matches CAPTURE_PHOTO handler in paw_app_screen.dart
  openCamera: (activityName, activityId) => {
    if (!window.pawSend) return
    // Store context so onNativePhoto callback knows which activity it belongs to
    window._pendingCameraActivity = { activityName, activityId }
    window.pawSend('CAPTURE_PHOTO', { lens: 'back' })
  },
}
