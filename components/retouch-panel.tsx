'use client';
import { useState } from 'react';
import { EditCommand, MaskDefinition, createId } from '@/lib/editor/types';

export function RetouchPanel({mask,onPreview,onApply,onCancel}:{mask:MaskDefinition;onPreview:(commands:EditCommand[])=>Promise<void>;onApply:(commands:EditCommand[])=>Promise<void>;onCancel:()=>void}){
  const [x,setX]=useState(.15),[y,setY]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  async function run(apply:boolean){setBusy(true);try{const commands:EditCommand[]=[{id:createId('clone'),version:1,tool:'retouch.clone',target:{type:'mask',id:mask.id},parameters:{x,y},origin:'user'}];await(apply?onApply(commands):onPreview(commands));setMessage(apply?'Đã áp dụng; dùng Undo để phục hồi.':'Đang xem nền thay thế trong vùng chọn.');}catch(error){setMessage(error instanceof Error?error.message:'Không thể xử lý.');}finally{setBusy(false);}}
  return <div className="mt-4 space-y-3 rounded-lg border border-white/10 p-3 text-[10px]">
    <h3 className="text-[#e7ff46]">Xóa người / clone nền</h3>
    <p className="leading-4 text-white/45">Khoanh kín người bằng cọ hoặc vùng AI. Dịch nguồn sang vùng nền sạch bên cạnh; xem trước rồi duyệt. Nền phức tạp có thể lộ vết ghép.</p>
    <label className="block">Nguồn ngang: {Math.round(x*100)}%<input className="mt-2 w-full" type="range" min={-.9} max={.9} step={.005} value={x} onChange={e=>setX(Number(e.target.value))}/></label>
    <label className="block">Nguồn dọc: {Math.round(y*100)}%<input className="mt-2 w-full" type="range" min={-.9} max={.9} step={.005} value={y} onChange={e=>setY(Number(e.target.value))}/></label>
    <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={()=>run(false)} className="top-button">Xem trước</button><button disabled={busy} onClick={()=>run(true)} className="top-button">Duyệt</button><button onClick={onCancel}>Hủy preview</button></div><p role="status">{message}</p>
  </div>;
}
