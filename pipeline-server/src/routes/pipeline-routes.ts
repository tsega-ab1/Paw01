// paw-server/src/routes/pipeline-routes.ts
import express, { Request, Response } from 'express';
import { IntakeRouter } from '../pipeline/intake-router';
import { TopologyEngine } from '../pipeline/topology-engine';
import { EngagementArbiter } from '../pipeline/engagement-arbiter';
import { createDefaultContextSnapshot } from '../pipeline/context-defaults';
import { CRISIS_RESOURCES } from '../pipeline/crisis-resources';
import { MODULE_INTAKES } from '../pipeline/module-intakes';
import { ALL_MODULES } from '../pipeline/modules';
import { VALIDATED_INSTRUMENTS, scoreInstrument } from '../pipeline/validated-instruments';
import { getInterventionsForDomain } from '../pipeline/intervention-library';
import { PipelineContext } from '../types/pipeline-types';

const router = express.Router();
const topologyEngine = new TopologyEngine();
const arbiter = new EngagementArbiter();

// GET the questionnaire for a module, to render the first time it's opened.
router.get('/modules/:moduleId/intake', (req: Request, res: Response) => {
  const intake = MODULE_INTAKES[req.params.moduleId];
  if (!intake) return res.status(404).json({ error: `No intake defined for module ${req.params.moduleId}` });
  res.json({
    moduleId: intake.moduleId,
    instrumentName: intake.instrumentName,
    isValidatedClinicalInstrument: intake.isValidatedClinicalInstrument,
    questions: intake.questions,
  });
});

// POST the person's answers (question id -> points for the option they
// picked). Scores it, computes priorityTier + pipelineType + tier, and
// assigns that module into the arbiter for this user.
router.post('/modules/:moduleId/intake', (req: Request, res: Response) => {
  const { moduleId } = req.params;
  const { userId, answers, meta } = req.body;
  const intake = MODULE_INTAKES[moduleId];
  if (!intake) return res.status(404).json({ error: `No intake defined for module ${moduleId}` });
  if (!userId || !answers) return res.status(400).json({ error: 'Missing userId or answers' });

  const assignment = intake.computeAssignment(answers, meta);
  arbiter.assignModule(userId, moduleId, assignment);
  res.json({ moduleId, instrumentName: intake.instrumentName, ...assignment });
});

// Ask the arbiter what should reach this user right now, across whatever
// modules are in their active rotation.
router.post('/decide', async (req: Request, res: Response) => {
  try {
    const { userId, contextOverrides } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    const decision = await arbiter.decide(userId, ALL_MODULES, contextOverrides ?? {});
    res.json(decision);
  } catch (error) {
    console.error('[PipelineRoute] Error in arbiter decision:', error);
    res.status(500).json({ error: 'Failed to reach a decision' });
  }
});

router.get('/users/:userId/rotation', (req: Request, res: Response) => {
  res.json(arbiter.getRotationState(req.params.userId));
});

router.post('/intake/assess', async (req: Request, res: Response) => {
  try {
    const { userId, responses, activeModuleIds } = req.body;
    if (!userId || !responses || !activeModuleIds) {
      return res.status(400).json({ error: 'Missing userId, responses, or activeModuleIds' });
    }

    if (IntakeRouter.needsImmediateSupport(responses)) {
      return res.json({ immediateSupport: true, crisisResources: CRISIS_RESOURCES });
    }

    const pipelineType = IntakeRouter.determinePipeline(responses) as PipelineContext['pipelineType'];
    const initialTier = pipelineType === 'HIERARCHICAL_CASCADE' ? IntakeRouter.getInitialTier(responses) : undefined;

    const context: PipelineContext = {
      userId,
      activeModuleIds,
      pipelineType,
      tier: initialTier,
      contextSnapshot: createDefaultContextSnapshot(),
    };

    const result = await topologyEngine.execute(context);
    res.json({ pipelineType, tier: initialTier, ...result });
  } catch (error) {
    console.error('[PipelineRoute] Error assessing intake:', error);
    res.status(500).json({ error: 'Failed to assess intake and generate routine' });
  }
});

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { userId, pipelineType, tier, activeModuleIds, contextSnapshot } = req.body;
    if (!userId || !pipelineType || !activeModuleIds) {
      return res.status(400).json({ error: 'Missing userId, pipelineType, or activeModuleIds' });
    }

    const context: PipelineContext = {
      userId,
      activeModuleIds,
      pipelineType,
      tier,
      contextSnapshot: createDefaultContextSnapshot(contextSnapshot ?? {}),
    };

    const result = await topologyEngine.execute(context);
    res.json(result);
  } catch (error) {
    console.error('[PipelineRoute] Error generating routine:', error);
    res.status(500).json({ error: 'Failed to generate routine' });
  }
});

