import {COURIER_ROUTE,shopLayout} from './layout.js';
import {initialUpgrades,upgradeOptions} from './upgrades.js';
import {DAY_EVENTS,initialDayEvents,previewNextEvent,advanceDayEvent,customerEventRates} from './day-events.js';
import {Ledger} from './finance.js';
export const ZONES = ['A', 'B'];
export const SHIFT_SECONDS = 150;
const slot = () => ({packageId: null, reservedFor: null});

export class Shift {
  constructor({practice = false, seed = 7, shippingChance = .2, deferDayStart = false, eventSeed = seed} = {}) {
    this.practice = practice;
    this.deferDayStart=deferDayStart;this.ledger=new Ledger();this.upgrades=initialUpgrades();this.worker=null;this.selectionId=null;this.managementFrom='closing';
    this.shippingChance = shippingChance;this.dayEvents=initialDayEvents(eventSeed);
    this.outbound = Array.from({length:6}, slot);
    this.courier = null;
    this.courierSerial = 0;
    this.seed = seed;
    this.phase = 'ready';
    this.day = 1;
    this.totalRevenue = 0;
    this.pausedPhase = null;
    this.remaining = SHIFT_SECONDS;
    this.elapsed = 0;
    this.shelves = Object.fromEntries(ZONES.map(zone => [zone, Array.from({length: 4}, slot)]));
    this.receiving = Array.from({length: 6}, slot);
    this.packages = new Map();
    this.queue = [];
    this.orders = [];
    this.held = null;
    this.serial = 0;
    this.orderSerial = 0;
    this.customerTimer = 10;
    this.deliveryTimer = 25;
    this.stats = {completed: 0, errors: 0, missed: 0, stocked: 0, revenue: 0, shipped: 0};
    this.events = [];
    for (const zone of ZONES) for (let i = 0; i < 2; i++) this.addPackage(zone, 'shelf');
    for (let i=0;i<3;i++) this.addPackage(null, 'receiving');
  }
  currentEvent(){return this.practice?DAY_EVENTS.normal:DAY_EVENTS[this.dayEvents.current.id];}
  customerRates(){return customerEventRates(this.currentEvent(),this.shippingChance);}
  previewTomorrow(){return this.practice?{id:'normal',day:this.day+1}:previewNextEvent(this.dayEvents);}
  moveSpeed(){return this.upgrades.shoeThroughDay>=this.day?88:80;}
  reservedWages(){return this.upgrades.workerBookedDay?60:0;}
  availableFunds(){return this.ledger.balance-this.reservedWages();}
  canUpgrade(){return !this.practice&&(this.phase==='closing'||this.phase==='stocking'||this.phase==='upgrading');}
  purchaseUpgrade(id){
    if(!this.canUpgrade())return{ok:false,message:'只可在關店後升級'};
    const item=upgradeOptions(this).find(i=>i.id===id);
    if(!item||item.blocked)return{ok:false,message:item?.blocked||'此升級未開放'};
    if(this.availableFunds()<item.price)return{ok:false,message:'可用資金不足（已扣除預留薪金）'};
    if(id==='worker'){this.upgrades.workerBookedDay=this.day+1;return{ok:true,message:'已預留明日薪金 $60，開門時扣款一次'};}
    const level=id.startsWith('shelf:')?this.upgrades.shelfLevels[id.slice(-1)]:this.upgrades[id+'Level'];
    const tx=id==='shoes'?`upgrade:shoes:${this.day}`:`upgrade:${id}:${level===undefined?'new':level+1}`;
    const ledger=Ledger.fromJSON(this.ledger.toJSON());
    if(!ledger.post(tx,'investment',item.price,id,true,item.name))return{ok:false,message:'這項購買已處理，沒有再次扣款'};
    this.ledger=ledger;
    if(id==='shoes')this.upgrades.shoeThroughDay=this.day+3;
    else if(id.startsWith('shelf:')){const z=id.slice(-1);if(!this.shelves[z]){this.upgrades.shelfLevels[z]=0;this.shelves[z]=Array.from({length:4},slot);}else{this.upgrades.shelfLevels[z]++;this.shelves[z].push(slot(),slot());}}
    else{this.upgrades[id+'Level']++;this[id].push(slot(),slot());}
    this.emit('upgrade',{id});return{ok:true,message:'已購買，本頁生效；開下一天前保存'};
  }
  cancelWorkerBooking(){if(!this.canUpgrade())return false;this.upgrades.workerBookedDay=0;return true;}
  setWorkerZones(zones){
    if(!this.canUpgrade()||!Array.isArray(zones)||!zones.length||new Set(zones).size!==zones.length||zones.some(z=>!this.shelves[z]))return false;
    this.upgrades.workerZones=[...zones];return true;
  }
  beginWorkerDay(){
    this.worker=null;
    if(this.upgrades.workerBookedDay!==this.day)return;
    if(!this.ledger.post(`salary:${this.day}`,'operating',60,'worker',false,'理貨店員薪金'))throw new Error('預留薪金不足，未開門');
    this.upgrades.workerBookedDay=0;
    this.worker={x:250,y:218,face:'down',moving:false,travel:0,route:[],next:0,task:null};
  }
  returnWorkerCargo(){
    const task=this.worker?.task;if(!task)return;
    const p=this.packages.get(task.packageId),dest=this.shelves[task.zone][task.index];
    if(dest.reservedFor===p.id)dest.reservedFor=null;
    if(task.carrying){const origin=this.receiving[task.originIndex];origin.packageId=p.id;origin.reservedFor=null;p.location='receiving';p.index=task.originIndex;p.origin=null;}
    this.worker.task=null;
  }
  advanceWorker(dt){
    const w=this.worker;if(!w||this.phase!=='playing')return;
    if(this.workerAvoid&&Math.hypot(w.x-this.workerAvoid.x,w.y-this.workerAvoid.y)<24){w.moving=false;return;}
    if(!w.task){
      const p=[...this.packages.values()].find(p=>p.location==='receiving'&&p.id!==this.selectionId);
      const zone=this.upgrades.workerZones.find(z=>this.shelves[z]?.some(s=>!s.packageId&&!s.reservedFor));
      if(!p||!zone){w.moving=false;return;}
      const index=this.shelves[zone].findIndex(s=>!s.packageId&&!s.reservedFor);
      w.task={packageId:p.id,zone,index,originIndex:p.index,carrying:false};this.shelves[zone][index].reservedFor=p.id;
      w.route=[{x:270,y:w.y},{x:270,y:218},{x:310,y:218},{x:310,y:112}];w.next=0;
    }
    let remaining=Math.min(dt,180);
    while(remaining>0&&w.task){
      const t=w.route[w.next];
      if(t){const dx=t.x-w.x,dy=t.y-w.y,d=Math.hypot(dx,dy);if(d<.001){w.next++;continue;}
        w.face=Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'up':'down');w.moving=true;
        const step=Math.min(d,remaining*64);w.x+=dx/d*step;w.y+=dy/d*step;w.travel+=step;remaining-=step/64;if(step>=d-.001)w.next++;continue;}
      const task=w.task,p=this.packages.get(task.packageId);
      if(!task.carrying){
        const origin=this.receiving[task.originIndex];if(origin.packageId!==p.id){this.returnWorkerCargo();return;}
        origin.packageId=null;origin.reservedFor=p.id;p.location='worker';p.index=null;p.origin={type:'receiving',zone:null,index:task.originIndex};task.carrying=true;
        const target=shopLayout(this.shelves).targets.find(t=>t.id===task.zone);
        w.route=[{x:310,y:112},{x:310,y:218},{x:270,y:218},{x:270,y:target.y},{x:target.x,y:target.y}];w.next=0;
      }else{
        const dest=this.shelves[task.zone][task.index];if(dest.packageId||dest.reservedFor!==p.id){this.returnWorkerCargo();return;}
        this.receiving[task.originIndex].reservedFor=null;dest.reservedFor=null;dest.packageId=p.id;p.location='shelf';p.zone=task.zone;p.index=task.index;p.origin=null;
        this.stats.stocked++;w.task=null;w.moving=false;this.emit('workerStock',{packageId:p.id});
      }
    }
  }
  random() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  emit(type, detail = {}) { this.events.push({type, ...detail}); }
  drainEvents() { return this.events.splice(0); }
  start() {
    if (this.phase !== 'ready') return false;
    this.phase = 'playing'; this.spawnCustomer(); return true;
  }
  pause() { if (this.canWork()) { this.pausedPhase = this.phase; this.phase = 'paused'; return true; } return false; }
  resume() { if (this.phase === 'paused') { this.phase = this.pausedPhase || 'playing'; this.pausedPhase = null; return true; } return false; }
  canWork() { return this.phase === 'playing' || this.phase === 'stocking'; }
  receivingCount() { return this.receiving.filter(s => s.packageId || s.reservedFor).length; }
  beginStocking() {
    if (!['closing','upgrading'].includes(this.phase)) return false;
    this.phase = 'stocking'; this.emit('stocking');
    if (this.receivingCount() === 0 && !this.isHoldingShipping()) this.nextDay();
    return true;
  }
  nextDay() {
    if (this.phase !== 'stocking') return false;
    if (this.held && !this.isHoldingShipping() && !this.returnHeld().ok) return false;
    this.forwardOutbound();
    this.ledger.seal(this.stats);
    if(this.deferDayStart){this.phase='dayend';this.emit('checkpoint');return true;}
    return this.openNextDay();
  }
  openNextDay(){
    if(!['stocking','dayend'].includes(this.phase))return false;
    this.ledger.seal(this.stats);this.ledger.openDay(this.day+1);
    this.day++;if(this.practice)this.dayEvents=initialDayEvents(this.dayEvents.seed,this.day,true);else advanceDayEvent(this.dayEvents); this.beginWorkerDay(); this.remaining = SHIFT_SECONDS; this.elapsed = 0;
    this.stats = {completed: 0, errors: 0, missed: 0, stocked: 0, revenue: 0, shipped: 0};
    this.customerTimer = 10/this.customerRates().total; this.deliveryTimer = 25/this.currentEvent().delivery; this.phase = 'playing';
    this.emit('daystart', {day: this.day}); this.spawnCustomer(); return true;
  }
  closeDay() {
    if (this.phase !== 'playing') return;
    this.returnWorkerCargo();this.worker=null;
    if (this.held && !this.isHoldingShipping()) this.returnHeld();
    this.forwardOutbound();
    if (this.courier && this.courier.stage !== 'leaving') this.turnCourierAround();
    for (const order of this.queue) {
      order.status = 'closed';
      const p = this.packages.get(order.packageId);
      if (p.orderId === order.id) p.orderId = null;
      if (order.type === 'shipping') this.cancelShipping(p);
      this.emit('closed', {order: {...order}});
    }
    this.queue = []; this.phase = 'closing';this.previewTomorrow(); this.emit('end');
  }
  slots(origin) { return origin.type === 'shelf' ? this.shelves[origin.zone] : origin.type === 'outbound' ? this.outbound : this.receiving; }
  isHoldingShipping() { return this.held && this.packages.get(this.held).kind === 'shipping'; }
  forwardOutbound() {
    for (const s of this.outbound) if (s.packageId) {
      this.packages.get(s.packageId).location = 'sent'; s.packageId = null;
    }
  }
  cancelShipping(p) {
    const s = this.outbound[p.index];
    if (s?.reservedFor === p.id) s.reservedFor = null;
    p.location = 'cancelled'; p.orderId = null;
  }
  addPackage(zone, location) {
    const slots = location === 'shelf' ? this.shelves[zone] : this.receiving;
    if(!slots)return null;
    const index = slots.findIndex(s => !s.packageId && !s.reservedFor);
    if (index < 0) return null;
    const serial = this.serial++;
    const pkg = {id: `P${serial + 1}`, code: String(4826 + serial * 37).padStart(4, '0'), zone: location === 'shelf' ? zone : null,
      location, index, orderId: null, origin: null};
    slots[index].packageId = pkg.id;
    this.packages.set(pkg.id, pkg);
    return pkg;
  }
  available(zone = null) {
    return [...this.packages.values()].filter(p => p.location === 'shelf' && !p.orderId && (!zone || p.zone === zone));
  }
  spawnCustomer({type = null} = {}) {
    if (this.phase !== 'playing' || this.queue.length >= 4) return null;
    const free = this.outbound.findIndex(s => !s.packageId && !s.reservedFor);
    let shipping = type === 'shipping' || (!type && !this.practice && this.orderSerial > 0 && this.random() < this.customerRates().shippingChance);
    if (shipping && free < 0) { if (type) return null; shipping = false; }
    const choices = this.available();
    if (!shipping && !choices.length) return null;
    const serial = this.orderSerial++;
    let pkg;
    if (shipping) {
      const id = `S${++this.serial}`;
      pkg = {id,kind:'shipping',code:id,zone:null,location:'customer',index:free,orderId:null,origin:null};
      this.packages.set(id,pkg); this.outbound[free].reservedFor = id;
    } else pkg = serial === 0 ? choices[0] : choices[Math.floor(this.random() * choices.length)];
    const basePatience=serial===0?60:48+Math.floor(this.random()*10),patienceFactor=this.currentEvent().patience;
    const order = {id:`O${serial+1}`,type:shipping?'shipping':'pickup',packageId:pkg.id,code:pkg.code,zone:pkg.zone,
      appearance:serial%3,patience:basePatience*patienceFactor,maxPatience:(serial===0?60:58)*patienceFactor,
      status:'waiting',revealed:false};
    pkg.orderId=order.id; this.queue.push(order); this.orders.push(order);
    this.emit('customer',{order:{...order}}); return order;
  }
  acceptShipping(order) {
    order.revealed = true;
    if (this.held) return {ok:false,message:'先完成手上貨物，再接收寄貨'};
    const p = this.packages.get(order.packageId);
    if (this.outbound[p.index].reservedFor !== p.id) return {ok:false,message:'寄貨位已不可用'};
    p.location='held'; p.origin={type:'outbound',zone:null,index:p.index}; p.orderId=null; this.held=p.id;
    order.status='accepted'; this.queue.shift(); this.emit('shippingAccepted',{order:{...order}});
    return {ok:true,message:'已接收寄貨，請放到紫色寄貨區'};
  }
  storeShipping() {
    if (!this.canWork() || !this.isHoldingShipping()) return {ok:false,message:'手上沒有待寄貨物'};
    const p=this.packages.get(this.held),index=p.origin.index,s=this.outbound[index];
    if (s.packageId || s.reservedFor!==p.id) return {ok:false,message:'寄貨位暫時不可用'};
    s.packageId=p.id; s.reservedFor=null; p.location='outbound'; p.index=index; p.origin=null; this.held=null;
    const order=this.orders.find(o=>o.packageId===p.id);if(order)order.status='completed';
    const earned=12; this.stats.shipped++; this.stats.revenue+=earned; this.totalRevenue+=earned;
    if(!this.practice)this.ledger.service(order.id,0,0,earned,this.phase==='stocking',p.code);
    this.emit('shipped',{packageId:p.id,earned});
    if(this.phase==='stocking' && this.receivingCount()===0) this.nextDay();
    return {ok:true,message:'寄貨入庫成功'};
  }
  take(id) {
    if (!this.canWork()) return {ok: false, message: '班次已暫停或結束'};
    if (this.held) return {ok: false, message: '先交貨、上架或退回手上包裹'};
    const p = this.packages.get(id);
    if(this.worker?.task?.packageId===id)return{ok:false,message:'理貨店員已預留此件，請選其他貨物'};
    if (!p || !['shelf', 'receiving'].includes(p.location)) return {ok: false, message: '這件貨物已不在原位'};
    const origin = {type: p.location, zone: p.zone, index: p.index};
    const s = this.slots(origin)[origin.index];
    if (s.packageId !== id) return {ok: false, message: '貨位資料不一致'};
    s.packageId = null; s.reservedFor = id;
    p.origin = origin; p.location = 'held'; p.index = null; this.held = id;
    this.emit('take', {packageId: id});
    return {ok: true, message: `已拿起 ${p.code}${p.zone ? ` · ${p.zone} 區` : ' · 自選已開放貨架上架'}`};
  }
  freeOrigin(p) {
    if (!p.origin) return;
    const s = this.slots(p.origin)[p.origin.index];
    if (s.reservedFor === p.id) s.reservedFor = null;
  }
  returnHeld() {
    if (!this.canWork() || !this.held) return {ok: false, message: '手上沒有包裹'};
    const p = this.packages.get(this.held), origin = p.origin;
    if (p.kind === 'shipping') return {ok:false,message:'寄貨只能放到紫色寄貨區'};
    if (!origin) return {ok: false, message: '沒有可退回的位置'};
    const s = this.slots(origin)[origin.index];
    if (s.packageId || s.reservedFor !== p.id) return {ok: false, message: '原位暫時不可用'};
    s.packageId = p.id; s.reservedFor = null;
    p.location = origin.type; p.index = origin.index; p.origin = null; this.held = null;
    this.emit('return', {packageId: p.id});
    return {ok: true, message: `已退回 ${p.code}`};
  }
  stock(zone) {
    if (!this.canWork() || !this.held) return {ok: false, message: '先從收貨區拿起包裹'};
    const p = this.packages.get(this.held);
    if (p.kind === 'shipping') return {ok:false,message:'寄貨不能放上貨架'};
    if (!this.shelves[zone]) return {ok: false, message: '請選擇已開放貨架'};
    if (p.origin.type === 'shelf' && p.origin.zone === zone) return this.returnHeld();
    const index = this.shelves[zone].findIndex(s => !s.packageId && !s.reservedFor);
    if (index < 0) return {ok: false, message: `${zone} 區已滿，請選其他貨架${this.phase === 'stocking' ? '，或提早開下一天' : '，或先交貨騰出空位'}`};
    const fresh = p.origin.type === 'receiving';
    this.freeOrigin(p); this.shelves[zone][index].packageId = p.id;
    p.location = 'shelf'; p.zone = zone; p.index = index;
    const order = this.queue.find(o => o.packageId === p.id);
    if (order) order.zone = zone;
    p.origin = null; this.held = null;
    if (fresh) this.stats.stocked++;
    this.emit('stock', {packageId: p.id});
    if (this.phase === 'stocking' && this.receivingCount() === 0 && !this.isHoldingShipping()) this.nextDay();
    return {ok: true, message: `${p.code} 已上架 · ${zone} 區`};
  }
  deliver() {
    if (this.phase !== 'playing') return {ok: false, message: '班次尚未開始或已結束'};
    const order = this.queue[0];
    if (!order) return {ok: false, message: '暫時沒有客人，趁空檔上架新貨'};
    if (order.type === 'shipping') return this.acceptShipping(order);
    if (!order.revealed) {
      order.revealed = true;
      order.zone = this.packages.get(order.packageId).zone;
      this.emit('greet', {order: {...order}});
      return {ok: true, message: `客人要 ${order.code}，已記錄在 ${order.zone} 區貨架`};
    }
    if (!this.held) return {ok: false, message: `客人要 ${order.code}，先到 ${order.zone} 區找貨`};
    const p = this.packages.get(this.held);
    if (order.packageId !== p.id) {
      this.stats.errors++; if (!this.practice) order.patience = Math.max(0, order.patience - 4);
      this.emit('wrong'); return {ok: false, message: `唔係呢件！要 ${order.code}，手上係 ${p.code}`};
    }
    if (order.patience <= 0 || order.status !== 'waiting') return {ok: false, message: '客人已離開，請退回貨物'};
    this.freeOrigin(p); p.location = 'delivered'; p.orderId = null; p.origin = null;
    this.held = null; order.status = 'completed'; this.queue.shift();
    const earned = 10 + Math.min(5, Math.floor(order.patience / 10));
    this.stats.completed++; this.stats.revenue += earned; this.totalRevenue += earned;
    if(!this.practice)this.ledger.service(order.id,10,earned-10,0,false,order.code);
    this.emit('delivered', {order: {...order}, earned});
    return {ok: true, message: `交貨成功！+$${earned}`};
  }
  expire(order) {
    order.status = 'missed'; this.queue = this.queue.filter(o => o !== order);
    const p = this.packages.get(order.packageId);
    if (p.orderId === order.id) p.orderId = null;
    if (order.type === 'shipping') this.cancelShipping(p);
    this.stats.missed++; this.emit('missed', {order: {...order}});
  }
  requestCourier() {
    if (this.phase!=='playing' || this.practice || this.courier) return false;
    this.courier={id:++this.courierSerial,x:COURIER_ROUTE[0].x,y:COURIER_ROUTE[0].y,
      stage:'arriving',carrying:true,face:'down',moving:true,travel:0,route:COURIER_ROUTE.map(p=>({...p})),next:1,unloadRemaining:.6};
    return true;
  }
  turnCourierAround() {
    const c=this.courier;
    // Return via the visited part of the public route, never through the divider.
    c.route=[{x:c.x,y:c.y},...COURIER_ROUTE.slice(0,Math.min(c.next,COURIER_ROUTE.length)).reverse().map(p=>({...p}))];
    c.next=1;c.stage='leaving';c.moving=true;
  }
  advanceCourier(dt) {
    let remaining=dt;
    while(this.courier && remaining>0){
      const c=this.courier;
      if(c.stage==='waiting'||c.stage==='unloading'){
        c.moving=false;c.face='up';
        const capacity=this.receiving.filter(s=>!s.packageId&&!s.reservedFor).length;
        if(capacity<2){c.stage='waiting';return;}
        c.stage='unloading';const used=Math.min(remaining,c.unloadRemaining);c.unloadRemaining-=used;remaining-=used;
        if(c.unloadRemaining>0)return;
        let count=0;for(let i=0;i<2;i++)if(this.addPackage(null,'receiving'))count++;
        c.carrying=false;this.emit('arrival',{count,courierId:c.id});this.turnCourierAround();continue;
      }
      const target=c.route[c.next];
      if(!target){
        if(c.stage==='leaving'){this.courier=null;return;}
        c.stage='waiting';continue;
      }
      const dx=target.x-c.x,dy=target.y-c.y,d=Math.hypot(dx,dy);
      if(d<.001){c.next++;continue;}
      c.moving=true;c.face=Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'up':'down');
      const step=Math.min(d,remaining*54);c.x+=dx/d*step;c.y+=dy/d*step;c.travel+=step;remaining-=step/54;
      if(step>=d-.001)c.next++;
    }
  }
  tick(dt) {
    if (!this.canWork() || !Number.isFinite(dt) || dt<=0) return;
    if(this.phase==='stocking'){this.advanceCourier(dt);return;}
    this.elapsed+=dt;if(this.practice)return;
    const activeTime=Math.min(dt,this.remaining);
    this.advanceCourier(activeTime);this.advanceWorker(activeTime);this.remaining=Math.max(0,this.remaining-activeTime);
    if(this.remaining===0){this.closeDay();return;}
    for(const order of [...this.queue]){order.patience-=activeTime;if(order.patience<=0)this.expire(order);}
    this.customerTimer-=activeTime;this.deliveryTimer-=activeTime;
    if(this.customerTimer<=0){this.spawnCustomer();this.customerTimer=(9+this.random()*5)/this.customerRates().total;}
    if(this.deliveryTimer<=0){this.requestCourier();this.deliveryTimer=25/this.currentEvent().delivery;}
  }
}
