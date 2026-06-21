// ═══════════════════════════════════════════
// PAW — Constants
// ═══════════════════════════════════════════

export const ACTIVITY_COLORS = {
  Spiritual:    '#6366f1',
  Learning:     '#f59e0b',
  Health:       '#2d9e55',
  Recovery:     '#06b6d4',
  Professional: '#8b5cf6',
  Creative:     '#ec4899',
  Travel:       '#f97316',
}

export const NODE_ICONS = {
  event:    '⚡',
  win:      '💪',
  struggle: '😔',
  decision: '🎯',
  insight:  '💡',
  growth:   '🌱',
  dormant:  '⚠️',
  photo:    '📸',
  routine:  '🔁',
}

export const QUOTES = {
  quran: [
    { text: 'Indeed, with hardship comes ease.', source: 'Quran · 94:6' },
    { text: 'Allah does not burden a soul beyond that it can bear.', source: 'Quran · 2:286' },
    { text: 'And He found you lost and guided you.', source: 'Quran · 93:7' },
  ],
  bible: [
    { text: 'I can do all things through him who strengthens me.', source: 'Philippians · 4:13' },
    { text: 'Be strong and courageous. Do not be afraid.', source: 'Joshua · 1:9' },
  ],
  stoic: [
    { text: 'We are what we repeatedly do. Excellence is not an act but a habit.', source: 'Aristotle' },
    { text: 'You have power over your mind, not outside events.', source: 'Marcus Aurelius' },
    { text: 'Waste no more time arguing about what a good man should be. Be one.', source: 'Marcus Aurelius' },
  ],
  sufi: [
    { text: 'The wound is the place where the light enters you.', source: 'Rumi' },
    { text: 'You were born with wings, why prefer to crawl through life?', source: 'Rumi' },
  ],
  african: [
    { text: 'If you want to go fast, go alone. If you want to go far, go together.', source: 'African proverb' },
    { text: 'Hurry, hurry has no blessing.', source: 'Swahili proverb' },
  ],
  universal: [
    { text: 'Indeed, with hardship comes ease.', source: 'Quran · 94:6' },
    { text: 'The wound is the place where the light enters you.', source: 'Rumi' },
    { text: 'We are what we repeatedly do.', source: 'Aristotle' },
    { text: 'If you want to go far, go together.', source: 'African proverb' },
  ],
}

export const QUOTE_LABELS = {
  quran:     'Quranic verses',
  bible:     'Biblical wisdom',
  stoic:     'Stoic philosophy',
  sufi:      'Sufi poetry',
  african:   'African proverbs',
  universal: 'wisdom from all traditions',
}

// Offline routine templates
export const ROUTINE_TEMPLATES = {
  '5am': {
    title: '5AM Morning Mastery',
    goalCategory: 'health',
    totalDays: 30,
    activities: [
      { id:'t1', name:'Wake & Hydrate',      time:'05:00', duration:'5 min',  type:'Health',   color:'#2d9e55', why:'Kickstart metabolism and clarity.', daysOfWeek:[1,2,3,4,5,6,7], critical:true  },
      { id:'t2', name:'Morning Movement',    time:'05:10', duration:'20 min', type:'Health',   color:'#2d9e55', why:'Activate body and mind before the world wakes.', daysOfWeek:[1,2,3,4,5,6,7], critical:true  },
      { id:'t3', name:'Reflection & Prayer', time:'05:30', duration:'15 min', type:'Spiritual',color:'#6366f1', why:'Ground the day in purpose.', daysOfWeek:[1,2,3,4,5,6,7], critical:true  },
      { id:'t4', name:'Deep Work Block',     time:'06:00', duration:'90 min', type:'Professional',color:'#8b5cf6',why:'Peak focus window before distractions start.', daysOfWeek:[1,2,3,4,5], critical:true  },
      { id:'t5', name:'Evening Wind Down',   time:'21:00', duration:'30 min', type:'Recovery', color:'#06b6d4', why:'Signal to body that the day is complete.', daysOfWeek:[1,2,3,4,5,6,7], critical:false },
    ],
  },
  reading: {
    title: 'Daily Reading Habit',
    goalCategory: 'learning',
    totalDays: 30,
    activities: [
      { id:'t1', name:'Morning Pages',       time:'07:00', duration:'20 min', type:'Learning', color:'#f59e0b', why:'Start with intentional learning.', daysOfWeek:[1,2,3,4,5,6,7], critical:true  },
      { id:'t2', name:'Midday Read',         time:'13:00', duration:'15 min', type:'Learning', color:'#f59e0b', why:'Break from work with enriching content.', daysOfWeek:[1,2,3,4,5,6,7], critical:false },
      { id:'t3', name:'Evening Reading',     time:'21:00', duration:'30 min', type:'Learning', color:'#f59e0b', why:'Replace screen time with books.', daysOfWeek:[1,2,3,4,5,6,7], critical:true  },
    ],
  },
  recovery: {
    title: 'Recovery & Renewal',
    goalCategory: 'recovery',
    totalDays: 90,
    activities: [
      { id:'t1', name:'Morning Reflection',  time:'06:00', duration:'15 min', type:'Spiritual',color:'#6366f1', why:'Start clear and grounded.', daysOfWeek:[1,2,3,4,5,6,7], critical:true  },
      { id:'t2', name:'Physical Activity',   time:'07:00', duration:'30 min', type:'Health',   color:'#2d9e55', why:'Body movement heals the mind.', daysOfWeek:[1,2,3,4,5,6,7], critical:true  },
      { id:'t3', name:'Urge Surfing',        time:'12:00', duration:'10 min', type:'Recovery', color:'#06b6d4', why:'Notice and release without acting.', daysOfWeek:[1,2,3,4,5,6,7], critical:true  },
      { id:'t4', name:'Evening Journal',     time:'20:00', duration:'15 min', type:'Recovery', color:'#06b6d4', why:'Process the day before sleep.', daysOfWeek:[1,2,3,4,5,6,7], critical:true  },
    ],
  },
}
