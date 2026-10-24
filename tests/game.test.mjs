import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Shift,ZONES} from '../src/game.js';

function playing(options){const s=new Shift({shippingChance:0,...options});s.start();s.deliver();return s;}
function invariant(s){
 const seen=new Set();
 for(const [zone,slots] of [...Object.entries(s.shelves),['receiving',s.receiving]]){
  for(const [index,slot] of slots.entries()){
   assert.ok(!(slot.packageId&&slot.reservedFor));
   if(slot.packageId){const p=s.packages.get(slot.packageId);assert.ok(p);assert.ok(!seen.has(p.id));seen.add(p.id);
    assert.equal(p.location,zone==='receiving'?'receiving':'shelf');assert.equal(p.index,index);}
   if(slot.reservedFor){const p=s.packages.get(slot.reservedFor);assert.equal(p.location,'held');assert.equal(p.id,s.held);}
  }
 }
 const pending=s.orders.filter(o=>o.status==='waiting');
 assert.equal(new Set(pending.map(o=>o.packageId)).size,pending.length);
 for(const o of pending){const p=s.packages.get(o.packageId);assert.equal(p.orderId,o.id);assert.ok(['shelf','held'].includes(p.location));}
 for(const p of s.packages.values()){
  if(['shelf','receiving'].includes(p.location))assert.ok(seen.has(p.id));
  if(p.location==='held')assert.equal(p.id,s.held);
 }
}
test('correct delivery releases origin and pays once',()=>{
 const s=playing(),o=s.queue[0],p=s.packages.get(o.packageId),index=p.index;
 assert.equal(s.take(p.id).ok,true);assert.equal(s.shelves.A[index].reservedFor,p.id);invariant(s);
 assert.equal(s.deliver().ok,true);assert.equal(s.stats.completed,1);assert.equal(p.location,'delivered');
 assert.equal(s.shelves.A[index].reservedFor,null);const paid=s.stats.revenue;
 assert.equal(s.deliver().ok,false);assert.equal(s.stats.revenue,paid);invariant(s);
});
test('wrong parcel is retained and can be returned even when all other slots are full',()=>{
 const s=playing();const p=[...s.packages.values()].find(p=>p.location==='shelf'&&!p.orderId&&p.zone==='A');
 s.take(p.id);while(s.addPackage('A','shelf')){}
 const count=s.packages.size;
 assert.equal(s.deliver().ok,false);assert.equal(s.held,p.id);assert.equal(s.stats.errors,1);
 assert.equal(s.returnHeld().ok,true);assert.equal(s.packages.size,count);invariant(s);
});
test('receiving parcels have no zone and can be stocked in any chosen zone',()=>{
 const s=playing();const p=[...s.packages.values()].find(p=>p.location==='receiving');
 for(let i=0;i<10;i++)s.spawnCustomer();assert.ok(!s.queue.some(o=>o.packageId===p.id));
 assert.equal(p.zone,null);s.take(p.id);assert.equal(s.stock('B').ok,true);assert.equal(p.zone,'B');assert.equal(p.location,'shelf');assert.equal(s.stats.stocked,1);invariant(s);
});
test('expiry while parcel held clears reservation, then returning makes it requestable',()=>{
 const s=playing();const o=s.queue[0];s.take(o.packageId);o.patience=.01;s.tick(.1);
 const p=s.packages.get(o.packageId);assert.equal(o.status,'missed');assert.equal(p.orderId,null);
 assert.ok(!s.available().some(x=>x.id===p.id));assert.equal(s.returnHeld().ok,true);
 assert.ok(s.available().some(x=>x.id===p.id));invariant(s);
});
test('pause freezes countdown, patience and incoming work',()=>{
 const s=playing();s.pause();const before=JSON.stringify([s.remaining,s.queue,s.packages.size]);
 s.tick(60);assert.equal(JSON.stringify([s.remaining,s.queue,s.packages.size]),before);
 assert.equal(s.take(s.queue[0].packageId).ok,false);s.resume();s.tick(1);assert.equal(s.remaining,119);
});
test('queue and receiving capacity remain bounded and stock never double-books',()=>{
 const s=playing();s.addPackage('A','shelf');for(let i=0;i<100;i++)s.spawnCustomer();assert.equal(s.queue.length,5);
 for(let i=0;i<50;i++)s.addPackage('A','receiving');assert.equal(s.receiving.filter(x=>x.packageId).length,6);
 for(let i=0;i<179;i++){s.tick(1);assert.ok(s.queue.length<=5);assert.ok(s.receiving.filter(x=>x.packageId).length<=6);invariant(s);}
});
test('end freezes commands and stops additional penalties',()=>{
 const s=playing();s.take(s.queue[0].packageId);s.tick(180);assert.equal(s.phase,'closing');assert.equal(s.held,null);assert.equal(s.queue.length,0);
 const before=JSON.stringify(s.stats);assert.equal(s.deliver().ok,false);s.tick(500);assert.equal(JSON.stringify(s.stats),before);
});
test('practice supports complete delivery and stock loop without time pressure',()=>{
 const s=playing({practice:true});const p=s.packages.get(s.queue[0].packageId);
 s.tick(1000);assert.equal(s.remaining,120);assert.equal(s.queue[0].patience,60);
 s.take(p.id);s.deliver();const fresh=[...s.packages.values()].find(p=>p.location==='receiving');
 s.take(fresh.id);s.stock('B');assert.equal(s.stats.completed,1);assert.equal(s.stats.stocked,1);invariant(s);
});
test('new shift restores independent clean state',()=>{
 const first=playing();first.take(first.queue[0].packageId);first.deliver();
 const next=playing();assert.equal(next.stats.completed,0);assert.equal(next.held,null);
 assert.equal(next.queue[0].code,'4826');assert.equal(next.remaining,120);invariant(next);
});

