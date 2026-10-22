export const ZONES = ['A', 'B', 'C'];
export const SHIFT_SECONDS = 180;
const slot = () => ({packageId: null, reservedFor: null});

export class Shift {
  constructor({practice = false, seed = 7} = {}) {
    this.practice = practice;
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
    this.stats = {completed: 0, errors: 0, missed: 0, stocked: 0, revenue: 0};
    this.events = [];
    for (const zone of ZONES) for (let i = 0; i < 2; i++) this.addPackage(zone, 'shelf');
    for (const zone of ZONES) this.addPackage(zone, 'receiving');
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
    if (this.phase !== 'closing') return false;
    this.phase = 'stocking'; this.emit('stocking');
    if (this.receivingCount() === 0) this.nextDay();
    return true;
  }
  nextDay() {
    if (this.phase !== 'stocking') return false;
    if (this.held && !this.returnHeld().ok) return false;
    this.day++; this.remaining = SHIFT_SECONDS; this.elapsed = 0;
    this.stats = {completed: 0, errors: 0, missed: 0, stocked: 0, revenue: 0};
    this.customerTimer = 10; this.deliveryTimer = 25; this.phase = 'playing';
    this.emit('daystart', {day: this.day}); this.spawnCustomer(); return true;
  }
  closeDay() {
    if (this.phase !== 'playing') return;
    if (this.held) this.returnHeld();
    for (const order of this.queue) {
      order.status = 'closed';
      const p = this.packages.get(order.packageId);
      if (p.orderId === order.id) p.orderId = null;
      this.emit('closed', {order: {...order}});
    }
    this.queue = []; this.phase = 'closing'; this.emit('end');
  }
  slots(origin) { return origin.type === 'shelf' ? this.shelves[origin.zone] : this.receiving; }
  addPackage(zone, location) {
    const slots = location === 'shelf' ? this.shelves[zone] : this.receiving;
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
  spawnCustomer() {
    if (this.phase !== 'playing' || this.queue.length >= 4) return null;
    const choices = this.available();
    if (!choices.length) return null;
    const pkg = this.orderSerial === 0 ? choices[0] : choices[Math.floor(this.random() * choices.length)];
    const serial = this.orderSerial++;
    const order = {id: `O${serial + 1}`, packageId: pkg.id, code: pkg.code, zone: pkg.zone,
      appearance: serial % 3, patience: serial === 0 ? 60 : 48 + Math.floor(this.random() * 10),
      maxPatience: serial === 0 ? 60 : 58, status: 'waiting', revealed: false};
    pkg.orderId = order.id;
    this.queue.push(order); this.orders.push(order);
    this.emit('customer', {order: {...order}});
    return order;
  }
  take(id) {
    if (!this.canWork()) return {ok: false, message: '班次已暫停或結束'};
    if (this.held) return {ok: false, message: '先交貨、上架或退回手上包裹'};
    const p = this.packages.get(id);
    if (!p || !['shelf', 'receiving'].includes(p.location)) return {ok: false, message: '這件貨物已不在原位'};
    const origin = {type: p.location, zone: p.zone, index: p.index};
    const s = this.slots(origin)[origin.index];
    if (s.packageId !== id) return {ok: false, message: '貨位資料不一致'};
    s.packageId = null; s.reservedFor = id;
    p.origin = origin; p.location = 'held'; p.index = null; this.held = id;
    this.emit('take', {packageId: id});
    return {ok: true, message: `已拿起 ${p.code}${p.zone ? ` · ${p.zone} 區` : ' · 自選 A／B／C 上架'}`};
  }
  freeOrigin(p) {
    if (!p.origin) return;
    const s = this.slots(p.origin)[p.origin.index];
    if (s.reservedFor === p.id) s.reservedFor = null;
  }
  returnHeld() {
    if (!this.canWork() || !this.held) return {ok: false, message: '手上沒有包裹'};
    const p = this.packages.get(this.held), origin = p.origin;
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
    if (!ZONES.includes(zone)) return {ok: false, message: '請選擇 A／B／C 貨架'};
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
    if (this.phase === 'stocking' && this.receivingCount() === 0) this.nextDay();
    return {ok: true, message: `${p.code} 已上架 · ${zone} 區`};
  }
  deliver() {
    if (this.phase !== 'playing') return {ok: false, message: '班次尚未開始或已結束'};
    const order = this.queue[0];
    if (!order) return {ok: false, message: '暫時沒有客人，趁空檔上架新貨'};
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
    this.emit('delivered', {order: {...order}, earned});
    return {ok: true, message: `交貨成功！+$${earned}`};
  }
  expire(order) {
    order.status = 'missed'; this.queue = this.queue.filter(o => o !== order);
    const p = this.packages.get(order.packageId);
    if (p.orderId === order.id) p.orderId = null;
    this.stats.missed++; this.emit('missed', {order: {...order}});
  }
  tick(dt) {
    if (this.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    this.elapsed += dt;
    if (this.practice) return;
    const activeTime = Math.min(dt, this.remaining);
    this.remaining = Math.max(0, this.remaining - activeTime);
    if (this.remaining === 0) {
      this.closeDay(); return;
    }
    for (const order of [...this.queue]) {
      order.patience -= activeTime;
      if (order.patience <= 0) this.expire(order);
    }
    this.customerTimer -= activeTime; this.deliveryTimer -= activeTime;
    if (this.customerTimer <= 0) { this.spawnCustomer(); this.customerTimer = 9 + this.random() * 5; }
    if (this.deliveryTimer <= 0) {
      let count = 0;
      for (let i = 0; i < 2; i++) {
        if (this.addPackage(null, 'receiving')) count++;
      }
      if (count) this.emit('arrival', {count});
      this.deliveryTimer = 25;
    }
  }
}
