import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Shift,ZONES} from '../src/game.js';

function playing(options){const s=new Shift(options);s.start();return s;}
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
test('receiving parcels are not requested until stocked and wrong-zone attempt preserves state',()=>{
 const s=playing();const p=[...s.packages.values()].find(p=>p.location==='receiving');
 for(let i=0;i<10;i++)s.spawnCustomer();assert.ok(!s.queue.some(o=>o.packageId===p.id));
 s.take(p.id);assert.equal(s.stock(p.zone==='A'?'B':'A').ok,false);assert.equal(s.held,p.id);
 assert.equal(s.stock(p.zone).ok,true);assert.equal(p.location,'shelf');assert.equal(s.stats.stocked,1);invariant(s);
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
 assert.equal(s.take(s.queue[0].packageId).ok,false);s.resume();s.tick(1);assert.equal(s.remaining,179);
});
test('queue and receiving capacity remain bounded and stock never double-books',()=>{
 const s=playing();for(let i=0;i<100;i++)s.spawnCustomer();assert.equal(s.queue.length,4);
 for(let i=0;i<50;i++)s.addPackage('A','receiving');assert.equal(s.receiving.filter(x=>x.packageId).length,6);
 for(let i=0;i<179;i++){s.tick(1);assert.ok(s.queue.length<=4);assert.ok(s.receiving.filter(x=>x.packageId).length<=6);invariant(s);}
});
test('end freezes commands and stops additional penalties',()=>{
 const s=playing();s.take(s.queue[0].packageId);s.tick(180);assert.equal(s.phase,'ended');
 const before=JSON.stringify(s.stats);assert.equal(s.deliver().ok,false);s.tick(500);assert.equal(JSON.stringify(s.stats),before);
});
test('practice supports complete delivery and stock loop without time pressure',()=>{
 const s=playing({practice:true});const p=s.packages.get(s.queue[0].packageId);
 s.tick(1000);assert.equal(s.remaining,180);assert.equal(s.queue[0].patience,60);
 s.take(p.id);s.deliver();const fresh=[...s.packages.values()].find(p=>p.location==='receiving');
 s.take(fresh.id);s.stock(fresh.zone);assert.equal(s.stats.completed,1);assert.equal(s.stats.stocked,1);invariant(s);
});
test('new shift restores independent clean state',()=>{
 const first=playing();first.take(first.queue[0].packageId);first.deliver();
 const next=playing();assert.equal(next.stats.completed,0);assert.equal(next.held,null);
 assert.equal(next.queue[0].code,'4826');assert.equal(next.remaining,180);invariant(next);
});
