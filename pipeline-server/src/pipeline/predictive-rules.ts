// paw-server/src/pipeline/predictive-rules.ts
//
// ════════════════════════════════════════════════════════════════════════
// READ THIS BEFORE TRUSTING THE NUMBERS BELOW
//
// Two different claims are easy to conflate here, and this file is honest
// about which one it's making:
//
//   CLAIM A ("these factors matter, in this direction"):
//   evidence-grounded. Sleep, stress, craving, social isolation, cue
//   exposure, and self-efficacy are all genuinely identified risk/protective
//   factors in the addiction and behavioral-medicine literature (see
//   citations on each rule below).
//
//   CLAIM B ("here is the exact point value each factor contributes, and
//   here is how they combine"):
//   NOT evidence-grounded, and no published, internationally validated
//   version of this claim exists for any system, anywhere. This is a known
//   property of the JITAI field, not a gap specific to PAW: real deployed
//   systems (e.g. Nahum-Shani et al.'s HeartSteps, Sense2Stop) don't
//   validate their combination weights against a published table -- they
//   validate the deployed system's actual effect empirically, via
//   micro-randomized trials, AFTER it's built and running on real outcome
//   data (see Nahum-Shani et al. 2018, Annals of Behavioral Medicine, for
//   the methodology). The weights below are a transparent, inspectable,
//   *tunable starting point* -- not a finding.
//
// What this means practically: trust the rule NAMES and DIRECTIONS as
// reflecting real research. Treat every DELTA VALUE as a placeholder meant
// to be replaced by outcome-tracking.ts data over time, once enough
// pre/post intervention deltas exist to estimate real weights for this
// specific person. That's what closes the loop honestly -- not a citation.
// ════════════════════════════════════════════════════════════════════════
//
// A composable, multi-factor rule engine for estimating risk and readiness.
//
// Design principles grounded in the research:
//
//   1. No single factor is decisive. Witkiewitz & Marlatt (2004) showed
//      that relapse is governed by nonlinear interactions between biological,
//      psychological, social, and environmental factors -- not thresholds on
//      any one variable.
//
//   2. Protective factors are first-class. A rule can lower risk, not just
//      raise it. Missing this was the main flaw in the original base-50
//      placeholder.
//
//   3. Interaction rules fire on combinations. A rule that fires only when
//      multiple conditions are simultaneously true adds more than the sum of
//      its parts, reflecting the empirical finding that co-occurrence of risk
//      factors produces nonlinear uplift (e.g. Sinha 2007 on stress+cue
//      interaction in craving; Brower 2001 on sleep+relapse).
//
//   4. Rules are named and tagged. This makes the engine's reasoning
//      inspectable -- the response object carries which rules fired, so the
//      UI can explain "risk elevated tonight because:" rather than producing
//      an opaque number.
//
// References used in rule design (not fabricated):
//   - Witkiewitz & Marlatt (2004), Relapse prevention for alcohol and drug
//     problems. American Psychologist.
//   - Sinha (2007), The role of stress in addiction relapse. Current
//     Psychiatry Reports.
//   - Brower (2001), Alcohol's effects on sleep in alcoholics. Alcohol
//     Research & Health.
//   - Bandura (1997), Self-efficacy: The exercise of control. For
//     confidence/self-efficacy rules.
//   - Cohen & Wills (1985), Stress, social support, and the buffering
//     hypothesis. Psychological Bulletin.
//   - Morin et al. (2003), Valerian-melatonin study and sleep hygiene as
//     protective factors in substance use.
//   - Erickson (1998), Environmental cue reactivity in addiction. For
//     location-based rules.
//   - Baumeister et al. (1998), Ego depletion. For fatigue + decision
//     quality interaction.

import { ContextSnapshot } from '../types/pipeline-types';

export interface RuleResult {
  name: string;
  delta: number;   // positive = raises risk, negative = lowers risk
  domain: 'biological' | 'psychological' | 'social' | 'environmental' | 'interaction' | 'protective';
  fired: boolean;
}

