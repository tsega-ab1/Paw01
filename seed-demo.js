// PAW Demo Seed Script — ESM version
// Run from ~/paw: node paw-app/seed-demo.js

import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Data file lives one level up in ~/paw/
const DB_FILE = path.join(__dirname, '..', 'paw-data.json')

const today        = new Date()
const routineStart = new Date(today)
routineStart.setDate(routineStart.getDate() - 21)
const startStr     = routineStart.toISOString().split('T')[0]

const ROUTINE = {
  id:            'routine_demo',
  title:         '5AM Morning Mastery',
  goalStatement: 'I want to build a disciplined morning routine that sets the tone for every day',
  goalCategory:  'health',
  totalDays:     30,
  startDate:     startStr,
  currentDay:    22,
  featureFlags:  { pomodoroTimer:false, urgeLog:false, countdownVisible:true, subjectTracker:false, emergencyChat:false, prayerTimes:true },
  quotePool:     'universal',
  communityFilter:'health',
  activities: [
    { id:'act_1', name:'Wake & Hydrate',    time:'05:00', duration:'5 min',  type:'Health',      color:'#2d9e55', why:'Kickstart metabolism and clarity before the world wakes.',                        daysOfWeek:[1,2,3,4,5,6,7], critical:true  },
    { id:'act_2', name:'Fajr / Reflection', time:'05:10', duration:'15 min', type:'Spiritual',   color:'#6366f1', why:'Ground the day in purpose before anything else demands attention.',               daysOfWeek:[1,2,3,4,5,6,7], critical:true  },
    { id:'act_3', name:'Morning Movement',  time:'05:30', duration:'20 min', type:'Health',      color:'#2d9e55', why:'Activate body and mind. The run that makes everything else possible.',            daysOfWeek:[1,2,3,4,5,6,7], critical:true  },
    { id:'act_4', name:'Cold Shower',       time:'05:55', duration:'5 min',  type:'Health',      color:'#06b6d4', why:'Discomfort tolerance. What you do at 5:55am shapes who you are at noon.',        daysOfWeek:[1,2,3,4,5,6,7], critical:false },
    { id:'act_5', name:'Deep Work Block',   time:'06:00', duration:'90 min', type:'Professional',color:'#8b5cf6', why:'Peak focus window. No notifications. Just the work that moves the needle.',       daysOfWeek:[1,2,3,4,5],     critical:true  },
    { id:'act_6', name:'Evening Wind Down', time:'21:00', duration:'30 min', type:'Recovery',    color:'#06b6d4', why:'Signal to the body the day is complete. Sleep quality depends on this.',         daysOfWeek:[1,2,3,4,5,6,7], critical:false },
  ],
  checkInQuestions: [
    'What made this morning different from last week?',
    'Which activity had the most impact on your focus today?',
    'What would make tomorrow\'s morning even stronger?',
  ],
  generatedAt: routineStart.toISOString(),
  exists: true,
}

const STANDARD = {
  description: 'Perfect execution means completing all 6 activities every day, morning activities done before 6:30am and evening wind-down before 21:30.',
  weeklyTargets:   { completionRate:90, consistencyScore:85 },
  moduleTargets:   { 'health.sleep_hours':'> 7', 'screen_time.passive_minutes':'< 90', 'health.steps':'> 7000' },
  scoringWeights:  { completion:0.5, timing:0.2, modules:0.3 },
  weeklyMilestones:{
    week1: 'Establish the pattern. Hit 80%+ completion. Notice which activities feel hardest.',
    week2: 'Raise the floor. 85%+ completion. Tighten the timing on morning activities.',
    week4: 'This is your life now. 90%+ completion feels effortless. The identity has shifted.',
  },
  activities: ROUTINE.activities,
  generatedAt: routineStart.toISOString(),
  exists: true,
}

function generateLogs() {
  const logs = []
  const pattern = [
    0.9, 0.75, 0.95, 0.6, 1.0, 0.85, 0.9,
    0.95, 0.5,  1.0, 0.9, 0.85, 1.0, 0.95,
    1.0,  0.9,  1.0, 0.95, 0.85, 1.0, 0.9,
  ]
  for (let d = 0; d < 21; d++) {
    const date = new Date(routineStart)
    date.setDate(date.getDate() + d)
    const dateStr   = date.toISOString().split('T')[0]
    const dayOfWeek = date.getDay() + 1
    const pct       = pattern[d] || 0.8
    ROUTINE.activities.forEach(act => {
      if (!(act.daysOfWeek||[1,2,3,4,5,6,7]).includes(dayOfWeek)) return
      const done  = Math.random() < pct
      const [h,m] = act.time.split(':').map(Number)
      const delay = done ? Math.floor(Math.random()*8) : 0
      const doneAt= done ? `${String(h).padStart(2,'0')}:${String(m+delay).padStart(2,'0')}` : null
      logs.push({ activity:act.name, activityId:act.id, done, doneAt, date:dateStr })
    })
  }
  return logs
}

function generateModuleData() {
  const md = {}
  for (let d = 0; d < 21; d++) {
    const date = new Date(routineStart)
    date.setDate(date.getDate() + d)
    const ds = date.toISOString().split('T')[0]
    md[ds] = {
      health:      { steps: 6000+Math.floor(Math.random()*6000), sleep_hours: +(6.5+Math.random()*2).toFixed(1), recordedAt:`${ds}T20:00:00.000Z` },
      mood:        { rating: +(3+Math.random()*2).toFixed(1), moodName:['GOOD','GREAT','OKAY','GOOD','AMAZING'][Math.floor(Math.random()*5)], recordedAt:`${ds}T21:00:00.000Z` },
      screen_time: { total_minutes:60+Math.floor(Math.random()*120), passive_minutes:30+Math.floor(Math.random()*80), recordedAt:`${ds}T21:30:00.000Z` },
    }
  }
  return md
}

