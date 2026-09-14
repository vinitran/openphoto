import { describe, expect, it } from 'vitest';
import { AiResult, MAX_AI_REGIONS, responseSchema, toPlan } from './edit-response';
import { buildEditingInstructions, DEFAULT_AI_PROMPT } from './edit-policy';
import { getPlanGroups, selectPlanRegions } from './region-plan';
import { createDocument } from '../editor/types';
import { createTransaction, runCommands } from '../editor/dispatcher';
import { parseProject, serializeProject } from '../editor/persistence';

function result(count = 0): AiResult {
  return {
    title: 'Tự nhiên', rationale: 'Cân tổng thể và chỉ nâng chủ thể thiếu sáng.', confidence: .8,
    expectedImpact: ['Giữ hướng sáng và màu da'],
    regions: Array.from({ length: count }, (_, index) => ({
      id: `region-${index}`, name: `Nâng sáng chủ thể ${index + 1}`, semanticLabel: 'subject',
      inverted: false, feather: .03, polygon: [{ x: .2, y: .2 }, { x: .5, y: .2 }, { x: .5, y: .8 }],
    })),
    adjustments: [{ tool: 'adjust.exposure', targetId: null, value: .15 },
      ...Array.from({ length: count }, (_, index) => ({ tool: 'adjust.exposure', targetId: `region-${index}`, value: .2 }))],
  };
}

describe('Global-first AI response contract', () => {
  it.each([0, 1, 2, 3])('accepts %i regions with a global adjustment', async count => {
    const plan = toPlan(result(count));
    const rendered = await runCommands(createDocument(), plan.commands, 'preview');
    expect(rendered.document.masks).toHaveLength(count);
    expect(rendered.document.adjustments.exposure).toBe(.15);
    expect(getPlanGroups(plan)[0]).toEqual({ id: 'global', name: 'Chỉnh tổng thể' });
  });

  it('enforces the same region cap in schema and runtime without truncation', () => {
    expect(MAX_AI_REGIONS).toBe(3);
    expect(responseSchema.properties.regions.maxItems).toBe(MAX_AI_REGIONS);
    const response = result(4);
    expect(() => toPlan(response)).toThrow('tối đa 3 vùng');
    expect(response.regions).toHaveLength(4);
  });

  it.each(['adjust.hsl', 'retouch.clone', 'adjust.toString', 'adjust.constructor'])(
    'rejects unregistered tool %s', tool => {
      const response = result();
      response.adjustments[0].tool = tool;
      expect(() => toPlan(response)).toThrow();
    },
  );
  it.each([NaN, Infinity, -3, 3])('rejects invalid exposure %s', value => {
    const response = result();
    response.adjustments[0].value = value;
    expect(() => toPlan(response)).toThrow();
  });
  it.each(['missing', ''])('rejects invalid region reference %s', targetId => {
    const response = result();
    response.adjustments[0].targetId = targetId;
    expect(() => toPlan(response)).toThrow('vùng không tồn tại');
  });
  it('rejects invalid geometry and duplicate region IDs', () => {
    const response = result(2);
    response.regions[1].id = response.regions[0].id;
    expect(() => toPlan(response)).toThrow('Vùng AI không hợp lệ');
    const invalid = result(1);
    invalid.regions[0].polygon[0].x = 2;
    expect(() => toPlan(invalid)).toThrow('Vùng AI không hợp lệ');
  });
  it('shows only actionable groups and accepts no-change plans', () => {
    const response = result(1);
    response.adjustments = [];
    expect(getPlanGroups(toPlan(response))).toEqual([]);
    response.regions = [];
    expect(toPlan(response).commands).toEqual([]);
    response.regions = result(1).regions;
    response.adjustments = result(1).adjustments.slice(1);
    expect(getPlanGroups(toPlan(response))).toHaveLength(1);
    expect(getPlanGroups(toPlan(response))[0].id).not.toBe('global');
  });

  it.each(['global', 'local', 'both'] as const)('previews and commits %s selection with reversible transaction data', async selection => {
    const plan = toPlan(result(1));
    const id = getPlanGroups(plan)[1].id;
    const chosen = selectPlanRegions(plan, selection === 'global' ? ['global'] : selection === 'local' ? [id] : ['global', id]);
    const before = createDocument();
    const savedBefore = structuredClone(before);
    expect(selectPlanRegions(plan, []).commands).toEqual([]);
    const preview = await runCommands(before, chosen.commands, 'preview');
    expect(before).toEqual(savedBefore);
    const transaction = await createTransaction(before, chosen.commands, 'AI');
    expect(transaction.after.adjustments).toEqual(preview.document.adjustments);
    expect(transaction.after.masks).toEqual(preview.document.masks);
    expect(transaction.after.adjustments.exposure).toBe(selection === 'local' ? 0 : .15);
    expect(transaction.after.masks).toHaveLength(selection === 'global' ? 0 : 1);
    const restored = parseProject(serializeProject(transaction.after, [transaction], 0));
    // The editor's undo/redo use these exact before/after document states.
    expect(restored.transactions[0].before).toEqual(savedBefore);
    expect(restored.transactions[0].after).toEqual(transaction.after);
  });

  it('does not restrict manual or existing project masks to three', async () => {
    const commands = Array.from({ length: 4 }, () => toPlan(result(1)).commands).flat();
    const document = (await runCommands(createDocument(), commands)).document;
    expect(parseProject(serializeProject(document, [], -1)).document.masks).toHaveLength(4);
  });

  it('prompts for global-first editing with optional masks and explicit-only effects', () => {
    const instructions = buildEditingInstructions();
    expect(instructions).toContain('đánh giá ánh sáng → cân màu tổng thể → chọn màu chủ đạo → chỉnh cục bộ nếu cần');
    expect(instructions).toContain('0–3 vùng');
    expect(instructions).toContain('Không tự đề xuất blur hoặc fade');
    expect(instructions).toContain('chỉ thay đổi chúng khi người dùng yêu cầu rõ');
    expect(instructions).toContain('không tạo vùng chỉ vì nhận diện được đồ vật');
    for (const prompt of [instructions, DEFAULT_AI_PROMPT]) {
      expect(prompt).not.toContain('Phân biệt da, chủ thể, quần áo');
      expect(prompt).not.toContain('da mặt/da tay, tóc, quần áo');
      expect(prompt).not.toContain('chỉ làm mờ nền nhẹ khi cần');
    }
  });
});
