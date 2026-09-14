import { NextRequest, NextResponse } from 'next/server';
import { ADJUSTMENT_KEYS, EditCommand, EditPlan, JsonValue, createId } from '@/lib/editor/types';
import { CONTROL_DEFINITIONS } from '@/lib/editor/tools';

export const runtime = 'nodejs';

const responseSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    title: { type: 'string' }, rationale: { type: 'string' }, confidence: { type: 'number', minimum: 0, maximum: 1 },
    expectedImpact: { type: 'array', items: { type: 'string' } },
    regions: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      id: { type: 'string' }, name: { type: 'string' }, semanticLabel: { type: 'string' }, feather: { type: 'number', minimum: 0, maximum: 1 },
      polygon: { type: 'array', minItems: 3, maxItems: 40, items: { type: 'object', additionalProperties: false, properties: { x: { type: 'number', minimum: 0, maximum: 1 }, y: { type: 'number', minimum: 0, maximum: 1 } }, required: ['x', 'y'] } },
    }, required: ['id', 'name', 'semanticLabel', 'feather', 'polygon'] } },
    adjustments: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      tool: { type: 'string', enum: ADJUSTMENT_KEYS.map(key => `adjust.${key}`) }, targetId: { type: ['string', 'null'] }, value: { type: 'number' },
    }, required: ['tool', 'targetId', 'value'] } },
  }, required: ['title', 'rationale', 'confidence', 'expectedImpact', 'regions', 'adjustments'],
};

type AiResult = { title:string;rationale:string;confidence:number;expectedImpact:string[];regions:Array<{id:string;name:string;semanticLabel:string;feather:number;polygon:Array<{x:number;y:number}>}>;adjustments:Array<{tool:string;targetId:string|null;value:number}> };

function toPlan(result: AiResult): EditPlan {
  if(!result || typeof result.title!=='string' || typeof result.rationale!=='string' || !Number.isFinite(result.confidence) || result.confidence<0 || result.confidence>1 || !Array.isArray(result.expectedImpact) || !result.expectedImpact.every(x=>typeof x==='string') || !Array.isArray(result.regions) || result.regions.length>12 || !Array.isArray(result.adjustments) || result.adjustments.length>100) throw new Error('Kế hoạch AI không hợp lệ.');
  const ids=new Map<string,string>();
  for(const region of result.regions){
    if(!region || typeof region.id!=='string' || !region.id || ids.has(region.id) || typeof region.name!=='string' || typeof region.semanticLabel!=='string' || !Number.isFinite(region.feather) || region.feather<0 || region.feather>1 || !Array.isArray(region.polygon) || region.polygon.length<3 || region.polygon.length>40 || !region.polygon.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1)) throw new Error('Vùng AI không hợp lệ.');
    ids.set(region.id,createId('region'));
  }
  const regionIds = new Set(result.regions.map(region => region.id));
  const maskCommands: EditCommand[] = result.regions.map(region => ({
    id:createId('cmd'),version:1,tool:'mask.createSemantic',target:{type:'document'},origin:'ai',
    parameters:{id:ids.get(region.id)!,name:region.name,type:'semantic',feather:region.feather,geometry:{polygon:region.polygon,semanticLabel:region.semanticLabel} as JsonValue},
  }));
  const adjustmentCommands: EditCommand[] = result.adjustments.map(item => {
    if(!item || typeof item.tool!=='string' || !item.tool.startsWith('adjust.') || !Number.isFinite(item.value) || (item.targetId!==null&&typeof item.targetId!=='string'))throw new Error('Thông số AI không hợp lệ.');
    const key=item.tool.replace('adjust.','') as keyof typeof CONTROL_DEFINITIONS,definition=CONTROL_DEFINITIONS[key];
    if(!definition)throw new Error(`AI trả về tool không hợp lệ: ${item.tool}`);
    if(item.targetId&&!regionIds.has(item.targetId))throw new Error(`AI tham chiếu vùng không tồn tại: ${item.targetId}`);
    if(item.value<definition.min||item.value>definition.max)throw new Error('AI trả thông số vượt giới hạn công cụ.');
    const value=item.value;
    return{id:createId('cmd'),version:1,tool:item.tool,target:item.targetId?{type:'mask',id:ids.get(item.targetId)!}:{type:'document'},parameters:{value},origin:'ai'};
  });
  return{id:createId('plan'),version:1,title:result.title,rationale:result.rationale,confidence:result.confidence,expectedImpact:result.expectedImpact,commands:[...maskCommands,...adjustmentCommands]};
}

export async function POST(request: NextRequest) {
  try {
    const apiKey=process.env.OPENAI_API_KEY;
    if(!apiKey)return NextResponse.json({error:'Chưa cấu hình OPENAI_API_KEY trong .env.local.'},{status:503});
    const body=await request.json() as {prompt?:unknown;image?:unknown;analysis?:unknown;document?:unknown};
    if(typeof body.prompt!=='string'||!body.prompt.trim()||body.prompt.length>2000)return NextResponse.json({error:'Yêu cầu phải dài từ 1–2000 ký tự.'},{status:400});
    if(typeof body.image!=='string'||!body.image.startsWith('data:image/')||body.image.length>8_000_000)return NextResponse.json({error:'Preview ảnh không hợp lệ hoặc quá lớn.'},{status:400});
    const toolSummary=ADJUSTMENT_KEYS.map(key=>`${key}: ${CONTROL_DEFINITIONS[key].min}..${CONTROL_DEFINITIONS[key].max} (${CONTROL_DEFINITIONS[key].description})`).join('\n');
    const baseUrl=(process.env.OPENAI_BASE_URL||'https://ai.hoanxu.com/v1').replace(/\/$/,'');
    const response=await fetch(`${baseUrl}/responses`,{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(45_000),body:JSON.stringify({
      model:process.env.OPENAI_MODEL||'cx/gpt-5.6-sol',store:false,
      instructions:`Bạn là chuyên gia chỉnh màu ảnh cho OpenPhoto. Phân tích ảnh và tạo kế hoạch tinh tế, tự nhiên. Chỉ tạo region khi một vùng thật sự cần chỉnh khác toàn ảnh. Polygon dùng tọa độ chuẩn hóa 0–1, bám sát đối tượng nhưng tối đa 40 điểm. targetId null nghĩa là toàn ảnh; nếu có phải trùng id region. Không chỉnh quá tay. Công cụ:\n${toolSummary}`,
      input:[{role:'user',content:[{type:'input_text',text:`Yêu cầu: ${body.prompt}\nPhân tích pixel cục bộ: ${JSON.stringify(body.analysis)}\nTrạng thái chỉnh sửa hiện tại: ${JSON.stringify(body.document)}`},{type:'input_image',image_url:body.image,detail:'high'}]}],
      text:{format:{type:'json_schema',name:'openphoto_edit_plan',strict:true,schema:responseSchema}},
    })});
    const data=await response.json() as {error?:{message?:string};output?:Array<{content?:Array<{type?:string;text?:string}>}>};
    if(!response.ok)throw new Error(data.error?.message||'Dịch vụ AI từ chối yêu cầu.');
    const text=data.output?.flatMap(item=>item.content||[]).find(item=>item.type==='output_text')?.text;
    if(!text)throw new Error('AI không trả về kế hoạch chỉnh sửa.');
    return NextResponse.json({plan:toPlan(JSON.parse(text) as AiResult)});
  } catch(error) {
    const message=error instanceof Error?(error.name==='TimeoutError'?'AI phản hồi quá lâu. Hãy thử lại.':error.message):'Không thể phân tích ảnh.';
    return NextResponse.json({error:message},{status:500});
  }
}
