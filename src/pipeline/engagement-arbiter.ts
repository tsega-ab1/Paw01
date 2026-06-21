// paw-server/src/pipeline/engagement-arbiter.ts
//
// This is the referee from the architecture diagrams: it does not generate
// content, it decides which already-generated module result actually reaches
// the user this cycle. It calls TopologyEngine.execute() once PER MODULE,
// each with that module's own pipelineType -- this is the fix for a real gap
// in the original design, where PipelineContext carried a single pipelineType
// for potentially many activeModuleIds. Per the purpose-not-domain decision
// from earlier, alcohol cessation and skill-building should never be forced
// to share one topology shape just because they're both "active."

import { TopologyEngine } from './topology-engine';
import { assessRisk, RiskAssessment } from './predictive-rules';
import { ReceptivityEngine } from './receptivity-engine';
import { OutcomeTracker } from './outcome-tracking';
import { PersonalizationMemory } from './personalization-memory';
import { RecoveryModule, PipelineContext, PipelineResult } from '../types/pipeline-types';
import { createDefaultContextSnapshot, ContextOverrides } from './context-defaults';

export interface ModuleAssignment {
  pipelineType: PipelineContext['pipelineType'];
  tier?: number;
  priorityTier?: 1 | 2 | 3 | 4; // from this user's module intake; falls back to the module's static default if absent
}

interface Bid {
  moduleId: string;
  priorityTier: number; // from RecoveryModule.priorityTier -- 1 is highest
  urgency: number;
  result: PipelineResult;
  riskAssessment: RiskAssessment; // from the rule engine, for cross-trigger evaluation
}

export type ArbiterDecision =
  | { delivered: null; reason: 'not_receptive' | 'no_bids' }
  | { delivered: string; result: PipelineResult; suppressed: string[] };

const DEFAULT_ROTATION_CAP = 2;

export class EngagementArbiter {
  private engine = new TopologyEngine();
  private receptivity = new ReceptivityEngine();
  readonly outcomes = new OutcomeTracker();
  readonly personalization = new PersonalizationMemory(this.outcomes);

  // All of this is in-memory and per-process -- replace with real persistence
  // before this needs to survive a restart or run across multiple users at scale.
  private assignments = new Map<string, Map<string, ModuleAssignment>>();
  private activeRotation = new Map<string, Set<string>>();
  private lastFocalAt = new Map<string, Map<string, number>>();
  private rotationCap = new Map<string, number>(); // per-user, settable from the capacity ledger

  setRotationCap(userId: string, cap: number) {
    this.rotationCap.set(userId, cap);
  }

  // Enabling a module assigns it a topology shape and a starting tier (if
  // applicable) and puts it into active rotation if there's room, otherwise
  // it queues dormant -- it still runs in the background via TopologyEngine,
  // it just can't win a focal slot until something rotates out.
  assignModule(userId: string, moduleId: string, assignment: ModuleAssignment) {
    if (!this.assignments.has(userId)) this.assignments.set(userId, new Map());
    this.assignments.get(userId)!.set(moduleId, assignment);

    const cap = this.rotationCap.get(userId) ?? DEFAULT_ROTATION_CAP;
    const rotation = this.activeRotation.get(userId) ?? new Set<string>();
    if (rotation.size < cap) rotation.add(moduleId);
    this.activeRotation.set(userId, rotation);
  }

  getRotationState(userId: string) {
    return {
      active: Array.from(this.activeRotation.get(userId) ?? []),
      assigned: Array.from((this.assignments.get(userId) ?? new Map()).keys()),
    };
  }

  // Placeholder heuristic REMOVED -- this now delegates to ReceptivityEngine,
  // which learns per-user, per-hour engagement patterns from real response
  // data and only falls back to the quiet-hours heuristic during cold start.
  private isReceptive(userId: string, snapshot: ReturnType<typeof createDefaultContextSnapshot>): boolean {
    return this.receptivity.isReceptive(userId, snapshot.timeOfDay, snapshot.weekday);
  }

  // Call this after a decide() result was actually shown to the person and
  // you know whether they engaged with it. Feeds the receptivity model.
  recordEngagementOutcome(userId: string, hour: number, weekday: number, engaged: boolean) {
    this.receptivity.recordOutcome(userId, hour, weekday, engaged);
  }

  getReceptivityProfile(userId: string) {
    return this.receptivity.getProfile(userId);
  }

