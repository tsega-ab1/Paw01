import { useEffect, useCallback } from 'react'
import { api } from '../lib/api.js'

/**
 * useNativeBridge
 * Mount once in App.jsx.
 * Listens to all CustomEvents fired by js_bridge.js
 * and routes data into React state + PAW server.
 */
export function useNativeBridge({ state }) {
  const { setProfile } = state

  // ── Health Connect data ──────────────────────────────────────────
  const onHealth = useCallback(async (e) => {
    const data = e.detail
    if (!data) return

    // Push to server so PAW memory + analysis has it
    try {
      if (data.steps       > 0) await api.logModule('health',      { steps: data.steps, sleep_hours: data.sleep_hours, resting_hr: data.resting_hr, calories: data.calories })
      if (data.sleep_hours > 0) await api.logModule('health',      { sleep_hours: data.sleep_hours })
    } catch {}

    // Store on window for Profile to read synchronously
    window._pawHealthData = data
    window.dispatchEvent(new CustomEvent('paw:health:react', { detail: data }))
  }, [])

  // ── Live step counter ────────────────────────────────────────────
  const onSteps = useCallback((e) => {
    const data = e.detail
    if (!data) return
    window._pawSteps = data
    window.dispatchEvent(new CustomEvent('paw:steps:react', { detail: data }))
  }, [])

  // ── Digital Wellbeing usage ──────────────────────────────────────
  const onUsage = useCallback(async (e) => {
    const data = e.detail
    if (!data) return

    // Push screen time to server
    try {
      if (data.screen_time_minutes > 0) {
        await api.logModule('screen_time', {
          total_minutes:   data.screen_time_minutes,
          passive_minutes: data.top_app_minutes || 0,
        })
      }
    } catch {}

    window._pawUsageData = data
    window.dispatchEvent(new CustomEvent('paw:usage:react', { detail: data }))
  }, [])

  // ── Camera photo result ──────────────────────────────────────────
  const onPhoto = useCallback(async (e) => {
    const data = e.detail
    if (!data?.base64) return

    const ctx = window._pendingCameraActivity || {}
    window._pendingCameraActivity = null

    // Save to journal automatically
    try {
      await api.addJourney({
        activity:  ctx.activityName || 'Captured moment',
        caption:   `${ctx.activityName || 'Activity'} · captured`,
        imageData: `data:image/jpeg;base64,${data.base64}`,
      })
      state.refreshJourney?.()
    } catch {}

    // Also notify any pending camera waiters in ActivityCard
    window._pendingPhoto = {
      activityId:  ctx.activityId,
      activityName:ctx.activityName,
      imageData:   `data:image/jpeg;base64,${data.base64}`,
      timestamp:   new Date().toISOString(),
    }
  }, [state])

  // ── Location ─────────────────────────────────────────────────────
  const onLocation = useCallback(async (e) => {
    const data = e.detail
    if (!data || data.error) return

    window._pawLocation = data

    // Inject location into profile context for PAW memory
    try {
      await api.saveProfile({
        last_location_at: new Date().toISOString(),
        location_lat:     data.latitude,
        location_lng:     data.longitude,
      })
    } catch {}
  }, [])

  // ── Calendar events ──────────────────────────────────────────────
  const onCalendar = useCallback((e) => {
    const data = e.detail
    if (!data?.events) return
    window._pawCalendar = data.events
    // Inject into chat context if PAW is mid-conversation
    window.dispatchEvent(new CustomEvent('paw:calendar:react', { detail: data.events }))
  }, [])

  // ── Permissions ──────────────────────────────────────────────────
  const onPermission = useCallback((e) => {
    const data = e.detail
    window.dispatchEvent(new CustomEvent('paw:permission:react', { detail: data }))
  }, [])

  // ── Mount / unmount ──────────────────────────────────────────────
  useEffect(() => {
    window.addEventListener('paw:health',   onHealth)
    window.addEventListener('paw:steps',    onSteps)
    window.addEventListener('paw:usage',    onUsage)
    window.addEventListener('paw:photo',    onPhoto)
    window.addEventListener('paw:location', onLocation)
    window.addEventListener('paw:calendar', onCalendar)
    window.addEventListener('paw:permission', onPermission)

    return () => {
      window.removeEventListener('paw:health',   onHealth)
      window.removeEventListener('paw:steps',    onSteps)
      window.removeEventListener('paw:usage',    onUsage)
      window.removeEventListener('paw:photo',    onPhoto)
      window.removeEventListener('paw:location', onLocation)
      window.removeEventListener('paw:calendar', onCalendar)
      window.removeEventListener('paw:permission', onPermission)
    }
  }, [onHealth, onSteps, onUsage, onPhoto, onLocation, onCalendar, onPermission])
}