test('each customer needs a first interaction before code reveal and delivery',()=>{
 const s=new Shift({shippingChance:0});s.start();const o=s.queue[0];assert.equal(o.revealed,false);
 s.take(o.packageId);const revenue=s.stats.revenue;
 assert.equal(s.deliver().ok,true);assert.equal(o.revealed,true);assert.equal(s.held,o.packageId);assert.equal(s.stats.revenue,revenue);
 assert.equal(s.deliver().ok,true);s.spawnCustomer();assert.equal(s.queue[0].revealed,false);invariant(s);
});
test('recorded shelf location follows relocation and is used by customer orders',()=>{
 const s=playing();const o=s.queue[0],p=s.packages.get(o.packageId);
 s.take(p.id);assert.equal(s.stock('B').ok,true);assert.equal(p.zone,'B');assert.equal(o.zone,'B');assert.equal(s.stats.stocked,0);
 s.take(p.id);s.deliver();assert.equal(o.status,'completed');invariant(s);
});
test('full destination preserves held parcel and reservation, including in stocking phase',()=>{
 const s=playing();while(s.addPackage('B','shelf')){}
 s.tick(180);s.beginStocking();const p=[...s.packages.values()].find(p=>p.location==='receiving');s.take(p.id);
 assert.equal(s.stock('B').ok,false);assert.equal(s.held,p.id);assert.equal(p.zone,null);
 assert.equal(s.returnHeld().ok,true);invariant(s);
});
test('stocking is untimed and paused stocking resumes to stocking',()=>{
 const s=playing();s.tick(180);s.beginStocking();assert.equal(s.phase,'stocking');
 const state=JSON.stringify([s.remaining,s.receiving,s.queue,s.stats]);s.tick(10000);
 assert.equal(JSON.stringify([s.remaining,s.receiving,s.queue,s.stats]),state);
 s.pause();assert.equal(s.take([...s.packages.values()][0].id).ok,false);s.resume();assert.equal(s.phase,'stocking');invariant(s);
});
test('last receiving parcel starts next day automatically and preserves chosen locations',()=>{
 const s=playing();s.take(s.queue[0].packageId);s.deliver();const earned=s.totalRevenue;
 s.tick(180);s.beginStocking();
 const fresh=[...s.packages.values()].filter(p=>p.location==='receiving');
 for(const [i,p] of fresh.entries()) {s.take(p.id);assert.equal(s.stock(ZONES[i%ZONES.length]).ok,true);}
 assert.equal(s.day,2);assert.equal(s.phase,'playing');assert.equal(s.remaining,120);assert.equal(s.totalRevenue,earned);
 for(const [i,p] of fresh.entries()){assert.equal(p.zone,ZONES[i%ZONES.length]);assert.equal(p.location,'shelf');}
 assert.equal(s.stats.revenue,0);assert.equal(s.queue[0].revealed,false);invariant(s);
});
test('manual next day safely returns held parcels and retains unstocked receiving goods',()=>{
 const s=playing();s.take(s.queue[0].packageId);s.tick(180);assert.equal(s.held,null);
 assert.ok([...s.packages.values()].every(p=>!p.orderId));s.beginStocking();
 const fresh=[...s.packages.values()].find(p=>p.location==='receiving');const count=s.receivingCount();s.take(fresh.id);
 assert.equal(s.nextDay(),true);assert.equal(s.day,2);assert.equal(s.held,null);assert.equal(fresh.location,'receiving');assert.equal(s.receivingCount(),count);
 assert.equal(s.nextDay(),false);invariant(s);
});
test('no receiving goods skips stocking to next day without reseeding shelves',()=>{
 const s=playing();for(const p of [...s.packages.values()].filter(p=>p.location==='receiving')){s.take(p.id);s.stock('A');if(s.held)s.stock('B');}
 assert.equal(s.receivingCount(),0);s.tick(180);const ids=[...s.packages.keys()];s.beginStocking();
 assert.equal(s.day,2);assert.equal(s.phase,'playing');assert.deepEqual([...s.packages.keys()],ids);invariant(s);
});

