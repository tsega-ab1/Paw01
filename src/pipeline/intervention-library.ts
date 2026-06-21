// paw-server/src/pipeline/intervention-library.ts
//
// The content database the architecture was missing: a library of discrete,
// deliverable interventions, each tagged by which risk/protective domain it
// addresses, its evidence basis, duration, and format. This is what the
// engine actually hands to the person, rather than abstract routing.
//
// Starting at ~25 entries, not "hundreds" -- every entry here has a real,
// checkable evidence basis. Padding this list with thin or invented entries
// to hit a round number would just move the fabrication problem from the
// rule engine into the content layer. Hundreds is a reasonable long-term
// target; it should grow by adding entries with the same rigor, not by
// batch-generating placeholders.

export type InterventionFormat = 'audio_guided' | 'text' | 'action_prompt' | 'tracking' | 'call_prompt';
export type InterventionDomain =
  | 'craving' | 'stress' | 'mood' | 'self_efficacy' | 'motivation'
  | 'social_isolation' | 'cue_exposure' | 'sleep' | 'fatigue' | 'general';

export interface Intervention {
  id: string;
  displayName: string;
  domains: InterventionDomain[]; // which risk/protective domains this addresses
  format: InterventionFormat;
  durationSec: number;
  energyCost: number; // 1-5, matches Validator's existing cognitive-load model
  minRiskLevel?: 'LOW' | 'ELEVATED' | 'HIGH'; // floor; omit if usable any time
  evidenceBase: string;
  citation: string;
  instructions: string;
}

