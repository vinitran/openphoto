import { NextRequest, NextResponse } from 'next/server';
import { responseSchema, toPlan } from '@/lib/ai/edit-response';
import { buildEditingInstructions } from '@/lib/ai/edit-policy';

export const runtime = 'nodejs';
// Leave headroom for validation/encoding beyond the upstream request deadline.
export const maxDuration = 240;

export async function POST(request: NextRequest) {
  try {
    const apiKey=process.env.OPENAI_API_KEY;
    if(!apiKey)return NextResponse.json({error:'Chưa cấu hình OPENAI_API_KEY trong .env.local.'},{status:503});
    const body=await request.json() as {prompt?:unknown;image?:unknown;analysis?:unknown;document?:unknown};
    if(typeof body.prompt!=='string'||!body.prompt.trim()||body.prompt.length>2000)return NextResponse.json({error:'Yêu cầu phải dài từ 1–2000 ký tự.'},{status:400});
    if(typeof body.image!=='string'||!body.image.startsWith('data:image/')||body.image.length>8_000_000)return NextResponse.json({error:'Preview ảnh không hợp lệ hoặc quá lớn.'},{status:400});
    const baseUrl=(process.env.OPENAI_BASE_URL||'https://ai.hoanxu.com/v1').replace(/\/$/,'');
    const response=await fetch(`${baseUrl}/responses`,{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},signal:AbortSignal.any([request.signal,AbortSignal.timeout(180_000)]),body:JSON.stringify({
      model:process.env.OPENAI_MODEL||'cx/gpt-5.6-sol',store:false,
      instructions:buildEditingInstructions(),
      input:[{role:'user',content:[{type:'input_text',text:`Yêu cầu: ${body.prompt}\nPhân tích pixel cục bộ: ${JSON.stringify(body.analysis)}\nTrạng thái chỉnh sửa hiện tại: ${JSON.stringify(body.document)}`},{type:'input_image',image_url:body.image,detail:'high'}]}],
      text:{format:{type:'json_schema',name:'openphoto_edit_plan',strict:true,schema:responseSchema}},
    })});
    if(!response.ok){
      const timeout=response.status===504||response.status===408;
      return NextResponse.json({error:timeout?'Gateway AI hết thời gian chờ. Hãy thử lại sau.':`Gateway AI trả lỗi HTTP ${response.status}. Hãy thử lại sau.`,code:timeout?'GATEWAY_TIMEOUT':'GATEWAY_ERROR'},{status:timeout?504:502});
    }
    const data=await response.json() as {status?:string;error?:{message?:string};output?:Array<{content?:Array<{type?:string;text?:string}>}>};
    if(data.status==='incomplete'||data.status==='failed')return NextResponse.json({error:'AI chưa hoàn thành kế hoạch. Hãy thử lại với yêu cầu ít vùng hơn.',code:'INCOMPLETE_PLAN'},{status:502});
    const text=data.output?.flatMap(item=>item.content||[]).find(item=>item.type==='output_text')?.text;
    if(!text)throw new Error('AI không trả về kế hoạch chỉnh sửa.');
    return NextResponse.json({plan:toPlan(JSON.parse(text))});
  } catch(error) {
    if(request.signal.aborted)return NextResponse.json({error:'Đã hủy phân tích.',code:'CANCELLED'},{status:499});
    if(error instanceof Error&&error.name==='TimeoutError')return NextResponse.json({error:'AI chưa hoàn thành sau 180 giây. Gateway có thể đang bận; hãy thử lại hoặc yêu cầu ít vùng hơn.',code:'AI_TIMEOUT'},{status:504});
    const message=error instanceof Error?error.message:'Không thể phân tích ảnh.';
    return NextResponse.json({error:message},{status:500});
  }
}
