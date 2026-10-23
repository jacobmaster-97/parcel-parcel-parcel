import {readSave} from './save.js';
export const SAVE_DATABASE='parcel-parcel-parcel-progress-v1';
const storeValid = r => {try{readSave(r);return true;}catch{return false;}};
export class SaveStore {
 constructor(){this.owner=globalThis.crypto?.randomUUID?.()||`tab-${Date.now()}-${Math.random()}`;this.revision=0;this.profileId=null;this.dbPromise=null;this.onConflict=null;
  try{if(typeof BroadcastChannel!=='undefined'){this.channel=new BroadcastChannel(SAVE_DATABASE);this.channel.onmessage=e=>{if(e.data?.owner!==this.owner)this.onConflict?.();};}}catch{/* IndexedDB ownership checks still protect writes without notifications. */}
 }
 db(){
  if(!this.dbPromise)this.dbPromise=new Promise((resolve,reject)=>{
   if(!globalThis.indexedDB){reject(new Error('此瀏覽器未能開啟本地存檔。可手動匯出備份。'));return;}
   const request=indexedDB.open(SAVE_DATABASE,1);request.onupgradeneeded=()=>request.result.createObjectStore('state');
   request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db);};request.onerror=()=>reject(new Error('本地存檔未能開啟，請檢查瀏覽器儲存權限。'));request.onblocked=()=>reject(new Error('存檔更新被另一個分頁阻擋，請先關閉舊分頁。'));
  });return this.dbPromise;
 }
 async inspect(){
  const db=await this.db();return new Promise((resolve,reject)=>{
   const tx=db.transaction('state','readonly'),s=tx.objectStore('state'),result={};
   for(const key of ['meta','current','previous','checkpoint','problem']){const q=s.get(key);q.onsuccess=()=>result[key]=q.result||null;}
   tx.oncomplete=()=>{this.revision=result.meta?.revision||0;this.profileId=result.meta?.profileId||null;resolve(result);};tx.onerror=()=>reject(new Error('無法讀取存檔，原檔仍然保留。'));
  });
 }
 async mutate(callback){
  const db=await this.db();return new Promise((resolve,reject)=>{
   const tx=db.transaction('state','readwrite'),s=tx.objectStore('state'),values={};let left=3,problem=null,result;
   for(const key of ['meta','current','previous']){const q=s.get(key);q.onsuccess=()=>{values[key]=q.result||null;if(--left===0){try{result=callback(s,values);}catch(e){problem=e;tx.abort();}}};}
   tx.oncomplete=()=>{this.revision=result.revision;this.profileId=result.profileId;this.channel?.postMessage({owner:this.owner,revision:this.revision});resolve(result.record||null);};
   tx.onabort=()=>reject(problem||new Error('未能儲存；原有存檔未被取代。請重試或匯出備份。'));tx.onerror=()=>{};
  });
 }
 async acquire(profileId,{force=false,reset=false}={}){
  return this.mutate((s,v)=>{
   const meta=v.meta||{revision:0,owner:null,profileId:null};
   if(meta.revision!==this.revision)throw new Error('存檔已在另一分頁更新，請重新讀取。');
   if(meta.owner&&meta.owner!==this.owner&&!force)throw new Error('TAKEOVER');
   const next={revision:meta.revision+1,owner:this.owner,profileId};
   if(reset){if(v.current){if(storeValid(v.current))s.put(v.current,'previous');else s.put(v.current,'problem');}s.delete('current');}
   s.put(next,'meta');return next;
  });
 }
 async write(record,{replace=false,force=false}={}){
  readSave(record);
  return this.mutate((s,v)=>{
   const meta=v.meta||{revision:0,owner:null,profileId:null};
   if(meta.revision!==this.revision||(!replace&&meta.profileId!==record.profileId))throw new Error('存檔版本已改變。請回主選單讀取最新進度，或匯出本頁。');
   if(meta.owner&&meta.owner!==this.owner&&!force)throw new Error('另一分頁已接管此店，這份舊進度未覆蓋新存檔。');
   if(v.current&&!storeValid(v.current)&&!replace)throw new Error('主存檔無法驗證，請回主選單選擇有效備份或匯入；原檔仍保留。');
   const next={revision:meta.revision+1,owner:this.owner,profileId:record.profileId};
   const saved={...structuredClone(record),revision:next.revision,savedAt:new Date().toISOString()};
   if(v.current){
    if(storeValid(v.current)){if(v.previous&&storeValid(v.previous))s.put(v.previous,'checkpoint');s.put(v.current,'previous');}
    else s.put(v.current,'problem');
   }
   s.put(saved,'current');s.put(next,'meta');return{...next,record:saved};
  });
 }
 async isOwner(){const catalog=await this.inspect();return catalog.meta?.owner===this.owner;}
}
