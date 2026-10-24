import{createRequire}from'node:module';import assert from'node:assert/strict';import fs from'node:fs/promises';
import{Shift}from'../src/game.js';import{makeSave}from'../src/save.js';
const{chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const url=new URL('../deliverables/parcel-point-prototype-v0.10.0.html',import.meta.url).href+'?qa=1',out=new URL('../deliverables/',import.meta.url).pathname;
const errors=[],checks=[];
function fixture(){const g=new Shift({deferDayStart:true,shippingChance:0});g.start();g.ledger.post('art-fixture','pickup',5000,'fixture');g.totalRevenue=5000;g.stats.revenue=5000;g.closeDay();for(const id of['shelf:C','shelf:D','shelf:A','shelf:A','worker'])assert.ok(g.purchaseUpgrade(id).ok,id);g.beginStocking();g.nextDay();g.openNextDay();for(let n=0;n<1500&&!g.worker.task?.carrying;n++)g.advanceWorker(.02);assert.ok(g.worker.task.carrying);return{g,record:makeSave('art-save-schema4',g,{player:{x:174,y:218,face:'up',travel:0},actors:g.queue.map(o=>({id:o.id,appearance:o.appearance,x:174,y:142,face:'down',travel:0,carrying:o.type==='shipping',entered:true,route:[{x:40,y:64}],next:1})),departures:[]})};}
try{
 for(const[width,height]of[[1440,1000],[390,844],[844,390]]){
 const context=await browser.newContext({viewport:{width,height},isMobile:width<1000,hasTouch:width<1000});const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{window.__artDraws=new Map();const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(img,...args){if(img.src)__artDraws.set(img.src,args);return draw.call(this,img,...args);};});
 await p.clock.install();await p.goto(url);await p.locator('#start-button:enabled').waitFor();const{g,record}=fixture();
 await p.locator('#import-file').setInputFiles({name:'v08-art-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(record))});await p.locator('#confirm-yes').click();await p.locator('#pause-dialog[open]').waitFor();
 const before=await p.evaluate(()=>__parcelQA.snapshot());assert.equal(before.wallet,g.ledger.balance);assert.equal(before.held,null);assert.equal(before.worker.task.packageId,g.worker.task.packageId);assert.deepEqual(before.dayEvents,g.dayEvents);assert.equal(before.world.height,484);
 await p.locator('#resume-button').click();await p.clock.runFor(60);
 const draws=await p.evaluate(()=>Object.fromEntries(Object.entries(__PACKAGED_ASSETS__).filter(([,src])=>__artDraws.has(src)).map(([key,src])=>[key,__artDraws.get(src)])));
 assert.ok(draws['assets/characters/player_idle.png']);assert.ok(Object.keys(draws).some(n=>n.includes('/worker_carry_')));assert.ok(!Object.keys(draws).some(n=>n.includes('/clerk_')));
 assert.deepEqual(draws['assets/environment/props/countertop_decor.png'],[0,138]);assert.ok(draws['assets/environment/props/counter_repeat.png']);assert.ok(draws['assets/environment/props/gate_open.png']);assert.ok(draws['assets/environment/shop_interior_tiles.png']);
 const after=await p.evaluate(()=>__parcelQA.snapshot());assert.equal(after.wallet,before.wallet);assert.equal(after.targets.length,before.targets.length);assert.ok(!after.targets.some(t=>/screen|decor|bell/.test(t.id)));assert.equal(after.assetSizes.player_walk[0],256);assert.equal(after.assetSizes.worker_walk[0],256);
 await p.screenshot({path:out+`art-integrated-${width}x${height}.png`});checks.push({width,height,distinctActors:true,saveRestored:true,decorativeOnly:true,expandedMap:true});await context.close();
 }
 assert.deepEqual(errors,[]);await fs.writeFile(out+'art-integration-report.json',JSON.stringify({status:'PASS',checks,errors,saveSchema:4,limitations:['Chromium emulation, not physical iPhone/Android.']},null,2)+'\n');console.log('Art integration: distinct player/worker, carry state, expanded shelves, decorations and v0.8 save restore PASS.');
}finally{await browser.close();}