const JOURNEY_ENTRIES = [
  { activity:'Morning Movement', caption:'Day 3. First time I didn\'t want to stop at 20 minutes. Something shifted.',                                    daysAgo:18 },
  { activity:'Deep Work Block',  caption:'Shipped the first feature of the app at 7:30am. The silence at this hour is gold.',                            daysAgo:15 },
  { activity:'Fajr / Reflection',caption:'Started writing what I\'m grateful for before prayer. The day starts differently now.',                         daysAgo:12 },
  { activity:'Wake & Hydrate',   caption:'Day 10 streak. The alarm doesn\'t feel like an enemy anymore.',                                                 daysAgo:11 },
  { activity:'Cold Shower',      caption:'I was sure I\'d skip this forever. I haven\'t skipped once this week.',                                         daysAgo:8  },
  { activity:'Morning Movement', caption:'Ran past the old route. The city at 5:30am belongs to nobody and everybody.',                                   daysAgo:6  },
  { activity:'Deep Work Block',  caption:'Three weeks in. The identity is starting to feel real.',                                                         daysAgo:2  },
]

function generateJourney() {
  return JOURNEY_ENTRIES.map(j => {
    const d = new Date(today)
    d.setDate(d.getDate() - j.daysAgo)
    return { activity:j.activity, caption:j.caption, photo:null, timestamp:d.toISOString() }
  })
}

const COMMUNITY_POSTS = [
  { category:'health',      title:'5AM Morning Mastery · Week 3',      quote:'The alarm doesn\'t feel like an enemy anymore. Day 21. The identity is starting to feel real.',              weeks:3, blocks:[1,1,0,1,1,1,1], liveCount:4, adapts:12, sharedAt:new Date(today.getTime()-2*86400000).toISOString(),  routineJSON:ROUTINE },
  { category:'spiritual',   title:'Fajr + Reflection Streak',           quote:'Started writing what I\'m grateful for before prayer. The day starts differently now. Quieter.',             weeks:2, blocks:[1,1,1,1,0,1,1], liveCount:2, adapts:7,  sharedAt:new Date(today.getTime()-5*86400000).toISOString(),  routineJSON:null    },
  { category:'learning',    title:'Deep Work Before 8am',               quote:'Shipped the first real feature at 7:30am. Three weeks of morning deep work compressed a month of effort.',  weeks:3, blocks:[1,0,1,1,1,0,1], liveCount:6, adapts:18, sharedAt:new Date(today.getTime()-7*86400000).toISOString(),  routineJSON:null    },
  { category:'recovery',    title:'Morning Movement Streak · 14 days',  quote:'Movement is the medicine. 14 days of morning movement. Each day the urge to skip gets quieter.',           weeks:2, blocks:[1,1,1,1,1,1,1], liveCount:3, adapts:9,  sharedAt:new Date(today.getTime()-10*86400000).toISOString(), routineJSON:null    },
]

const MEMORIES = [
  { id:'m1', type:'insight',  content:'User prefers morning routines. Energy peaks before 8am.',              summary:'Prefers mornings',           tags:['routine','timing'],      createdAt:new Date(today.getTime()-20*86400000).toISOString() },
  { id:'m2', type:'struggle', content:'Missed 3 days in week 2 due to late work deadline. Felt guilty.',     summary:'Late work caused 3 misses',  tags:['work','struggle'],       createdAt:new Date(today.getTime()-13*86400000).toISOString() },
  { id:'m3', type:'win',      content:'Completed first 7-day streak. Celebrated with a longer run.',         summary:'First 7-day streak done',    tags:['win','streak'],          createdAt:new Date(today.getTime()-14*86400000).toISOString() },
  { id:'m4', type:'insight',  content:'Cold shower is the most impactful activity for mental resilience.',   summary:'Cold shower = key habit',    tags:['insight','resilience'],  createdAt:new Date(today.getTime()-8*86400000).toISOString()  },
  { id:'m5', type:'decision', content:'Decided to extend the routine to 60 days after feeling results.',     summary:'Extending to 60 days',       tags:['decision','commitment'], createdAt:new Date(today.getTime()-1*86400000).toISOString()  },
]

// Read existing DB if present (preserve profile/conversations)
let existing = {}
if (fs.existsSync(DB_FILE)) {
  try { existing = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) } catch {}
}

const demo = {
  ...existing,
  profile:      existing.profile?.name ? existing.profile : { name:'Tse', field:'Technology', updatedAt:new Date().toISOString() },
  routine:      { ...ROUTINE, exists:true },
  standard:     STANDARD,
  logs:         generateLogs(),
  moduleData:   generateModuleData(),
  journey:      generateJourney(),
  community:    COMMUNITY_POSTS,
  memories:     MEMORIES,
  mindMapNodes: [],
  challenges:   [],
  conversations:existing.conversations || [],
  analyses:     existing.analyses      || [],
  checkins:     existing.checkins      || [],
}

fs.writeFileSync(DB_FILE, JSON.stringify(demo, null, 2))

console.log(`
╔═══════════════════════════════════════╗
║  🌱  PAW Demo Data Seeded             ║
╠═══════════════════════════════════════╣
║  Profile:   ${(demo.profile.name + '                     ').slice(0,21)} ║
║  Routine:   5AM Morning Mastery       ║
║  Days:      21 days of logs           ║
║  Journey:   ${demo.journey.length} entries              ║
║  Community: ${demo.community.length} posts               ║
║  Memories:  ${demo.memories.length} extracted facts      ║
║  Data file: paw-data.json             ║
╚═══════════════════════════════════════╝

Now restart the server: node paw-server.js
`)
