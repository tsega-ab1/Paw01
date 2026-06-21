// paw-server/src/pipeline/validator.ts
import { RecoveryModule, ValidationResult, PipelineContext, AnyRoutine } from '../types/pipeline-types';

export class Validator {
  private static readonly MAX_DAILY_TASKS = 7;
  private static readonly MAX_ENERGY_PER_DAY = 10;

  static async validate<T extends AnyRoutine>(
    routine: T,
    context: PipelineContext,
    modules: RecoveryModule[]
  ): Promise<ValidationResult<T>> {
    let isValid = true;
    let explanation = '';
    const modifiedRoutine: T = { ...(routine as any) };

    const tasks: any[] | undefined = (routine as any).tasks;

    if (Array.isArray(tasks)) {
      if (tasks.length > this.MAX_DAILY_TASKS) {
        isValid = false;
        explanation += `Too many tasks (${tasks.length}), max allowed is ${this.MAX_DAILY_TASKS}. `;
        (modifiedRoutine as any).tasks = tasks.slice(0, this.MAX_DAILY_TASKS);
      }

      const totalEnergy = tasks.reduce((sum: number, task: any) => {
        const module = modules.find((m) => m.id === task.moduleId);
        const component = module?.components[task.componentId as keyof typeof module.components];
        if (component && 'energyCost' in component) {
          return sum + component.energyCost;
        }
        return sum;
      }, 0);

      if (totalEnergy > this.MAX_ENERGY_PER_DAY) {
        isValid = false;
        explanation += `Total cognitive load (${totalEnergy}) exceeds maximum (${this.MAX_ENERGY_PER_DAY}). `;
      }
    }

    if (isValid) {
      return { valid: true, routine };
    }
    return { valid: false, routine, modifiedRoutine, explanation };
  }
}
