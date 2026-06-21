// paw-server/src/pipeline/topology-engine.ts
import {
  PipelineContext,
  ValidationResult,
  EvaluationResult,
  LinearRoutine,
  ParallelRoutine,
  HierarchicalRoutine,
  PredictiveRoutine,
  RecoveryModule,
  PipelineResult,
  AnyRoutine,
} from '../types/pipeline-types';
import { Validator } from './validator';
import { assessRisk } from './predictive-rules';
import { CRISIS_RESOURCES, getModuleCautions } from './crisis-resources';
import { ALL_MODULES } from './modules';

export class TopologyEngine {
  async execute(ctx: PipelineContext): Promise<PipelineResult> {
    const modules = ctx.activeModuleIds.map((id) => ALL_MODULES[id]).filter(Boolean);
    if (modules.length === 0) {
      throw new Error(`No valid modules found for IDs: ${ctx.activeModuleIds.join(', ')}`);
    }

    let routine: AnyRoutine;
    switch (ctx.pipelineType) {
      case 'LINEAR_JITAI':
        routine = await this.executeLinear(ctx, modules);
        break;
      case 'PARALLEL_STREAM':
        routine = await this.executeParallel(ctx, modules);
        break;
      case 'HIERARCHICAL_CASCADE':
        routine = await this.executeHierarchical(ctx, modules);
        break;
      case 'PREDICTIVE_PREEMPTIVE':
        routine = await this.executePredictive(ctx, modules);
        break;
      default:
        routine = await this.executeLinear(ctx, modules);
    }

    const validationResult: ValidationResult<AnyRoutine> = await Validator.validate(routine, ctx, modules);
    const finalRoutine = validationResult.valid ? validationResult.routine : (validationResult.modifiedRoutine ?? validationResult.routine);

    // Crisis resources and module cautions are attached unconditionally, on
    // every path, regardless of pipeline type or validation outcome.
    return {
      routine: finalRoutine,
      crisisResources: CRISIS_RESOURCES,
      moduleCautions: getModuleCautions(ctx.activeModuleIds),
      validation: validationResult.valid ? undefined : { adjusted: true, explanation: validationResult.explanation },
    };
  }

  private async executeLinear(ctx: PipelineContext, modules: RecoveryModule[]): Promise<LinearRoutine> {
    const linearConfigs = modules.map((m) => m.pipelineConfig.LINEAR_JITAI);
    const allTaskIds = linearConfigs.flatMap((config) => config.taskOrder);
    const tasks = allTaskIds.map((taskId) => this.getComponentById(modules, taskId)).filter(Boolean) as any[];

    return {
      type: 'STRUCTURED_ROUTINE',
      tasks,
      stream: 'UNIFIED',
      maxItems: Math.min(...linearConfigs.map((c) => c.maxDaily)),
    };
  }

  private async executeParallel(ctx: PipelineContext, modules: RecoveryModule[]): Promise<ParallelRoutine> {
    const parallelConfigs = modules.map((m) => m.pipelineConfig.PARALLEL_STREAM);
    const reflectiveTasks = parallelConfigs
      .flatMap((c) => c.reflectiveTasks)
      .map((id) => this.getComponentById(modules, id))
      .filter(Boolean);
    const impulsiveTasks = parallelConfigs
      .flatMap((c) => c.impulsiveTriggers)
      .map((id) => this.getComponentById(modules, id))
      .filter(Boolean);

    return {
      type: 'PARALLEL_ROUTINE',
      reflectiveStream: reflectiveTasks,
      impulsiveStream: impulsiveTasks,
      passiveMonitor: ctx.contextSnapshot,
      streamBalance: { reflective: 0.6, impulsive: 0.4 },
    };
  }