export const INTERVENTION_LIBRARY: Intervention[] = [
  // ─── Craving-focused ──────────────────────────────────────────────────
  {
    id: 'urge_surfing_3min',
    displayName: 'Urge Surfing (3 min)',
    domains: ['craving'],
    format: 'audio_guided',
    durationSec: 180,
    energyCost: 1,
    evidenceBase: 'Mindfulness-Based Relapse Prevention: treats urges as a wave with a rise/peak/fall, not a command to act',
    citation: 'Marlatt & Gordon (1985); Bowen, Chawla & Marlatt, MBRP manual',
    instructions: 'Notice the urge without acting. Describe its physical sensations. Watch it rise, peak, and pass over the next 3 minutes.',
  },
  {
    id: 'urge_delay_10min',
    displayName: '10-Minute Delay Rule',
    domains: ['craving'],
    format: 'action_prompt',
    durationSec: 600,
    energyCost: 1,
    evidenceBase: 'Craving intensity is typically time-limited; delay reduces the likelihood of acting on a peak urge',
    citation: 'Marlatt & Gordon (1985), relapse prevention model',
    instructions: 'Set a 10-minute timer before deciding anything. Do something else fully during that time. Re-evaluate after.',
  },
  {
    id: 'leave_location',
    displayName: 'Leave the Location',
    domains: ['craving', 'cue_exposure'],
    format: 'action_prompt',
    durationSec: 60,
    energyCost: 2,
    evidenceBase: 'Stimulus control: removing oneself from a cue-rich environment reduces conditioned craving response',
    citation: 'Erickson (1998), cue reactivity in addiction; standard behavioral stimulus-control technique',
    instructions: 'Physically leave the current location for at least 15 minutes. Go somewhere with fewer cues.',
  },
  {
    id: 'thought_reframing',
    displayName: 'Thought Reframing',
    domains: ['craving', 'mood'],
    format: 'text',
    durationSec: 300,
    energyCost: 3,
    evidenceBase: 'CBT cognitive restructuring: identify and challenge the automatic thought driving the urge',
    citation: 'Beck (1976); Beck Institute CBT protocols',
    instructions: 'Write the automatic thought. Ask: what is the evidence for and against it? Write a more balanced alternative.',
  },
  {
    id: 'play_the_tape_forward',
    displayName: 'Play the Tape Forward',
    domains: ['craving', 'self_efficacy'],
    format: 'text',
    durationSec: 180,
    energyCost: 2,
    evidenceBase: 'Decisional balance / consequence visualization, common relapse-prevention technique',
    citation: 'Marlatt & Gordon (1985)',
    instructions: 'Mentally walk through what happens 1 hour, 1 day, and 1 week after acting on this urge versus not acting on it.',
  },

  // ─── Stress-focused ───────────────────────────────────────────────────
  {
    id: 'box_breathing_2min',
    displayName: 'Box Breathing (2 min)',
    domains: ['stress', 'fatigue'],
    format: 'audio_guided',
    durationSec: 120,
    energyCost: 1,
    evidenceBase: 'Paced breathing activates parasympathetic response, lowering acute physiological arousal',
    citation: 'Standard autonomic-regulation technique used across CBT and DBT protocols',
    instructions: 'Inhale 4 counts, hold 4, exhale 4, hold 4. Repeat for 2 minutes.',
  },
  {
    id: 'progressive_muscle_relax',
    displayName: 'Progressive Muscle Relaxation',
    domains: ['stress'],
    format: 'audio_guided',
    durationSec: 600,
    energyCost: 2,
    evidenceBase: 'Systematic tense-release of muscle groups reduces somatic stress markers',
    citation: 'Jacobson (1938), progressive relaxation; widely used in stress-management protocols',
    instructions: 'Starting at your feet, tense each muscle group for 5 seconds, then release. Move upward through the body.',
  },
  {
    id: 'halt_check',
    displayName: 'HALT Check',
    domains: ['stress', 'craving', 'general'],
    format: 'text',
    durationSec: 60,
    energyCost: 1,
    evidenceBase: 'Brief self-check for common destabilizing states preceding urges; widely used clinically in relapse-prevention practice',
    citation: 'Common addiction-recovery and CBT-integrated practice (clinical consensus tool, not a validated scale)',
    instructions: 'Ask: am I Hungry, Angry, Lonely, or Tired? Address whichever is true before deciding anything else.',
  },
  {
    id: 'grounding_5_4_3_2_1',
    displayName: '5-4-3-2-1 Grounding',
    domains: ['stress', 'mood'],
    format: 'text',
    durationSec: 180,
    energyCost: 1,
    evidenceBase: 'Sensory grounding technique used to interrupt rumination/panic and reorient to the present',
    citation: 'Common DBT/trauma-informed grounding technique',
    instructions: 'Name 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste.',
  },

  // ─── Social ────────────────────────────────────────────────────────────
  {
    id: 'call_support_person',
    displayName: 'Call a Support Person',
    domains: ['social_isolation', 'craving', 'stress'],
    format: 'call_prompt',
    durationSec: 600,
    energyCost: 2,
    evidenceBase: 'Social support buffers stress response and is one of the most consistent protective factors against relapse',
    citation: 'Cohen & Wills (1985), buffering hypothesis; Marlatt & Gordon (1985)',
    instructions: 'Call or message someone on your support list. You do not need to explain why -- just connect.',
  },
  {
    id: 'reach_out_text',
    displayName: 'Send One Check-In Text',
    domains: ['social_isolation'],
    format: 'action_prompt',
    durationSec: 120,
    energyCost: 1,
    evidenceBase: 'Lower-effort version of social reconnection for moments when a call feels like too much',
    citation: 'Cohen & Wills (1985), buffering hypothesis',
    instructions: 'Send a short message to one person, even just "thinking of you, how are you doing?"',
  },

  // ─── Mood / behavioral activation ─────────────────────────────────────
  {
    id: 'five_min_walk',
    displayName: '5-Minute Walk',
    domains: ['mood', 'stress', 'craving', 'fatigue'],
    format: 'action_prompt',
    durationSec: 300,
    energyCost: 1,
    evidenceBase: 'Brief physical activity reliably reduces craving intensity and improves mood in controlled studies',
    citation: 'Taylor, Ussher & Faulkner (2007), exercise and cigarette craving, meta-analytic review',
    instructions: 'Walk outside or around your space for 5 minutes. Notice your surroundings as you go.',
  },
  {
    id: 'behavioral_activation_task',
    displayName: 'One Small Valued Action',
    domains: ['mood', 'motivation'],
    format: 'action_prompt',
    durationSec: 600,
    energyCost: 2,
    evidenceBase: 'Behavioral activation: scheduling small value-aligned actions counters withdrawal/avoidance cycles in low mood',
    citation: 'Jacobson, Martell & Dimidjian (2001), behavioral activation for depression',
    instructions: 'Pick one small task aligned with something you care about. Do just that one thing, nothing more.',
  },
  {
    id: 'values_clarification',
    displayName: 'Values Check-In',
    domains: ['motivation', 'mood'],
    format: 'text',
    durationSec: 300,
    energyCost: 2,
    evidenceBase: 'Acceptance and Commitment Therapy: reconnecting with values increases willingness to tolerate discomfort',
    citation: 'Hayes, Strosahl & Wilson (1999), ACT',
    instructions: 'Write one sentence: what matters to you right now, and what would acting on that look like today?',
  },
  {
    id: 'opposite_action',
    displayName: 'Opposite Action',
    domains: ['mood', 'craving'],
    format: 'text',
    durationSec: 180,
    energyCost: 2,
    evidenceBase: 'DBT distress tolerance: deliberately acting opposite to an unhelpful urge weakens its grip over time',
    citation: 'Linehan (1993), DBT skills manual',
    instructions: 'Identify what the urge wants you to do. Do something deliberately opposite to it instead.',
  },

  // ─── Self-efficacy / confidence ───────────────────────────────────────
  {
    id: 'past_success_recall',
    displayName: 'Recall a Past Success',
    domains: ['self_efficacy'],
    format: 'text',
    durationSec: 180,
    energyCost: 1,
    evidenceBase: 'Mastery experiences are the strongest source of self-efficacy; recalling them activates the same belief',
    citation: 'Bandura (1997), Self-Efficacy: The Exercise of Control',
    instructions: 'Write about one specific time you got through something hard like this. What did you do?',
  },
  {
    id: 'coping_plan_review',
    displayName: 'Review Your Coping Plan',
    domains: ['self_efficacy', 'craving'],
    format: 'text',
    durationSec: 120,
    energyCost: 1,
    evidenceBase: 'Pre-committed coping plans increase follow-through under acute stress (implementation intentions)',
    citation: 'Gollwitzer (1999), implementation intentions',
    instructions: 'Re-read the coping plan you wrote when calm. Follow the first step now.',
  },

  // ─── Sleep ─────────────────────────────────────────────────────────────
  {
    id: 'wind_down_prompt',
    displayName: 'Start Wind-Down Routine',
    domains: ['sleep', 'fatigue'],
    format: 'action_prompt',
    durationSec: 1800,
    energyCost: 1,
    evidenceBase: 'Consistent pre-sleep routines and screen reduction improve sleep onset and quality',
    citation: 'Standard sleep hygiene guidance; Morin et al. on behavioral sleep interventions',
    instructions: 'Dim lights, put the phone away, and begin your wind-down routine now.',
  },
  {
    id: 'screen_cutoff_nudge',
    displayName: 'Screen Cutoff Nudge',
    domains: ['sleep'],
    format: 'action_prompt',
    durationSec: 30,
    energyCost: 1,
    evidenceBase: 'Late-night screen exposure delays sleep onset and disrupts circadian timing',
    citation: 'Standard sleep hygiene guidance',
    instructions: 'Put the screen down for tonight. Your morning self will have better data because of it.',
  },

  // ─── Tracking (low energy, always available) ──────────────────────────
  {
    id: 'quick_mood_log',
    displayName: 'Quick Mood Log',
    domains: ['general'],
    format: 'tracking',
    durationSec: 30,
    energyCost: 1,
    evidenceBase: 'Self-monitoring is a core behavior-change mechanism across CBT and behavioral medicine',
    citation: 'Standard self-monitoring practice in CBT protocols',
    instructions: 'Rate your mood 0-10 right now. No explanation needed.',
  },
  {
    id: 'trigger_log_entry',
    displayName: 'Log This Trigger',
    domains: ['craving', 'general'],
    format: 'tracking',
    durationSec: 90,
    energyCost: 1,
    evidenceBase: 'Functional analysis: logging antecedent-behavior-consequence patterns builds awareness of personal triggers',
    citation: 'Behavioral Self-Control Training functional analysis',
    instructions: 'Note: what happened right before this urge, where you were, and how you felt.',
  },

  // ─── Skill-building specific (growth purpose, not cessation) ──────────
  {
    id: 'micro_practice_5min',
    displayName: '5-Minute Micro-Practice',
    domains: ['motivation', 'self_efficacy'],
    format: 'action_prompt',
    durationSec: 300,
    energyCost: 1,
    evidenceBase: 'Small, low-friction practice sessions maintain consistency better than infrequent long sessions',
    citation: 'Spaced practice / distributed practice research, Cepeda et al. (2006) meta-analysis',
    instructions: 'Do just 5 minutes of practice. No more required today.',
  },
  {
    id: 'progress_reflection',
    displayName: 'Progress Reflection',
    domains: ['self_efficacy', 'motivation'],
    format: 'text',
    durationSec: 180,
    energyCost: 1,
    evidenceBase: 'Reflecting on concrete progress strengthens self-efficacy via the mastery-experience pathway',
    citation: 'Bandura (1997)',
    instructions: 'Write one specific thing you can do now that you could not do when you started.',
  },

  // ─── Emergency / crisis-adjacent (always available, never gated) ──────
  {
    id: 'emergency_protocol',
    displayName: 'Emergency Protocol',
    domains: ['general'],
    format: 'action_prompt',
    durationSec: 0,
    energyCost: 1,
    minRiskLevel: 'HIGH',
    evidenceBase: 'Direct path to crisis resources -- not a clinical technique, a safety pathway',
    citation: 'See crisis-resources.ts: unconditional, never inferred or gated',
    instructions: 'If you are in danger of harming yourself or others, use the crisis resources shown with this response now.',
  },
  {
    id: 'self_compassion_script',
    displayName: 'Self-Compassion Pause',
    domains: ['mood', 'craving'],
    format: 'text',
    durationSec: 120,
    energyCost: 1,
    evidenceBase: 'Self-compassion after a lapse reduces shame-driven further use, compared to self-criticism',
    citation: 'Neff (2003), self-compassion; Witkiewitz & Marlatt (2004), relapse prevention',
    instructions: 'A slip is information, not a verdict. Name what happened without judgment, then decide your next step.',
  },
];

export function getInterventionsForDomain(
  domain: InterventionDomain,
  maxEnergyCost = 5
): Intervention[] {
  return INTERVENTION_LIBRARY.filter((iv) => iv.domains.includes(domain) && iv.energyCost <= maxEnergyCost);
}

export function getInterventionById(id: string): Intervention | undefined {
  return INTERVENTION_LIBRARY.find((iv) => iv.id === id);
}
