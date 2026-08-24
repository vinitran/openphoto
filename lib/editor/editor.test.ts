import { describe, expect, it } from 'vitest';
import { createTransaction, runCommands, validatePlan } from './dispatcher';
import { parseProject, serializeProject } from './persistence';
import { EditCommand, EditPlan, createDocument } from './types';

const command=(tool:string,value:number,origin:EditCommand['origin']='user'):EditCommand=>({id:`cmd_${tool}`,version:1,tool,target:{type:'document'},parameters:{value},origin});

describe('command dispatcher',()=>{
  it('tạo cùng state khi nhận command từ UI hoặc AI',async()=>{
    const document=createDocument('test.jpg');
    const ui=await runCommands(document,[command('adjust.exposure',.5,'user')]);
    const ai=await runCommands(document,[command('adjust.exposure',.5,'ai')]);
    expect(ai.document.adjustments).toEqual(ui.document.adjustments);
  });
  it('từ chối tool lạ và giá trị ngoài schema',async()=>{
    await expect(runCommands(createDocument(),[command('adjust.unknown',1)])).rejects.toThrow('chưa được đăng ký');
    await expect(runCommands(createDocument(),[command('adjust.exposure',8)])).rejects.toThrow('nằm trong');
  });
  it('gom nhiều command thành một transaction không chứa pixel',async()=>{
    const tx=await createTransaction(createDocument(),[command('adjust.shadows',20),command('adjust.vibrance',12)],'AI plan');
    expect(tx.after.adjustments.shadows).toBe(20); expect(tx.after.adjustments.vibrance).toBe(12); expect(tx.commands).toHaveLength(2);
  });
});

describe('AI plan và project',()=>{
  it('validate EditPlan hợp lệ và chặn confidence sai',()=>{
    const plan:EditPlan={id:'plan',version:1,title:'Test',rationale:'Test',confidence:.8,expectedImpact:[],commands:[command('adjust.contrast',10,'ai')]};
    expect(()=>validatePlan(plan)).not.toThrow(); expect(()=>validatePlan({...plan,confidence:2})).toThrow('confidence');
  });
  it('round-trip project JSON giữ nguyên state và history',async()=>{
    const document=createDocument('photo.jpg'); const tx=await createTransaction(document,[command('adjust.temperature',15)],'Warm');
    const restored=parseProject(serializeProject(tx.after,[tx],0)); expect(restored.document).toEqual(tx.after); expect(restored.transactions[0].before).toEqual(document);
  });
});
