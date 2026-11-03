// Regression for an exact-one-unit waypoint gap blocking the logical front customer.
// Uses real save import and keyboard/touch interaction, without state mutation hooks.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Shift} from '../src/game.js';
import {makeSave} from '../src/save.js';
import {QUEUE_POINTS,ENTRANCE} from '../src/layout.js';
const {chromium}=createRequire(import.meta.url)('playwright');
const version=JSON.parse(await fs.readFile(new URL('../package.json',import.meta.url))).version;
const url=new URL(`../deliverables/parcel-point-prototype-v${version}.html`,import.meta.url).href+'?qa=1';
const out=new URL('../deliverables/queue-recovery/',import.meta.url).pathname;
const reproduce=process.argv.includes('--reproduce');
await fs.mkdir(out,{recursive:true});
function fixture({mode='pickup',gap=1,waypoint=0}={}){
 const g=new Shift({deferDayStart:true,shippingChance:0});g.start();
 if(mode==='shipping'){g.expire(g.queue[0]);g.spawnCustomer({type:'shipping'});}
 while(g.queue.length<5){
  if(!g.available().length)g.addPackage('A','shelf');
  assert.ok(g.spawnCustomer({type:'pickup'}));
 }
 if(mode==='pickup'){assert.ok(g.deliver().ok);assert.ok(g.take(g.queue[0].packageId).ok);}
 const stalledIndex=mode==='multi-timeout'?2:1;
 if(mode==='timeout'||mode==='multi-timeout'){
  g.queue[0].patience=.5;
  if(mode==='multi-timeout')g.queue[1].patience=.5;
 }
 g.customerTimer=g.deliveryTimer=999;
 const route=[{x:40,y:64},{x:25,y:64},{x:25,y:142}],target=route[waypoint];
 const actors=g.queue.map((o,i)=>({id:o.id,appearance:o.appearance,
  x:i===stalledIndex?target.x:QUEUE_POINTS[i].x,
  y:i===stalledIndex?target.y-gap:QUEUE_POINTS[i].y,
  face:'down',travel:0,carrying:o.type==='shipping',entered:i!==stalledIndex,
  route:i===stalledIndex?structuredClone(route):[],next:i===stalledIndex?waypoint:0}));
 const departures=[{id:'old-departure',appearance:1,x:40,y:23,face:'up',travel:0,carrying:false,entered:true,route:[{x:40,y:24},{...ENTRANCE}],next:0}];
 return makeSave('queue-recovery-'+mode,g,{player:{x:174,y:218,face:'up',travel:0},actors,departures});
}
const browser=await chromium.launch({args:['--no-sandbox']}),checks=[],errors=[];
try{
 const cases=reproduce?[{mode:'pickup',gap:1,waypoint:0}]:[
  {mode:'pickup',gap:1,waypoint:0},{mode:'shipping',gap:1,waypoint:1},
  {mode:'timeout',gap:1,waypoint:2},{mode:'multi-timeout',gap:1,waypoint:0},
  {mode:'pickup',gap:.5,waypoint:1},{mode:'pickup',gap:1.5,waypoint:2},
  {mode:'pickup',gap:0,waypoint:0}
 ];
 for(const mobile of reproduce?[false]:[false,true])for(const spec of cases){
  const c=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
  await c.setOffline(true);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>localStorage.setItem('parcel-parcel-parcel-home-hint-v1','off'));
  await p.clock.install();await p.goto(url);await p.locator('#start-button:enabled').waitFor();
  const record=fixture(spec);await p.locator('#import-file').setInputFiles({name:'queue.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(record))});
  await p.locator('#confirm-yes').click();await p.locator('#pause-dialog[open]').waitFor();
  const snap=()=>p.evaluate(()=>__parcelQA.snapshot()),before=await snap();
  const successor=before.queue[spec.mode==='multi-timeout'?2:1].id;
  const act=()=>mobile?p.locator('#touch-action').tap():p.keyboard.press('e');
  await p.locator('#resume-button')[mobile?'tap':'click']();
  if(!spec.mode.includes('timeout'))await act();
  await p.clock.runFor(6500);
  let after=await snap();assert.equal(after.queue[0].id,successor);
  const actor=after.actors.find(a=>a.id===successor);
  assert.ok(actor);const distance=Math.hypot(actor.x-QUEUE_POINTS[0].x,actor.y-QUEUE_POINTS[0].y);
  await p.screenshot({path:out+`${reproduce?'before':'fixed'}-${spec.mode}-${spec.gap}-${spec.waypoint}-${mobile?'touch':'keyboard'}.png`});
  await act();await p.clock.runFor(50);after=await snap();
  if(reproduce){
   assert.equal(distance,Math.hypot(40-174,63-142));assert.equal(after.queue[0].revealed,false);
   checks.push({...spec,mobile,stalledAt:{x:actor.x,y:actor.y},cannotGreet:true});
  }else{
   assert.ok(distance<1,JSON.stringify({spec,mobile,actor,distance}));
   assert.equal(after.queue[0].revealed,true,'the next customer must be greetable');
   assert.ok(!after.departures.some(a=>a.id==='old-departure'),'old departures must complete their route');
   assert.equal(after.queue.length,spec.mode==='multi-timeout'?3:4);
   assert.equal(after.wallet,before.wallet+(spec.mode==='pickup'?15:0));
   assert.equal(after.stats.missed-before.stats.missed,spec.mode==='multi-timeout'?2:spec.mode==='timeout'?1:0);
   assert.equal(after.stats.completed-before.stats.completed,spec.mode==='pickup'?1:0);
   // Verify a manual export retains the recovered route and current order.
   if(spec.mode==='pickup'){
    const order=after.queue[0],pkg=after.packages.find(x=>x.id===order.packageId);
    // Export the reached state without creating a new gameplay autosave.
    await p.locator('#pause-button').click();await p.locator('#settings-button').click();
    const dl=p.waitForEvent('download');await p.locator('#export-button').click();const download=await dl;
    const exported=JSON.parse(await fs.readFile(await download.path(),'utf8'));
    assert.ok(exported.payload.view.actors.find(a=>a.id===order.id).entered);
    assert.equal(exported.payload.shift.queue[0],order.id);
    assert.ok(pkg);
    if(!mobile){
     await p.locator('#settings-back').click();await p.locator('#resume-button').click();
     const move=async(axis,value)=>{const current=(await snap()).player[axis],delta=value-current;if(Math.abs(delta)<1)return;const key=axis==='x'?(delta>0?'d':'a'):(delta>0?'s':'w');await p.keyboard.down(key);await p.clock.runFor(Math.abs(delta)/80*1000);await p.keyboard.up(key);};
     const shelf=(await snap()).targets.find(t=>t.type==='shelf'&&t.zone===pkg.zone);
     await move('x',shelf.x);await move('y',shelf.y);await act();await p.locator('#inventory-dialog[open]').waitFor();
     await p.locator('.parcel-choice').filter({hasText:order.code}).click();await p.locator('#inventory-confirm').click();await p.clock.runFor(450);
     assert.equal((await snap()).held.id,order.packageId);await move('y',218);await move('x',174);
     const beforeDelivery=await snap();await act();await p.clock.runFor(50);const done=await snap();
     assert.equal(done.held,null);assert.equal(done.stats.completed,before.stats.completed+2);
     assert.ok(done.wallet-beforeDelivery.wallet>=10&&done.wallet-beforeDelivery.wallet<=15);
    }
    checks.push({...spec,mobile,distance,canGreet:true,exportAfterRecovery:true});
   }else checks.push({...spec,mobile,distance,canGreet:true});
  }
  await c.close();
 }
 assert.deepEqual(errors,[]);
 await fs.writeFile(out+(reproduce?'reproduction.json':'browser-report.json'),JSON.stringify({status:reproduce?'REPRODUCED':'PASS',version,checks,errors,limits:['Chromium keyboard/touch emulation; physical devices not tested.']},null,2)+'\n');
 console.log(reproduce?'REPRODUCED: exact-one-unit arrival remains at doorway; front leaves, next cannot be greeted.':`PASS: ${checks.length} queue recovery scenarios, pickup/shipping/timeouts, waypoint boundaries, departure cleanup, save export.`);
}finally{await browser.close();}
