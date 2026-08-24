export const ADJUSTMENT_KEYS = [
  'exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks',
  'temperature', 'tint', 'vibrance', 'saturation', 'clarity', 'vignette',
] as const;

export type AdjustmentKey = (typeof ADJUSTMENT_KEYS)[number];
export type Adjustments = Record<AdjustmentKey, number>;
export type CommandOrigin = 'user' | 'preset' | 'ai';
export type JsonValue = number | string | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type MaskType = 'brush' | 'radial' | 'linear';
export type NormalizedPoint = { x: number; y: number };
export type MaskGeometry = {
  points?: NormalizedPoint[];
  strokes?: NormalizedPoint[][];
  brushSize?: number;
  center?: NormalizedPoint;
  radiusX?: number;
  radiusY?: number;
  start?: NormalizedPoint;
  end?: NormalizedPoint;
};
export type MaskDefinition = {
  id: string;
  name: string;
  type: MaskType;
  enabled: boolean;
  inverted: boolean;
  opacity: number;
  feather: number;
  geometry: MaskGeometry;
  adjustments: Adjustments;
};

export type EditCommand = {
  id: string;
  version: 1;
  tool: string;
  target: { type: 'document' | 'layer' | 'mask'; id?: string };
  parameters: Record<string, JsonValue>;
  origin: CommandOrigin;
};

export type EditPlan = {
  id: string;
  version: 1;
  title: string;
  rationale: string;
  confidence: number;
  expectedImpact: string[];
  commands: EditCommand[];
};

export type JsonSchema = {
  type: 'object';
  properties: Record<string, { type: 'number' | 'string' | 'boolean' | 'object' | 'array'; minimum?: number; maximum?: number; default?: number | string | boolean; description?: string }>;
  required: string[];
  additionalProperties: false;
};

export type EditorDocument = {
  schemaVersion: 2;
  id: string;
  name: string;
  adjustments: Adjustments;
  masks: MaskDefinition[];
  createdAt: string;
  updatedAt: string;
};

export type Transaction = {
  id: string;
  label: string;
  origin: CommandOrigin;
  commands: EditCommand[];
  before: EditorDocument;
  after: EditorDocument;
  createdAt: string;
};

export type ToolResult = { document: EditorDocument; description: string };
export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  preview(document: EditorDocument, command: EditCommand): Promise<ToolResult>;
  execute(document: EditorDocument, command: EditCommand): Promise<ToolResult>;
  describe(command: EditCommand): string;
};

export type ProjectFile = {
  kind: 'openphoto-project';
  schemaVersion: 2;
  document: EditorDocument;
  transactions: Transaction[];
  historyIndex: number;
};

export const INITIAL_ADJUSTMENTS: Adjustments = {
  exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
  temperature: 0, tint: 0, vibrance: 0, saturation: 0, clarity: 0, vignette: 0,
};

export function createId(prefix = 'op') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createDocument(name = 'Untitled'): EditorDocument {
  const now = new Date().toISOString();
  return { schemaVersion: 2, id: createId('doc'), name, adjustments: { ...INITIAL_ADJUSTMENTS }, masks: [], createdAt: now, updatedAt: now };
}

export function createMask(type: MaskType, name?: string): MaskDefinition {
  const geometry: MaskGeometry = type === 'brush' ? { points: [], brushSize: .08 } : type === 'radial' ? { center: { x: .5, y: .5 }, radiusX: .3, radiusY: .3 } : { start: { x: .5, y: .2 }, end: { x: .5, y: .8 } };
  return { id: createId('mask'), name: name ?? ({ brush: 'Cọ vùng chọn', radial: 'Vùng elip', linear: 'Dải chuyển sắc' }[type]), type, enabled: true, inverted: false, opacity: 1, feather: .25, geometry, adjustments: { ...INITIAL_ADJUSTMENTS } };
}
