// paw-server/src/pipeline/receptivity-engine.ts
//
// Replaces the placeholder `timeOfDay >= 6 && timeOfDay < 23` heuristic with
// a per-user model that learns when this specific person actually engages
// versus ignores. This is what the JITAI literature means by "receptivity":
// not a fixed window, but a property of the individual that's estimated from
// their own response history.
//
// Method: Beta-Bernoulli estimation per (hour-of-day, day-type) bucket.
// This is standard, well-understood statistical practice for estimating a
// probability from binary outcomes (engaged / ignored) with proper handling
// of small sample sizes -- NOT a fabricated "AI model." With few or no
// observations in a bucket, the estimate falls back toward a neutral prior
// (Laplace/Beta(1,1) smoothing) rather than overclaiming confidence from
// thin data. As more observations accumulate, the estimate increasingly
// reflects this person's actual pattern.
//
// This deliberately does NOT use any contextual/biological data to infer
// receptivity (e.g. it does not guess "probably asleep" from inactivity) --
// it only uses directly observed past response behavior, which is the one
// thing it's safe to infer from.

export type DayType = 'weekday' | 'weekend';

interface BucketStats {
  engaged: number;  // count of times something was delivered and the person responded
  ignored: number;  // count of times something was delivered and the person did not respond
}

interface ReceptivityRecord {
  // 24 hours x 2 day-types = 48 buckets per user
  buckets: Map<string, BucketStats>;
}

function bucketKey(hour: number, dayType: DayType): string {
  return `${hour}_${dayType}`;
}

function dayTypeFromWeekday(weekday: number): DayType {
  return weekday === 0 || weekday === 6 ? 'weekend' : 'weekday';
}

const PRIOR_ALPHA = 1; // Beta(1,1) = uniform prior, standard non-informative choice
const PRIOR_BETA = 1;
const MIN_OBSERVATIONS_FOR_CONFIDENCE = 5;

export class ReceptivityEngine {
  private records = new Map<string, ReceptivityRecord>();

  // Call this whenever something is delivered to the user (a nudge, a task,
  // a check-in) and you later find out whether they engaged with it or not.
  recordOutcome(userId: string, hour: number, weekday: number, engaged: boolean) {
    if (!this.records.has(userId)) this.records.set(userId, { buckets: new Map() });
    const record = this.records.get(userId)!;
    const key = bucketKey(hour, dayTypeFromWeekday(weekday));
    const stats = record.buckets.get(key) ?? { engaged: 0, ignored: 0 };
    if (engaged) stats.engaged += 1;
    else stats.ignored += 1;
    record.buckets.set(key, stats);
  }

  // Returns an estimated probability [0,1] this person engages at this
  // hour/day-type, plus how many real observations back that estimate.
  estimate(userId: string, hour: number, weekday: number): { probability: number; observations: number; confident: boolean } {
    const record = this.records.get(userId);
    const key = bucketKey(hour, dayTypeFromWeekday(weekday));
    const stats = record?.buckets.get(key) ?? { engaged: 0, ignored: 0 };
    const observations = stats.engaged + stats.ignored;

    // Beta-Bernoulli posterior mean with a uniform prior -- the standard,
    // well-understood way to estimate a probability from few observations
    // without overclaiming confidence.
    const probability = (stats.engaged + PRIOR_ALPHA) / (observations + PRIOR_ALPHA + PRIOR_BETA);

    return { probability, observations, confident: observations >= MIN_OBSERVATIONS_FOR_CONFIDENCE };
  }

  // Decision function combining the learned estimate with a safe cold-start
  // fallback. Until there's enough data, falls back to a conservative
  // quiet-hours heuristic rather than pretending to know the person's
  // pattern from zero observations.
  isReceptive(userId: string, hour: number, weekday: number, threshold = 0.4): boolean {
    const { probability, confident } = this.estimate(userId, hour, weekday);
    if (!confident) {
      // Cold-start fallback: same conservative window as before, but only
      // used until real data exists.
      return hour >= 6 && hour < 23;
    }
    return probability >= threshold;
  }

  getProfile(userId: string): Array<{ hour: number; dayType: DayType; probability: number; observations: number }> {
    const record = this.records.get(userId);
    if (!record) return [];
    const out: Array<{ hour: number; dayType: DayType; probability: number; observations: number }> = [];
    for (const [key, stats] of record.buckets.entries()) {
      const [hourStr, dayType] = key.split('_');
      const observations = stats.engaged + stats.ignored;
      const probability = (stats.engaged + PRIOR_ALPHA) / (observations + PRIOR_ALPHA + PRIOR_BETA);
      out.push({ hour: Number(hourStr), dayType: dayType as DayType, probability, observations });
    }
    return out.sort((a, b) => a.hour - b.hour);
  }
}