router.post('/evaluate', async (req: Request, res: Response) => {
  try {
    const { userId, interactionData, pipelineType, tier } = req.body;
    if (!userId || !interactionData || !pipelineType) {
      return res.status(400).json({ error: 'Missing userId, interactionData, or pipelineType' });
    }

    const feedback = await topologyEngine.evaluateAndFeedback(userId, interactionData, pipelineType, tier);
    res.json(feedback);
  } catch (error) {
    console.error('[PipelineRoute] Error evaluating interaction:', error);
    res.status(500).json({ error: 'Failed to evaluate interaction data' });
  }
});

// ── Validated periodic instruments (PHQ-9, GAD-7, PSS-4, WHO-5, ISI, UCLA-3) ──

router.get('/instruments', (_req: Request, res: Response) => {
  res.json(
    Object.values(VALIDATED_INSTRUMENTS).map((i) => ({
      id: i.id,
      fullName: i.fullName,
      citation: i.citation,
      cadence: i.cadence,
    }))
  );
});

router.get('/instruments/:instrumentId', (req: Request, res: Response) => {
  const instrument = VALIDATED_INSTRUMENTS[req.params.instrumentId];
  if (!instrument) return res.status(404).json({ error: `Unknown instrument ${req.params.instrumentId}` });
  res.json(instrument);
});

router.post('/instruments/:instrumentId/score', (req: Request, res: Response) => {
  const instrument = VALIDATED_INSTRUMENTS[req.params.instrumentId];
  if (!instrument) return res.status(404).json({ error: `Unknown instrument ${req.params.instrumentId}` });
  const { answers } = req.body;
  if (!answers) return res.status(400).json({ error: 'Missing answers' });

  // PHQ-9's safety item is never part of this scoring call -- if your client
  // collected it, route it through the same unconditional crisis-resources
  // path as IntakeRouter.needsImmediateSupport(), not through this endpoint.
  const result = scoreInstrument(instrument, answers);
  res.json({ instrumentId: instrument.id, ...result });
});

// ── Intervention library ──────────────────────────────────────────────────

router.get('/interventions/:domain', (req: Request, res: Response) => {
  const domain = req.params.domain as any;
  res.json(getInterventionsForDomain(domain));
});

// Personalized ranking for a domain, for a specific user, using their real
// outcome history if there's enough of it (falls back to library order).
router.get('/users/:userId/interventions/:domain', (req: Request, res: Response) => {
  const { userId, domain } = req.params;
  const ranked = arbiter.personalization.rankInterventionsForDomain(userId, domain as any);
  res.json(ranked);
});

// ── Outcome tracking ──────────────────────────────────────────────────────

router.post('/outcomes/delivered', (req: Request, res: Response) => {
  const { userId, moduleId, interventionId, domain, preState } = req.body;
  if (!userId || !moduleId || !interventionId || !domain) {
    return res.status(400).json({ error: 'Missing userId, moduleId, interventionId, or domain' });
  }
  const id = arbiter.outcomes.recordDelivery(userId, moduleId, interventionId, domain, preState ?? {});
  res.json({ outcomeRecordId: id });
});

router.post('/outcomes/:recordId/result', (req: Request, res: Response) => {
  const { postState, engaged } = req.body;
  const ok = arbiter.outcomes.recordOutcome(req.params.recordId, postState ?? {}, engaged ?? true);
  if (!ok) return res.status(404).json({ error: 'Unknown outcome record id' });
  res.json({ updated: true });
});

router.get('/users/:userId/outcomes', (req: Request, res: Response) => {
  res.json(arbiter.outcomes.getForUser(req.params.userId));
});

// Longitudinal: "how was craving trending at this hour, over the last N
// days" -- the actual mechanism behind progress tracking over weeks/months.
router.get('/users/:userId/timeseries/:field', (req: Request, res: Response) => {
  const { userId, field } = req.params;
  const sinceDays = Number(req.query.sinceDays ?? 30);
  const sinceMs = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
  res.json(arbiter.outcomes.getTimeSeries(userId, field as any, sinceMs));
});

router.get('/users/:userId/effectiveness', (req: Request, res: Response) => {
  res.json(arbiter.personalization.getEffectivenessSummary(req.params.userId));
});

// ── Receptivity ─────────────────────────────────────────────────────────

router.post('/users/:userId/receptivity/outcome', (req: Request, res: Response) => {
  const { hour, weekday, engaged } = req.body;
  if (hour === undefined || weekday === undefined || engaged === undefined) {
    return res.status(400).json({ error: 'Missing hour, weekday, or engaged' });
  }
  arbiter.recordEngagementOutcome(req.params.userId, hour, weekday, engaged);
  res.json({ recorded: true });
});

router.get('/users/:userId/receptivity', (req: Request, res: Response) => {
  res.json(arbiter.getReceptivityProfile(req.params.userId));
});

export default router;