export interface RiskAssessment {
  score: number;          // 0-100, clamped
  level: 'LOW' | 'ELEVATED' | 'HIGH';
  firedRules: RuleResult[];
  dominantDomain: string;
}

type Rule = (ctx: ContextSnapshot) => RuleResult;

// ─── BIOLOGICAL RULES ───────────────────────────────────────────────────────

const r_poor_sleep_quality: Rule = (ctx) => ({
  name: 'poor_sleep_quality',
  delta: ctx.sleepQualityLastNight < 4 ? 18 : ctx.sleepQualityLastNight < 6 ? 8 : 0,
  domain: 'biological',
  fired: ctx.sleepQualityLastNight < 6,
});

const r_short_sleep_duration: Rule = (ctx) => ({
  name: 'short_sleep_duration',
  delta: ctx.sleepHoursLastNight < 5 ? 22 : ctx.sleepHoursLastNight < 6 ? 12 : 0,
  domain: 'biological',
  fired: ctx.sleepHoursLastNight < 6,
});

const r_accumulated_sleep_debt: Rule = (ctx) => ({
  // Brower (2001): cumulative sleep deprivation substantially raises relapse
  // risk beyond any single night's loss.
  name: 'accumulated_sleep_debt',
  delta: ctx.sleepDebtDays >= 3 ? 20 : ctx.sleepDebtDays >= 2 ? 10 : 0,
  domain: 'biological',
  fired: ctx.sleepDebtDays >= 2,
});

const r_high_fatigue: Rule = (ctx) => ({
  name: 'high_fatigue',
  delta: ctx.fatigueLevel >= 8 ? 15 : ctx.fatigueLevel >= 6 ? 7 : 0,
  domain: 'biological',
  fired: ctx.fatigueLevel >= 6,
});

const r_exercise_protective: Rule = (ctx) => ({
  // Physical activity is a well-documented protective factor for mood
  // regulation and craving reduction.
  name: 'exercise_today',
  delta: ctx.exerciseMinutesToday >= 30 ? -12 : ctx.exerciseMinutesToday >= 15 ? -5 : 0,
  domain: 'protective',
  fired: ctx.exerciseMinutesToday >= 15,
});

const r_good_sleep_protective: Rule = (ctx) => ({
  name: 'good_sleep_protective',
  delta: ctx.sleepQualityLastNight >= 8 && ctx.sleepHoursLastNight >= 7 ? -10 : 0,
  domain: 'protective',
  fired: ctx.sleepQualityLastNight >= 8 && ctx.sleepHoursLastNight >= 7,
});

// ─── PSYCHOLOGICAL RULES ────────────────────────────────────────────────────

const r_high_craving: Rule = (ctx) => ({
  name: 'high_craving',
  delta: ctx.cravingScore >= 8 ? 30 : ctx.cravingScore >= 6 ? 20 : ctx.cravingScore >= 4 ? 8 : 0,
  domain: 'psychological',
  fired: ctx.cravingScore >= 4,
});

const r_high_stress: Rule = (ctx) => ({
  // Sinha (2007): stress is one of the strongest predictors of craving and
  // relapse, operating partly through CRF and cortisol pathways.
  name: 'high_stress',
  delta: ctx.stressLevel >= 8 ? 22 : ctx.stressLevel >= 6 ? 12 : 0,
  domain: 'psychological',
  fired: ctx.stressLevel >= 6,
});

const r_low_mood: Rule = (ctx) => ({
  name: 'low_mood',
  delta: ctx.moodScore <= 3 ? 18 : ctx.moodScore <= 5 ? 8 : 0,
  domain: 'psychological',
  fired: ctx.moodScore <= 5,
});

const r_low_self_efficacy: Rule = (ctx) => ({
  // Bandura (1997): confidence in one's ability to cope without substances
  // is one of the most reliable individual-level predictors of outcome.
  name: 'low_self_efficacy',
  delta: ctx.confidenceScore <= 3 ? 15 : ctx.confidenceScore <= 5 ? 7 : 0,
  domain: 'psychological',
  fired: ctx.confidenceScore <= 5,
});