function shippingReady(){
 const s=playing({shippingChance:1});s.take(s.queue[0].packageId);s.deliver();
 const order=s.spawnCustomer({type:'shipping'});return {s,order,p:s.packages.get(order.packageId)};
}
test('shipping handover reserves a destination, leaves hands occupied and pays only on deposit',()=>{
 const {s,order,p}=shippingReady(),before=s.totalRevenue;
 assert.equal(s.deliver().ok,true);assert.equal(order.status,'accepted');assert.equal(s.held,p.id);
 assert.equal(s.totalRevenue,before);assert.equal(s.outbound[p.index].reservedFor,p.id);
 assert.equal(s.stock('A').ok,false);assert.equal(s.returnHeld().ok,false);assert.ok(!s.available().includes(p));
 assert.equal(s.storeShipping().ok,true);assert.equal(s.held,null);assert.equal(p.location,'outbound');
 assert.equal(order.status,'completed');assert.equal(s.stats.shipped,1);assert.equal(s.totalRevenue,before+12);
 assert.equal(s.storeShipping().ok,false);assert.equal(s.totalRevenue,before+12);
});
test('busy clerk does not steal sender parcel or its reserved slot',()=>{
 const {s,order,p}=shippingReady();const incoming=[...s.packages.values()].find(p=>p.location==='receiving');
 s.take(incoming.id);assert.equal(s.deliver().ok,false);assert.equal(p.location,'customer');
 assert.equal(s.held,incoming.id);assert.equal(order.status,'waiting');assert.equal(s.outbound[p.index].reservedFor,p.id);
 s.returnHeld();assert.equal(s.deliver().ok,true);assert.equal(s.held,p.id);
});
test('outbound capacity stays bounded and full capacity prevents another sender',()=>{
 const {s}=shippingReady();
 for(let i=0;i<6;i++){if(!s.queue.length)s.spawnCustomer({type:'shipping'});assert.equal(s.deliver().ok,true);assert.equal(s.storeShipping().ok,true);}
 assert.equal(s.outbound.filter(x=>x.packageId).length,6);assert.equal(s.spawnCustomer({type:'shipping'}),null);
 const paid=s.totalRevenue;s.closeDay();assert.equal(s.outbound.filter(x=>x.packageId).length,0);
 assert.equal(s.totalRevenue,paid);s.beginStocking();s.nextDay();assert.equal(s.totalRevenue,paid);
});
test('sender timeout and closing release only unaccepted reservations',()=>{
 const {s,order,p}=shippingReady();s.expire(order);assert.equal(p.location,'cancelled');assert.equal(s.outbound[p.index].reservedFor,null);
 const next=s.spawnCustomer({type:'shipping'}),np=s.packages.get(next.packageId);s.closeDay();
 assert.equal(np.location,'cancelled');assert.equal(s.outbound[np.index].reservedFor,null);
});
test('accepted shipping survives closing and must be deposited before empty-stock automatic next day',()=>{
 const {s,p}=shippingReady();
 for(const item of [...s.packages.values()].filter(p=>p.location==='receiving')){s.take(item.id);s.stock('A');if(s.held)s.stock('B');}
 s.deliver();const before=s.totalRevenue;s.closeDay();assert.equal(s.held,p.id);
 s.beginStocking();assert.equal(s.phase,'stocking');assert.equal(s.storeShipping().ok,true);
 assert.equal(s.day,2);assert.equal(p.location,'sent');assert.equal(s.totalRevenue,before+12);
});
test('manual next day retains accepted shipping and its reserved destination',()=>{
 const {s,p}=shippingReady();s.deliver();s.closeDay();s.beginStocking();assert.equal(s.nextDay(),true);
 assert.equal(s.held,p.id);assert.equal(s.outbound[p.index].reservedFor,p.id);assert.equal(s.storeShipping().ok,true);
});
test('courier is visible carrying before drop, adds parcels once, then leaves empty handed',()=>{
 const s=playing();const count=s.receivingCount();assert.equal(s.requestCourier(),true);assert.equal(s.requestCourier(),false);
 s.advanceCourier(6.9);assert.equal(s.receivingCount(),count);assert.equal(s.courier.carrying,true);
 s.advanceCourier(3);assert.equal(s.receivingCount(),count+2);assert.equal(s.courier.carrying,false);assert.equal(s.courier.stage,'leaving');
 s.advanceCourier(60);assert.equal(s.courier,null);assert.equal(s.receivingCount(),count+2);
});
test('full receiving makes courier wait with cargo and no inventory loss',()=>{
 const s=playing();while(s.addPackage(null,'receiving')){}s.requestCourier();s.advanceCourier(30);
 assert.equal(s.courier.stage,'waiting');assert.equal(s.courier.carrying,true);assert.equal(s.receivingCount(),6);
 for(let i=0;i<2;i++){const p=[...s.packages.values()].find(p=>p.location==='receiving');s.take(p.id);s.stock('A');}
 s.advanceCourier(1);assert.equal(s.receivingCount(),6);assert.equal(s.courier.carrying,false);invariant(s);
});
test('pause freezes courier travel as well as clock and orders',()=>{
 const s=playing();s.requestCourier();s.tick(1);s.pause();const before=JSON.stringify(s.courier);s.tick(90);
 assert.equal(JSON.stringify(s.courier),before);s.resume();s.tick(1);assert.notEqual(JSON.stringify(s.courier),before);
});
test('closing turns undelivered courier back without dropping cargo during stocking',()=>{
 const s=playing();s.requestCourier();s.advanceCourier(3);const count=s.receivingCount();s.closeDay();
 assert.equal(s.courier.stage,'leaving');assert.equal(s.courier.carrying,true);s.beginStocking();s.tick(60);
 assert.equal(s.courier,null);assert.equal(s.receivingCount(),count);
});
test('scheduled arrivals dispatch courier rather than materialize receiving parcels',()=>{
 const s=playing(),count=s.receivingCount();s.tick(25);assert.ok(s.courier);assert.equal(s.receivingCount(),count);
 s.tick(1);assert.equal(s.receivingCount(),count);s.tick(10);assert.equal(s.receivingCount(),count+2);
});

test('normal first arrival timer7 and subsequent midpoint interval7',()=>{const g=playing();assert.equal(g.customerTimer,7);g.random=()=>.5;g.customerTimer=.001;g.tick(.01);assert.equal(g.customerTimer,7);});
