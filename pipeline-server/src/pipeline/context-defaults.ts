// paw-server/src/pipeline/context-defaults.ts
import { ContextSnapshot } from '../types/pipeline-types';

export type ContextOverrides = Partial<ContextSnapshot>;

export function createDefaultContextSnapshot(overrides: ContextOverrides = {}): ContextSnapshot {
  const now = new Date();
  return {
    // Environmental
    location: 'unknown',
    timeOfDay: now.getHours(),
    weekday: now.getDay(),
    screenTimeMinutesToday: 0,
    lastActivityTimestamp: now.getTime(),
    substanceCueExposure: 0,
    // Biological
    stepsToday: 0,
    sleepQualityLastNight: 6,
    sleepHoursLastNight: 7,
    sleepDebtDays: 0,
    fatigueLevel: 3,
    exerciseMinutesToday: 0,
    // Psychological
    cravingScore: 0,
    stressLevel: 3,
    moodScore: 6,
    confidenceScore: 6,
    motivationScore: 6,
    // Social
    hoursSinceLastSocialContact: 8,
    recentConflict: false,
    perceivedSocialSupport: 6,
    // Behavioural history
    currentStreak: 0,
    recentLapseCount: 0,
    completedMorningAnchor: false,
    taskCompletionRate7d: 0.5,
    ...overrides,
  };
}