const r_low_motivation: Rule = (ctx) => ({
  name: 'low_motivation',
  delta: ctx.motivationScore <= 3 ? 12 : ctx.motivationScore <= 5 ? 5 : 0,
  domain: 'psychological',
  fired: ctx.motivationScore <= 5,
});

const r_high_confidence_protective: Rule = (ctx) => ({
  name: 'high_self_efficacy_protective',
  delta: ctx.confidenceScore >= 8 ? -12 : ctx.confidenceScore >= 7 ? -6 : 0,
  domain: 'protective',
  fired: ctx.confidenceScore >= 7,
});

// ─── SOCIAL RULES ───────────────────────────────────────────────────────────

const r_social_isolation: Rule = (ctx) => ({
  // Social withdrawal is both a prodrome and an accelerant of relapse.
  name: 'social_isolation',
  delta: ctx.hoursSinceLastSocialContact >= 48 ? 18 : ctx.hoursSinceLastSocialContact >= 24 ? 9 : 0,
  domain: 'social',
  fired: ctx.hoursSinceLastSocialContact >= 24,
});

const r_recent_conflict: Rule = (ctx) => ({
  name: 'recent_interpersonal_conflict',
  delta: ctx.recentConflict ? 20 : 0,
  domain: 'social',
  fired: ctx.recentConflict,
});

const r_low_social_support: Rule = (ctx) => ({
  // Cohen & Wills (1985): perceived social support buffers the effect of
  // stress. Low support amplifies risk; high support attenuates it.
  name: 'low_perceived_social_support',
  delta: ctx.perceivedSocialSupport <= 3 ? 15 : ctx.perceivedSocialSupport <= 5 ? 7 : 0,
  domain: 'social',
  fired: ctx.perceivedSocialSupport <= 5,
});

const r_high_social_support_protective: Rule = (ctx) => ({
  name: 'high_social_support_protective',
  delta: ctx.perceivedSocialSupport >= 8 ? -15 : ctx.perceivedSocialSupport >= 7 ? -8 : 0,
  domain: 'protective',
  fired: ctx.perceivedSocialSupport >= 7,
});

// ─── ENVIRONMENTAL RULES ────────────────────────────────────────────────────

const r_high_cue_exposure: Rule = (ctx) => ({
  // Erickson (1998): environmental cues (sights, smells, social triggers)
  // activate conditioned craving through learned associations. High cue
  // exposure is one of the most proximal relapse risk factors.
  name: 'high_substance_cue_exposure',
  delta: ctx.substanceCueExposure >= 8 ? 28 : ctx.substanceCueExposure >= 5 ? 15 : 0,
  domain: 'environmental',
  fired: ctx.substanceCueExposure >= 5,
});

const r_location_risk: Rule = (ctx) => {
  const loc = ctx.location.toLowerCase();
  const highRiskLocation = ['bar', 'pub', 'club', 'liquor', 'bottle shop', 'tavern'].some((k) => loc.includes(k));
  const mediumRiskLocation = ['party', 'social event', 'restaurant'].some((k) => loc.includes(k));
  return {
    name: 'risk_location',
    delta: highRiskLocation ? 28 : mediumRiskLocation ? 12 : 0,
    domain: 'environmental',
    fired: highRiskLocation || mediumRiskLocation,
  };
};

const r_late_night_high_screen: Rule = (ctx) => ({
  // Late-night high screen time is associated with disrupted sleep, emotional
  // dysregulation, and reduced inhibitory control the following day.
  name: 'late_night_high_screen_time',
  delta: ctx.timeOfDay >= 22 && ctx.screenTimeMinutesToday > 240 ? 14 : 0,
  domain: 'environmental',
  fired: ctx.timeOfDay >= 22 && ctx.screenTimeMinutesToday > 240,
});

const r_weekend_evening: Rule = (ctx) => ({
  // Friday/Saturday evenings are empirically higher-risk windows for
  // alcohol-related triggers in population-level studies.
  name: 'weekend_evening',
  delta: [5, 6].includes(ctx.weekday) && ctx.timeOfDay >= 18 && ctx.timeOfDay < 24 ? 8 : 0,
  domain: 'environmental',
  fired: [5, 6].includes(ctx.weekday) && ctx.timeOfDay >= 18 && ctx.timeOfDay < 24,
});