  private async executeHierarchical(ctx: PipelineContext, modules: RecoveryModule[]): Promise<HierarchicalRoutine> {
    const tier = ctx.tier ?? 1;
    const hierarchicalConfigs = modules.map((m) => m.pipelineConfig.HIERARCHICAL_CASCADE);

    if (tier === 1) {
      const tasks = hierarchicalConfigs
        .flatMap((c) => c.tier1Fixed)
        .map((id) => this.getComponentById(modules, id))
        .filter(Boolean);
      return { type: 'HIERARCHICAL_ROUTINE', tier, tasks, userAction: 'CONFIRM_ONLY' };
    }

    if (tier === 2) {
      const optionIds = hierarchicalConfigs.flatMap((c) => c.tier2Options);
      const options = [optionIds.map((id) => this.getComponentById(modules, id)).filter(Boolean)];
      return { type: 'HIERARCHICAL_ROUTINE', tier, options, userAction: 'SELECT_MODIFY' };
    }

    if (tier === 3) {
      const template = modules.flatMap((m) => Object.values(m.components).filter((c) => c !== undefined));
      return { type: 'HIERARCHICAL_ROUTINE', tier, template, userAction: 'USER_PROPOSES' };
    }

    return this.executeHierarchical({ ...ctx, tier: 1 }, modules);
  }

  private async executePredictive(ctx: PipelineContext, modules: RecoveryModule[]): Promise<PredictiveRoutine> {
    const { score: riskScore, level: riskLevel, dominantDomain } = this.calculateRiskScore(ctx.contextSnapshot);
    const configs = modules.map((m) => m.pipelineConfig.PREDICTIVE_PREEMPTIVE);

    if (riskLevel === 'HIGH') {
      const safeguards = configs
        .flatMap((c) => c.protectiveSafeguards)
        .map((id) => this.getComponentById(modules, id))
        .filter(Boolean);
      return {
        type: 'PREDICTIVE_ROUTINE',
        riskLevel: 'HIGH',
        action: 'PROTECTIVE_MODE',
        safeguards,
        notification: `Risk elevated (dominant factor: ${dominantDomain}). Protective safeguards activated.`,
      };
    }

    if (riskLevel === 'ELEVATED') {
      const routine = configs
        .flatMap((c) => c.preemptiveBuffers)
        .map((id) => this.getComponentById(modules, id))
        .filter(Boolean);
      return {
        type: 'PREDICTIVE_ROUTINE',
        riskLevel: 'ELEVATED',
        action: 'PREEMPTIVE_ADAPTATION',
        routine,
        notification: `Risk elevated (dominant factor: ${dominantDomain}). Added a protective buffer.`,
      };
    }

    const linearRoutine = await this.executeLinear(ctx, modules);
    return { type: 'PREDICTIVE_ROUTINE', riskLevel: 'LOW', action: 'STANDARD', routine: linearRoutine.tasks };
  }

  private getComponentById(modules: RecoveryModule[], taskId: string) {
    for (const module of modules) {
      const entry = Object.entries(module.components).find(([, def]) => def?.id === taskId);
      if (entry) {
        const [compKey, compDef] = entry;
        return { ...compDef, moduleId: module.id, componentId: compKey };
      }
    }
    return null;
  }

  private calculateRiskScore(context: PipelineContext['contextSnapshot']): {
    score: number;
    level: 'LOW' | 'ELEVATED' | 'HIGH';
    dominantDomain: string;
  } {
    const assessment = assessRisk(context);
    return { score: assessment.score, level: assessment.level, dominantDomain: assessment.dominantDomain };
  }

  // tier is now an explicit parameter instead of reading ctx.tier, which was
  // never in scope here in the original draft.
  async evaluateAndFeedback(
    userId: string,
    interactionData: any,
    currentPipelineType: string,
    currentTier?: number
  ): Promise<{ feedback: any; source: string }> {
    const evaluation: EvaluationResult = {
      completionRate: 0.7,
      cravingDelta: -0.5,
      sleepQualityDelta: 0.2,
    };

    let pipelineChangeRecommended: string | null = null;
    if (currentPipelineType === 'LINEAR_JITAI' && evaluation.completionRate < 0.5) {
      pipelineChangeRecommended = 'HIERARCHICAL_CASCADE';
    }

    if (currentPipelineType === 'HIERARCHICAL_CASCADE' && currentTier === 1 && evaluation.completionRate > 0.85) {
      console.log(`[Evaluator] User ${userId} shows high adherence in Tier 1. Eligible for Tier 2 review.`);
    }

    const humanOverrideActive = false;
    if (humanOverrideActive) {
      return { feedback: {}, source: 'CLINICIAN' };
    }

    return {
      feedback: { adjustedWeights: evaluation, pipelineChangeRecommended },
      source: 'AUTOMATED',
    };
  }
}
