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
  it('mọi adjustment có thể nhắm vào mask mà không đổi toàn ảnh',async()=>{
    const document=createDocument('mask.jpg');
    const created=await runCommands(document,[{...command('mask.create',0),parameters:{id:'mask_face',type:'radial'}}]);
    const adjusted=await runCommands(created.document,[{...command('adjust.exposure',.4,'ai'),target:{type:'mask',id:'mask_face'}}]);
    expect(adjusted.document.adjustments.exposure).toBe(0);
    expect(adjusted.document.masks[0].adjustments.exposure).toBe(.4);
  });
  it('AI có thể tạo semantic mask rồi chỉnh riêng vùng trong cùng plan',async()=>{
    const created=await runCommands(createDocument('ai.jpg'),[
      {...command('mask.createSemantic',0,'ai'),parameters:{id:'sky',type:'semantic',name:'Bầu trời',geometry:{semanticLabel:'sky',polygon:[{x:0,y:0},{x:1,y:0},{x:1,y:.4},{x:0,y:.4}]},feather:.1}},
      {...command('adjust.saturation',15,'ai'),target:{type:'mask',id:'sky'}},
    ]);
    expect(created.document.masks[0].type).toBe('semantic');
    expect(created.document.masks[0].geometry.polygon).toHaveLength(4);
    expect(created.document.masks[0].adjustments.saturation).toBe(15);
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
  it('migrate project schema v1 sang document có mask schema v2',()=>{
    const legacy=createDocument('legacy.jpg');
    const input={kind:'openphoto-project',schemaVersion:1,document:{...legacy,schemaVersion:1,masks:undefined},transactions:[],historyIndex:-1};
    const restored=parseProject(JSON.stringify(input));
    expect(restored.schemaVersion).toBe(2);expect(restored.document.schemaVersion).toBe(2);expect(restored.document.masks).toEqual([]);
  });
});
