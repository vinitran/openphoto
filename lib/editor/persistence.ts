import { EditorDocument, ProjectFile, Transaction } from './types';

const DB_NAME='openphoto'; const STORE='projects'; const KEY='active-project';
export type StoredProject={ project:ProjectFile; image?:Blob; imageName?:string };

function openDb(){ return new Promise<IDBDatabase>((resolve,reject)=>{ const request=indexedDB.open(DB_NAME,1); request.onupgradeneeded=()=>{ if(!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); }; request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error); }); }
export async function saveProject(document:EditorDocument,transactions:Transaction[],historyIndex:number,image?:Blob,imageName?:string){ const db=await openDb(); const project:ProjectFile={kind:'openphoto-project',schemaVersion:1,document,transactions,historyIndex}; await new Promise<void>((resolve,reject)=>{ const tx=db.transaction(STORE,'readwrite'); tx.objectStore(STORE).put({project,image,imageName} satisfies StoredProject,KEY); tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error); }); db.close(); }
export async function loadProject(){ const db=await openDb(); const result=await new Promise<StoredProject|undefined>((resolve,reject)=>{ const request=db.transaction(STORE).objectStore(STORE).get(KEY); request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error); }); db.close(); return result; }
export function serializeProject(document:EditorDocument,transactions:Transaction[],historyIndex:number){ return JSON.stringify({kind:'openphoto-project',schemaVersion:1,document,transactions,historyIndex} satisfies ProjectFile,null,2); }
export function parseProject(text:string):ProjectFile{ const value=JSON.parse(text) as ProjectFile; if(value.kind!=='openphoto-project'||value.schemaVersion!==1||!value.document||!Array.isArray(value.transactions)||typeof value.historyIndex!=='number') throw new Error('File project không hợp lệ hoặc chưa được hỗ trợ.'); return value; }
