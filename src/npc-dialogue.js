// Cosmetic-only speech: independent random stream, no game commands or save fields.
export const NPC_LINES=[
 ['G01','customer','我嚟拎件呀，唔該！','pickup'],['G02','customer','終於等到件貨喇！','pickup'],
 ['G03','customer','今日又買多咗少少……','waiting'],['G04','customer','睇吓今次個箱有幾大先。','pickup'],
 ['G05','customer','呢度近屋企，方便好多。','waiting'],['G06','customer','希望今次唔使砌好耐啦。','pickup'],
 ['G07','customer','拎完件，順便買餸先。','pickup'],['G08','customer','我個購物車又滿咗喇。','waiting'],
 ['G09','customer','呢件幫我寄出去呀。','shipping'],['G10','customer','唔急，慢慢搵。','patient'],
 ['G11','customer','唔該，幫我睇睇仲耐唔耐呀？','impatient'],['G12','customer','唔該晒，辛苦你喇！','thanks'],
 ['W01','worker','呢批貨我幫你上架。','stock'],['W02','worker','一件一件嚟，好快搞掂。','stock'],
 ['W03','worker','個箱有啲重，搬穩啲先。','carrying'],['W04','worker','你接客，我嚟理貨。','any'],
 ['W05','worker','擺齊啲，之後搵貨快啲。','stock'],['W06','worker','貨架就快滿，要睇睇空位。','almostFull'],
 ['W07','worker','呢邊冇位，我等一等先。','full'],['W08','worker','今日都幾多貨喎。','busy'],
 ['C01','courier','送貨到，唔該借借！','entering'],['C02','courier','今日呢批貨到咗喇。','entering'],
 ['C03','courier','我擺去收貨區先。','travelling'],['C04','courier','呢箱我搬穩啲先。','travelling'],
 ['C05','courier','收貨籠滿咗，我等一等先。','cageFull'],['C06','courier','等有位先放低。','cageFull'],
 ['C07','courier','呢批貨放低喇。','unloaded'],['C08','courier','呢批交畀你喇。','unloaded'],
 ['C09','courier','送完呢度，趕下一站先。','leaving'],['C10','courier','我行先，辛苦晒！','leaving'],
 ['C11','courier','今日啲貨一批接一批呀。','sale'],['C12','courier','落雨都要送，件貨幫你放穩。','weather']
].map(([id,role,text,condition])=>Object.freeze({id,role,text,condition}));
export function eligibleLines(s){
 const waiting=!s.departing,carrying=!!s.carrying;
 const conditions=s.role==='customer'?{
  waiting,pickup:waiting&&!s.shipping,shipping:waiting&&s.shipping,
  patient:waiting&&s.ratio>=.7,impatient:waiting&&s.ratio<=.3,thanks:s.departing&&s.success
 }:s.role==='worker'?{
  any:true,stock:s.hasStock&&s.freeShelf>0,carrying,almostFull:s.hasStock&&s.freeShelf>0&&s.freeShelf<=2,
  full:s.hasStock&&s.freeShelf===0&&s.idle,busy:s.hasStock&&s.event==='sale'
 }:{
  entering:carrying&&s.stage==='arriving'&&s.y<85,travelling:carrying&&s.stage==='arriving',
  cageFull:carrying&&s.stage==='waiting'&&s.freeReceiving<2,
  unloaded:!carrying&&s.stage==='leaving'&&s.nearReceiving,
  leaving:!carrying&&s.stage==='leaving',sale:carrying&&s.event==='sale',weather:carrying&&s.event==='weather'
 };
 return NPC_LINES.filter(l=>l.role===s.role&&conditions[l.condition]&&(!s.allowedLineIds||s.allowedLineIds.includes(l.id)));
}
export class NpcSpeech{
 constructor(seed=1){this.reset(seed);}
 reset(seed=1){this.seed=(seed^0x61c88647)>>>0;this.time=0;this.cooldowns=new Map();this.lastLine=new Map();this.active=null;this.next=12+this.random()*8;}
 random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 tick(dt,speakers,enabled){
  if(!enabled)return null;
  this.time+=Math.max(0,dt);
  if(this.active){const s=speakers.find(s=>s.id===this.active.speakerId);if(!s||this.time>=this.active.until||!eligibleLines(s).some(l=>l.id===this.active.id))this.active=null;}
  if(this.time>=this.next){
   this.next=this.time+12+this.random()*8;
   if(!this.active){
    const candidates=speakers.map(s=>({s,lines:eligibleLines(s)})).filter(c=>c.lines.length&&this.time-(this.cooldowns.get(c.s.id)??-Infinity)>=30);
    if(candidates.length){const {s,lines}=candidates[Math.floor(this.random()*candidates.length)];const fresh=lines.filter(l=>l.id!==this.lastLine.get(s.id));const pool=fresh.length?fresh:lines;const line=pool[Math.floor(this.random()*pool.length)];this.active={...line,speakerId:s.id,until:this.time+2.5};this.cooldowns.set(s.id,this.time);this.lastLine.set(s.id,line.id);}
   }
  }
  const ids=new Set(speakers.map(s=>s.id));for(const id of this.cooldowns.keys())if(!ids.has(id)&&this.time-this.cooldowns.get(id)>=60){this.cooldowns.delete(id);this.lastLine.delete(id);}
  return this.active;
 }
}
export const rectOverlaps=(a,b)=>a.x<b.x+b.w+2&&a.x+a.w+2>b.x&&a.y<b.y+b.h+2&&a.y+a.h+2>b.y;
export function placeSpeech(actor,size,view,obstacles){
 const [w,h]=size;if(w+12>view.w||h+12>view.h)return null;
 const options=[[actor.x-w/2,actor.y-50-h],[actor.x-20-w,actor.y-44],[actor.x+20,actor.y-44],[actor.x-w/2,actor.y+8],[actor.x-20-w,actor.y-12],[actor.x+20,actor.y-12]];
 for(const [x,y]of options){const r={x:Math.round(Math.max(view.x+6,Math.min(view.x+view.w-w-6,x))),y:Math.round(Math.max(view.y+6,Math.min(view.y+view.h-h-6,y))),w,h};if(!obstacles.some(o=>rectOverlaps(r,o)))return r;}
 return null;
}
