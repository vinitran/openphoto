export const ADJUSTMENT_KEYS = [
  'exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks',
  'temperature', 'tint', 'vibrance', 'saturation', 'clarity', 'vignette',
] as const;

export type AdjustmentKey = (typeof ADJUSTMENT_KEYS)[number];
export type Adjustments = Record<AdjustmentKey, number>;
export type CommandOrigin = 'user' | 'preset' | 'ai';

export type EditCommand = {
  id: string;
  version: 1;
  tool: string;
  target: { type: 'document' | 'layer' | 'mask'; id?: string };
  parameters: Record<string, number | string | boolean>;
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
  properties: Record<string, { type: 'number' | 'string' | 'boolean'; minimum?: number; maximum?: number; default?: number | string | boolean; description?: string }>;
  required: string[];
  additionalProperties: false;
};

export type EditorDocument = {
  schemaVersion: 1;
  id: string;
  name: string;
  adjustments: Adjustments;
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
  schemaVersion: 1;
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
  return { schemaVersion: 1, id: createId('doc'), name, adjustments: { ...INITIAL_ADJUSTMENTS }, createdAt: now, updatedAt: now };
}
