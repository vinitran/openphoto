import { ADJUSTMENT_KEYS, EditCommand, EditPlan, JsonValue, createId } from '../editor/types';
import { CONTROL_DEFINITIONS } from '../editor/tools';

export const MAX_AI_REGIONS = 3;

export const responseSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    title: { type: 'string' }, rationale: { type: 'string' }, confidence: { type: 'number', minimum: 0, maximum: 1 },
    expectedImpact: { type: 'array', items: { type: 'string' } },
    regions: { type: 'array', maxItems: MAX_AI_REGIONS, items: { type: 'object', additionalProperties: false, properties: {
      id: { type: 'string' }, name: { type: 'string' }, semanticLabel: { type: 'string' }, inverted: { type: 'boolean' }, feather: { type: 'number', minimum: 0, maximum: 1 },
      polygon: { type: 'array', minItems: 3, maxItems: 40, items: { type: 'object', additionalProperties: false, properties: { x: { type: 'number', minimum: 0, maximum: 1 }, y: { type: 'number', minimum: 0, maximum: 1 } }, required: ['x', 'y'] } },
    }, required: ['id', 'name', 'semanticLabel', 'inverted', 'feather', 'polygon'] } },
    adjustments: { type: 'array', maxItems: 100, items: { type: 'object', additionalProperties: false, properties: {
      tool: { type: 'string', enum: ADJUSTMENT_KEYS.map(key => `adjust.${key}`) }, targetId: { type: ['string', 'null'] }, value: { type: 'number' },
    }, required: ['tool', 'targetId', 'value'] } },
  }, required: ['title', 'rationale', 'confidence', 'expectedImpact', 'regions', 'adjustments'],
};

export type AiResult = { title:string;rationale:string;confidence:number;expectedImpact:string[];regions:Array<{id:string;name:string;semanticLabel:string;inverted:boolean;feather:number;polygon:Array<{x:number;y:number}>}>;adjustments:Array<{tool:string;targetId:string|null;value:number}> };

export function toPlan(value: unknown): EditPlan {
  const result = value as AiResult;
  if (Array.isArray(result?.regions) && result.regions.length > MAX_AI_REGIONS) throw new Error('AI chỉ được đề xuất tối đa 3 vùng. Hãy phân tích lại theo hướng tổng thể.');
  if(!result || typeof result.title!=='string' || typeof result.rationale!=='string' || !Number.isFinite(result.confidence) || result.confidence<0 || result.confidence>1 || !Array.isArray(result.expectedImpact) || !result.expectedImpact.every(x=>typeof x==='string') || !Array.isArray(result.regions) || result.regions.length>MAX_AI_REGIONS || !Array.isArray(result.adjustments) || result.adjustments.length>100) throw new Error('Kế hoạch AI không hợp lệ.');
  const ids=new Map<string,string>();
  for(const region of result.regions){
    if(!region || typeof region.id!=='string' || !region.id || ids.has(region.id) || typeof region.name!=='string' || typeof region.semanticLabel!=='string' || typeof region.inverted!=='boolean' || !Number.isFinite(region.feather) || region.feather<0 || region.feather>1 || !Array.isArray(region.polygon) || region.polygon.length<3 || region.polygon.length>40 || !region.polygon.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1)) throw new Error('Vùng AI không hợp lệ.');
    ids.set(region.id,createId('region'));
  }
  const regionIds = new Set(result.regions.map(region => region.id));
  const maskCommands: EditCommand[] = result.regions.map(region => ({
    id:createId('cmd'),version:1,tool:'mask.createSemantic',target:{type:'document'},origin:'ai',
    parameters:{id:ids.get(region.id)!,name:region.name,type:'semantic',inverted:region.inverted,feather:region.feather,geometry:{polygon:region.polygon,semanticLabel:region.semanticLabel} as JsonValue},
  }));
  const adjustmentCommands: EditCommand[] = result.adjustments.map(item => {
    if(!item || typeof item.tool!=='string' || !item.tool.startsWith('adjust.') || !Number.isFinite(item.value) || (item.targetId!==null&&typeof item.targetId!=='string'))throw new Error('Thông số AI không hợp lệ.');
    const key=item.tool.replace('adjust.','') as keyof typeof CONTROL_DEFINITIONS,definition=CONTROL_DEFINITIONS[key];
    if(!ADJUSTMENT_KEYS.some(key => item.tool === `adjust.${key}`) || !definition)throw new Error(`AI trả về tool không hợp lệ: ${item.tool}`);
    if(item.targetId!==null&&!regionIds.has(item.targetId))throw new Error(`AI tham chiếu vùng không tồn tại: ${item.targetId}`);
    if(item.value<definition.min||item.value>definition.max)throw new Error('AI trả thông số vượt giới hạn công cụ.');
    const value=item.value;
    return{id:createId('cmd'),version:1,tool:item.tool,target:item.targetId?{type:'mask',id:ids.get(item.targetId)!}:{type:'document'},parameters:{value},origin:'ai'};
  });
  return{id:createId('plan'),version:1,title:result.title,rationale:result.rationale,confidence:result.confidence,expectedImpact:result.expectedImpact,commands:[...maskCommands,...adjustmentCommands]};
}
