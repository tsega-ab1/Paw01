// paw-server/src/pipeline/module-intakes.ts
import { ModuleIntakeDefinition } from '../types/pipeline-types';
import { ALCOHOL_INTAKE } from './modules/alcohol-module';
import { PYTHON_SKILL_INTAKE } from './modules/python-skill-module';

export const MODULE_INTAKES: Record<string, ModuleIntakeDefinition> = {
  [ALCOHOL_INTAKE.moduleId]: ALCOHOL_INTAKE,
  [PYTHON_SKILL_INTAKE.moduleId]: PYTHON_SKILL_INTAKE,
};
