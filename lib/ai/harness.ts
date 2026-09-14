import { validatePlan } from '@/lib/editor/dispatcher';
import { EditPlan, EditorDocument } from '@/lib/editor/types';

export type ImageAnalysis={width:number;height:number;aspectRatio:number;meanLuminance:number;shadowRatio:number;highlightRatio:number;meanRgb:{r:number;g:number;b:number}};
export type HarnessResult={plan:EditPlan;analysis:ImageAnalysis;preview:EditorDocument};
export type HarnessProgress={stage:'preparing'|'analyzing'|'validating'|'previewing'|'ready';message:string};

function prepareImage(image:HTMLImageElement){const max=1280,scale=Math.min(1,max/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('Không thể chuẩn bị ảnh cho AI.');context.drawImage(image,0,0,canvas.width,canvas.height);return{canvas,image:canvas.toDataURL('image/jpeg',.82)};}

function analyzePixels(canvas:HTMLCanvasElement):ImageAnalysis{const sampleWidth=Math.min(256,canvas.width),sampleHeight=Math.max(1,Math.round(canvas.height*sampleWidth/canvas.width)),sample=document.createElement('canvas');sample.width=sampleWidth;sample.height=sampleHeight;const ctx=sample.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('Không thể phân tích ảnh.');ctx.drawImage(canvas,0,0,sampleWidth,sampleHeight);const pixels=ctx.getImageData(0,0,sampleWidth,sampleHeight).data;let r=0,g=0,b=0,luminance=0,shadows=0,highlights=0,count=0;for(let index=0;index<pixels.length;index+=4){const red=pixels[index]/255,green=pixels[index+1]/255,blue=pixels[index+2]/255,light=.2126*red+.7152*green+.0722*blue;r+=red;g+=green;b+=blue;luminance+=light;if(light<.08)shadows++;if(light>.92)highlights++;count++;}return{width:canvas.width,height:canvas.height,aspectRatio:canvas.width/canvas.height,meanLuminance:luminance/count,shadowRatio:shadows/count,highlightRatio:highlights/count,meanRgb:{r:r/count,g:g/count,b:b/count}};}

export class AiEditingHarness{
  private controller:AbortController|null=null;
  cancel(){this.controller?.abort();this.controller=null;}
  async process({image,prompt,document,preview,onProgress}:{image:HTMLImageElement;prompt:string;document:EditorDocument;preview:(plan:EditPlan)=>Promise<EditorDocument>;onProgress?:(progress:HarnessProgress)=>void}):Promise<HarnessResult>{
    this.cancel();this.controller=new AbortController();const signal=this.controller.signal;
    onProgress?.({stage:'preparing',message:'Đang tạo preview và đo ánh sáng…'});const prepared=prepareImage(image),analysis=analyzePixels(prepared.canvas);
    onProgress?.({stage:'analyzing',message:'AI đang quan sát ảnh và lập kế hoạch…'});
    const response=await fetch('/api/ai/edit',{method:'POST',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({prompt,image:prepared.image,analysis,document:{name:document.name,adjustments:document.adjustments,masks:document.masks.map(mask=>({id:mask.id,name:mask.name,type:mask.type}))}})});
    const data=await response.json() as {plan?:EditPlan;error?:string};if(!response.ok||!data.plan)throw new Error(data.error||'AI không trả về kế hoạch.');
    signal.throwIfAborted();
    onProgress?.({stage:'validating',message:'Đang kiểm tra giới hạn và tham chiếu vùng…'});validatePlan(data.plan);
    onProgress?.({stage:'previewing',message:'Đang chạy thử kế hoạch bằng editor engine…'});const previewDocument=await preview(data.plan);
    signal.throwIfAborted();
    onProgress?.({stage:'ready',message:`Đã tạo ${data.plan.commands.length} lệnh hợp lệ · chưa áp dụng.`});this.controller=null;
    return{plan:data.plan,analysis,preview:previewDocument};
  }
}