// ─── BEHAVIOURAL HISTORY RULES ──────────────────────────────────────────────

const r_recent_lapse_history: Rule = (ctx) => ({
  name: 'recent_lapse_history',
  delta: ctx.recentLapseCount >= 3 ? 22 : ctx.recentLapseCount >= 1 ? 10 : 0,
  domain: 'psychological',
  fired: ctx.recentLapseCount >= 1,
});

const r_low_task_completion: Rule = (ctx) => ({
  name: 'low_7d_task_completion',
  delta: ctx.taskCompletionRate7d < 0.3 ? 15 : ctx.taskCompletionRate7d < 0.5 ? 7 : 0,
  domain: 'psychological',
  fired: ctx.taskCompletionRate7d < 0.5,
});

const r_strong_streak_protective: Rule = (ctx) => ({
  name: 'strong_streak_protective',
  delta: ctx.currentStreak >= 14 ? -15 : ctx.currentStreak >= 7 ? -8 : ctx.currentStreak >= 3 ? -3 : 0,
  domain: 'protective',
  fired: ctx.currentStreak >= 3,
});

const r_morning_anchor_completed: Rule = (ctx) => ({
  // Completing the morning anchor is both a direct protective behaviour and
  // a proxy for ongoing engagement with the programme.
  name: 'morning_anchor_completed',
  delta: ctx.completedMorningAnchor ? -10 : 5,
  domain: 'protective',
  fired: true, // Always evaluated; fires differently based on completion
});

const r_high_task_completion_protective: Rule = (ctx) => ({
  name: 'high_7d_completion_protective',
  delta: ctx.taskCompletionRate7d >= 0.8 ? -10 : 0,
  domain: 'protective',
  fired: ctx.taskCompletionRate7d >= 0.8,
});

// ─── INTERACTION / NONLINEAR COMBINATION RULES ──────────────────────────────

const r_stress_plus_cue: Rule = (ctx) => ({
  // Sinha (2007): stress + cue co-exposure produces substantially higher
  // craving than either alone (nonlinear synergy).
  name: 'interaction_stress_x_cue',
  delta: ctx.stressLevel >= 6 && ctx.substanceCueExposure >= 5 ? 22 : 0,
  domain: 'interaction',
  fired: ctx.stressLevel >= 6 && ctx.substanceCueExposure >= 5,
});

const r_isolation_plus_low_mood: Rule = (ctx) => ({
  name: 'interaction_isolation_x_low_mood',
  delta: ctx.hoursSinceLastSocialContact >= 24 && ctx.moodScore <= 4 ? 20 : 0,
  domain: 'interaction',
  fired: ctx.hoursSinceLastSocialContact >= 24 && ctx.moodScore <= 4,
});

const r_craving_plus_location: Rule = (ctx) => {
  const loc = ctx.location.toLowerCase();
  const highRisk = ['bar', 'pub', 'club', 'liquor'].some((k) => loc.includes(k));
  return {
    name: 'interaction_craving_x_risky_location',
    delta: ctx.cravingScore >= 5 && highRisk ? 25 : 0,
    domain: 'interaction',
    fired: ctx.cravingScore >= 5 && highRisk,
  };
};

const r_poor_sleep_plus_stress: Rule = (ctx) => ({
  // Baumeister et al. (1998): sleep deprivation degrades self-regulatory
  // capacity; when combined with high stress the resulting impairment in
  // executive control is disproportionate.
  name: 'interaction_sleep_debt_x_stress',
  delta: ctx.sleepDebtDays >= 2 && ctx.stressLevel >= 7 ? 18 : 0,
  domain: 'interaction',
  fired: ctx.sleepDebtDays >= 2 && ctx.stressLevel >= 7,
});

const r_conflict_plus_isolation: Rule = (ctx) => ({
  name: 'interaction_conflict_x_isolation',
  delta: ctx.recentConflict && ctx.hoursSinceLastSocialContact >= 24 ? 16 : 0,
  domain: 'interaction',
  fired: ctx.recentConflict && ctx.hoursSinceLastSocialContact >= 24,
});

