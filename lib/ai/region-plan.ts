import { EditPlan } from '../editor/types';

// Review only actionable groups, with the overall look before local refinements.
export function getPlanGroups(plan: EditPlan) {
  const adjustments = plan.commands.filter(command => command.tool.startsWith('adjust.'));
  const groups: Array<{ id: string; name: string }> = [];
  if (adjustments.some(command => command.target.type === 'document')) {
    groups.push({ id: 'global', name: 'Chỉnh tổng thể' });
  }
  for (const command of plan.commands.filter(command => command.tool === 'mask.createSemantic')) {
    const id = String(command.parameters.id);
    if (adjustments.some(adjustment => adjustment.target.type === 'mask' && adjustment.target.id === id)) {
      groups.push({ id, name: String(command.parameters.name) });
    }
  }
  return groups;
}

// Include creation commands with selected adjustments so masks never become dangling references.
export function selectPlanRegions(plan: EditPlan, regions: string[]): EditPlan {
  const selected = new Set(regions);
  return { ...plan, commands: plan.commands.filter(command => {
    if (command.tool === 'mask.createSemantic') return selected.has(String(command.parameters.id));
    return selected.has(command.target.type === 'document' ? 'global' : command.target.id || '');
  }) };
}
