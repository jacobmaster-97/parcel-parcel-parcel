import {createRequire} from 'node:module';import assert from 'node:assert/strict';import fs from 'node:fs';
const {chromium}=createRequire(import.meta.url)('playwright');
const url=process.env.GAME_URL||new URL('../deliverables/parcel-point-prototype-v0.18.0.html',import.meta.url).href;
const root=new URL(process.env.LARGE_TEXT?'../deliverables/settings-v018/large-ui/':'../deliverables/',import.meta.url).pathname;fs.mkdirSync(root,{recursive:true});const b=await chromium.launch({args:['--no-sandbox']});const errors=[],profiles=[];
const c=await b.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
try{
 await p.clock.install();await p.goto(url+'?qa=1');await p.locator('#start-button:enabled').click();await p.locator('#welcome-dialog').waitFor({state:'hidden'});await p.clock.runFor(50);
 if(process.env.LARGE_TEXT){await p.locator('#pause-button').click();await p.locator('#settings-button').click();await p.locator('#text-size').selectOption('large');await p.locator('#settings-back').click();await p.locator('#resume-button').click();await p.clock.runFor(50);}
 assert.equal(await p.locator('#order-zone').innerText(),'—');assert.ok(!(await p.locator('.order-card').innerText()).includes('4826'));
 const outbound=await p.evaluate(()=>__parcelQA.snapshot().targets.find(t=>t.type==='outbound'));assert.deepEqual([outbound.x,outbound.y,outbound.footY],[310,260,330]);
 async function move(key,ms){await p.keyboard.down(key);await p.clock.runFor(ms);await p.keyboard.up(key);}
 await move('w',175);await p.keyboard.press('e');await p.clock.runFor(450);assert.equal(await p.locator('#order-code').innerText(),'4826');await p.screenshot({path:root+'ui-order-desktop.png'});
 await move('s',525);await move('a',1300);await p.keyboard.press('e');await p.clock.runFor(50);
 assert.equal(await p.locator('#inventory-confirm').isDisabled(),true);assert.equal(await p.locator('.parcel-choice[aria-pressed=true]').count(),0);assert.equal(await p.locator('.parcel-choice:disabled').count(),2);
 await p.keyboard.press('ArrowRight');assert.match(await p.locator('#inventory-selection').innerText(),/4826/);
 await p.getByRole('button',{name:'包裹 4863，貨架'}).click();await p.locator('#inventory-pause').click();const paused=await p.evaluate(()=>__parcelQA.snapshot().queue[0].patience);await p.clock.runFor(5000);assert.equal(await p.evaluate(()=>__parcelQA.snapshot().queue[0].patience),paused);await p.locator('#pause-achievements').click();await p.clock.runFor(5000);assert.equal(await p.evaluate(()=>__parcelQA.snapshot().queue[0].patience),paused);await p.keyboard.press('Escape');assert.ok(await p.locator('#pause-dialog').evaluate(e=>e.open));await p.locator('#resume-button').click();assert.equal(await p.locator('#inventory-dialog').evaluate(e=>e.open),true);assert.equal(await p.getByRole('button',{name:'包裹 4863，貨架'}).getAttribute('aria-pressed'),'true');
 await p.screenshot({path:root+'ui-selection-desktop.png'});
 for(const [width,height] of [[390,844],[844,390],[360,640],[640,360],[360,800]]){
  await p.setViewportSize({width,height});await p.waitForTimeout(150);await p.clock.runFor(100);if(await p.locator('#pause-dialog').evaluate(e=>e.open))await p.locator('#resume-button').click();await p.clock.runFor(50);
  assert.equal(await p.locator('#inventory-dialog').evaluate(e=>e.open),true);assert.equal(await p.getByRole('button',{name:'包裹 4863，貨架'}).getAttribute('aria-pressed'),'true');
  const layout=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,items:['inventory-confirm','inventory-back','inventory-pause','inventory-close'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return{id,x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};}),scrollable:document.getElementById('inventory-scroll').clientHeight}));
  assert.equal(layout.overflow,false);for(const v of layout.items){assert.ok(v.w>=48&&v.h>=48,JSON.stringify(v));assert.ok(v.x>=0&&v.y>=0&&v.right<=width+1&&v.bottom<=height+1,JSON.stringify({width,height,...v}));}assert.ok(layout.scrollable>=55);
  await p.screenshot({path:root+`ui-selection-${width}x${height}.png`});profiles.push({viewport:[width,height],result:'PASS',selectedSurvivesResize:true,footerVisible:true});
 }
 await p.keyboard.press('Escape');assert.equal(await p.locator('#inventory-dialog').evaluate(e=>e.open),false);assert.equal(await p.evaluate(()=>__parcelQA.snapshot().held),null);
 await p.keyboard.press('e');await p.clock.runFor(50);await p.getByRole('button',{name:'包裹 4863，貨架'}).click();await p.locator('#inventory-confirm').click();await p.clock.runFor(450);assert.equal(await p.evaluate(()=>__parcelQA.snapshot().held.code),'4863');
 assert.deepEqual(errors,[]);fs.writeFileSync(root+'ui-integration-report.json',JSON.stringify({status:'PASS',checks:['first greeting privacy','bottom-right outbound target','no default or correct-answer selection','wrong parcel remains selectable','empty slots disabled','pause freezes patience and preserves selection','resize preserves selection','Escape cancels without pickup','one confirmed pickup'],profiles,errors,limitations:['Mobile layout emulation; pure touch gameplay separately covered by browser-smoke','Physical phones not tested']},null,2));console.log('UI integration PASS',profiles.length,'mobile layouts; 0 errors');
}finally{await b.close();}
