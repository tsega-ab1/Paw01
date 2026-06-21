// paw-server/src/pipeline/intake-router.ts

interface IntakeResponse {
  safety_acute: boolean;
  executive_load: string;
  readiness_stage: string;
  pattern_insight: string;
  polysubstance_complexity: string;
}

export class IntakeRouter {
  // An acute-safety disclosure is not a routing signal for app content -- it
  // gets its own immediate, separate response. Check this FIRST and, if true,
  // do not call determinePipeline() at all; surface CRISIS_RESOURCES directly
  // from crisis-resources.ts instead.
  static needsImmediateSupport(responses: IntakeResponse): boolean {
    return responses.safety_acute === true;
  }

  static determinePipeline(responses: IntakeResponse): string {
    const score = { parallel: 0, hierarchical: 0, predictive: 0, linear: 0 };

    if (['Very much', 'Completely paralyzed'].includes(responses.executive_load)) score.parallel += 3;
    else if (responses.executive_load === 'Somewhat') score.parallel += 1;

    if (['Not confident', 'Slightly'].includes(responses.readiness_stage)) score.hierarchical += 3;
    else if (responses.readiness_stage === 'Moderately') score.hierarchical += 2;
    else if (['Very', 'Extremely'].includes(responses.readiness_stage)) score.linear += 2;

    if (['Often', 'Almost always'].includes(responses.pattern_insight)) score.predictive += 3;
    else if (responses.pattern_insight === 'Sometimes') score.predictive += 1;

    if (responses.polysubstance_complexity === 'Three or more') score.parallel += 4;
    else if (responses.polysubstance_complexity === 'Two') score.parallel += 2;

    const sorted = Object.entries(score).sort((a, b) => b[1] - a[1]);
    const top = sorted[0][0];

    const PIPELINE_MAP: Record<string, string> = {
      parallel: 'PARALLEL_STREAM',
      hierarchical: 'HIERARCHICAL_CASCADE',
      predictive: 'PREDICTIVE_PREEMPTIVE',
      linear: 'LINEAR_JITAI',
    };

    return PIPELINE_MAP[top] || 'LINEAR_JITAI';
  }

  static getInitialTier(responses: IntakeResponse): number {
    if (responses.readiness_stage === 'Not confident') return 1;
    if (responses.readiness_stage === 'Slightly') return 1;
    if (responses.readiness_stage === 'Moderately') return 2;
    return 2;
  }
}
