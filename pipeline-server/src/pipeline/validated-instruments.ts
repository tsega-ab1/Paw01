// paw-server/src/pipeline/validated-instruments.ts
//
// Validated periodic screening instruments. These are administered on a
// schedule (weekly/biweekly), NOT moment-to-moment -- that is their actual
// validated use case, unlike the momentary EMA items in ContextSnapshot.
//
// LICENSING NOTE (read before shipping commercially):
//   - PHQ-9, GAD-7: public domain, developed by Pfizer/Kroenke/Spitzer,
//     free to use clinically and in apps without permission.
//   - WHO-5: published by WHO, free to use.
//   - PSS-4, ISI, UCLA-3 (Loneliness): copyrighted by their original authors.
//     Free for research; commercial/app use typically requires contacting
//     the rights holder. Don't ship these in a commercial release without
//     checking current licensing terms.
//
// Item wording below is paraphrased to capture each instrument's clinical
// construct, not copied verbatim from the copyrighted originals. For exact
// official wording and administration instructions, use the original
// published instrument.
//
// Item 9 of the PHQ-9 concerns thoughts of self-harm. Per this system's
// standing policy (see crisis-resources.ts), that item is NEVER scored into
// priorityTier or any routing decision. Any endorsement above "not at all"
// routes directly and unconditionally to crisis resources, exactly like
// IntakeRouter.needsImmediateSupport() -- it is a disclosure, not a feature.

import { IntakeQuestion } from '../types/pipeline-types';

export interface ValidatedInstrument {
  id: string;
  fullName: string;
  citation: string;
  cadence: 'weekly' | 'biweekly';
  questions: IntakeQuestion[];
  // maxScore excludes any safety-routed item (e.g. PHQ-9 item 9)
  maxScore: number;
  interpret: (totalScore: number) => { band: string; description: string };
}

const freq4 = (labels: [string, string, string, string]) =>
  labels.map((label, i) => ({ label, points: i }));

// ─── PHQ-9 : depression severity ───────────────────────────────────────────
// Kroenke K, Spitzer RL, Williams JB. The PHQ-9: validity of a brief
// depression severity measure. J Gen Intern Med. 2001.
const PHQ9_SCALE = freq4(['Not at all', 'Several days', 'More than half the days', 'Nearly every day']);

export const PHQ9: ValidatedInstrument = {
  id: 'PHQ9',
  fullName: 'Patient Health Questionnaire-9',
  citation: 'Kroenke, Spitzer & Williams (2001), J Gen Intern Med',
  cadence: 'biweekly',
  maxScore: 24, // 8 scored items x 3; item 9 is safety-routed, not scored here
  questions: [
    { id: 'phq9_1', prompt: 'Little interest or pleasure in doing things', options: PHQ9_SCALE },
    { id: 'phq9_2', prompt: 'Feeling down, depressed, or hopeless', options: PHQ9_SCALE },
    { id: 'phq9_3', prompt: 'Trouble falling or staying asleep, or sleeping too much', options: PHQ9_SCALE },
    { id: 'phq9_4', prompt: 'Feeling tired or having little energy', options: PHQ9_SCALE },
    { id: 'phq9_5', prompt: 'Poor appetite or overeating', options: PHQ9_SCALE },
    { id: 'phq9_6', prompt: 'Feeling bad about yourself, or that you are a failure', options: PHQ9_SCALE },
    { id: 'phq9_7', prompt: 'Trouble concentrating on things', options: PHQ9_SCALE },
    { id: 'phq9_8', prompt: 'Moving or speaking noticeably slowly, or being unusually fidgety/restless', options: PHQ9_SCALE },
    // phq9_9 intentionally omitted from this list -- handled by a separate,
    // unconditional safety-routing check, never folded into score totals.
  ],
  interpret(score) {
    if (score <= 4) return { band: 'minimal', description: 'Minimal depressive symptoms' };
    if (score <= 9) return { band: 'mild', description: 'Mild depressive symptoms' };
    if (score <= 14) return { band: 'moderate', description: 'Moderate depressive symptoms' };
    if (score <= 19) return { band: 'moderately_severe', description: 'Moderately severe depressive symptoms' };
    return { band: 'severe', description: 'Severe depressive symptoms' };
  },
};

// The safety-routed item, kept separate from the scored instrument above.
export const PHQ9_SAFETY_ITEM: IntakeQuestion = {
  id: 'phq9_9_safety',
  prompt: 'Thoughts that you would be better off dead, or of hurting yourself in some way',
  options: PHQ9_SCALE,
};

