'use client';
import { useState } from 'react';
import { validatePlan } from '@/lib/editor/dispatcher';
import { EditCommand, EditPlan } from '@/lib/editor/types';
import { listToolContracts } from '@/lib/editor/tools';

const samplePlan:EditPlan={id:'plan_demo',version:1,title:'Cân bằng ảnh tự nhiên',rationale:'Nâng vùng tối và tăng độ rực nhẹ mà không làm ảnh quá gắt.',confidence:.88,expectedImpact:['Chi tiết vùng tối rõ hơn','Màu sắc tự nhiên hơn'],commands:[
  {id:'cmd_shadow',version:1,tool:'adjust.shadows',target:{type:'document'},parameters:{value:18},origin:'ai'},
  {id:'cmd_vibrance',version:1,tool:'adjust.vibrance',target:{type:'document'},parameters:{value:12},origin:'ai'},
]};

export function DeveloperPanel({onPreview,onApply,onApplyCommand,onClose}:{onPreview:(plan:EditPlan)=>Promise<void>;onApply:(plan:EditPlan)=>Promise<void>;onApplyCommand:(command:EditCommand)=>Promise<void>;onClose:()=>void}){
  const [text,setText]=useState(JSON.stringify(samplePlan,null,2)); const [plan,setPlan]=useState<EditPlan|null>(samplePlan); const [message,setMessage]=useState('Schema hợp lệ · chưa áp dụng'); const [busy,setBusy]=useState(false); const [showContracts,setShowContracts]=useState(false);
  function parse(){ try{const value=JSON.parse(text);validatePlan(value);setPlan(value);setMessage(`Hợp lệ · ${value.commands.length} command`);return value as EditPlan;}catch(error){setPlan(null);setMessage(error instanceof Error?error.message:'JSON không hợp lệ');return null;} }
  async function action(kind:'preview'|'apply'){const value=parse();if(!value)return;setBusy(true);try{await(kind==='preview'?onPreview(value):onApply(value));setMessage(kind==='preview'?'Đang xem trước · document chưa thay đổi':'Đã áp dụng dưới dạng một transaction');}catch(error){setMessage(error instanceof Error?error.message:'Không thể thực thi');}finally{setBusy(false)}}
  return <section className="absolute inset-y-0 right-0 z-30 flex w-[430px] max-w-[90vw] flex-col border-l border-white/10 bg-[#151619]/98 shadow-2xl backdrop-blur-xl">
    <header className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div><div className="text-xs font-semibold text-[#e7ff46]">AI TOOL LAB</div><div className="mt-1 text-[10px] text-white/40">Mô phỏng phản hồi API trước khi nối model</div></div><button onClick={onClose} className="toolbar-button">×</button></header>
    <div className="flex-1 overflow-y-auto p-4"><label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-white/45">EditPlan JSON</label><textarea spellCheck={false} value={text} onChange={e=>setText(e.target.value)} className="h-[330px] w-full resize-y rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-[10px] leading-5 text-white/75 outline-none focus:border-[#e7ff46]/45"/>
      <div className={`mt-2 rounded-lg px-3 py-2 text-[10px] ${plan?'bg-emerald-400/8 text-emerald-300':'bg-red-400/8 text-red-300'}`}>{message}</div>
      {plan&&<div className="mt-4 space-y-2"><div className="flex items-center justify-between"><h3 className="text-xs font-semibold">{plan.title}</h3><span className="rounded-full bg-white/5 px-2 py-1 text-[9px] text-white/45">Tin cậy {Math.round(plan.confidence*100)}%</span></div><p className="text-[10px] leading-4 text-white/45">{plan.rationale}</p>{plan.commands.map(command=><div key={command.id} className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[.02] p-2.5"><div><div className="font-mono text-[10px] text-[#e7ff46]/80">{command.tool}</div><div className="mt-1 text-[9px] text-white/35">value: {String(command.parameters.value)}</div></div><button onClick={()=>onApplyCommand(command)} className="rounded-md border border-white/10 px-2 py-1 text-[9px] hover:border-[#e7ff46]/40">Áp dụng riêng</button></div>)}</div>}
      <button onClick={()=>setShowContracts(v=>!v)} className="mt-5 text-[10px] text-white/40 hover:text-white">{showContracts?'Ẩn':'Xem'} {listToolContracts().length} tool contracts</button>{showContracts&&<pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-black/30 p-3 text-[9px] leading-4 text-white/45">{JSON.stringify(listToolContracts(),null,2)}</pre>}
    </div>
    <footer className="grid grid-cols-3 gap-2 border-t border-white/10 p-4"><button onClick={parse} className="rounded-lg border border-white/10 py-2 text-[10px] hover:bg-white/5">Kiểm tra</button><button disabled={busy} onClick={()=>action('preview')} className="rounded-lg border border-[#e7ff46]/25 py-2 text-[10px] text-[#e7ff46] hover:bg-[#e7ff46]/5">Preview</button><button disabled={busy} onClick={()=>action('apply')} className="rounded-lg bg-[#e7ff46] py-2 text-[10px] font-bold text-black">Duyệt & áp dụng</button></footer>
  </section>;
}
