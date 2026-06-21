// paw-server/src/pipeline/outcome-tracking.ts
//
// Tracks "did the intervention work": pre-state, intervention delivered,
// post-state, and the delta. This is the piece that lets the system improve
// rather than just deciding -- and it's also the only honest path to
// validating the predictive-rules.ts weights for a specific person, per the
// epistemic note at the top of that file.
//
// Unlike most of this codebase so far, this writes to a JSON file rather
// than an in-memory Map. Outcome data is explicitly meant to accumulate
// over weeks/months -- losing it on every server restart (which happens
// constantly during Termux development) would defeat the entire purpose of
// this layer. SQLite is the better long-term choice per the original
// architecture discussion; this file-backed version is a deliberately
// simple, dependency-free starting point that's easy to migrate later
// (one record shape, append-only, trivial to import into SQLite).

import * as fs from 'fs';
import * as path from 'path';

export interface OutcomeRecord {
  id: string;
  userId: string;
  moduleId: string;
  interventionId: string;
  domain: string; // InterventionDomain from intervention-library.ts, kept as string to avoid a circular import
  deliveredAt: number;
  preState: { cravingScore?: number; stressLevel?: number; moodScore?: number };
  postState?: { cravingScore?: number; stressLevel?: number; moodScore?: number };
  respondedAt?: number;
  engaged: boolean; // did the person interact with the intervention at all
}

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'outcomes.jsonl');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '');
}

export class OutcomeTracker {
  constructor() {
    ensureDataFile();
  }

  recordDelivery(
    userId: string,
    moduleId: string,
    interventionId: string,
    domain: string,
    preState: OutcomeRecord['preState']
  ): string {
    const record: OutcomeRecord = {
      id: `${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      moduleId,
      interventionId,
      domain,
      deliveredAt: Date.now(),
      preState,
      engaged: false,
    };
    this.append(record);
    return record.id;
  }

  // Call when the person responds to or completes the intervention, ideally
  // with a follow-up self-report (e.g. craving re-rated a few minutes later).
  recordOutcome(recordId: string, postState: OutcomeRecord['postState'], engaged = true): boolean {
    const all = this.readAll();
    const idx = all.findIndex((r) => r.id === recordId);
    if (idx === -1) return false;
    all[idx].postState = postState;
    all[idx].respondedAt = Date.now();
    all[idx].engaged = engaged;
    this.rewriteAll(all);
    return true;
  }

  private append(record: OutcomeRecord) {
    fs.appendFileSync(DATA_FILE, JSON.stringify(record) + '\n');
  }

  private readAll(): OutcomeRecord[] {
    ensureDataFile();
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    return content
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as OutcomeRecord);
  }

  private rewriteAll(records: OutcomeRecord[]) {
    fs.writeFileSync(DATA_FILE, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
  }

  getForUser(userId: string): OutcomeRecord[] {
    return this.readAll().filter((r) => r.userId === userId);
  }

  // Used by personalization-memory.ts to compute per-intervention effectiveness.
  getCompletedForUser(userId: string): OutcomeRecord[] {
    return this.getForUser(userId).filter((r) => r.engaged && r.postState);
  }

  // Longitudinal query: e.g. "how was craving trending at this hour, over
  // the last N days" -- this is what makes "how am I doing at 1:18am across
  // weeks" answerable.
  getTimeSeries(
    userId: string,
    field: 'cravingScore' | 'stressLevel' | 'moodScore',
    sinceMs: number
  ): Array<{ timestamp: number; pre?: number; post?: number; delta?: number }> {
    return this.getForUser(userId)
      .filter((r) => r.deliveredAt >= sinceMs)
      .map((r) => {
        const pre = r.preState[field];
        const post = r.postState?.[field];
        return {
          timestamp: r.deliveredAt,
          pre,
          post,
          delta: pre !== undefined && post !== undefined ? post - pre : undefined,
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }
}
