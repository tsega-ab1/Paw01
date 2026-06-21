// paw-server/src/types/pipeline-types.ts

export interface User {
  id: string;
  createdAt: Date;
  lastActive: Date;
}

export interface PipelineContext {
  userId: string;
  activeModuleIds: string[];
  pipelineType: 'LINEAR_JITAI' | 'PARALLEL_STREAM' | 'HIERARCHICAL_CASCADE' | 'PREDICTIVE_PREEMPTIVE';
  contextSnapshot: ContextSnapshot;
  historicalData?: HistoricalData;
  tier?: number; // For Hierarchical pipeline
}

export interface ContextSnapshot {
  // --- Environmental ---
  location: string;
  timeOfDay: number;            // Hour (0-23)
  weekday: number;              // Day of week (0-6)
  screenTimeMinutesToday: number;
  lastActivityTimestamp: number;
  substanceCueExposure: number; // 0-10: cues encountered today

  // --- Biological ---
  stepsToday: number;
  sleepQualityLastNight: number; // 1-10
  sleepHoursLastNight: number;
  sleepDebtDays: number;         // consecutive nights below 6hrs
  fatigueLevel: number;          // 0-10 self-report
  exerciseMinutesToday: number;

  // --- Psychological ---
  cravingScore: number;       // 0-10 VAS-style; most recent self-report
  stressLevel: number;        // 0-10
  moodScore: number;          // 0-10 (higher = better)
  confidenceScore: number;    // 0-10 self-efficacy re: staying on track
  motivationScore: number;    // 0-10

  // --- Social ---
  hoursSinceLastSocialContact: number;
  recentConflict: boolean;
  perceivedSocialSupport: number; // 0-10

  // --- Behavioural history (rolling window) ---
  currentStreak: number;        // consecutive days of target behaviour
  recentLapseCount: number;     // lapses in last 7 days
  completedMorningAnchor: boolean;
  taskCompletionRate7d: number; // 0-1
}

export interface HistoricalData {
  cravingScores: { timestamp: number; score: number }[];
  activityCompletions: { activityId: string; completed: boolean; timestamp: number }[];
  sleepHistory: { date: string; quality: number; duration: number }[];
}

export interface RecoveryModule {
  id: string;
  displayName: string;
  priorityTier: 1 | 2 | 3 | 4;
  components: {
    morningAnchor?: TaskDefinition;
    urgeSurfing?: MicroIntervention;
    triggerLog?: TrackingComponent;
    eveningRitual?: TaskDefinition;
    lapseProtocol?: CrisisComponent;
    spacedRepetitionReview?: TaskDefinition;
    deliberatePracticeBlock?: TaskDefinition;
    microWinLogging?: TrackingComponent;
  };
  pipelineConfig: {
    LINEAR_JITAI: { taskOrder: string[]; maxDaily: number };
    PARALLEL_STREAM: {
      reflectiveTasks: string[];
      impulsiveTriggers: string[];
    };
    HIERARCHICAL_CASCADE: {
      tier1Fixed: string[];
      tier2Options: string[];
      tier3UserEditable: string[];
    };
    PREDICTIVE_PREEMPTIVE: {
      protectiveSafeguards: string[];
      preemptiveBuffers: string[];
      predictorFeatures: string[];
    };
  };
  // NOTE: defined but not yet consumed by topology-engine.ts -- see the
  // crossTriggers discussion in the accompanying message before relying on this.
  crossTriggers: Array<{
    targetModuleId: string;
    condition: string;
    response: string;
  }>;
}

export interface TaskDefinition {
  id: string;
  type: 'scheduled_task';
  content: any;
  energyCost: number;
  evidenceBase: string;
}

export interface MicroIntervention {
  id: string;
  type: 'micro_intervention';
  durationSec: number;
  content: any;
  energyCost: number;
  evidenceBase: string;
}

export interface TrackingComponent {
  id: string;
  type: 'tracking';
  fields: string[];
  evidenceBase: string;
}

export interface CrisisComponent {
  id: string;
  type: 'crisis_response';
  steps: string[];
  evidenceBase: string;
}

export interface LinearRoutine {
  type: 'STRUCTURED_ROUTINE';
  tasks: any[];
  stream: 'UNIFIED';
  maxItems: number;
}

export interface ParallelRoutine {
  type: 'PARALLEL_ROUTINE';
  reflectiveStream: any[];
  impulsiveStream: any[];
  passiveMonitor: ContextSnapshot;
  streamBalance: { reflective: number; impulsive: number };
}

export interface HierarchicalRoutine {
  type: 'HIERARCHICAL_ROUTINE';
  tier: number;
  tasks?: any[];
  options?: any[][];
  template?: any;
  userAction: 'CONFIRM_ONLY' | 'SELECT_MODIFY' | 'USER_PROPOSES';
}

export interface PredictiveRoutine {
  type: 'PREDICTIVE_ROUTINE';
  riskLevel: 'LOW' | 'ELEVATED' | 'HIGH';
  action: 'STANDARD' | 'PREEMPTIVE_ADAPTATION' | 'PROTECTIVE_MODE';
  routine?: any[];
  safeguards?: any[];
  notification?: string;
}

export type AnyRoutine = LinearRoutine | ParallelRoutine | HierarchicalRoutine | PredictiveRoutine;

// Every pipeline run returns this envelope. crisisResources and moduleCautions
// are unconditional: they do not depend on anything inferred about the user
// and are never withheld based on a computed risk level. There is deliberately
// no "safe: false" branch anywhere in this system.
export interface PipelineResult<T extends AnyRoutine = AnyRoutine> {
  routine: T;
  crisisResources: string[];
  moduleCautions: string[];
  validation?: { adjusted: boolean; explanation?: string };
}

export interface ValidationResult<T extends AnyRoutine = AnyRoutine> {
  valid: boolean;
  routine: T;
  modifiedRoutine?: T;
  explanation?: string;
}

export interface EvaluationResult {
  completionRate: number;
  cravingDelta: number;
  sleepQualityDelta: number;
}

// --- Module intake questionnaires ---
// Each module defines its own instrument. For alcohol this is the real,
// validated AUDIT-C. For non-clinical domains (skill-building, etc.) this is
// a structured self-report, explicitly NOT a validated clinical instrument --
// see instrumentName, which should say so plainly rather than implying
// equivalence with something like AUDIT-C.
export interface IntakeOption {
  label: string;
  points: number;
}

export interface IntakeQuestion {
  id: string;
  prompt: string;
  options: IntakeOption[];
}

export interface IntakeAssignment {
  priorityTier: 1 | 2 | 3 | 4;
  pipelineType: PipelineContext['pipelineType'];
  tier?: number;
  rawScore: number;
  note?: string;
}

export interface ModuleIntakeDefinition {
  moduleId: string;
  instrumentName: string;
  isValidatedClinicalInstrument: boolean;
  questions: IntakeQuestion[];
  computeAssignment: (answers: Record<string, number>, meta?: Record<string, any>) => IntakeAssignment;
}
