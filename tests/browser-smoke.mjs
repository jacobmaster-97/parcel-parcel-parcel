import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const {chromium}=createRequire(import.meta.url)('playwright');
const base=process.env.GAME_URL||'http://127.0.0.1:4173';
const gameURL=base.startsWith('file:')?`${base}?qa=1`:`${base}/?qa=1`;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const failures=[],results=[];const output=new URL('../deliverables/',import.meta.url).pathname;
const snapshot=page=>page.evaluate(()=>__parcelQA.snapshot());
async function setup(mobile=false){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1});
 const page=await context.newPage();page.on('pageerror',e=>failures.push(e.message));page.on('console',m=>{if(m.type()==='error')failures.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`);});
 await page.addInitScript(()=>{window.__drawnLabels=[];const f=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(t,...a){__drawnLabels.push(String(t));return f.call(this,t,...a);};});
 await page.clock.install();await page.goto(gameURL);await page.locator('#start-button:enabled').waitFor();return {context,page};
}
async function keyTo(page,axis,target){
 const before=(await snapshot(page)).player[axis];if(Math.abs(before-target)<=1)return;
 const key=axis==='x'?(target>before?'d':'a'):(target>before?'s':'w');
 await page.keyboard.down(key);await page.clock.runFor(Math.ceil(Math.abs(target-before)/80*1000));await page.keyboard.up(key);
 // Input delivery can span two 60Hz frames (about 2.7px); interactions are asserted separately.
 const after=(await snapshot(page)).player[axis];assert.ok(Math.abs(after-target)<4,`${axis} ${before} -> ${target} stopped at ${after}`);
}
async function act(page,touch=false){await(touch?page.locator('#touch-action').tap():page.keyboard.press('e'));await page.clock.runFor(450);}
async function choose(page,code,zone,touch=false){
 assert.equal(await page.locator('#inventory-confirm').isDisabled(),true);
 const choice=page.getByRole('button',{name:`包裹 ${code}，${zone==='receiving'?'待上架':`${zone} 區`}`});
 await(touch?choice.tap():choice.click());await(touch?page.locator('#inventory-confirm').tap():page.locator('#inventory-confirm').click());await page.clock.runFor(450);
}
async function counterFromShelf(page){await keyTo(page,'y',218);await keyTo(page,'x',174);}
async function receivingFromStaff(page){await keyTo(page,'x',310);await keyTo(page,'y',156);await keyTo(page,'x',240);}
async function shelfFromPublic(page,x){await keyTo(page,'x',310);await keyTo(page,'y',260);await keyTo(page,'x',x);}
async function controlsFit(page){
 const boxes=await page.evaluate(()=>({width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,
  items:['.scene-panel','#joystick','#touch-action'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return{s,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};})}));
 assert.equal(boxes.overflow,false);for(const b of boxes.items){assert.ok(b.x>=0&&b.y>=0&&b.right<=boxes.width+1&&b.bottom<=boxes.height+1,JSON.stringify(boxes));if(b.s!=='.scene-panel')assert.ok(b.w>=48&&b.h>=48);}
}
try{
 const desktop=await setup(),page=desktop.page;await page.locator('#practice-button').click();await page.clock.runFor(50);
 let state=await snapshot(page);assert.equal(state.world.width,350);assert.deepEqual(state.targets.filter(t=>t.type==='shelf').map(t=>t.x),[70,140,210]);
 assert.deepEqual(state.assetSizes.courier_walk,[256,192]);assert.deepEqual(state.assetSizes.courier_carry_walk,[256,192]);assert.deepEqual(state.assetSizes.outbound_cage,[96,80]);
 assert.equal(await page.locator('#instruction,#toast').count(),0);assert.equal(await page.locator('#order-code').textContent(),'待接待');
 assert.ok(!(await page.locator('body').innerText()).includes('4826'));assert.ok((await page.evaluate(()=>__drawnLabels)).includes('互動'));
 // The middle of the counter is a real divider; only its right gate is passable.
 await page.keyboard.down('w');await page.clock.runFor(900);await page.keyboard.up('w');assert.ok((await snapshot(page)).player.y>=209);
 await keyTo(page,'y',218);await act(page);assert.equal(await page.locator('#order-code').textContent(),'4826');
 await keyTo(page,'y',260);await keyTo(page,'x',70);await act(page);await choose(page,'4863','A');
 await counterFromShelf(page);await act(page);assert.equal((await snapshot(page)).stats.errors,1);assert.equal((await snapshot(page)).held.code,'4863');
 await keyTo(page,'y',260);await keyTo(page,'x',70);await act(page);assert.equal((await snapshot(page)).held,null);
 await act(page);await choose(page,'4826','A');await counterFromShelf(page);await act(page);assert.equal((await snapshot(page)).stats.completed,1);
 await page.keyboard.down('e');await page.clock.runFor(600);await page.keyboard.up('e');assert.equal((await snapshot(page)).stats.completed,1);
 await receivingFromStaff(page);await act(page);await choose(page,'5048','receiving');await shelfFromPublic(page,140);await act(page);
 await page.locator('#practice-done-dialog[open]').waitFor();assert.equal((await snapshot(page)).packages.find(p=>p.code==='5048').zone,'B');
 await page.locator('#practice-to-shift').click();await page.clock.runFor(50);await page.screenshot({path:output+'prototype-desktop.png'});
 assert.ok((await snapshot(page)).actors.every(a=>a.y<=142));results.push('Desktop: real counter collision, staff gate, first greeting, wrong/return/correct pickup and free shelving; normalized courier atlases loaded.');await desktop.context.close();

 const mobile=await setup(true),mp=mobile.page,cdp=await mobile.context.newCDPSession(mp);await mp.locator('#practice-button').tap();await mp.clock.runFor(50);
 async function touchTo(axis,target){
  const before=(await snapshot(mp)).player[axis];if(Math.abs(before-target)<=1)return;
  const b=await mp.locator('#joystick').boundingBox(),sign=target>before?1:-1;
  const point={x:b.x+b.width/2+(axis==='x'?sign*b.width*.33:0),y:b.y+b.height/2+(axis==='y'?sign*b.height*.33:0),id:1};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await mp.clock.runFor(Math.ceil(Math.abs(target-before)/80*1000));await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.ok(Math.abs((await snapshot(mp)).player[axis]-target)<3);
 }
 await act(mp,true);await touchTo('y',260);await touchTo('x',70);
 const joy=await mp.locator('#joystick').boundingBox(),button=await mp.locator('#touch-action').boundingBox();const finger={x:joy.x+joy.width/2,y:joy.y+joy.height/2,id:1};
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger]});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger,{x:button.x+button.width/2,y:button.y+button.height/2,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await mp.locator('#inventory-dialog[open]').waitFor();await choose(mp,'4826','A',true);await touchTo('y',218);await touchTo('x',174);await act(mp,true);
 assert.equal((await snapshot(mp)).stats.completed,1);await touchTo('x',310);await touchTo('y',156);await touchTo('x',240);await act(mp,true);await choose(mp,'5048','receiving',true);
 await touchTo('x',310);await touchTo('y',260);await touchTo('x',210);await act(mp,true);await mp.locator('#practice-done-dialog[open]').waitFor();
 await mp.locator('#practice-to-shift').tap();await mp.clock.runFor(50);await controlsFit(mp);await mp.screenshot({path:output+'prototype-mobile.png'});
 await mp.setViewportSize({width:844,height:390});await mp.waitForTimeout(150);await mp.clock.runFor(50);await mp.locator('#pause-dialog[open]').waitFor();await mp.locator('#resume-button').tap();await mp.clock.runFor(50);await controlsFit(mp);await mp.screenshot({path:output+'prototype-mobile-landscape.png'});
 await mp.evaluate(()=>window.dispatchEvent(new Event('blur')));await mp.locator('#pause-dialog[open]').waitFor();results.push('Mobile: pure touch pickup/delivery, two-finger inventory, staff-gate replenishment, C-zone stocking, portrait/landscape and focus-loss pause.');await mobile.context.close();

 for(const useTouch of [false,true]){
 const shipping=await setup(useTouch),sp=shipping.page,shipCDP=useTouch?await shipping.context.newCDPSession(sp):null;
 async function shipMove(axis,target){
  if(!useTouch)return keyTo(sp,axis,target);
  const before=(await snapshot(sp)).player[axis];if(Math.abs(before-target)<=1)return;
  const b=await sp.locator('#joystick').boundingBox(),sign=target>before?1:-1;
  const point={x:b.x+b.width/2+(axis==='x'?sign*b.width*.33:0),y:b.y+b.height/2+(axis==='y'?sign*b.height*.33:0),id:1};
  await shipCDP.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await sp.clock.runFor(Math.ceil(Math.abs(target-before)/80*1000));await shipCDP.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.ok(Math.abs((await snapshot(sp)).player[axis]-target)<4);
 }await sp.locator('#start-button').click();await sp.clock.runFor(50);
 let accepted=null;
 for(let attempt=0;attempt<10&&!accepted;attempt++){
  for(let n=0;n<35;n++){const s=await snapshot(sp),o=s.queue[0],a=o&&s.actors.find(a=>a.id===o.id);if(o&&a&&Math.hypot(a.x-174,a.y-142)<10)break;await sp.clock.runFor(1000);}
  const s=await snapshot(sp),o=s.queue[0];assert.ok(o,'Expected customer');await act(sp,useTouch);
  if(o.type==='shipping'){accepted=o;break;}
  const p=(await snapshot(sp)).packages.find(p=>p.id===o.packageId),x={A:70,B:140,C:210}[p.zone];
  await shipMove('y',260);await shipMove('x',x);await act(sp,useTouch);await choose(sp,p.code,p.zone,useTouch);await shipMove('y',218);await shipMove('x',174);await act(sp,useTouch);
 }
 assert.ok(accepted,'Random shipping customer must appear in seeded playable shift');state=await snapshot(sp);assert.equal(state.held.kind,'shipping');
 assert.equal(await sp.locator('#order-code').innerText(),'寄貨');assert.match(await sp.locator('#order-location').innerText(),/右下角/);
 const before=state.totalRevenue;await shipMove('x',310);await shipMove('y',260);await act(sp,useTouch);state=await snapshot(sp);
 assert.equal(state.held,null);assert.equal(state.stats.shipped,1);assert.equal(state.totalRevenue,before+12);await act(sp,useTouch);assert.equal((await snapshot(sp)).totalRevenue,before+12);
 assert.ok(state.actors.every(a=>a.y<=142));await sp.screenshot({path:output+(useTouch?'prototype-shipping-mobile.png':'prototype-shipping.png')});results.push((useTouch?'Mobile touch: ':'Desktop: ')+'Real random shipping sender: accepts parcel, leaves empty, clerk walks directly to bottom-right purple cage, deposits and earns once; customers stay in public zone.');await shipping.context.close();

 }
 const timed=await setup(),tp=timed.page;await tp.locator('#start-button').click();await tp.clock.runFor(25100);state=await snapshot(tp);const count=state.receivingCount;
 assert.ok(state.courier?.carrying);await tp.clock.runFor(7000);assert.equal((await snapshot(tp)).receivingCount,count);
 await tp.clock.runFor(1000);state=await snapshot(tp);assert.equal(state.receivingCount,count+2);assert.equal(state.courier.carrying,false);await tp.screenshot({path:output+'prototype-courier.png'});
 await tp.locator('#pause-button').click();const frozen=JSON.stringify((await snapshot(tp)).courier);await tp.clock.runFor(1000);assert.equal(JSON.stringify((await snapshot(tp)).courier),frozen);await tp.locator('#resume-button').click();
 await tp.clock.fastForward(181000);await tp.locator('#result-dialog[open]').waitFor();await tp.locator('#play-again').click();await tp.clock.runFor(50);assert.equal((await snapshot(tp)).phase,'stocking');
 await tp.clock.fastForward(600000);assert.equal((await snapshot(tp)).phase,'stocking');await tp.locator('#next-day').click();await tp.clock.runFor(50);assert.equal((await snapshot(tp)).day,2);
 await tp.clock.fastForward(181000);await tp.locator('#result-dialog[open]').waitFor();await tp.locator('#play-again').click();await tp.clock.runFor(50);
 const incoming=(await snapshot(tp)).packages.filter(p=>p.location==='receiving');
 for(const p of incoming){
  let s=await snapshot(tp);if(s.player.y>=182){await keyTo(tp,'x',310);await keyTo(tp,'y',156);}await keyTo(tp,'x',240);await act(tp);await choose(tp,p.code,'receiving');
  s=await snapshot(tp);const zone=['A','B','C'].find(z=>s.packages.filter(p=>p.location==='shelf'&&p.zone===z).length<4);await shelfFromPublic(tp,{A:70,B:140,C:210}[zone]);await act(tp);
 }
 assert.equal((await snapshot(tp)).day,3);assert.equal((await snapshot(tp)).receivingCount,0);results.push('Courier carrying/put-down/empty departure, paused courier, timed close, ten-minute untimed stocking, manual next day and last-parcel automatic next day.');await timed.context.close();
 assert.deepEqual(failures,[]);const report={status:'PASS',results,errors:failures,engine:'Playwright Chromium; mobile emulation, not physical devices'};fs.writeFileSync(output+'prototype-browser-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
