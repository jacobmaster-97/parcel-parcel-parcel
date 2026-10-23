import {Shift} from './game.js';
import {Ledger} from './finance.js';
import {canStandAt} from './layout.js';
export const SAVE_SCHEMA=1;
const savedFields=['shippingChance','deferDayStart','courier','courierSerial','seed','phase','day','totalRevenue','remaining','elapsed','shelves','receiving','outbound','held','serial','orderSerial','customerTimer','deliveryTimer','stats'];
const saveFaces=['down','left','right','up'];
function saveCheck(ok){if(!ok)throw new Error('存檔資料不完整或已損壞，原有進度沒有被取代。');}
const saveInt=n=>Number.isSafeInteger(n)&&n>=0;
const saveFinite=n=>typeof n==='number'&&Number.isFinite(n);
const savePoint=p=>p&&saveFinite(p.x)&&saveFinite(p.y)&&p.x>=-32&&p.x<=382&&p.y>=-32&&p.y<=372;
const saveRoute=a=>Array.isArray(a)&&a.length<=16&&a.every(savePoint);
export function saveChecksum(payload){const s=JSON.stringify(payload);let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return(h>>>0).toString(16).padStart(8,'0');}
export function encodeShift(game){
 const value=Object.fromEntries(savedFields.map(k=>[k,structuredClone(game[k])]));
 value.phase=game.phase==='paused'?game.pausedPhase:game.phase;
 value.ledger=game.ledger.toJSON();value.packages=[...game.packages.values()].filter(p=>['shelf','receiving','outbound','held','customer'].includes(p.location)).map(p=>structuredClone(p));
 const activeOrders=new Set(game.queue.map(o=>o.id));
 value.orders=game.orders.filter(o=>activeOrders.has(o.id)||(o.status==='accepted'&&game.packages.get(o.packageId)?.location==='held')).map(o=>structuredClone(o));
 value.queue=game.queue.map(o=>o.id);return value;
}
export function decodeShift(value){
 saveCheck(value&&typeof value==='object'&&saveInt(value.day)&&value.day>=1&&value.day<=1000000&&saveInt(value.serial)&&saveInt(value.orderSerial)&&saveInt(value.courierSerial)&&saveInt(value.seed)&&value.seed<=4294967295);
 saveCheck(['playing','closing','stocking','dayend'].includes(value.phase)&&saveFinite(value.remaining)&&value.remaining>=0&&value.remaining<=180&&saveFinite(value.elapsed)&&value.elapsed>=0&&value.elapsed<=10000000&&saveInt(value.totalRevenue)&&saveFinite(value.shippingChance)&&value.shippingChance>=0&&value.shippingChance<=1&&value.deferDayStart===true);
 saveCheck(['customerTimer','deliveryTimer'].every(k=>saveFinite(value[k])&&value[k]>=-100000&&value[k]<=100000));
 const ledger=Ledger.fromJSON(value.ledger);saveCheck(ledger.current.day===value.day&&ledger.lifetimeRevenue===value.totalRevenue&&ledger.current.sealed===(value.phase==='dayend'));
 for(const d of ledger.reports)saveCheck(d.stats&&['completed','errors','missed','stocked','revenue','shipped'].every(k=>saveInt(d.stats[k])));
 saveCheck(value.stats&&['completed','errors','missed','stocked','revenue','shipped'].every(k=>saveInt(value.stats[k]))&&value.stats.revenue===Object.values(ledger.current.income).reduce((a,b)=>a+b,0));
 saveCheck(Array.isArray(value.packages)&&value.packages.length<=30&&Array.isArray(value.orders)&&value.orders.length<=5&&Array.isArray(value.queue)&&value.queue.length<=4&&new Set(value.queue).size===value.queue.length);
 const packages=new Map(),orderMap=new Map();
 for(const p of value.packages){saveCheck(p&&typeof p.id==='string'&&/^[PS][1-9]\d*$/.test(p.id)&&Number(p.id.slice(1))<=value.serial&&!packages.has(p.id)&&typeof p.code==='string'&&/^(?:\d{4,12}|S\d{1,12})$/.test(p.code)&&['shelf','receiving','outbound','held','customer'].includes(p.location)&&(['A','B','C'].includes(p.zone)||p.zone===null)&&(!p.kind||p.kind==='shipping'));packages.set(p.id,p);}
 saveCheck(new Set(value.packages.map(p=>p.code)).size===packages.size);
 for(const o of value.orders){saveCheck(o&&typeof o.id==='string'&&/^O[1-9]\d*$/.test(o.id)&&Number(o.id.slice(1))<=value.orderSerial&&!orderMap.has(o.id)&&packages.has(o.packageId)&&o.code===packages.get(o.packageId).code&&['pickup','shipping'].includes(o.type)&&['waiting','accepted'].includes(o.status)&&typeof o.revealed==='boolean'&&saveInt(o.appearance)&&o.appearance<3&&saveFinite(o.patience)&&saveFinite(o.maxPatience)&&o.patience>=0&&o.patience<=o.maxPatience&&o.maxPatience>0&&o.maxPatience<=60);orderMap.set(o.id,o);}
 const occupancy=new Map(),reserved=new Map();
 saveCheck(value.shelves&&Object.keys(value.shelves).sort().join()==='A,B,C'&&Array.isArray(value.receiving)&&value.receiving.length===6&&Array.isArray(value.outbound)&&value.outbound.length===6);
 const groups=[...['A','B','C'].map(z=>['shelf',z,value.shelves[z]]),['receiving',null,value.receiving],['outbound',null,value.outbound]];
 for(const [type,zone,slots] of groups){saveCheck(Array.isArray(slots)&&slots.length===(type==='shelf'?4:6));slots.forEach((s,i)=>{
  saveCheck(s&&(s.packageId===null||typeof s.packageId==='string')&&(s.reservedFor===null||typeof s.reservedFor==='string')&&!(s.packageId&&s.reservedFor));
  if(s.packageId){const p=packages.get(s.packageId);saveCheck(p&&!occupancy.has(p.id)&&p.location===type&&p.index===i&&(type!=='shelf'||p.zone===zone));occupancy.set(p.id,{type,zone,index:i});}
  if(s.reservedFor){saveCheck(packages.has(s.reservedFor)&&!reserved.has(s.reservedFor));reserved.set(s.reservedFor,{type,zone,index:i});}
 });}
 let held=0;
 for(const p of packages.values()){
  if(['shelf','receiving','outbound'].includes(p.location))saveCheck(occupancy.has(p.id)&&!p.origin&&(p.location!=='outbound'||p.kind==='shipping'));
  if(p.location==='held'){held++;const r=reserved.get(p.id);saveCheck(value.held===p.id&&p.origin&&r&&r.type===p.origin.type&&r.zone===p.origin.zone&&r.index===p.origin.index);}
  if(p.location==='customer'){const r=reserved.get(p.id);saveCheck(p.kind==='shipping'&&r?.type==='outbound'&&r.index===p.index);}
  if(reserved.has(p.id))saveCheck(['held','customer'].includes(p.location));
  if(p.orderId)saveCheck(orderMap.has(p.orderId)&&value.queue.includes(p.orderId));
 }
 saveCheck(held===(value.held?1:0));
 for(const id of value.queue){const o=orderMap.get(id),p=o&&packages.get(o.packageId);saveCheck(o&&o.status==='waiting'&&p.orderId===id&&(o.type==='shipping'?p.kind==='shipping'&&p.location==='customer':p.kind!=='shipping'&&['shelf','held'].includes(p.location)));}
 for(const o of orderMap.values())if(!value.queue.includes(o.id))saveCheck(o.status==='accepted'&&o.type==='shipping'&&packages.get(o.packageId).location==='held');
 if(value.courier){const q=value.courier;saveCheck(saveInt(q.id)&&q.id>0&&q.id<=value.courierSerial&&savePoint(q)&&saveFaces.includes(q.face)&&typeof q.carrying==='boolean'&&['arriving','waiting','unloading','leaving'].includes(q.stage)&&saveRoute(q.route)&&saveInt(q.next)&&q.next<=q.route.length&&saveFinite(q.unloadRemaining)&&q.unloadRemaining>=0&&q.unloadRemaining<=.6&&saveFinite(q.travel)&&q.travel>=0);}
 const game=Object.create(Shift.prototype);for(const key of savedFields)game[key]=structuredClone(value[key]);
 game.practice=false;game.packages=new Map([...packages].map(([id,p])=>[id,structuredClone(p)]));game.orders=[...orderMap.values()].map(o=>structuredClone(o));const restored=new Map(game.orders.map(o=>[o.id,o]));game.queue=value.queue.map(id=>restored.get(id));game.ledger=ledger;game.events=[];game.pausedPhase=null;return game;
}
function validateActor(a){saveCheck(a&&typeof a.id==='string'&&a.id.length<40&&savePoint(a)&&saveFaces.includes(a.face)&&saveFinite(a.travel)&&a.travel>=0&&typeof a.carrying==='boolean'&&saveInt(a.appearance)&&a.appearance<3&&saveRoute(a.route)&&saveInt(a.next)&&a.next<=a.route.length&&typeof a.entered==='boolean');}
export function makeSave(profileId,game,view,settings={sound:true}){
 if(game.practice)throw new Error('練習不能覆蓋正式店舖進度。');
 const record={format:'parcel-parcel-parcel',schemaVersion:SAVE_SCHEMA,appVersion:'0.5.0',profileId,revision:0,savedAt:new Date().toISOString(),payload:{shift:encodeShift(game),view:structuredClone(view),settings:{sound:!!settings.sound}}};record.checksum=saveChecksum(record.payload);readSave(record);return record;
}
export function readSave(record){
 if(record?.schemaVersion>SAVE_SCHEMA)throw new Error('此存檔來自較新版本，請使用相容版本開啟。');
 saveCheck(record&&record.format==='parcel-parcel-parcel'&&record.schemaVersion===SAVE_SCHEMA&&typeof record.profileId==='string'&&record.profileId.length>0&&record.profileId.length<100&&saveInt(record.revision)&&typeof record.savedAt==='string'&&Number.isFinite(Date.parse(record.savedAt))&&record.payload&&record.checksum===saveChecksum(record.payload));
 const {view,settings}=record.payload;saveCheck(view&&view.player&&savePoint(view.player)&&canStandAt(view.player.x,view.player.y)&&saveFaces.includes(view.player.face)&&saveFinite(view.player.travel)&&view.player.travel>=0&&Array.isArray(view.actors)&&view.actors.length<=4&&Array.isArray(view.departures)&&view.departures.length<=50&&settings&&typeof settings.sound==='boolean');
 const game=decodeShift(record.payload.shift);view.actors.forEach(validateActor);view.departures.forEach(validateActor);saveCheck(new Set(view.actors.map(a=>a.id)).size===view.actors.length&&view.actors.length===game.queue.length&&view.actors.every(a=>game.queue.some(o=>o.id===a.id)));
 return{game,view:structuredClone(view),settings:structuredClone(settings)};
}
