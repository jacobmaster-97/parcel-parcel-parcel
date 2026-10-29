import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const uri=pathToFileURL(path.join(root,'deliverables/parcel-point-prototype-v0.19.9.html')).href+'?qa=1';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
await context.setOffline(true);
const errors=[],network=[];const page=await context.newPage();
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
await page.clock.install();await page.goto(uri);await page.locator('#start-button:enabled').waitFor();
assert.equal(await page.locator('#practice-button,#practice-done-dialog,#practice-to-shift').count(),0);await page.locator('#start-button').tap();await page.locator('#welcome-dialog').waitFor({state:'hidden'});await page.clock.fastForward(4000);assert.equal(await page.evaluate(()=>__parcelQA.snapshot().practice),false);
const profiles=[{width:390,height:844,file:'prototype-mobile.png'},
 {width:844,height:390,file:'prototype-mobile-landscape.png'},
 {width:360,height:640,file:'prototype-small.png'},
 {width:640,height:360,file:'prototype-small-landscape.png'},
 {width:360,height:800,file:'prototype-tall.png'}];
const results=[];
try{
 for(const profile of profiles){
  await page.setViewportSize({width:profile.width,height:profile.height});
  await page.waitForTimeout(150);
  await page.clock.fastForward(100);
  if(await page.locator('#pause-dialog').evaluate(e=>e.open))await page.locator('#resume-button').tap();
  await page.clock.fastForward(50);
  const boxes=await page.evaluate(()=>({width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,
   items:['.scene-panel','#joystick','#touch-action','#pause-button'].map(selector=>{
    const r=document.querySelector(selector).getBoundingClientRect();return{selector,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};
   })}));
  assert.equal(boxes.overflow,false);
  for(const box of boxes.items){
   assert.ok(box.x>=0&&box.y>=0&&box.right<=boxes.width+1&&box.bottom<=boxes.height+1,JSON.stringify(boxes));
   if(box.selector!=='.scene-panel')assert.ok(box.width>=48&&box.height>=48,JSON.stringify(box));
  }
  const scene=boxes.items[0];assert.ok(scene.bottom>boxes.height-30,'Game uses available height');
  await page.screenshot({path:path.join(root,'deliverables',profile.file)});
  results.push({viewport:[profile.width,profile.height],status:'PASS',controlsInsideViewport:true,minTouchSize:48});
 }
 // Test the exact downloaded file, without any server/network, through its end state.
 await page.reload();await page.locator('#start-button:enabled').waitFor();await page.locator('#start-button').tap();await page.locator('#confirm-dialog[open]').waitFor();assert.match(await page.locator('#confirm-title').innerText(),/接管/);await page.locator('#confirm-yes').tap();await page.locator('#welcome-dialog').waitFor({state:'hidden'});
 await page.clock.fastForward(10000);
 const remaining=await page.evaluate(()=>__parcelQA.snapshot().remaining);assert.ok(remaining>=109&&remaining<=111);
 await page.clock.fastForward(171000);await page.locator('#result-dialog[open]').waitFor();
 assert.equal(await page.evaluate(()=>__parcelQA.snapshot().phase),'closing');
 await page.locator('#play-again').tap();await page.locator('#upgrade-skip').tap();assert.equal(await page.evaluate(()=>__parcelQA.snapshot().phase),'stocking');
 await page.clock.fastForward(600000);assert.equal(await page.evaluate(()=>__parcelQA.snapshot().phase),'stocking');
 for(const profile of profiles){
  await page.setViewportSize({width:profile.width,height:profile.height});
  await page.waitForTimeout(150);
  await page.clock.fastForward(100);
  if(await page.locator('#pause-dialog').evaluate(e=>e.open))await page.locator('#resume-button').tap();
  await page.clock.fastForward(50);
  await page.waitForTimeout(50);
  assert.equal(await page.evaluate(()=>__parcelQA.snapshot().phase),'stocking');
  assert.equal(await page.locator('#pause-dialog').evaluate(e=>e.open),false);
  const box=await page.locator('#next-day').boundingBox();assert.ok(box&&box.width>=48&&box.height>=48);
  assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=profile.width&&box.y+box.height<=profile.height);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:path.join(root,'deliverables',`stocking-${profile.width}x${profile.height}.png`)});
 }

 await page.locator('#next-day').tap();await page.locator('#checkpoint-dialog').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>__parcelQA.snapshot().day),2);
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 const report={status:'PASS',offlineFile:uri.split('?')[0],externalNetworkRequests:network,browserErrors:errors,
  profiles:results,timedShift:'PASS',limitations:['Chromium mobile emulation, not physical Android/iOS verification.','Other languages, screen-reader gameplay and sustained device performance remain unverified.']};
 fs.writeFileSync(path.join(root,'deliverables/prototype-offline-report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
