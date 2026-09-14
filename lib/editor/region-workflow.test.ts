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
  it('stores clone coordinates in a reversible transaction and round-trips project JSON',async()=>{
    const before=(await runCommands(createDocument(),[create])).document;
    const clone:EditCommand={...adjust,tool:'retouch.clone',parameters:{x:.15,y:0}};
    const tx=await createTransaction(before,[clone],'Remove person');
    expect(tx.before.masks[0].clone).toBeUndefined();
    expect(tx.after.masks[0].clone).toEqual({x:.15,y:0});
    expect(parseProject(serializeProject(tx.after,[tx],0)).transactions[0]).toEqual(tx);
  });
  it('rejects nonexistent masks and unsafe clone coordinates atomically',async()=>{
    await expect(runCommands(createDocument(),[{...adjust,tool:'retouch.clone',parameters:{x:.2,y:0}}])).rejects.toThrow();
    const before=(await runCommands(createDocument(),[create])).document;
    for(const x of [NaN,Infinity,2,0]){
      await expect(runCommands(before,[{...adjust,tool:'retouch.clone',parameters:{x,y:0}}])).rejects.toThrow();
    }
    expect(before.masks[0].clone).toBeUndefined();
  });
});
