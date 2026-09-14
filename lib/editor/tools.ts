import { ADJUSTMENT_KEYS, AdjustmentKey, EditCommand, EditorDocument, MaskDefinition, MaskType, ToolDefinition, ToolResult, createMask } from './types';

export const CONTROL_DEFINITIONS: Record<AdjustmentKey, { label: string; min: number; max: number; step: number; unit: string; description: string }> = {
  blur: { label: 'Làm mờ', min: 0, max: 100, step: 1, unit: '%', description: 'Làm mờ quang học mô phỏng; 100 tương ứng bán kính 2% cạnh ngắn. Nền dùng nhẹ 5–25, da mặc định 0.' },
  fade: { label: 'Màu matte', min: 0, max: 100, step: 1, unit: '%', description: 'Nâng điểm đen và nén tương phản nhẹ để tạo màu matte. Mặc định 0; dùng tự nhiên 5–15.' },
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
  if (command.target.type !== 'document' && command.target.type !== 'mask') throw new Error('Công cụ này chỉ hỗ trợ document hoặc mask.');
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
    if (command.target.type === 'mask') {
      const index = document.masks.findIndex((mask) => mask.id === command.target.id);
      if (index < 0) throw new Error(`Không tìm thấy mask “${command.target.id}”.`);
      const masks = document.masks.map((mask, maskIndex) => maskIndex === index ? { ...mask, adjustments: { ...mask.adjustments, [key]: value } } : mask);
      return { document: { ...document, masks, updatedAt: new Date().toISOString() }, description: `${definition.label} trên ${document.masks[index].name}: ${value > 0 ? '+' : ''}${value}` };
    }
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

const maskCreate: ToolDefinition = {
  name: 'mask.create', description: 'Tạo vùng chọn không phá hủy với tọa độ chuẩn hóa.',
  inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'ID ổn định do AI hoặc UI cấp' }, type: { type: 'string', description: 'brush, radial, linear hoặc semantic' }, name: { type: 'string', description: 'Tên vùng chọn' }, inverted: { type: 'boolean', description: 'Đảo polygon để chọn nền bên ngoài chủ thể' }, geometry: { type: 'object', description: 'Hình học chuẩn hóa 0–1' }, feather: { type: 'number', minimum: 0, maximum: 1 } }, required: ['type'], additionalProperties: false },
  preview: applyCreateMask, execute: applyCreateMask, describe: (command) => `Tạo mask ${command.parameters.type}`,
};
async function applyCreateMask(document: EditorDocument, command: EditCommand): Promise<ToolResult> {
  if (command.target.type !== 'document') throw new Error('mask.create phải nhắm vào document.');
  const type = command.parameters.type;
  if (!['brush', 'radial', 'linear', 'semantic'].includes(String(type))) throw new Error('Mask type không hợp lệ.');
  const mask = createMask(type as MaskType, typeof command.parameters.name === 'string' ? command.parameters.name : undefined);
  if (typeof command.parameters.id === 'string') mask.id = command.parameters.id;
  if(document.masks.some(item=>item.id===mask.id))throw new Error('ID vùng chọn đã tồn tại.');
  if (command.parameters.geometry && typeof command.parameters.geometry === 'object' && !Array.isArray(command.parameters.geometry)) mask.geometry = command.parameters.geometry;
  if (typeof command.parameters.feather === 'number') mask.feather = Math.max(0, Math.min(1, command.parameters.feather));
  if (typeof command.parameters.inverted === 'boolean') mask.inverted = command.parameters.inverted;
  if(mask.type==='semantic'&&(!Array.isArray(mask.geometry.polygon)||mask.geometry.polygon.length<3||mask.geometry.polygon.length>40||!mask.geometry.polygon.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1)))throw new Error('Polygon vùng chọn không hợp lệ.');
  return { document: { ...document, masks: [...document.masks, mask], updatedAt: new Date().toISOString() }, description: `Tạo ${mask.name}` };
}

const maskUpdate: ToolDefinition = {
  name: 'mask.update', description: 'Cập nhật hình học, feather, opacity hoặc trạng thái mask.',
  inputSchema: { type: 'object', properties: { name: { type: 'string' }, enabled: { type: 'boolean' }, inverted: { type: 'boolean' }, opacity: { type: 'number', minimum: 0, maximum: 1 }, feather: { type: 'number', minimum: 0, maximum: 1 }, geometry: { type: 'object', description: 'Hình học mask với tọa độ chuẩn hóa 0–1' } }, required: [], additionalProperties: false },
  preview: applyUpdateMask, execute: applyUpdateMask, describe: () => 'Cập nhật vùng chọn',
};
async function applyUpdateMask(document: EditorDocument, command: EditCommand): Promise<ToolResult> {
  if (command.target.type !== 'mask' || !command.target.id) throw new Error('mask.update cần target mask hợp lệ.');
  const index = document.masks.findIndex((mask) => mask.id === command.target.id); if (index < 0) throw new Error(`Không tìm thấy mask “${command.target.id}”.`);
  const current=document.masks[index]; const allowed=['name','enabled','inverted','opacity','feather','geometry']; const unknown=Object.keys(command.parameters).filter(key=>!allowed.includes(key)); if(unknown.length)throw new Error(`Tham số mask không hỗ trợ: ${unknown.join(', ')}`);
  const next={...current,...command.parameters} as MaskDefinition;
  if(next.opacity<0||next.opacity>1||next.feather<0||next.feather>1)throw new Error('Opacity và feather phải nằm trong 0–1.');
  const masks=document.masks.map((mask,i)=>i===index?next:mask); return {document:{...document,masks,updatedAt:new Date().toISOString()},description:`Cập nhật ${next.name}`};
}

const maskDelete: ToolDefinition = {
  name:'mask.delete',description:'Xóa một vùng chọn và các điều chỉnh liên quan.',inputSchema:{type:'object',properties:{},required:[],additionalProperties:false},
  preview:applyDeleteMask,execute:applyDeleteMask,describe:()=> 'Xóa vùng chọn',
};
async function applyDeleteMask(document:EditorDocument,command:EditCommand):Promise<ToolResult>{if(command.target.type!=='mask'||!command.target.id)throw new Error('mask.delete cần target mask.');if(!document.masks.some(mask=>mask.id===command.target.id))throw new Error(`Không tìm thấy mask “${command.target.id}”.`);return{document:{...document,masks:document.masks.filter(mask=>mask.id!==command.target.id),updatedAt:new Date().toISOString()},description:'Đã xóa vùng chọn'};}

TOOL_REGISTRY.set(maskCreate.name,maskCreate); TOOL_REGISTRY.set(maskUpdate.name,maskUpdate); TOOL_REGISTRY.set(maskDelete.name,maskDelete);

TOOL_REGISTRY.set('mask.createSemantic',{...maskCreate,name:'mask.createSemantic',description:'Tạo vùng chọn semantic do AI nhận diện bằng polygon chuẩn hóa.'});

export function listToolContracts() {
  return [...TOOL_REGISTRY.values()].map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
}
