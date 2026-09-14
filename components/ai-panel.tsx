'use client';
import { useEffect, useRef, useState } from 'react';
import { EditPlan, EditorDocument } from '@/lib/editor/types';
import { AiEditingHarness } from '@/lib/ai/harness';
import { getPlanGroups, selectPlanRegions } from '@/lib/ai/region-plan';
import { runCommands } from '@/lib/editor/dispatcher';
import { CONTROL_DEFINITIONS } from '@/lib/editor/tools';
import { DEFAULT_AI_PROMPT } from '@/lib/ai/edit-policy';

export function AiPanel({image,document,onPreview,onApply,onClose,onSelectRegion}:{image:HTMLImageElement;document:EditorDocument;onPreview:(plan:EditPlan)=>Promise<EditorDocument>;onApply:(plan:EditPlan)=>Promise<void>;onClose:()=>void;onSelectRegion:(id:string|null)=>void}){
  const harness=useRef(new AiEditingHarness());
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;const runner=harness.current;return()=>{mounted.current=false;runner.cancel();}},[]);
  const [prompt,setPrompt]=useState(DEFAULT_AI_PROMPT);
  const [plan,setPlan]=useState<EditPlan|null>(null),[selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('Chỉ gửi preview thu nhỏ tới HoanXu để nhận thông số và vùng chọn. Ảnh gốc được giữ lại trên máy.');
  const [base,setBase]=useState(document);
  const stale=base!==document;
  const groups=plan?getPlanGroups(plan):[];
  async function analyze(){
    setBusy(true);setPlan(null);setSelected([]);onSelectRegion(null);setBase(document);
    try{
      const result=await harness.current.process({image,prompt,document,preview:async value=>(await runCommands(document,value.commands,'preview')).document,onProgress:p=>{if(mounted.current)setMessage(p.message);}});
      if(!mounted.current)return;
      setPlan(result.plan);setSelected([]);setMessage(getPlanGroups(result.plan).length?'Xem chỉnh tổng thể trước, sau đó chọn tinh chỉnh cục bộ nếu cần. Chưa có thay đổi nào được áp dụng.':'AI không đề xuất thay đổi. Ảnh và thông số hiện tại được giữ nguyên.');
    }catch(error){if(mounted.current)setMessage(error instanceof Error?error.message:'Không thể phân tích.');}finally{if(mounted.current)setBusy(false);}
  }
  async function action(apply:boolean){
    if(!plan||stale)return;setBusy(true);
    try{const chosen=selectPlanRegions(plan,selected);if(!chosen.commands.length)throw new Error('Hãy chọn ít nhất một nhóm chỉnh sửa có đề xuất.');onSelectRegion(null);await onPreview(chosen);if(apply){await onApply(chosen);onClose();}else setMessage('Đang xem trước các chỉnh sửa đã chọn. Giữ nút xem ảnh gốc để so sánh.');}
    catch(error){setMessage(error instanceof Error?error.message:'Không thể áp dụng.');}finally{setBusy(false);}
  }
  async function inspect(id:string){
    if(!plan||stale)return;setBusy(true);
    try{
      onSelectRegion(id==='global'?null:id);
      const commands=plan.commands.filter(c=>c.tool==='mask.createSemantic'&&String(c.parameters.id)===id);
      if(commands.length)await onPreview({...plan,commands});
      setMessage('Vùng chọn được đánh dấu trên ảnh; chưa áp dụng chỉnh màu.');
    }catch(error){setMessage(error instanceof Error?error.message:'Không thể xem vùng.');}finally{setBusy(false);}
  }
  return <section className="absolute inset-y-0 right-0 z-30 flex w-[360px] max-w-[90vw] flex-col border-l border-white/10 bg-[#151619] shadow-2xl">
    <header className="flex justify-between border-b border-white/10 p-4"><div><h2 className="text-sm text-[#e7ff46]">Trợ lý chỉnh ảnh</h2><p className="mt-1 text-xs text-white/45">Tự nhiên — ưu tiên tổng thể</p></div><button onClick={onClose} aria-label="Đóng AI">×</button></header>
    <div className="flex-1 space-y-4 overflow-auto p-4">
      <label className="block text-xs">Bạn muốn chỉnh gì?<textarea disabled={busy} value={prompt} onChange={e=>setPrompt(e.target.value)} maxLength={2000} className="mt-2 h-28 w-full rounded-lg bg-black/30 p-3 text-xs"/></label>
      <button disabled={busy||!prompt.trim()} onClick={analyze} className="w-full rounded-lg bg-[#e7ff46] p-3 text-xs text-black disabled:opacity-40">{busy?'Đang xử lý…':'Gửi preview & phân tích'}</button>
      <p role="status" className="text-xs leading-5 text-white/50">{stale?'Ảnh đã được chỉnh sửa. Hãy phân tích lại để tránh áp thông số cũ.':message}</p>
      {plan&&<><h3 className="text-sm">{plan.title}</h3><p className="text-xs leading-5 text-white/50">{plan.rationale}</p>
      {groups.some(group=>group.id!=='global')&&<p className="text-[10px] text-white/40">Vùng chọn là polygon ước lượng; hãy kiểm tra biên khi xem trước.</p>}
      {groups.map(group=><div key={group.id} className="rounded-lg border border-white/10 p-3">
        {group.id===groups.find(item=>item.id!=='global')?.id&&<h4 className="mb-3 text-xs text-white/60">Tinh chỉnh cục bộ</h4>}
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" disabled={busy||stale} checked={selected.includes(group.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,group.id]:ids.filter(id=>id!==group.id))}/>{group.name}</label>
        {group.id!=='global'&&<button disabled={busy||stale} onClick={()=>inspect(group.id)} className="mt-2 text-[10px] text-[#e7ff46]">Xem vùng trên ảnh</button>}
        {plan.commands.filter(c=>c.tool.startsWith('adjust.')&&(c.target.id||'global')===group.id).map(c=><div key={c.id} className="mt-2 flex justify-between text-[10px] text-white/50"><span>{CONTROL_DEFINITIONS[c.tool.slice(7) as keyof typeof CONTROL_DEFINITIONS]?.label}</span><span>{String(c.parameters.value)}</span></div>)}
      </div>)}
      <p className="text-[10px] text-white/40">Chọn nhóm chỉnh sửa, xem trước và so sánh ảnh gốc trước khi duyệt. Sau khi duyệt, bạn vẫn có thể tinh chỉnh bằng slider hoặc hoàn tác.</p></>}
    </div>
    <footer className="grid grid-cols-2 gap-2 border-t border-white/10 p-4"><button disabled={busy||stale||!selected.length} onClick={()=>action(false)} className="top-button disabled:opacity-30">Xem trước</button><button disabled={busy||stale||!selected.length} onClick={()=>action(true)} className="rounded-lg bg-[#e7ff46] p-2 text-xs text-black disabled:opacity-30">Duyệt chỉnh sửa</button></footer>
  </section>;
}
