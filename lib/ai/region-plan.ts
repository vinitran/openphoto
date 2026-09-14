import { EditPlan } from '../editor/types';

// Include creation commands with selected adjustments so masks never become dangling references.
export function selectPlanRegions(plan: EditPlan, regions: string[]): EditPlan {
  const selected = new Set(regions);
  return { ...plan, commands: plan.commands.filter(command => {
    if (command.tool === 'mask.createSemantic') return selected.has(String(command.parameters.id));
    return selected.has(command.target.type === 'document' ? 'global' : command.target.id || '');
  }) };
}
