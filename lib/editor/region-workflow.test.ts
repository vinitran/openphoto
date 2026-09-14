import { describe, expect, it } from 'vitest';
import { createDocument, EditCommand, EditPlan } from './types';
import { createTransaction, runCommands } from './dispatcher';
import { serializeProject, parseProject } from './persistence';
import { selectPlanRegions } from '../ai/region-plan';

const create:EditCommand={id:'create',version:1,tool:'mask.createSemantic',target:{type:'document'},origin:'ai',parameters:{id:'person',type:'semantic',name:'Người phía sau',geometry:{polygon:[{x:.3,y:.3},{x:.4,y:.3},{x:.4,y:.7},{x:.3,y:.7}]}}};
const adjust:EditCommand={id:'adjust',version:1,tool:'adjust.exposure',target:{type:'mask',id:'person'},origin:'ai',parameters:{value:.2}};
const global:EditCommand={...adjust,id:'global',target:{type:'document'}};
const plan:EditPlan={id:'plan',version:1,title:'Test',rationale:'Test',confidence:.8,expectedImpact:[],commands:[create,adjust,global]};

describe('Region editing and non-destructive removal',()=>{
  it('keeps mask dependencies while excluding unselected global edits',async()=>{
    const filtered=selectPlanRegions(plan,['person']);
    const original=createDocument();
    const result=await runCommands(original,filtered.commands,'preview');
    expect(result.document.adjustments.exposure).toBe(0);
    expect(result.document.masks[0].adjustments.exposure).toBe(.2);
    expect(original.masks).toEqual([]);
    expect(selectPlanRegions(plan,[]).commands).toEqual([]);
  });
  it('stores region blur and matte without altering global state, including project round-trip',async()=>{
    const before=(await runCommands(createDocument(),[create])).document;
    const tx=await createTransaction(before,[{...adjust,tool:'adjust.blur',parameters:{value:20}},{...adjust,id:'matte',tool:'adjust.fade',parameters:{value:12}}],'Regional effects');
    expect(tx.before.masks[0].adjustments.blur).toBe(0);
    expect(tx.after.adjustments.blur).toBe(0);
    expect(tx.after.masks[0].adjustments).toMatchObject({blur:20,fade:12});
    expect(parseProject(serializeProject(tx.after,[tx],0)).transactions[0]).toEqual(tx);
  });
  it('rejects removed clone tools and invalid regional effects',async()=>{
    const before=(await runCommands(createDocument(),[create])).document;
    await expect(runCommands(before,[{...adjust,tool:'retouch.clone',parameters:{x:.2,y:0}}])).rejects.toThrow('chưa được đăng ký');
    for(const value of [NaN,Infinity,-1,101]){
      await expect(runCommands(before,[{...adjust,tool:'adjust.blur',parameters:{value}}])).rejects.toThrow();
    }
  });
  it('migrates old masks to zero effects and discards legacy clone state',()=>{
    const doc=createDocument();
    const mask={id:'old',type:'semantic',geometry:{polygon:[]},adjustments:{exposure:1},clone:{x:.2,y:0}};
    const restored=parseProject(JSON.stringify({kind:'openphoto-project',schemaVersion:2,document:{...doc,masks:[mask]},transactions:[],historyIndex:-1}));
    expect(restored.document.masks[0]).not.toHaveProperty('clone');
    expect(restored.document.masks[0].adjustments).toMatchObject({blur:0,fade:0,exposure:1});
  });
  it('creates an inverted subject mask to select the surrounding background',async()=>{
    const result=await runCommands(createDocument(),[{...create,parameters:{...create.parameters,inverted:true}}]);
    expect(result.document.masks[0].inverted).toBe(true);
  });
});
