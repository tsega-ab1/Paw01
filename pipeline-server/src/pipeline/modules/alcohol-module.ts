// paw-server/src/pipeline/modules/alcohol-module.ts
import { RecoveryModule, ModuleIntakeDefinition } from '../../types/pipeline-types';

export const ALCOHOL_MODULE: RecoveryModule = {
  id: 'alcohol',
  displayName: 'Alcohol Cessation',
  priorityTier: 1,
  components: {
    morningAnchor: {
      id: 'alc_morning_anchor',
      type: 'scheduled_task',
      content: { sunlight_min: 15, protein_g: 30, hydration_ml: 500 },
      energyCost: 2,
      evidenceBase: 'circadian_reentrainment_glucose_stabilization',
    },
    urgeSurfing: {
      id: 'alc_urge_surf',
      type: 'micro_intervention',
      durationSec: 600,
      content: { audioGuided: true, textFallback: true, vasPrePost: true },
      energyCost: 1,
      evidenceBase: 'MBRP_RCT_craving_duration_reduction',
    },
    triggerLog: {
      id: 'alc_trigger_log',
      type: 'tracking',
      fields: ['antecedent', 'behavior', 'consequence', 'emotion', 'location'],
      evidenceBase: 'BSCT_functional_analysis',
    },
    eveningRitual: {
      id: 'alc_evening_ritual',
      type: 'scheduled_task',
      content: { na_beverage: true, wind_down_block_min: 90 },
      energyCost: 2,
      evidenceBase: 'cue_extinction_choice_architecture',
    },
    lapseProtocol: {
      id: 'alc_lapse_protocol',
      type: 'crisis_response',
      steps: ['self_compassion_script', 'safety_check', 'abc_log_2hr'],
      evidenceBase: 'shame_free_reengagement',
    },
  },
  pipelineConfig: {
    LINEAR_JITAI: {
      taskOrder: ['alc_morning_anchor', 'alc_trigger_log', 'alc_evening_ritual'],
      maxDaily: 4,
    },
    PARALLEL_STREAM: {
      reflectiveTasks: ['alc_morning_anchor', 'alc_evening_ritual', 'alc_trigger_log'],
      impulsiveTriggers: ['alc_urge_surf', 'alc_lapse_protocol'],
    },
    HIERARCHICAL_CASCADE: {
      tier1Fixed: ['alc_morning_anchor', 'alc_evening_ritual'],
      tier2Options: ['alc_trigger_log', 'alc_urge_surf'],
      tier3UserEditable: ['alc_evening_ritual', 'alc_trigger_log'],
    },
    PREDICTIVE_PREEMPTIVE: {
      protectiveSafeguards: ['alc_lapse_protocol'],
      preemptiveBuffers: ['alc_urge_surf', 'alc_evening_ritual'],
      predictorFeatures: ['location_near_bar', 'evening_screen_velocity', 'sleep_debt', 'social_isolation_hours'],
    },
  },
  crossTriggers: [],
};

// AUDIT-C: the 3-item consumption subset of the WHO's 10-item AUDIT,
// validated by Bush, Kivlahan, McDonell et al. (1998) and recommended by the
// US Preventive Services Task Force as a brief alcohol screen. Scored 0-12.
// Validated positive-screen cutoffs: >=4 for men, >=3 for women -- the lower
// cutoff for women reflects validated sex differences in risk thresholds, not
// an assumption added here. This screens for hazardous/harmful drinking; it
// does not diagnose, and a high score here should prompt a real conversation
// with a doctor, not just a different in-app tier.
export const ALCOHOL_INTAKE: ModuleIntakeDefinition = {
  moduleId: 'alcohol',
  instrumentName: 'AUDIT-C',
  isValidatedClinicalInstrument: true,
  questions: [
    {
      id: 'frequency',
      prompt: 'Over the past year, how often have you had a drink containing alcohol?',
      options: [
        { label: 'Never', points: 0 },
        { label: 'Monthly or less', points: 1 },
        { label: '2-4 times a month', points: 2 },
        { label: '2-3 times a week', points: 3 },
        { label: '4 or more times a week', points: 4 },
      ],
    },
    {
      id: 'typical_quantity',
      prompt: 'On a typical day when you drink, how many drinks do you have?',
      options: [
        { label: '1 or 2', points: 0 },
        { label: '3 or 4', points: 1 },
        { label: '5 or 6', points: 2 },
        { label: '7 to 9', points: 3 },
        { label: '10 or more', points: 4 },
      ],
    },
    {
      id: 'binge_frequency',
      prompt: 'In the past year, how often have you had 6 or more drinks on one occasion?',
      options: [
        { label: 'Never', points: 0 },
        { label: 'Less than monthly', points: 1 },
        { label: 'Monthly', points: 2 },
        { label: 'Weekly', points: 3 },
        { label: 'Daily or almost daily', points: 4 },
      ],
    },
  ],
  computeAssignment(answers, meta) {
    const rawScore = (answers.frequency ?? 0) + (answers.typical_quantity ?? 0) + (answers.binge_frequency ?? 0);
    const cutoff = meta?.sex === 'female' ? 3 : 4;

    if (rawScore < cutoff) {
      return { priorityTier: 3, pipelineType: 'LINEAR_JITAI', rawScore };
    }
    if (rawScore <= 7) {
      return { priorityTier: 2, pipelineType: 'HIERARCHICAL_CASCADE', tier: 2, rawScore };
    }
    return {
      priorityTier: 1,
      pipelineType: 'HIERARCHICAL_CASCADE',
      tier: 1,
      rawScore,
      note: 'This score range is consistent with higher-risk drinking on a validated screen. Consider discussing it with a doctor.',
    };
  },
};
