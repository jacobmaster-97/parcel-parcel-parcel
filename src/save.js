import {CUSTOMER_COUNT} from './customers.js';
import {migrateAchievements,validAchievements} from './achievements.js';
import {Shift} from './game.js';
import {Ledger} from './finance.js';
import {canStandInShop} from './layout.js';
import {initialDayEvents,eventSeedFromText,previewNextEvent,validDayEvents} from './day-events.js';
import {initialUpgrades} from './upgrades.js';
export const SAVE_SCHEMA=11;
const savedFields=['achievements','shippingChance','deferDayStart','courier','courierSerial','seed','phase','day','totalRevenue','remaining','elapsed','shelves','receiving','outbound','held','heldExtra','serial','orderSerial','customerTimer','deliveryTimer','stats','upgrades','worker','managementFrom','dayEvents'];
const saveFaces=['down','left','right','up'];
function saveCheck(ok){if(!ok)throw new Error('存檔資料不完整或已損壞，原有進度沒有被取代。');}
const saveInt=n=>Number.isSafeInteger(n)&&n>=0;
const saveFinite=n=>typeof n==='number'&&Number.isFinite(n);
const savePoint=p=>p&&saveFinite(p.x)&&saveFinite(p.y)&&p.x>=-32&&p.x<=382&&p.y>=-32&&p.y<=516;
const saveRoute=a=>Array.isArray(a)&&a.length<=16&&a.every(savePoint);
export function saveChecksum(payload){const s=JSON.stringify(payload);let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return(h>>>0).toString(16).padStart(8,'0');}
export function encodeShift(game){
 const value=Object.fromEntries(savedFields.map(k=>[k,structuredClone(game[k])]));
 value.phase=game.phase==='paused'?game.pausedPhase:game.phase;
 value.ledger=game.ledger.toJSON();value.packages=[...game.packages.values()].filter(p=>['shelf','receiving','outbound','held','customer','worker'].includes(p.location)).map(p=>structuredClone(p));
 const activeOrders=new Set(game.queue.map(o=>o.id));
 value.orders=game.orders.filter(o=>activeOrders.has(o.id)||(o.status==='accepted'&&game.packages.get(o.packageId)?.location==='held')).map(o=>structuredClone(o));
 value.queue=game.queue.map(o=>o.id);return value;
}
export function decodeShift(value){
 saveCheck(validAchievements(value?.achievements,value?.day));
 saveCheck(value&&typeof value==='object'&&saveInt(value.day)&&value.day>=1&&value.day<=1000000&&saveInt(value.serial)&&saveInt(value.orderSerial)&&saveInt(value.courierSerial)&&saveInt(value.seed)&&value.seed<=4294967295);
 saveCheck(['playing','closing','stocking','dayend','upgrading'].includes(value.phase)&&saveFinite(value.remaining)&&value.remaining>=0&&value.remaining<=120&&saveFinite(value.elapsed)&&value.elapsed>=0&&value.elapsed<=10000000&&saveInt(value.totalRevenue)&&saveFinite(value.shippingChance)&&value.shippingChance>=0&&value.shippingChance<=1&&value.deferDayStart===true);
 saveCheck(['customerTimer','deliveryTimer'].every(k=>saveFinite(value[k])&&value[k]>=-100000&&value[k]<=100000));
 saveCheck(validDayEvents(value.dayEvents,value.day,value.phase));
 const ledger=Ledger.fromJSON(value.ledger);saveCheck(ledger.current.day===value.day&&ledger.lifetimeRevenue===value.totalRevenue&&ledger.current.sealed===(value.phase==='dayend'));
 for(const d of ledger.reports)saveCheck(d.stats&&['completed','errors','missed','stocked','revenue','shipped'].every(k=>saveInt(d.stats[k])));
 saveCheck(value.stats&&['completed','errors','missed','stocked','revenue','shipped'].every(k=>saveInt(value.stats[k]))&&value.stats.revenue===Object.values(ledger.current.income).reduce((a,b)=>a+b,0));
 saveCheck(Array.isArray(value.packages)&&value.packages.length<=61&&Array.isArray(value.orders)&&value.orders.length<=6&&Array.isArray(value.queue)&&value.queue.length<=5&&new Set(value.queue).size===value.queue.length);
 const packages=new Map(),orderMap=new Map();
 for(const p of value.packages){saveCheck(p&&typeof p.id==='string'&&/^[PS][1-9]\d*$/.test(p.id)&&Number(p.id.slice(1))<=value.serial&&!packages.has(p.id)&&typeof p.code==='string'&&/^(?:\d{4,12}|S\d{1,12})$/.test(p.code)&&['shelf','receiving','outbound','held','customer','worker'].includes(p.location)&&(['A','B','C','D'].includes(p.zone)||p.zone===null)&&(!p.kind||p.kind==='shipping')&&(p.achievementStocked===undefined||typeof p.achievementStocked==='boolean'));packages.set(p.id,p);}
 saveCheck(new Set(value.packages.map(p=>p.code)).size===packages.size);
 for(const o of value.orders){saveCheck(o&&typeof o.id==='string'&&/^O[1-9]\d*$/.test(o.id)&&Number(o.id.slice(1))<=value.orderSerial&&!orderMap.has(o.id)&&packages.has(o.packageId)&&o.code===packages.get(o.packageId).code&&['pickup','shipping'].includes(o.type)&&['waiting','accepted'].includes(o.status)&&typeof o.revealed==='boolean'&&saveInt(o.appearance)&&o.appearance<CUSTOMER_COUNT&&saveFinite(o.patience)&&saveFinite(o.maxPatience)&&o.patience>=0&&o.patience<=o.maxPatience&&o.maxPatience>0&&o.maxPatience<=60);orderMap.set(o.id,o);}
 for(const [id,time] of Object.entries(value.achievements.today.greeted)){const o=orderMap.get(id);saveCheck(o?.type==='pickup'&&o.revealed&&value.queue.includes(id)&&time<=value.elapsed);}
 const occupancy=new Map(),reserved=new Map();
 saveCheck(['closing','stocking'].includes(value.managementFrom));
 const u=value.upgrades;
 saveCheck(u&&typeof u.twoHands==='boolean'&&u.twoHands===ledger.paid.includes('upgrade:twoHands:new')&&typeof u.cargoManagement==='boolean'&&u.cargoManagement===ledger.paid.includes('upgrade:management:new')&&saveInt(u.shoeThroughDay)&&u.shoeThroughDay<=value.day+3&&u.shelfLevels&&['A','B'].every(z=>saveInt(u.shelfLevels[z])&&u.shelfLevels[z]<=2)&&Object.keys(u.shelfLevels).every(z=>['A','B','C','D'].includes(z)&&saveInt(u.shelfLevels[z])&&u.shelfLevels[z]<=2)&&saveInt(u.receivingLevel)&&u.receivingLevel<=3&&saveInt(u.outboundLevel)&&u.outboundLevel<=3&&[0,value.day+1].includes(u.workerBookedDay)&&u.workerBookedDay!==value.day&&Array.isArray(u.workerZones)&&u.workerZones.length>0&&new Set(u.workerZones).size===u.workerZones.length&&u.workerZones.every(z=>u.shelfLevels[z]!==undefined)&&typeof u.workerAdvancedUnlocked==='boolean'&&['basic','advanced'].includes(u.workerBookedTier)&&(u.workerBookedTier!=='advanced'||u.workerAdvancedUnlocked)&&ledger.balance>=(u.workerBookedDay?(u.workerBookedTier==='advanced'?85:60):0));
 saveCheck(value.shelves&&Object.keys(value.shelves).sort().join()===Object.keys(u.shelfLevels).sort().join()&&Array.isArray(value.receiving)&&value.receiving.length===6+u.receivingLevel*2&&Array.isArray(value.outbound)&&value.outbound.length===6+u.outboundLevel*2);
 const groups=[...Object.keys(value.shelves).map(z=>['shelf',z,value.shelves[z]]),['receiving',null,value.receiving],['outbound',null,value.outbound]];
 const worker=value.worker;
 if(worker){saveCheck(['basic','advanced'].includes(worker.tier)&&(worker.tier!=='advanced'||u.workerAdvancedUnlocked)&&value.phase==='playing'&&savePoint(worker)&&saveFaces.includes(worker.face)&&typeof worker.moving==='boolean'&&saveFinite(worker.travel)&&worker.travel>=0&&saveRoute(worker.route)&&saveInt(worker.next)&&worker.next<=worker.route.length&&ledger.paid.includes(`salary:${value.day}`));
  if(worker.task){const t=worker.task;saveCheck(packages.has(t.packageId)&&u.workerZones.includes(t.zone)&&saveInt(t.index)&&t.index<value.shelves[t.zone].length&&saveInt(t.originIndex)&&t.originIndex<value.receiving.length&&typeof t.carrying==='boolean');}}
 for(const [type,zone,slots] of groups){saveCheck(Array.isArray(slots)&&slots.length===(type==='shelf'?4+u.shelfLevels[zone]*2:type==='receiving'?6+u.receivingLevel*2:6+u.outboundLevel*2));slots.forEach((s,i)=>{
  saveCheck(s&&(s.packageId===null||typeof s.packageId==='string')&&(s.reservedFor===null||typeof s.reservedFor==='string')&&!(s.packageId&&s.reservedFor));
  if(s.packageId){const p=packages.get(s.packageId);saveCheck(p&&!occupancy.has(p.id)&&p.location===type&&p.index===i&&(type!=='shelf'||p.zone===zone));occupancy.set(p.id,{type,zone,index:i});}
  if(s.reservedFor){
   const task=worker?.task;
   if(task?.packageId===s.reservedFor)saveCheck(type==='shelf'&&zone===task.zone&&i===task.index||task.carrying&&type==='receiving'&&i===task.originIndex);
   saveCheck(packages.has(s.reservedFor)&&(!reserved.has(s.reservedFor)||s.reservedFor===task?.packageId));if(!reserved.has(s.reservedFor)||type==='receiving')reserved.set(s.reservedFor,{type,zone,index:i});
  }
 });}
 if(worker?.task){const t=worker.task,p=packages.get(t.packageId);saveCheck(value.shelves[t.zone][t.index].reservedFor===p.id&&(t.carrying?p.location==='worker'&&p.origin?.index===t.originIndex:p.location==='receiving'&&p.index===t.originIndex));}
 let held=0;
 for(const p of packages.values()){
  if(['shelf','receiving','outbound'].includes(p.location))saveCheck(occupancy.has(p.id)&&!p.origin&&(p.location!=='outbound'||p.kind==='shipping'));
  if(p.location==='held'){held++;const r=reserved.get(p.id);saveCheck([value.held,value.heldExtra].includes(p.id)&&p.origin&&r&&r.type===p.origin.type&&r.zone===p.origin.zone&&r.index===p.origin.index);}
  if(p.location==='customer'){const r=reserved.get(p.id);saveCheck(p.kind==='shipping'&&r?.type==='outbound'&&r.index===p.index);}
  if(reserved.has(p.id))saveCheck(['held','customer','worker'].includes(p.location)||p.id===worker?.task?.packageId&&p.location==='receiving');
  if(p.location==='worker')saveCheck(worker?.task?.carrying&&worker.task.packageId===p.id&&p.origin?.type==='receiving'&&value.receiving[p.origin.index]?.reservedFor===p.id);
  if(p.orderId)saveCheck(orderMap.has(p.orderId)&&value.queue.includes(p.orderId));
 }
 saveCheck((value.held===null||typeof value.held==='string'&&packages.get(value.held)?.location==='held')&&(value.heldExtra===null||typeof value.heldExtra==='string'&&packages.get(value.heldExtra)?.location==='held'));
 const heldIds=[value.held,value.heldExtra].filter(Boolean);saveCheck(held===heldIds.length&&new Set(heldIds).size===heldIds.length&&heldIds.every(id=>packages.get(id)?.location==='held'));
 if(value.heldExtra)saveCheck(value.held&&u.twoHands&&heldIds.every(id=>{const p=packages.get(id);return p.kind!=='shipping'&&p.zone===null&&p.origin?.type==='receiving'&&!p.orderId;}));
 saveCheck(value.achievements.values[37]===Number(u.twoHands));
 for(const id of value.queue){const o=orderMap.get(id),p=o&&packages.get(o.packageId);saveCheck(o&&o.status==='waiting'&&p.orderId===id&&(o.type==='shipping'?p.kind==='shipping'&&p.location==='customer':p.kind!=='shipping'&&['shelf','held'].includes(p.location)));}
 for(const o of orderMap.values())if(!value.queue.includes(o.id))saveCheck(o.status==='accepted'&&o.type==='shipping'&&packages.get(o.packageId).location==='held');
 if(value.courier){const q=value.courier;saveCheck(saveInt(q.id)&&q.id>0&&q.id<=value.courierSerial&&savePoint(q)&&saveFaces.includes(q.face)&&typeof q.carrying==='boolean'&&['arriving','waiting','unloading','leaving'].includes(q.stage)&&saveRoute(q.route)&&saveInt(q.next)&&q.next<=q.route.length&&saveFinite(q.unloadRemaining)&&q.unloadRemaining>=0&&q.unloadRemaining<=.6&&saveFinite(q.travel)&&q.travel>=0);}
 const game=Object.create(Shift.prototype);for(const key of savedFields)game[key]=structuredClone(value[key]);
 game.practice=false;game.packages=new Map([...packages].map(([id,p])=>[id,structuredClone(p)]));game.orders=[...orderMap.values()].map(o=>structuredClone(o));const restored=new Map(game.orders.map(o=>[o.id,o]));game.queue=value.queue.map(id=>restored.get(id));game.ledger=ledger;game.events=[];game.pausedPhase=null;game.selectionId=null;game.selectionIds=[];game.workerAvoid=null;return game;
}
function validateActor(a){saveCheck(a&&typeof a.id==='string'&&a.id.length<40&&savePoint(a)&&saveFaces.includes(a.face)&&saveFinite(a.travel)&&a.travel>=0&&typeof a.carrying==='boolean'&&saveInt(a.appearance)&&a.appearance<CUSTOMER_COUNT&&saveRoute(a.route)&&saveInt(a.next)&&a.next<=a.route.length&&typeof a.entered==='boolean');}
export function makeSave(profileId,game,view,settings={sound:true}){
 if(game.practice)throw new Error('練習不能覆蓋正式店舖進度。');
 const record={format:'parcel-parcel-parcel',schemaVersion:SAVE_SCHEMA,appVersion:'0.19.0',profileId,revision:0,savedAt:new Date().toISOString(),payload:{shift:encodeShift(game),view:structuredClone(view),settings:{sound:!!settings.sound}}};record.checksum=saveChecksum(record.payload);readSave(record);return record;
}
export function readSave(record){
 if(record?.schemaVersion>SAVE_SCHEMA)throw new Error('此存檔來自較新版本，請使用相容版本開啟。');
 saveCheck(record&&record.format==='parcel-parcel-parcel'&&[1,2,3,4,5,6,7,8,9,10,SAVE_SCHEMA].includes(record.schemaVersion)&&typeof record.profileId==='string'&&record.profileId.length>0&&record.profileId.length<100&&saveInt(record.revision)&&typeof record.savedAt==='string'&&Number.isFinite(Date.parse(record.savedAt))&&record.payload&&record.checksum===saveChecksum(record.payload));
 const payload=structuredClone(record.payload);if(record.schemaVersion===1){payload.shift.upgrades=initialUpgrades();payload.shift.upgrades.shelfLevels=Object.fromEntries(Object.keys(payload.shift.shelves||{}).map(z=>[z,0]));payload.shift.upgrades.workerZones=Object.keys(payload.shift.shelves||{});payload.shift.worker=null;payload.shift.managementFrom='closing';}
 if(record.schemaVersion<3){
  const old=payload.shift;saveCheck(saveFinite(old.remaining)&&old.remaining>=0&&old.remaining<=180&&saveFinite(old.elapsed)&&old.elapsed>=0);
  old.remaining=old.remaining*150/180;old.elapsed=old.elapsed*150/180;
  const c=old.courier;if(c&&c.stage!=='leaving'){c.route=[{x:c.x,y:c.y},{x:272,y:c.y},{x:272,y:112},{x:310,y:112}];c.next=1;c.stage='arriving';}
  const w=old.worker;if(w?.task&&!w.task.carrying){w.route=w.y<182?[{x:w.x,y:112},{x:310,y:112}]:[{x:270,y:w.y},{x:270,y:218},{x:310,y:218},{x:310,y:112}];w.next=0;}
  if(payload.view?.player&&savePoint(payload.view.player)&&payload.view.player.x>278&&payload.view.player.x<342&&payload.view.player.y>68&&payload.view.player.y<102&&!canStandInShop(payload.view.player.x,payload.view.player.y,old.shelves)){payload.view.player.x=310;payload.view.player.y=112;}
 }
 if(record.schemaVersion<4){const old=payload.shift;old.dayEvents=initialDayEvents(eventSeedFromText(record.profileId),old.day,true);if(['closing','stocking','dayend','upgrading'].includes(old.phase))previewNextEvent(old.dayEvents);}
 if(record.schemaVersion<5){const old=payload.shift;saveCheck(saveFinite(old.remaining)&&old.remaining>=0&&old.remaining<=150&&saveFinite(old.elapsed)&&old.elapsed>=0);old.remaining=old.remaining*120/150;old.elapsed=old.elapsed*120/150;if(record.schemaVersion===4)old.dayEvents.legacyDrawThroughDay=old.dayEvents.next?.day||old.day;}
 if(record.schemaVersion<7){const u=payload.shift.upgrades;u.workerAdvancedUnlocked=false;u.workerBookedTier='basic';if(payload.shift.worker)payload.shift.worker.tier='basic';}
 if(record.schemaVersion<8)payload.shift.upgrades.cargoManagement=false;
 if(record.schemaVersion<9){const old=payload.shift;const viewGame={...old,packages:new Map(old.packages.map(p=>[p.id,p])),ledger:Ledger.fromJSON(old.ledger)};old.achievements=migrateAchievements(viewGame);}
 if(record.schemaVersion<11){payload.shift.heldExtra=null;payload.shift.upgrades.twoHands=false;payload.shift.achievements.values[37]=0;payload.shift.achievements.unlocked[37]=[];}
 const {view,settings}=payload;saveCheck(view&&view.player&&savePoint(view.player)&&canStandInShop(view.player.x,view.player.y,payload.shift.shelves)&&saveFaces.includes(view.player.face)&&saveFinite(view.player.travel)&&view.player.travel>=0&&Array.isArray(view.actors)&&view.actors.length<=5&&Array.isArray(view.departures)&&view.departures.length<=50&&settings&&typeof settings.sound==='boolean');
 const game=decodeShift(payload.shift);view.actors.forEach(validateActor);view.departures.forEach(validateActor);saveCheck(new Set(view.actors.map(a=>a.id)).size===view.actors.length&&view.actors.length===game.queue.length&&view.actors.every(a=>game.queue.some(o=>o.id===a.id)));
 return{game,view:structuredClone(view),settings:structuredClone(settings)};
}
