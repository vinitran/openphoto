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
      id: { type: 'string' }, name: { type: 'string' }, semanticLabel: { type: 'string' }, inverted: { type: 'boolean' }, feather: { type: 'number', minimum: 0, maximum: 1 },
      polygon: { type: 'array', minItems: 3, maxItems: 40, items: { type: 'object', additionalProperties: false, properties: { x: { type: 'number', minimum: 0, maximum: 1 }, y: { type: 'number', minimum: 0, maximum: 1 } }, required: ['x', 'y'] } },
    }, required: ['id', 'name', 'semanticLabel', 'inverted', 'feather', 'polygon'] } },
    adjustments: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      tool: { type: 'string', enum: ADJUSTMENT_KEYS.map(key => `adjust.${key}`) }, targetId: { type: ['string', 'null'] }, value: { type: 'number' },
    }, required: ['tool', 'targetId', 'value'] } },
  }, required: ['title', 'rationale', 'confidence', 'expectedImpact', 'regions', 'adjustments'],
};

type AiResult = { title:string;rationale:string;confidence:number;expectedImpact:string[];regions:Array<{id:string;name:string;semanticLabel:string;inverted:boolean;feather:number;polygon:Array<{x:number;y:number}>}>;adjustments:Array<{tool:string;targetId:string|null;value:number}> };

function toPlan(result: AiResult): EditPlan {
  if(!result || typeof result.title!=='string' || typeof result.rationale!=='string' || !Number.isFinite(result.confidence) || result.confidence<0 || result.confidence>1 || !Array.isArray(result.expectedImpact) || !result.expectedImpact.every(x=>typeof x==='string') || !Array.isArray(result.regions) || result.regions.length>12 || !Array.isArray(result.adjustments) || result.adjustments.length>100) throw new Error('Kế hoạch AI không hợp lệ.');
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
      instructions:`Bạn là chuyên gia chỉnh màu tự nhiên cho OpenPhoto. Chỉ trả thông số ánh sáng, màu sắc, hiệu ứng và vùng chọn; không xóa, clone, di chuyển, tái tạo đối tượng hoặc thay đổi bố cục.
Phân biệt các vùng THỰC SỰ nhìn thấy: chủ thể, da mặt/da tay, tóc, quần áo, bầu trời, cây cối, mặt đất, hậu cảnh. Đặt tên tiếng Việt cụ thể theo vị trí để người dùng chọn đúng. Không bịa vùng không có trong ảnh. Tối đa 12 vùng và 100 lệnh.
Polygon tọa độ 0–1, 3–40 điểm bám sát biên, không cắt qua chủ thể. Với nền bao quanh chủ thể, khoanh chủ thể rồi inverted=true để chọn phần ngoài; bình thường inverted=false. Tránh chồng nhiều vùng có cùng chỉnh sửa; đừng dùng hình chữ nhật thô cho da hoặc đối tượng có biên phức tạp. Nếu không xác định chắc, nêu hạn chế trong rationale và chỉ đề xuất toàn ảnh.
Mỗi vùng có thông số riêng, giữ màu da và kết cấu tự nhiên; tăng sáng nhẹ cho chủ thể tối, bảo vệ vùng sáng bầu trời, hạn chế bão hòa quá mức. Không tự làm mờ da/mắt/tóc. blur chỉ dùng nền khi phù hợp hoặc người dùng yêu cầu, mức 5–25; fade 5–15 khi muốn màu matte; mặc định cả hai 0.
Feather là độ mềm BIÊN vùng chọn, không phải độ mờ hình ảnh. Với biên chủ thể dùng feather nhỏ 0.01–0.05 để hạn chế halo; vùng ánh sáng lớn có thể mềm hơn. blur là làm mờ NỘI DUNG vùng.
targetId null là toàn ảnh; còn lại phải trùng id region. Giá trị adjust là giá trị tuyệt đối cho bộ điều khiển, các điều chỉnh vùng được cộng với toàn ảnh. Dùng vùng tách biệt; giải thích lý do từng vùng trong rationale. Ảnh gửi là ảnh gốc thu nhỏ; xem trạng thái hiện tại trước khi đề xuất thay đổi. Công cụ:\n${toolSummary}`,
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