  async decide(
    userId: string,
    modules: Record<string, RecoveryModule>,
    contextOverrides: ContextOverrides = {}
  ): Promise<ArbiterDecision> {
    const snapshot = createDefaultContextSnapshot(contextOverrides);

    if (!this.isReceptive(userId, snapshot)) {
      return { delivered: null, reason: 'not_receptive' };
    }

    const rotation = this.activeRotation.get(userId) ?? new Set<string>();
    const userAssignments = this.assignments.get(userId) ?? new Map<string, ModuleAssignment>();

    const bids: Bid[] = [];
    for (const moduleId of rotation) {
      const module = modules[moduleId];
      const assignment = userAssignments.get(moduleId);
      if (!module || !assignment) continue;

      const result = await this.engine.execute({
        userId,
        activeModuleIds: [moduleId],
        pipelineType: assignment.pipelineType,
        tier: assignment.tier,
        contextSnapshot: snapshot,
      });

      bids.push({
        moduleId,
        priorityTier: assignment.priorityTier ?? module.priorityTier,
        urgency: this.estimateUrgency(result),
        result,
        riskAssessment: assessRisk(snapshot),
      });
    }

    if (bids.length === 0) {
      return { delivered: null, reason: 'no_bids' };
    }

    // Cross-triggers are applied AFTER this cycle's bids are read, so they
    // affect the NEXT decision rather than mutating state mid-selection.
    this.applyCrossTriggers(userId, bids, modules);

    // Goal-shielding selection: lowest priorityTier number wins (1 = highest,
    // matches the Cessation/Recovery > Maintenance > Growth ordering from
    // earlier), tie-broken by urgency, then by which module has waited
    // longest since its last focal slot.
    bids.sort((a, b) => {
      if (a.priorityTier !== b.priorityTier) return a.priorityTier - b.priorityTier;
      if (a.urgency !== b.urgency) return b.urgency - a.urgency;
      const lastA = this.lastFocalAt.get(userId)?.get(a.moduleId) ?? 0;
      const lastB = this.lastFocalAt.get(userId)?.get(b.moduleId) ?? 0;
      return lastA - lastB;
    });

    const winner = bids[0];
    if (!this.lastFocalAt.has(userId)) this.lastFocalAt.set(userId, new Map());
    this.lastFocalAt.get(userId)!.set(winner.moduleId, Date.now());

    return {
      delivered: winner.moduleId,
      result: winner.result,
      suppressed: bids.slice(1).map((b) => b.moduleId),
    };
  }

  private estimateUrgency(result: PipelineResult): number {
    const routine: any = result.routine;
    if (routine.type === 'PREDICTIVE_ROUTINE') {
      if (routine.riskLevel === 'HIGH') return 100;
      if (routine.riskLevel === 'ELEVATED') return 60;
      return 20;
    }
    if (routine.type === 'HIERARCHICAL_ROUTINE' && routine.tier === 1) return 70;
    return 30;
  }

  // All conditions now read from bid.riskAssessment (the rule engine output)
  // and bid.result, giving access to both computed risk and pipeline state.
  // Adding a new condition: add a case here and a corresponding response in
  // applyResponse() -- that's the only change needed on the arbiter side.
  private conditionMet(condition: string, bid: Bid): boolean {
    const { riskAssessment } = bid;
    const routine: any = bid.result.routine;
    const ctx = riskAssessment; // convenience alias for fired-rule checks

    switch (condition) {
      case 'lapse_detected':
        // A HIGH predictive risk or active Tier 1 hierarchical placement
        // both indicate lapse-proximal state.
        return (
          riskAssessment.level === 'HIGH' ||
          (routine.type === 'HIERARCHICAL_ROUTINE' && routine.tier === 1)
        );

      case 'craving_above_7':
        // Now directly readable from the rule engine's fired rules rather
        // than needing a separate craving-score field on the result.
        return riskAssessment.firedRules.some(
          (r) => r.name === 'high_craving' && r.fired && r.delta >= 20
          // delta >= 20 corresponds to cravingScore >= 8 in the rule definition
        );

      case 'missed_3x':
        // Low 7-day completion rate is now in ContextSnapshot and scored
        // by r_low_task_completion (delta 15 for < 0.3 rate).
        return riskAssessment.firedRules.some(
          (r) => r.name === 'low_7d_task_completion' && r.fired && r.delta >= 15
        );

      case 'stress_spike':
        return riskAssessment.firedRules.some(
          (r) => r.name === 'high_stress' && r.fired && r.delta >= 22
          // delta 22 = stressLevel >= 8
        );

      case 'social_isolation_detected':
        return riskAssessment.firedRules.some(
          (r) => r.name === 'social_isolation' && r.fired && r.delta >= 18
          // 48+ hours without social contact
        );

      case 'sleep_debt_accumulated':
        return riskAssessment.firedRules.some(
          (r) => r.name === 'accumulated_sleep_debt' && r.fired && r.delta >= 20
          // 3+ consecutive nights below 6 hours
        );

      case 'interaction_stress_cue':
        // The stress-x-cue nonlinear interaction is itself a named rule,
        // so it can be used directly as a cross-trigger condition.
        return riskAssessment.firedRules.some(
          (r) => r.name === 'interaction_stress_x_cue' && r.fired
        );

      case 'risk_elevated_or_high':
        return riskAssessment.level === 'ELEVATED' || riskAssessment.level === 'HIGH';

      default:
        return false;
    }
  }

  private applyCrossTriggers(userId: string, bids: Bid[], modules: Record<string, RecoveryModule>) {
    for (const bid of bids) {
      const module = modules[bid.moduleId];
      for (const trigger of module.crossTriggers) {
        if (this.conditionMet(trigger.condition, bid)) {
          this.applyResponse(userId, trigger.targetModuleId, trigger.response);
        }
      }
    }
  }

  private applyResponse(userId: string, targetModuleId: string, response: string) {
    const target = this.assignments.get(userId)?.get(targetModuleId);
    if (!target) return;

    if (response === 'pause_target') {
      this.activeRotation.get(userId)?.delete(targetModuleId);
    }
    if (response === 'reduce_target_load' && target.pipelineType === 'HIERARCHICAL_CASCADE') {
      target.tier = Math.max(1, (target.tier ?? 2) - 1); // step toward more structure, less self-directed load
    }
    // 'inject_extra_checkin' has no effect yet -- it needs a scheduling/
    // notification hook that doesn't exist in this layer.
  }
}
