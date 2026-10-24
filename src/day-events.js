// Event weights are normalized after eligibility filtering. No game RNG is consumed.
export const DAY_EVENTS=Object.freeze({
 normal:Object.freeze({id:'normal',name:'平常一天',story:'街坊照常到店',mode:'營業中',pickup:1,shipping:1,delivery:1,patience:1,weight:70,busy:false}),
 sale:Object.freeze({id:'sale',name:'購買網優惠',story:'淘淘網年度大優惠，集運訂單創高峰',mode:'優惠高峰',pickup:1.5,shipping:1.5,delivery:1.6,patience:.6,weight:20,busy:true}),
 weather:Object.freeze({id:'weather',name:'惡劣天氣',story:'惡劣天氣影響集運物流',mode:'惡劣天氣',pickup:1,shipping:1,delivery:.6,patience:1,weight:5,busy:false}),
 returns:Object.freeze({id:'returns',name:'退貨潮',story:'大型網購品牌爆出次貨醜聞，大量回收產品',mode:'退貨潮',pickup:1,shipping:1.5,delivery:1,patience:.8,weight:5,busy:true})
});
export function eventSeedFromText(text){let n=2166136261;for(const c of String(text))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
export function eventCandidates(day,history=[]){
 const tired=history.slice(-2).length===2&&history.slice(-2).every(e=>DAY_EVENTS[e.id]?.busy);
 return Object.values(DAY_EVENTS).filter(e=>(day>=4||e.id!=='sale')&&(!tired||!e.busy));
}
export function chooseLegacyDayEvent(seed,day,history=[]){
 if(day===1)return{id:'normal',day};
 let n=(seed^Math.imul(day,0x9e3779b1))>>>0;n=Math.imul(n^(n>>>16),0x85ebca6b);n=Math.imul(n^(n>>>13),0xc2b2ae35);n=(n^(n>>>16))>>>0;
 const candidates=eventCandidates(day,history),total=candidates.reduce((s,e)=>s+e.weight,0);let pick=n/4294967296*total;
 for(const e of candidates){pick-=e.weight;if(pick<0)return{id:e.id,day};}return{id:candidates.at(-1).id,day};
}
export function chooseDayEvent(seed,day,history=[]){
 if(day===1)return{id:'normal',day};
 // Separate deterministic draws for the 50/50 gate and the uniform other pool.
 const draw=salt=>{let n=(seed^Math.imul(day,0x9e3779b1)^salt)>>>0;n=Math.imul(n^(n>>>16),0x85ebca6b);n=Math.imul(n^(n>>>13),0xc2b2ae35);return((n^(n>>>16))>>>0)/4294967296;};
 if(draw(0x51ed270b)<.5)return{id:'normal',day};
 const others=eventCandidates(day,history).filter(e=>e.id!=='normal');
 return{id:others.length?others[Math.floor(draw(0xa3c59ac3)*others.length)].id:'normal',day};
}
const stateEvent=(s,day,history)=>day<=s.legacyDrawThroughDay?chooseLegacyDayEvent(s.seed,day,history):chooseDayEvent(s.seed,day,history);
export function initialDayEvents(seed,day=1,legacy=false){return{seed:seed>>>0,legacyThroughDay:legacy?day:0,legacyDrawThroughDay:0,current:{id:'normal',day},next:null,history:[],drawDay:day};}
export function previewNextEvent(state){
 if(!state.next){state.next=stateEvent(state,state.current.day+1,[...state.history,state.current].slice(-2));state.drawDay=state.next.day;}
 return state.next;
}
export function advanceDayEvent(state){
 const next=previewNextEvent(state);state.history=[...state.history,state.current].slice(-2);state.current=next;state.next=null;state.drawDay=next.day;
}
export function customerEventRates(event,chance){
 const total=(1-chance)*event.pickup+chance*event.shipping;
 return{total,shippingChance:total?chance*event.shipping/total:chance};
}
const eventPercent=n=>n===1?'不變':`${n>1?'+':'−'}${Math.round(Math.abs(n-1)*100)}%`;
export function dayEventSummary(event){return `${event.pickup===event.shipping?`客量 ${eventPercent(event.pickup)}`:`提貨客 ${eventPercent(event.pickup)} · 寄貨客 ${eventPercent(event.shipping)}`} · 收貨頻率 ${eventPercent(event.delivery)} · 客人耐性 ${eventPercent(event.patience)}`;}
export function validDayEvents(s,day,phase){
 const uint=n=>Number.isSafeInteger(n)&&n>=0&&n<=4294967295;
 const record=e=>e&&DAY_EVENTS[e.id]&&Number.isSafeInteger(e.day)&&e.day>=1&&e.day<=1000001&&(e.day!==1||e.id==='normal')&&(e.id!=='sale'||e.day>=4);
 if(!s||!uint(s.seed)||!Number.isSafeInteger(s.legacyDrawThroughDay)||s.legacyDrawThroughDay<0||s.legacyDrawThroughDay>day+1||!Number.isSafeInteger(s.legacyThroughDay)||s.legacyThroughDay<0||s.legacyThroughDay>day||!record(s.current)||s.current.day!==day||!Array.isArray(s.history)||s.history.length>2)return false;
 if(s.history.length!==Math.min(2,day-Math.max(1,s.legacyThroughDay)))return false;
 if(!s.history.every((e,i)=>record(e)&&e.day===day-s.history.length+i))return false;
 if(day<=s.legacyThroughDay&&s.current.id!=='normal')return false;
 if(day>s.legacyThroughDay&&s.current.id!==stateEvent(s,day,s.history).id)return false;
 const closed=['closing','stocking','dayend','upgrading'].includes(phase);
 if(closed&&!s.next||s.next&&(!record(s.next)||s.next.day!==day+1||s.next.id!==stateEvent(s,day+1,[...s.history,s.current].slice(-2)).id))return false;
 return s.drawDay===(s.next?day+1:day);
}