// ─── GAD-7 : anxiety severity ──────────────────────────────────────────────
// Spitzer RL, Kroenke K, Williams JB, Löwe B. A brief measure for assessing
// generalized anxiety disorder: the GAD-7. Arch Intern Med. 2006.
const GAD7_SCALE = PHQ9_SCALE;

export const GAD7: ValidatedInstrument = {
  id: 'GAD7',
  fullName: 'Generalized Anxiety Disorder 7-item scale',
  citation: 'Spitzer, Kroenke, Williams & Löwe (2006), Arch Intern Med',
  cadence: 'biweekly',
  maxScore: 21,
  questions: [
    { id: 'gad7_1', prompt: 'Feeling nervous, anxious, or on edge', options: GAD7_SCALE },
    { id: 'gad7_2', prompt: 'Not being able to stop or control worrying', options: GAD7_SCALE },
    { id: 'gad7_3', prompt: 'Worrying too much about different things', options: GAD7_SCALE },
    { id: 'gad7_4', prompt: 'Trouble relaxing', options: GAD7_SCALE },
    { id: 'gad7_5', prompt: "Being so restless that it's hard to sit still", options: GAD7_SCALE },
    { id: 'gad7_6', prompt: 'Becoming easily annoyed or irritable', options: GAD7_SCALE },
    { id: 'gad7_7', prompt: 'Feeling afraid as if something awful might happen', options: GAD7_SCALE },
  ],
  interpret(score) {
    if (score <= 4) return { band: 'minimal', description: 'Minimal anxiety symptoms' };
    if (score <= 9) return { band: 'mild', description: 'Mild anxiety symptoms' };
    if (score <= 14) return { band: 'moderate', description: 'Moderate anxiety symptoms' };
    return { band: 'severe', description: 'Severe anxiety symptoms' };
  },
};

// ─── PSS-4 : perceived stress ──────────────────────────────────────────────
// Cohen S, Williamson G. Perceived stress in a probability sample of the
// United States. In: Spacapan & Oskamp, The Social Psychology of Health, 1988
// (4-item short form of Cohen, Kamarck & Mermelstein's 1983 PSS).
const PSS_SCALE = freq4(['Never', 'Sometimes', 'Often', 'Very often']);

export const PSS4: ValidatedInstrument = {
  id: 'PSS4',
  fullName: 'Perceived Stress Scale (4-item)',
  citation: 'Cohen & Williamson (1988); short form of Cohen, Kamarck & Mermelstein (1983)',
  cadence: 'weekly',
  maxScore: 16,
  questions: [
    { id: 'pss_1', prompt: 'In the last month, how often have you felt unable to control important things in your life?', options: PSS_SCALE },
    { id: 'pss_2', prompt: 'In the last month, how often have you felt confident about handling personal problems?', options: [...PSS_SCALE].reverse().map((o, i) => ({ ...o, points: i })) }, // reverse-scored
    { id: 'pss_3', prompt: 'In the last month, how often have you felt things were going your way?', options: [...PSS_SCALE].reverse().map((o, i) => ({ ...o, points: i })) }, // reverse-scored
    { id: 'pss_4', prompt: 'In the last month, how often have you felt difficulties were piling up too high to overcome?', options: PSS_SCALE },
  ],
  interpret(score) {
    if (score <= 5) return { band: 'low', description: 'Low perceived stress' };
    if (score <= 10) return { band: 'moderate', description: 'Moderate perceived stress' };
    return { band: 'high', description: 'High perceived stress' };
  },
};

// ─── WHO-5 : well-being ─────────────────────────────────────────────────────
// WHO Regional Office for Europe. WHO-5 Well-Being Index, 1998.
// Psychometric validation: Topp CW, Østergaard SD, Søndergaard S, Bech P.
// The WHO-5 well-being index: a systematic review. Psychother Psychosom. 2015.
const WHO5_SCALE = [
  { label: 'At no time', points: 0 },
  { label: 'Some of the time', points: 1 },
  { label: 'Less than half the time', points: 2 },
  { label: 'More than half the time', points: 3 },
  { label: 'Most of the time', points: 4 },
  { label: 'All of the time', points: 5 },
];

