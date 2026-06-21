import { useEffect, useState } from 'react'

function getTimeSlot() {
  const h = new Date().getHours()
  if (h >= 5  && h < 7)  return 'time-dawn'
  if (h >= 7  && h < 13) return 'time-morning'
  if (h >= 13 && h < 18) return 'time-afternoon'
  if (h >= 18 && h < 21) return 'time-evening'
  return 'time-night'
}

function getTimeLabel(slot) {
  return {
    'time-dawn':      '🌅 Dawn',
    'time-morning':   '☀️ Morning',
    'time-afternoon': '🌤 Afternoon',
    'time-evening':   '🌆 Evening',
    'time-night':     '🌙 Night',
  }[slot] || ''
}

function formatTime() {
  const now  = new Date()
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const h12  = now.getHours() % 12 || 12
  const m    = String(now.getMinutes()).padStart(2, '0')
  const ap   = now.getHours() >= 12 ? 'pm' : 'am'
  return `${days[now.getDay()]} ${h12}:${m}${ap}`
}

export function useTimeTheme() {
  const [slot,    setSlot]    = useState(getTimeSlot())
  const [timeStr, setTimeStr] = useState(formatTime())

  useEffect(() => {
    const update = () => {
      const s = getTimeSlot()
      setSlot(s)
      setTimeStr(formatTime())
      document.body.className = s
      document.title = `PAW · ${getTimeLabel(s)}`
    }
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [])

  return { slot, timeStr, label: getTimeLabel(slot) }
}
