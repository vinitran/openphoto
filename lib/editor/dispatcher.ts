import { EditCommand, EditorDocument, EditPlan, ToolResult, Transaction, createId } from './types';
import { TOOL_REGISTRY } from './tools';

export async function runCommand(document: EditorDocument, command: EditCommand, mode: 'preview' | 'execute' = 'execute'): Promise<ToolResult> {
  const tool = TOOL_REGISTRY.get(command.tool);
  if (!tool) throw new Error(`Công cụ “${command.tool}” chưa được đăng ký.`);
  return tool[mode](document, command);
}

export async function runCommands(document: EditorDocument, commands: EditCommand[], mode: 'preview' | 'execute' = 'execute') {
  if (!commands.length) throw new Error('Kế hoạch không có command.');
  let next = document;
  const descriptions: string[] = [];
  for (const command of commands) {
    const result = await runCommand(next, command, mode);
    next = result.document;
    descriptions.push(result.description);
  }
  return { document: next, descriptions };
}

export function validatePlan(value: unknown): asserts value is EditPlan {
  if (!value || typeof value !== 'object') throw new Error('Kế hoạch phải là một object JSON.');
  const plan = value as Partial<EditPlan>;
  if (plan.version !== 1 || typeof plan.id !== 'string' || typeof plan.title !== 'string') throw new Error('Thiếu id, title hoặc version=1.');
  if (typeof plan.rationale !== 'string' || typeof plan.confidence !== 'number' || plan.confidence < 0 || plan.confidence > 1) throw new Error('Rationale hoặc confidence không hợp lệ.');
  if (!Array.isArray(plan.expectedImpact) || !plan.expectedImpact.every((item) => typeof item === 'string')) throw new Error('expectedImpact phải là danh sách chuỗi.');
  if (!Array.isArray(plan.commands)) throw new Error('commands phải là một danh sách.');
  for (const command of plan.commands) {
    if (!command || command.version !== 1 || typeof command.id !== 'string' || typeof command.tool !== 'string') throw new Error('Command thiếu id, tool hoặc version=1.');
    const validTarget=command.target?.type==='document'||(command.target?.type==='mask'&&typeof command.target.id==='string');
    if (!['user', 'preset', 'ai'].includes(command.origin) || !validTarget || !command.parameters || typeof command.parameters !== 'object') throw new Error(`Command ${command.id || ''} có origin, target hoặc parameters không hợp lệ.`);
  }
}

export async function createTransaction(before: EditorDocument, commands: EditCommand[], label: string): Promise<Transaction> {
  const { document: after } = await runCommands(before, commands, 'execute');
  return { id: createId('tx'), label, origin: commands[0]?.origin ?? 'user', commands, before, after, createdAt: new Date().toISOString() };
}
