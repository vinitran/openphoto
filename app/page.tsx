'use client';

import { ChangeEvent, DragEvent, useCallback, useEffect, useRef, useState } from 'react';

type Adjustments = { exposure: number; contrast: number; highlights: number; shadows: number; whites: number; blacks: number; temperature: number; tint: number; vibrance: number; saturation: number; clarity: number; vignette: number };
const initialAdjustments: Adjustments = { exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, temperature: 0, tint: 0, vibrance: 0, saturation: 0, clarity: 0, vignette: 0 };
const controls: { key: keyof Adjustments; label: string; min: number; max: number; step?: number }[] = [
  { key: 'exposure', label: 'Phơi sáng', min: -2, max: 2, step: 0.05 }, { key: 'contrast', label: 'Tương phản', min: -100, max: 100 },
  { key: 'highlights', label: 'Vùng sáng', min: -100, max: 100 }, { key: 'shadows', label: 'Vùng tối', min: -100, max: 100 },
  { key: 'whites', label: 'Điểm trắng', min: -100, max: 100 }, { key: 'blacks', label: 'Điểm đen', min: -100, max: 100 },
  { key: 'temperature', label: 'Nhiệt độ', min: -100, max: 100 }, { key: 'tint', label: 'Sắc độ', min: -100, max: 100 },
  { key: 'vibrance', label: 'Độ rực', min: -100, max: 100 }, { key: 'saturation', label: 'Bão hòa', min: -100, max: 100 },
  { key: 'clarity', label: 'Độ rõ', min: -100, max: 100 }, { key: 'vignette', label: 'Tối góc', min: -100, max: 100 },
];
const presets = [
  { name: 'Tự nhiên', values: { contrast: 8, vibrance: 12, shadows: 8 } },
  { name: 'Điện ảnh', values: { contrast: 22, saturation: -12, temperature: -8, vignette: 24 } },
  { name: 'Ấm áp', values: { temperature: 24, tint: 5, vibrance: 16 } },
  { name: 'Đen trắng', values: { saturation: -100, contrast: 18, clarity: 12 } },
];
const clamp = (value: number) => Math.max(0, Math.min(255, value));

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null); const fileRef = useRef<HTMLInputElement>(null); const imageRef = useRef<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState('Chưa có ảnh'); const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [adjustments, setAdjustments] = useState(initialAdjustments); const [history, setHistory] = useState<Adjustments[]>([initialAdjustments]);
  const [historyIndex, setHistoryIndex] = useState(0); const [rotation, setRotation] = useState(0); const [compare, setCompare] = useState(false); const [dragging, setDragging] = useState(false);

  const renderImage = useCallback(() => {
    const canvas = canvasRef.current, image = imageRef.current; if (!canvas || !image) return;
    const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight)); const rotated = rotation % 180 !== 0;
    const sw = Math.round(image.naturalWidth * scale), sh = Math.round(image.naturalHeight * scale); canvas.width = rotated ? sh : sw; canvas.height = rotated ? sw : sh;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) return;
    ctx.save(); ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate((rotation * Math.PI) / 180); ctx.drawImage(image, -sw / 2, -sh / 2, sw, sh); ctx.restore();
    if (compare) return;
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height), data = frame.data;
    const exposure = Math.pow(2, adjustments.exposure), contrast = (259 * (adjustments.contrast + 255)) / (255 * (259 - adjustments.contrast));
    const saturation = 1 + adjustments.saturation / 100, vibrance = adjustments.vibrance / 180, warmth = adjustments.temperature * .32, tint = adjustments.tint * .2;
    const white = adjustments.whites * .32, black = adjustments.blacks * .28, shadow = adjustments.shadows / 100, highlight = adjustments.highlights / 100;
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i] * exposure, g = data[i + 1] * exposure, b = data[i + 2] * exposure; const light = (Math.max(r, g, b) + Math.min(r, g, b)) / 510;
      const sm = Math.pow(1 - light, 2), hm = Math.pow(light, 2), tone = shadow * sm * 70 + highlight * hm * 55 + white * hm + black * sm;
      r += tone + warmth + tint; g += tone - tint * .5; b += tone - warmth + tint; r = contrast * (r - 128) + 128; g = contrast * (g - 128) + 128; b = contrast * (b - 128) + 128;
      const gray = r * .299 + g * .587 + b * .114, max = Math.max(r, g, b), avg = (r + g + b) / 3, color = saturation * (1 + vibrance * (1 - Math.abs(max - avg) / 255));
      data[i] = clamp(gray + (r - gray) * color); data[i + 1] = clamp(gray + (g - gray) * color); data[i + 2] = clamp(gray + (b - gray) * color);
    }
    ctx.putImageData(frame, 0, 0);
    if (adjustments.vignette > 0) { const gradient = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * .72); gradient.addColorStop(.35, 'rgba(0,0,0,0)'); gradient.addColorStop(1, `rgba(0,0,0,${adjustments.vignette / 130})`); ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  }, [adjustments, compare, rotation]);
  useEffect(() => renderImage(), [renderImage]);

  function loadFile(file?: File) { if (!file || !file.type.startsWith('image/')) return; if (imageUrl) URL.revokeObjectURL(imageUrl); const url = URL.createObjectURL(file), image = new Image(); image.onload = () => { imageRef.current = image; setFileName(file.name); setImageUrl(url); setAdjustments(initialAdjustments); setHistory([initialAdjustments]); setHistoryIndex(0); setRotation(0); }; image.src = url; }
  function commit(next: Adjustments) { const nextHistory = [...history.slice(0, historyIndex + 1), next]; setAdjustments(next); setHistory(nextHistory); setHistoryIndex(nextHistory.length - 1); }
  function undo() { if (historyIndex > 0) { const index = historyIndex - 1; setHistoryIndex(index); setAdjustments(history[index]); } }
  function redo() { if (historyIndex < history.length - 1) { const index = historyIndex + 1; setHistoryIndex(index); setAdjustments(history[index]); } }
  function exportImage() { const canvas = canvasRef.current; if (!canvas || !imageRef.current) return; const link = document.createElement('a'); link.download = `${fileName.replace(/\.[^.]+$/, '') || 'openphoto'}-edited.jpg`; link.href = canvas.toDataURL('image/jpeg', .92); link.click(); }
  function drop(event: DragEvent) { event.preventDefault(); setDragging(false); loadFile(event.dataTransfer.files[0]); }

  return <main className="flex h-dvh min-h-[620px] flex-col overflow-hidden bg-[#111214] text-[#eee]">
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#17181b] px-4">
      <div className="flex items-center gap-3"><div className="grid h-8 w-8 place-items-center rounded-lg bg-[#e7ff46] font-black text-[#121315]">O</div><div><div className="text-sm font-semibold leading-none">OpenPhoto</div><div className="mt-1 max-w-48 truncate text-[10px] text-white/45">{fileName}</div></div></div>
      <div className="flex items-center gap-1 rounded-lg bg-black/20 p-1"><button aria-label="Hoàn tác" onClick={undo} disabled={historyIndex === 0} className="toolbar-button">↶</button><button aria-label="Làm lại" onClick={redo} disabled={historyIndex >= history.length - 1} className="toolbar-button">↷</button><div className="mx-1 h-5 w-px bg-white/10"/><button onClick={() => setRotation(v => (v - 90 + 360) % 360)} className="toolbar-button" title="Xoay trái">↺</button><button onClick={() => setRotation(v => (v + 90) % 360)} className="toolbar-button" title="Xoay phải">↻</button></div>
      <div className="flex gap-2"><button onClick={() => fileRef.current?.click()} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-medium hover:bg-white/5">Mở ảnh</button><button onClick={exportImage} disabled={!imageUrl} className="rounded-lg bg-[#e7ff46] px-4 py-2 text-xs font-bold text-[#151613] hover:bg-[#efff78] disabled:opacity-40">Xuất ảnh</button></div>
    </header>
    <div className="grid min-h-0 flex-1 grid-cols-[56px_minmax(0,1fr)_320px] max-md:grid-cols-[48px_minmax(0,1fr)]">
      <aside className="flex flex-col items-center gap-2 border-r border-white/10 bg-[#17181b] py-4">{['◫','⌁','◐','✦'].map((icon,index)=><button key={icon} className={`grid h-9 w-9 place-items-center rounded-lg text-lg ${index===2?'bg-[#e7ff46]/12 text-[#e7ff46]':'text-white/50 hover:bg-white/5 hover:text-white'}`} title={['Cắt ảnh','Mặt nạ','Điều chỉnh','AI'][index]}>{icon}</button>)}<div className="mt-auto text-[9px] font-semibold uppercase tracking-[.18em] text-white/25 [writing-mode:vertical-rl]">Creative studio</div></aside>
      <section onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={drop} className={`relative grid min-h-0 place-items-center overflow-hidden bg-[#0d0e10] p-8 transition ${dragging?'bg-[#e7ff46]/5':''}`}>
        <div className="absolute inset-0 editor-grid opacity-30"/>{imageUrl?<canvas ref={canvasRef} className="relative max-h-full max-w-full shadow-[0_24px_80px_rgba(0,0,0,.6)]"/>:<button onClick={()=>fileRef.current?.click()} className="relative flex w-[min(460px,90%)] flex-col items-center rounded-2xl border border-dashed border-white/20 bg-white/[.025] px-10 py-14 text-center transition hover:border-[#e7ff46]/50"><span className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[#e7ff46] text-2xl text-black">＋</span><span className="text-base font-semibold">Bắt đầu với một bức ảnh</span><span className="mt-2 text-xs leading-5 text-white/45">Kéo thả ảnh vào đây hoặc chọn từ thiết bị<br/>JPG, PNG và WebP</span></button>}
        {imageUrl&&<button onPointerDown={()=>setCompare(true)} onPointerUp={()=>setCompare(false)} onPointerLeave={()=>setCompare(false)} className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/55 px-4 py-2 text-[11px] text-white/70 backdrop-blur">Giữ để xem ảnh gốc</button>}<input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e:ChangeEvent<HTMLInputElement>)=>loadFile(e.target.files?.[0])}/>
      </section>
      <aside className="min-h-0 overflow-y-auto border-l border-white/10 bg-[#17181b] max-md:hidden"><div className="border-b border-white/10 p-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-xs font-semibold">Presets nhanh</h2><span className="text-[10px] text-white/35">04 presets</span></div><div className="grid grid-cols-2 gap-2">{presets.map(p=><button key={p.name} onClick={()=>commit({...initialAdjustments,...p.values})} className="rounded-lg border border-white/10 bg-white/[.025] px-3 py-2.5 text-left text-[11px] text-white/65 hover:border-[#e7ff46]/30 hover:text-white">{p.name}</button>)}</div></div>
        <div className="p-4"><div className="mb-5 flex items-center justify-between"><h2 className="text-xs font-semibold uppercase tracking-[.12em] text-white/75">Điều chỉnh</h2><button onClick={()=>commit(initialAdjustments)} className="text-[10px] text-white/35 hover:text-[#e7ff46]">Đặt lại</button></div><div className="space-y-4">{controls.map((c,index)=><div key={c.key} className={index===6||index===10?'border-t border-white/10 pt-4':''}><div className="mb-1.5 flex justify-between text-[11px]"><label htmlFor={c.key} className="text-white/58">{c.label}</label><span className="w-10 text-right font-mono text-[10px] text-white/38">{adjustments[c.key]>0?'+':''}{adjustments[c.key]}</span></div><input id={c.key} type="range" min={c.min} max={c.max} step={c.step??1} value={adjustments[c.key]} onChange={e=>setAdjustments(v=>({...v,[c.key]:Number(e.target.value)}))} onPointerUp={()=>commit(adjustments)} className="adjustment-range"/></div>)}</div></div>
      </aside>
    </div>
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-white/10 bg-[#17181b] px-4 text-[9px] text-white/30"><span>Xử lý cục bộ · Ảnh của bạn không rời thiết bị</span><span>⌘Z Hoàn tác · Shift ⌘Z Làm lại</span></footer>
  </main>;
}
