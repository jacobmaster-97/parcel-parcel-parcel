// Device preferences are separate from the whole-shop day-boundary save.
export const PREFERENCES_KEY='parcel-parcel-parcel-preferences-v1';
export const DEFAULT_PREFERENCES=Object.freeze({musicEnabled:true,musicVolume:25,sfxEnabled:true,sfxVolume:100,textSize:'standard'});
export function validPreferences(p){return !!p&&typeof p.musicEnabled==='boolean'&&typeof p.sfxEnabled==='boolean'&&['musicVolume','sfxVolume'].every(k=>Number.isInteger(p[k])&&p[k]>=0&&p[k]<=100)&&['standard','large'].includes(p.textSize);}
export function loadPreferences(storage=()=>globalThis.localStorage){
 try{const raw=storage().getItem(PREFERENCES_KEY);if(raw===null)return{values:{...DEFAULT_PREFERENCES},explicit:false,error:false};const record=JSON.parse(raw);if(record?.version!==1||!validPreferences(record.values))throw Error('Invalid preferences');return{values:{...record.values},explicit:true,error:false};}
 catch{return{values:{...DEFAULT_PREFERENCES},explicit:false,error:true};}
}
export function savePreferences(values,storage=()=>globalThis.localStorage){
 if(!validPreferences(values))return false;
 try{storage().setItem(PREFERENCES_KEY,JSON.stringify({version:1,values}));return true;}catch{return false;}
}
