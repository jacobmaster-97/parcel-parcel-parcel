import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const base=process.env.GAME_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const failures=[],results=[];
const screenshotDir=new URL('../deliverables/',import.meta.url).pathname;
async function setup(options){
 const context=await browser.newContext(options),page=await context.newPage();
 page.on('pageerror',e=>failures.push(e.message));
 page.on('console',m=>{if(m.type()==='error')failures.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`);});
 await page.goto(`${base}/?qa=1`);await page.locator('#practice-button:enabled').waitFor();
 return {context,page};
}
const snapshot=page=>page.evaluate(()=>window.__parcelQA.snapshot());
async function assertControlsInsideViewport(page){
 const layout=await page.evaluate(()=>{
  const bounds=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  return {height:innerHeight,width:innerWidth,scene:bounds('.scene-panel'),joystick:bounds('#joystick'),action:bounds('#touch-action')};
 });
 for(const name of ['scene','joystick','action']){
  const box=layout[name];assert.ok(box.x>=0&&box.y>=0&&box.right<=layout.width+1&&box.bottom<=layout.height+1,
   `${name} must fit viewport: ${JSON.stringify(layout)}`);
 }
 assert.ok(layout.joystick.width>=48&&layout.action.height>=48,'Touch targets must remain usable');
 assert.ok(layout.scene.bottom>layout.height-30,'Scene should use available viewport height');
}
async function readyAction(page){await page.waitForFunction(()=>!window.__parcelQA.snapshot().action);}
async function keyTo(page,key,axis,target){
 const before=(await snapshot(page)).player[axis],positive=target>before;
 await page.keyboard.down(key);
 try{await page.waitForFunction(({axis,target,positive})=>{
  const p=window.__parcelQA.snapshot().player[axis];return positive?p>=target-1:p<=target+1;
 },{axis,target,positive},{timeout:7000});}finally{await page.keyboard.up(key);}
}
async function choose(page,code,touch=false){
 const choice=page.getByRole('button',{name:`包裹 ${code}，A 區`});
 await (touch?choice.tap():choice.click());
 await (touch?page.locator('#inventory-confirm').tap():page.locator('#inventory-confirm').click());
 await readyAction(page);
}
try{
 const {page,context}=await setup({viewport:{width:1440,height:1000}});
 await page.locator('#practice-button').click();
 await keyTo(page,'a','x',96);await keyTo(page,'w','y',132);await page.keyboard.press('e');
 await choose(page,'4863');
 await keyTo(page,'s','y',195);await keyTo(page,'d','x',300);await page.keyboard.press('e');
 let state=await snapshot(page);assert.equal(state.stats.errors,1);assert.equal(state.held.code,'4863');
 await keyTo(page,'a','x',96);await keyTo(page,'w','y',132);await page.keyboard.press('e');
 await readyAction(page);assert.equal((await snapshot(page)).held,null);
 await page.keyboard.press('e');await choose(page,'4826');
 await keyTo(page,'s','y',195);await keyTo(page,'d','x',300);await page.keyboard.press('e');
 await readyAction(page);state=await snapshot(page);assert.equal(state.stats.completed,1);assert.equal(state.held,null);
 // Holding the key must not cause another inventory transaction or payout.
 await page.keyboard.down('e');await page.waitForTimeout(550);await page.keyboard.up('e');
 assert.equal((await snapshot(page)).stats.completed,1);
 await keyTo(page,'a','x',116);await keyTo(page,'s','y',263);await page.keyboard.press('e');
 await choose(page,'5048');await keyTo(page,'w','y',132);await keyTo(page,'a','x',96);
 await page.keyboard.press('e');await page.locator('#practice-done-dialog[open]').waitFor();
 state=await snapshot(page);assert.equal(state.stats.stocked,1);assert.equal(state.remaining,180);
 results.push('Desktop keyboard: wrong parcel, return, correct delivery, input-repeat guard, receiving and stock completed.');
 await page.locator('#practice-to-shift').click();await page.waitForTimeout(200);
 await page.keyboard.press('Escape');const paused=await snapshot(page);await page.waitForTimeout(400);
 assert.equal((await snapshot(page)).remaining,paused.remaining);
 await page.locator('#resume-button').click();
 await page.screenshot({path:screenshotDir+'prototype-desktop.png'});
 await context.close();
 const timedContext=await browser.newContext({viewport:{width:1440,height:1000}}),timed=await timedContext.newPage();
 timed.on('pageerror',e=>failures.push(e.message));
 await timed.clock.install();await timed.goto(`${base}/?qa=1`);await timed.locator('#start-button:enabled').waitFor();
 await timed.locator('#start-button').click();
 await timed.clock.fastForward(10000);
 const afterGap=(await snapshot(timed)).remaining;assert.ok(afterGap>=169&&afterGap<=171,`Real elapsed time: ${afterGap}`);
 await timed.clock.fastForward(171000);
 await timed.locator('#result-dialog[open]').waitFor();assert.equal((await snapshot(timed)).phase,'ended');
 await timed.screenshot({path:screenshotDir+'prototype-result.png'});
 await timed.locator('#play-again').click();state=await snapshot(timed);
 assert.equal(state.stats.completed,0);assert.equal(state.held,null);assert.equal(state.queue[0].code,'4826');
 results.push('Full timed shift: countdown, customer expiry, stock arrival, result and clean restart; pause freezes time.');
 await timedContext.close();

 const mobile=await setup({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const mp=mobile.page,cdp=await mobile.context.newCDPSession(mp);
 await mp.locator('#practice-button').tap();
 async function touchTo(axis,target){
  const before=(await snapshot(mp)).player[axis],positive=target>before;
  const b=await mp.locator('#joystick').boundingBox();
  const x=b.x+b.width/2+(axis==='x'?(positive?1:-1)*b.width*.33:0);
  const y=b.y+b.height/2+(axis==='y'?(positive?1:-1)*b.height*.33:0);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  try{await mp.waitForFunction(({axis,target,positive})=>{
   const p=window.__parcelQA.snapshot().player[axis];return positive?p>=target-1:p<=target+1;
  },{axis,target,positive},{timeout:7000});}
  finally{await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 }
 await touchTo('x',96);await touchTo('y',132);
 // Keep a left thumb on the joystick while tapping interact with a second finger.
 const joy=await mp.locator('#joystick').boundingBox(),button=await mp.locator('#touch-action').boundingBox();
 const finger={x:joy.x+joy.width/2,y:joy.y+joy.height/2,id:1};
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger,{x:button.x+button.width/2,y:button.y+button.height/2,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await mp.locator('#inventory-dialog[open]').waitFor();
 await mp.screenshot({path:screenshotDir+'prototype-mobile-inventory.png'});
 await choose(mp,'4826',true);
 await touchTo('y',195);await touchTo('x',300);await mp.locator('#touch-action').tap();await readyAction(mp);
 assert.equal((await snapshot(mp)).stats.completed,1);
 await touchTo('x',116);await touchTo('y',263);await mp.locator('#touch-action').tap();await choose(mp,'5048',true);
 await touchTo('y',132);await touchTo('x',96);await mp.locator('#touch-action').tap();
 await mp.locator('#practice-done-dialog[open]').waitFor();assert.equal((await snapshot(mp)).stats.stocked,1);
 results.push('Mobile touch: two-finger interaction, parcel selection, delivery and replenishment without keyboard.');
 await mp.locator('#practice-to-shift').tap();
 await assertControlsInsideViewport(mp);
 await mp.screenshot({path:screenshotDir+'prototype-mobile.png'});
 const overflow=await mp.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
 // Clear active touch input when OS/browser cancels a gesture.
 const jr=await mp.locator('#joystick').boundingBox();
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:jr.x+jr.width*.9,y:jr.y+jr.height/2,id:3}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
 assert.deepEqual((await snapshot(mp)).joystick,{x:0,y:0});
 await mp.setViewportSize({width:844,height:390});await mp.locator('#pause-dialog[open]').waitFor();
 await mp.locator('#resume-button').tap();await mp.screenshot({path:screenshotDir+'prototype-mobile-landscape.png'});
 await assertControlsInsideViewport(mp);
 assert.equal(await mp.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await mp.evaluate(()=>window.dispatchEvent(new Event('blur')));await mp.locator('#pause-dialog[open]').waitFor();
 results.push('Viewport rotation, portrait/landscape overflow, touch cancellation and focus-loss pause verified.');
 await mobile.context.close();
 assert.deepEqual(failures,[],'Unexpected browser errors');
 fs.writeFileSync(screenshotDir+'prototype-browser-report.json',JSON.stringify({status:'PASS',results,errors:failures,
  engine:'Playwright Chromium; mobile emulation, not physical-device verification'},null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',results,errors:failures},null,2));
}finally{await browser.close();}
