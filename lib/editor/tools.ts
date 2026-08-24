import { ADJUSTMENT_KEYS, AdjustmentKey, EditCommand, EditorDocument, ToolDefinition, ToolResult } from './types';

export const CONTROL_DEFINITIONS: Record<AdjustmentKey, { label: string; min: number; max: number; step: number; unit: string; description: string }> = {
  exposure: { label: 'Phơi sáng', min: -2, max: 2, step: .05, unit: 'EV', description: 'Độ sáng tổng thể theo stop ánh sáng' },
  contrast: { label: 'Tương phản', min: -100, max: 100, step: 1, unit: '%', description: 'Khoảng cách giữa vùng sáng và tối' },
  highlights: { label: 'Vùng sáng', min: -100, max: 100, step: 1, unit: '%', description: 'Độ sáng của vùng highlight' },
  shadows: { label: 'Vùng tối', min: -100, max: 100, step: 1, unit: '%', description: 'Độ sáng của vùng shadow' },
  whites: { label: 'Điểm trắng', min: -100, max: 100, step: 1, unit: '%', description: 'Mức trắng cực đại' },
  blacks: { label: 'Điểm đen', min: -100, max: 100, step: 1, unit: '%', description: 'Mức đen cực tiểu' },
  temperature: { label: 'Nhiệt độ', min: -100, max: 100, step: 1, unit: '%', description: 'Cân bằng xanh dương và vàng' },
  tint: { label: 'Sắc độ', min: -100, max: 100, step: 1, unit: '%', description: 'Cân bằng xanh lá và magenta' },
  vibrance: { label: 'Độ rực', min: -100, max: 100, step: 1, unit: '%', description: 'Bão hòa có bảo vệ màu đã rực' },
  saturation: { label: 'Bão hòa', min: -100, max: 100, step: 1, unit: '%', description: 'Độ bão hòa toàn ảnh' },
  clarity: { label: 'Độ rõ', min: -100, max: 100, step: 1, unit: '%', description: 'Tương phản vùng trung gian' },
  vignette: { label: 'Tối góc', min: -100, max: 100, step: 1, unit: '%', description: 'Độ tối hoặc sáng ở viền ảnh' },
};

function assertCommand(command: EditCommand, key: AdjustmentKey) {
  if (command.version !== 1) throw new Error('Phiên bản command không được hỗ trợ.');
  if (command.target.type !== 'document') throw new Error('Công cụ này chỉ hỗ trợ document.');
  const value = command.parameters.value;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Tham số value phải là số hữu hạn.');
  const definition = CONTROL_DEFINITIONS[key];
  if (value < definition.min || value > definition.max) throw new Error(`${definition.label} phải nằm trong ${definition.min}–${definition.max}.`);
  const unknown = Object.keys(command.parameters).filter((item) => item !== 'value');
  if (unknown.length) throw new Error(`Tham số không được hỗ trợ: ${unknown.join(', ')}.`);
}

function createAdjustmentTool(key: AdjustmentKey): ToolDefinition {
  const definition = CONTROL_DEFINITIONS[key];
  const apply = async (document: EditorDocument, command: EditCommand): Promise<ToolResult> => {
    assertCommand(command, key);
    const value = command.parameters.value as number;
    return {
      document: { ...document, adjustments: { ...document.adjustments, [key]: value }, updatedAt: new Date().toISOString() },
      description: `${definition.label}: ${value > 0 ? '+' : ''}${value}${definition.unit === 'EV' ? ' EV' : ''}`,
    };
  };
  return {
    name: `adjust.${key}`,
    description: definition.description,
    inputSchema: { type: 'object', properties: { value: { type: 'number', minimum: definition.min, maximum: definition.max, default: 0, description: definition.description } }, required: ['value'], additionalProperties: false },
    preview: apply,
    execute: apply,
    describe: (command) => `${definition.label} → ${command.parameters.value}`,
  };
}

export const TOOL_REGISTRY = new Map<string, ToolDefinition>(ADJUSTMENT_KEYS.map((key) => {
  const tool = createAdjustmentTool(key);
  return [tool.name, tool];
}));

export function listToolContracts() {
  return [...TOOL_REGISTRY.values()].map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
}