export const WHO5: ValidatedInstrument = {
  id: 'WHO5',
  fullName: 'WHO-5 Well-Being Index',
  citation: 'WHO Regional Office for Europe (1998); Topp et al. (2015), Psychother Psychosom',
  cadence: 'weekly',
  maxScore: 25,
  questions: [
    { id: 'who5_1', prompt: 'I have felt cheerful and in good spirits', options: WHO5_SCALE },
    { id: 'who5_2', prompt: 'I have felt calm and relaxed', options: WHO5_SCALE },
    { id: 'who5_3', prompt: 'I have felt active and vigorous', options: WHO5_SCALE },
    { id: 'who5_4', prompt: 'I woke up feeling fresh and rested', options: WHO5_SCALE },
    { id: 'who5_5', prompt: 'My daily life has been filled with things that interest me', options: WHO5_SCALE },
  ],
  interpret(score) {
    const percentage = score * 4;
    if (percentage <= 28) return { band: 'low', description: 'Low well-being; consider further depression screening' };
    if (percentage <= 50) return { band: 'below_average', description: 'Below-average well-being' };
    return { band: 'good', description: 'Good well-being' };
  },
};

// ─── ISI : insomnia severity ────────────────────────────────────────────────
// Bastien CH, Vallières A, Morin CM. Validation of the Insomnia Severity
// Index as an outcome measure for insomnia research. Sleep Med. 2001.
const ISI_SCALE = freq4(['None', 'Mild', 'Moderate', 'Severe']).concat([{ label: 'Very severe', points: 4 }]);

export const ISI: ValidatedInstrument = {
  id: 'ISI',
  fullName: 'Insomnia Severity Index',
  citation: 'Bastien, Vallières & Morin (2001), Sleep Medicine',
  cadence: 'biweekly',
  maxScore: 28,
  questions: [
    { id: 'isi_1', prompt: 'Difficulty falling asleep: severity', options: ISI_SCALE },
    { id: 'isi_2', prompt: 'Difficulty staying asleep: severity', options: ISI_SCALE },
    { id: 'isi_3', prompt: 'Problems waking up too early: severity', options: ISI_SCALE },
    { id: 'isi_4', prompt: 'How satisfied/dissatisfied are you with your current sleep pattern?', options: ISI_SCALE },
    { id: 'isi_5', prompt: 'How noticeable to others is your sleep problem in terms of impairing quality of life?', options: ISI_SCALE },
    { id: 'isi_6', prompt: 'How worried/distressed are you about your current sleep problem?', options: ISI_SCALE },
    { id: 'isi_7', prompt: 'How much does your sleep problem interfere with daily functioning?', options: ISI_SCALE },
  ],
  interpret(score) {
    if (score <= 7) return { band: 'none', description: 'No clinically significant insomnia' };
    if (score <= 14) return { band: 'subthreshold', description: 'Subthreshold insomnia' };
    if (score <= 21) return { band: 'moderate', description: 'Moderate clinical insomnia' };
    return { band: 'severe', description: 'Severe clinical insomnia' };
  },
};

// ─── UCLA-3 : loneliness ────────────────────────────────────────────────────
// Hughes ME, Waite LJ, Hawkley LC, Cacioppo JT. A short scale for measuring
// loneliness in large surveys. Res Aging. 2004.
const UCLA3_SCALE = [
  { label: 'Hardly ever', points: 1 },
  { label: 'Some of the time', points: 2 },
  { label: 'Often', points: 3 },
];

export const UCLA3: ValidatedInstrument = {
  id: 'UCLA3',
  fullName: 'UCLA Loneliness Scale (3-item version)',
  citation: 'Hughes, Waite, Hawkley & Cacioppo (2004), Research on Aging',
  cadence: 'biweekly',
  maxScore: 9,
  questions: [
    { id: 'ucla_1', prompt: 'How often do you feel that you lack companionship?', options: UCLA3_SCALE },
    { id: 'ucla_2', prompt: 'How often do you feel left out?', options: UCLA3_SCALE },
    { id: 'ucla_3', prompt: 'How often do you feel isolated from others?', options: UCLA3_SCALE },
  ],
  interpret(score) {
    if (score <= 3) return { band: 'low', description: 'Low loneliness' };
    if (score <= 6) return { band: 'moderate', description: 'Moderate loneliness' };
    return { band: 'high', description: 'High loneliness' };
  },
};

export const VALIDATED_INSTRUMENTS: Record<string, ValidatedInstrument> = {
  PHQ9, GAD7, PSS4, WHO5, ISI, UCLA3,
};

export function scoreInstrument(
  instrument: ValidatedInstrument,
  answers: Record<string, number>
): { rawScore: number; band: string; description: string } {
  const rawScore = instrument.questions.reduce((sum, q) => sum + (answers[q.id] ?? 0), 0);
  const { band, description } = instrument.interpret(rawScore);
  return { rawScore, band, description };
}
