// paw-server/src/pipeline/personalization-memory.ts
//
// "Stress -> breathing exercise, for everyone" becomes "for THIS person,
// rank what's actually worked." This reads OutcomeTracker's accumulated
// pre/post deltas and turns them into a per-user, per-intervention
// effectiveness ranking, used to bias which intervention gets selected next
// time that domain needs addressing.
//
// Cold start: with no outcome data yet, falls back to the static intervention
// library order (evidence-based defaults) rather than guessing. This mirrors
// the same honest cold-start handling as ReceptivityEngine -- no claim of
// personalization until there's real data to personalize from.

import { OutcomeTracker, OutcomeRecord } from './outcome-tracking';
import { getInterventionsForDomain, InterventionDomain, Intervention } from './intervention-library';

export interface EffectivenessScore {
  interventionId: string;
  meanDelta: number;     // average (post - pre) across the relevant field; more negative = better for craving/stress
  sampleSize: number;
  lastUsedAt: number;
}

const MIN_SAMPLES_FOR_RANKING = 3;

// Which self-report field is the relevant "did it work" signal for each
// domain. Craving/stress: lower post-score is better (negative delta good).
// Mood/motivation/self_efficacy: higher post-score is better (positive delta good).
const DOMAIN_FIELD: Partial<Record<InterventionDomain, 'cravingScore' | 'stressLevel' | 'moodScore'>> = {
  craving: 'cravingScore',
  stress: 'stressLevel',
  mood: 'moodScore',
};

const LOWER_IS_BETTER: Partial<Record<InterventionDomain, boolean>> = {
  craving: true,
  stress: true,
  mood: false,
};

export class PersonalizationMemory {
  constructor(private outcomes: OutcomeTracker) {}

  // Computes effectiveness per intervention id, for one user, using
  // whichever self-report field is relevant. Returns null entries for
  // interventions with no data yet rather than fabricating a score.
  private computeEffectiveness(userId: string): Map<string, EffectivenessScore> {
    const records = this.outcomes.getCompletedForUser(userId);
    const grouped = new Map<string, OutcomeRecord[]>();
    for (const r of records) {
      const list = grouped.get(r.interventionId) ?? [];
      list.push(r);
      grouped.set(r.interventionId, list);
    }

    const result = new Map<string, EffectivenessScore>();
    for (const [interventionId, recs] of grouped.entries()) {
      const deltas: number[] = [];
      let lastUsedAt = 0;
      for (const r of recs) {
        lastUsedAt = Math.max(lastUsedAt, r.deliveredAt);
        const field = DOMAIN_FIELD[r.domain as InterventionDomain];
        const pre = field ? r.preState[field] : undefined;
        const post = field ? r.postState?.[field] : undefined;
        if (pre !== undefined && post !== undefined) deltas.push(post - pre);
      }
      if (deltas.length === 0) continue;
      const meanDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      result.set(interventionId, { interventionId, meanDelta, sampleSize: deltas.length, lastUsedAt });
    }
    return result;
  }

  // Ranks interventions for a domain, best-first, for this specific user.
  // Interventions with insufficient data fall back to library order
  // (already evidence-ordered by inclusion, not ranked further), appended
  // after anything with enough real data to rank confidently.
  rankInterventionsForDomain(userId: string, domain: InterventionDomain, maxEnergyCost = 5): Intervention[] {
    const candidates = getInterventionsForDomain(domain, maxEnergyCost);
    const effectiveness = this.computeEffectiveness(userId);
    const lowerIsBetter = LOWER_IS_BETTER[domain];

    const ranked: Intervention[] = [];
    const unranked: Intervention[] = [];

    for (const iv of candidates) {
      const score = effectiveness.get(iv.id);
      if (score && score.sampleSize >= MIN_SAMPLES_FOR_RANKING && lowerIsBetter !== undefined) {
        ranked.push(iv);
      } else {
        unranked.push(iv);
      }
    }

    ranked.sort((a, b) => {
      const sa = effectiveness.get(a.id)!.meanDelta;
      const sb = effectiveness.get(b.id)!.meanDelta;
      return lowerIsBetter ? sa - sb : sb - sa; // best first
    });

    return [...ranked, ...unranked];
  }

  // Convenience: best single pick for a domain.
  bestInterventionForDomain(userId: string, domain: InterventionDomain, maxEnergyCost = 5): Intervention | undefined {
    return this.rankInterventionsForDomain(userId, domain, maxEnergyCost)[0];
  }

  getEffectivenessSummary(userId: string): EffectivenessScore[] {
    return Array.from(this.computeEffectiveness(userId).values()).sort((a, b) => b.sampleSize - a.sampleSize);
  }
}
