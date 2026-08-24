'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createTransaction, runCommands } from './dispatcher';
import { EditCommand, EditorDocument, ProjectFile, Transaction, createDocument } from './types';
import { loadProject, saveProject } from './persistence';

export function useEditor(){
  const [document,setDocument]=useState<EditorDocument>(()=>createDocument()); const [transactions,setTransactions]=useState<Transaction[]>([]); const [historyIndex,setHistoryIndex]=useState(-1); const [ready,setReady]=useState(false); const imageBlob=useRef<Blob|undefined>(undefined); const imageName=useRef<string|undefined>(undefined);
  useEffect(()=>{ loadProject().then((stored)=>{ if(stored){ setDocument(stored.project.document);setTransactions(stored.project.transactions);setHistoryIndex(stored.project.historyIndex);imageBlob.current=stored.image;imageName.current=stored.imageName; } }).catch(()=>undefined).finally(()=>setReady(true)); },[]);
  useEffect(()=>{ if(!ready)return; const timer=setTimeout(()=>saveProject(document,transactions,historyIndex,imageBlob.current,imageName.current),350); return()=>clearTimeout(timer); },[document,transactions,historyIndex,ready]);
  const dispatch=useCallback(async(commands:EditCommand[],label:string)=>{ const tx=await createTransaction(document,commands,label); const next=[...transactions.slice(0,historyIndex+1),tx];setTransactions(next);setHistoryIndex(next.length-1);setDocument(tx.after);return tx; },[document,transactions,historyIndex]);
  const preview=useCallback((commands:EditCommand[])=>runCommands(document,commands,'preview'),[document]);
  const undo=useCallback(()=>{ if(historyIndex<0)return;setDocument(transactions[historyIndex].before);setHistoryIndex(historyIndex-1); },[historyIndex,transactions]);
  const redo=useCallback(()=>{ if(historyIndex>=transactions.length-1)return;const index=historyIndex+1;setDocument(transactions[index].after);setHistoryIndex(index); },[historyIndex,transactions]);
  const restore=useCallback((project:ProjectFile)=>{setDocument(project.document);setTransactions(project.transactions);setHistoryIndex(Math.min(project.historyIndex,project.transactions.length-1));},[]);
  const setImage=useCallback((blob:Blob,name:string)=>{imageBlob.current=blob;imageName.current=name;setDocument(createDocument(name));setTransactions([]);setHistoryIndex(-1);},[]);
  return {document,transactions,historyIndex,ready,dispatch,preview,undo,redo,restore,setImage,getStoredImage:()=>({blob:imageBlob.current,name:imageName.current})};
}
