// paw-server/src/pipeline/modules/index.ts
import { RecoveryModule } from '../../types/pipeline-types';
import { ALCOHOL_MODULE } from './alcohol-module';
import { PYTHON_SKILL_MODULE } from './python-skill-module';

export const ALL_MODULES: Record<string, RecoveryModule> = {
  [ALCOHOL_MODULE.id]: ALCOHOL_MODULE,
  [PYTHON_SKILL_MODULE.id]: PYTHON_SKILL_MODULE,
};
