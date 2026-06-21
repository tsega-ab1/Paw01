// paw-server/src/pipeline/modules/python-skill-module.ts
import { RecoveryModule, ModuleIntakeDefinition } from '../../types/pipeline-types';

export const PYTHON_SKILL_MODULE: RecoveryModule = {
  id: 'python_skill',
  displayName: 'Python Programming',
  priorityTier: 4,
  components: {
    spacedRepetitionReview: {
      id: 'py_spaced_review',
      type: 'scheduled_task',
      content: { duration_minutes: 15, topic_area: 'syntax' },
      energyCost: 1,
      evidenceBase: 'spaced_practice_retention',
    },
    deliberatePracticeBlock: {
      id: 'py_deliberate_practice',
      type: 'scheduled_task',
      content: { duration_minutes: 45, challenge_level: 'intermediate', project_focus: true },
      energyCost: 3,
      evidenceBase: 'ericsson_deliberate_practice',
    },
    microWinLogging: {
      id: 'py_micro_win_log',
      type: 'tracking',
      fields: ['what_built', 'confidence_rating', 'connection_to_recovery'],
      evidenceBase: 'self_efficacy_theory',
    },
  },
  pipelineConfig: {
    LINEAR_JITAI: {
      taskOrder: ['py_spaced_review', 'py_deliberate_practice'],
      maxDaily: 3,
    },
    PARALLEL_STREAM: {
      reflectiveTasks: ['py_deliberate_practice', 'py_spaced_review'],
      impulsiveTriggers: [],
    },
    HIERARCHICAL_CASCADE: {
      tier1Fixed: [],
      tier2Options: ['py_spaced_review', 'py_deliberate_practice'],
      tier3UserEditable: ['py_deliberate_practice', 'py_micro_win_log'],
    },
    PREDICTIVE_PREEMPTIVE: {
      protectiveSafeguards: [],
      preemptiveBuffers: ['py_spaced_review'],
      predictorFeatures: ['available_time_blocks', 'stress_levels', 'recovery_stability'],
    },
  },
  crossTriggers: [],
};

// This is a structured self-report grounded in two real, established
// constructs -- self-efficacy (Bandura) for the confidence item, and
// realistic time-availability for the scheduling item -- but it is NOT a
// validated diagnostic-style instrument the way AUDIT-C is. No standardized
// screener like that exists for skill-acquisition domains, and presenting
// this as if it were equivalent would overstate its rigor. priorityTier is
// fixed at 4 regardless of answers: growth/curiosity modules don't compete
// for cross-domain priority against cessation or maintenance modules no
// matter how someone answers here -- only the internal scaffolding
// (pipelineType/tier) responds to the answers.
export const PYTHON_SKILL_INTAKE: ModuleIntakeDefinition = {
  moduleId: 'python_skill',
  instrumentName: 'Structured self-assessment (not a validated clinical instrument)',
  isValidatedClinicalInstrument: false,
  questions: [
    {
      id: 'baseline_level',
      prompt: 'How would you describe your current level in this skill?',
      options: [
        { label: 'Brand new', points: 0 },
        { label: 'Some exposure', points: 1 },
        { label: 'Comfortable with basics', points: 2 },
        { label: 'Intermediate', points: 3 },
        { label: 'Advanced', points: 4 },
      ],
    },
    {
      id: 'time_availability',
      prompt: 'Roughly how many focused minutes per week can you realistically commit?',
      options: [
        { label: 'Less than 30', points: 0 },
        { label: '30-90', points: 1 },
        { label: '90-180', points: 2 },
        { label: '180-300', points: 3 },
        { label: '300 or more', points: 4 },
      ],
    },
    {
      id: 'confidence',
      prompt: 'How confident are you that you will keep a regular practice routine going without reminders?',
      options: [
        { label: 'Not at all', points: 0 },
        { label: 'Slightly', points: 1 },
        { label: 'Moderately', points: 2 },
        { label: 'Very', points: 3 },
        { label: 'Extremely', points: 4 },
      ],
    },
  ],
  computeAssignment(answers) {
    const confidence = answers.confidence ?? 0;
    const time = answers.time_availability ?? 0;
    const rawScore = confidence + time + (answers.baseline_level ?? 0);

    if (confidence >= 3 && time >= 2) {
      return { priorityTier: 4, pipelineType: 'LINEAR_JITAI', rawScore };
    }
    if (confidence <= 1 || time <= 1) {
      return { priorityTier: 4, pipelineType: 'HIERARCHICAL_CASCADE', tier: 1, rawScore };
    }
    return { priorityTier: 4, pipelineType: 'HIERARCHICAL_CASCADE', tier: 2, rawScore };
  },
};