const r_craving_plus_low_efficacy: Rule = (ctx) => ({
  // High craving alone is manageable if self-efficacy is intact; the
  // dangerous combination is high craving + low confidence to resist it.
  name: 'interaction_craving_x_low_efficacy',
  delta: ctx.cravingScore >= 6 && ctx.confidenceScore <= 4 ? 20 : 0,
  domain: 'interaction',
  fired: ctx.cravingScore >= 6 && ctx.confidenceScore <= 4,
});

const r_fatigue_plus_low_motivation: Rule = (ctx) => ({
  // Ego depletion (Baumeister 1998): high fatigue + low motivation
  // substantially impairs decision quality around high-temptation choices.
  name: 'interaction_fatigue_x_low_motivation',
  delta: ctx.fatigueLevel >= 7 && ctx.motivationScore <= 3 ? 15 : 0,
  domain: 'interaction',
  fired: ctx.fatigueLevel >= 7 && ctx.motivationScore <= 3,
});

const r_lapse_history_plus_cue: Rule = (ctx) => ({
  name: 'interaction_lapse_history_x_cue',
  delta: ctx.recentLapseCount >= 2 && ctx.substanceCueExposure >= 5 ? 20 : 0,
  domain: 'interaction',
  fired: ctx.recentLapseCount >= 2 && ctx.substanceCueExposure >= 5,
});

const r_high_support_buffers_stress: Rule = (ctx) => ({
  // Cohen & Wills (1985) buffering hypothesis: social support specifically
  // reduces the impact of stress rather than just adding a flat benefit.
  name: 'protective_support_buffers_stress',
  delta: ctx.perceivedSocialSupport >= 7 && ctx.stressLevel >= 6 ? -15 : 0,
  domain: 'protective',
  fired: ctx.perceivedSocialSupport >= 7 && ctx.stressLevel >= 6,
});

// ─── ENGINE ─────────────────────────────────────────────────────────────────

const ALL_RULES: Rule[] = [
  // Biological
  r_poor_sleep_quality,
  r_short_sleep_duration,
  r_accumulated_sleep_debt,
  r_high_fatigue,
  r_exercise_protective,
  r_good_sleep_protective,
  // Psychological
  r_high_craving,
  r_high_stress,
  r_low_mood,
  r_low_self_efficacy,
  r_low_motivation,
  r_high_confidence_protective,
  // Social
  r_social_isolation,
  r_recent_conflict,
  r_low_social_support,
  r_high_social_support_protective,
  // Environmental
  r_high_cue_exposure,
  r_location_risk,
  r_late_night_high_screen,
  r_weekend_evening,
  // Behavioural history
  r_recent_lapse_history,
  r_low_task_completion,
  r_strong_streak_protective,
  r_morning_anchor_completed,
  r_high_task_completion_protective,
  // Interaction / nonlinear
  r_stress_plus_cue,
  r_isolation_plus_low_mood,
  r_craving_plus_location,
  r_poor_sleep_plus_stress,
  r_conflict_plus_isolation,
  r_craving_plus_low_efficacy,
  r_fatigue_plus_low_motivation,
  r_lapse_history_plus_cue,
  r_high_support_buffers_stress,
];

export function assessRisk(ctx: ContextSnapshot): RiskAssessment {
  const results = ALL_RULES.map((rule) => rule(ctx));
  const firedRules = results.filter((r) => r.fired);

  const rawScore = firedRules.reduce((sum, r) => sum + r.delta, 0);
  const score = Math.min(100, Math.max(0, rawScore));

  // Dominant domain: whichever contributed the most total delta
  const domainTotals: Record<string, number> = {};
  for (const r of firedRules) {
    domainTotals[r.domain] = (domainTotals[r.domain] ?? 0) + Math.abs(r.delta);
  }
  const dominantDomain = Object.entries(domainTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'none';

  const level: RiskAssessment['level'] = score >= 55 ? 'HIGH' : score >= 28 ? 'ELEVATED' : 'LOW';

  return { score, level, firedRules, dominantDomain };
}
