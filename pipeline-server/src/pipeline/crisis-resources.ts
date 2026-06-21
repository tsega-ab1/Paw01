// paw-server/src/pipeline/crisis-resources.ts
//
// This deliberately does NOT read self-report flags, does NOT compute a risk
// score, and does NOT decide whether to show or hide anything. Every routine
// the engine produces carries the same resources, unconditionally. The
// previous SafetyGatekeeper design inferred "hasThoughtsOfHarmingSelf" /
// "isUnableToKeepSafe" from user data and used that to silently swap the
// whole response for a crisis protocol -- an unvalidated algorithm making a
// clinical-style call. That pattern is intentionally not reproduced here.
//
// If you later want an explicit "I need help now" affordance, it should be a
// user-initiated action in the app shell that goes straight to these
// resources -- not something inferred from passive or self-report data.

export const CRISIS_RESOURCES: string[] = [
  'If you are in immediate danger, contact local emergency services.',
  'Suicide & Crisis Lifeline (US): call or text 988',
  'Crisis Text Line: text HOME to 741741',
];

// Static, non-personalized cautions shown to every user of a given module --
// not a judgment about any individual's risk level.
export const MODULE_CAUTIONS: Record<string, string> = {
  alcohol:
    'If you have a history of heavy or long-term alcohol use, stopping suddenly can be medically dangerous. Talk to a doctor before quitting unsupervised.',
};

export function getModuleCautions(activeModuleIds: string[]): string[] {
  return activeModuleIds
    .map((id) => MODULE_CAUTIONS[id])
    .filter((c): c is string => Boolean(c));
}
