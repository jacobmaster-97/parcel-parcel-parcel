import {Shift, ZONES} from './game.js';
import {WORLD,TARGETS,GATE,QUEUE_POINTS,ENTRANCE,canStandAt} from './layout.js';
import {COURIER_ART} from './courier-art.js';

const $ = id => document.getElementById(id);
const canvas = $('shop'), ctx = canvas.getContext('2d');
const images = new Map(), keys = new Set();
const people = ['customer_young', 'customer_office', 'customer_senior'];
const characterNames = ['courier_walk','courier_carry_walk','clerk_walk','clerk_carry_walk','clerk_work','clerk_idle','clerk_carry_idle',
 ...people.flatMap(p=>[`${p}_walk`,`${p}_carry_walk`,`${p}_idle`])];
const propNames = ['shelf_empty','counter','receiving_cage','parcel_small','parcel_medium','parcel_padded',
 'scanner','checkout_terminal','trolley','outbound_cage'];
const sources = Object.fromEntries([...characterNames.map(n=>[n,`assets/characters/${n}.png`]),
 ...propNames.map(n=>[n,`assets/environment/props/${n}.png`]),['tiles','assets/environment/shop_tiles.png'],['ui_icons','assets/ui/ui_icons.png']]);
const sourceURL = path => window.__PACKAGED_ASSETS__?.[path] || path;
const world=WORLD,targets=TARGETS,queuePoints=QUEUE_POINTS;
const counter=targets.find(t=>t.type==='counter'),receiving=targets.find(t=>t.type==='receiving');
let shift = new Shift(), player, actors = new Map(), departures = [], lastTime = 0;
let action = null, selected = null, inventoryContext = null, selectedIndex = 0;
let joystickPointer = null, joystickVector = {x:0,y:0}, ready = false, loadError = false;
let camera = {x:0,y:0,scale:2}, practiceDone = false, queueSignature = '';
let sound = true, audio = null;
let suspendedInventory=null,inventoryBusy=false,feedback=null;
const dialogIds = ['welcome-dialog','inventory-dialog','pause-dialog','result-dialog','practice-done-dialog'];
const canWork = () => shift.canWork();
const requestText = () => {
 const o = shift.queue[0];
 return o ? o.type==='shipping'&&o.revealed?'客人寄貨：請將手上貨物放到寄貨區':o.revealed ? `客人要：${o.code} · ${shift.packages.get(o.packageId).zone} 區` : '未接待：先到櫃檯與客人互動。' : shift.phase === 'stocking' ? '收舖整理：新貨可自由放到 A／B／C；不計時。' : '暫時冇客，趁空檔上架新貨。';
};
const dialogOpen = () => dialogIds.some(id=>$(id).open);
function resetPlayer(){ player={x:174,y:232,face:'down',moving:false,travel:0}; }
resetPlayer();

function clearInput(){
 keys.clear();joystickPointer=null;joystickVector={x:0,y:0};$('joystick-knob').style.transform='';
}
function closeDialogs(){ for(const id of dialogIds)if($(id).open)$(id).close();inventoryContext=null;selected=null;suspendedInventory=null;clearInput(); }
function showDialog(id){clearInput();if(!$(id).open)$(id).showModal();}
// The floating message area is intentionally silent in every game phase.
function toast() {}

function beep(success=true){
 if(!sound)return;
 try{
  audio??=new (window.AudioContext||window.webkitAudioContext)();
  if(audio.state==='suspended')audio.resume();
  const osc=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;
  osc.type='triangle';osc.frequency.setValueAtTime(success?660:185,now);
  if(success)osc.frequency.setValueAtTime(880,now+.08);
  gain.gain.setValueAtTime(.025,now);gain.gain.exponentialRampToValueAtTime(.001,now+.19);
  osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(now+.2);
 }catch{/* Audio is optional; gameplay continues if the browser denies it. */}
}
function start(practice=false){
 if(!ready){if(loadError)location.reload();return;}
 closeDialogs();shift=new Shift({practice});resetPlayer();actors=new Map();departures=[];
 action=null;practiceDone=false;feedback=null;queueSignature='';shift.start();processEvents();
 $('guide').textContent='先到櫃檯接待客人，再按提貨碼找貨。新貨可自由選 A／B／C 上架。';
 const first=actors.get(shift.queue[0]?.id);if(first){first.x=queuePoints[0].x;first.y=queuePoints[0].y;first.moving=false;first.entered=true;}
 $('pause-button').disabled=false;canvas.focus({preventScroll:true});
 toast(practice?'練習不計時：先到櫃檯接待客人，登記提貨要求。':'開檔！先接待客人，空檔自由上架新貨。');
}
function pause(reason='所有客人耐性及班次時間已停止。'){
 if(!shift.pause())return;
 if($('inventory-dialog').open){
  const saved={target:{...inventoryContext},selected,scroll:$('inventory-scroll').scrollTop};
  closeInventory(false);suspendedInventory=saved;
 }
 $('pause-reason').textContent=reason;showDialog('pause-dialog');
}
function resume(){
 if($('pause-dialog').open)$('pause-dialog').close();
 clearInput();shift.resume();lastTime=performance.now();
 if(suspendedInventory){const saved=suspendedInventory;suspendedInventory=null;openInventory(saved.target,saved);}
 else canvas.focus({preventScroll:true});
}
function closestTarget(){
 if(!canWork()||dialogOpen()||action)return null;
 return targets.map(t=>({...t,distance:Math.hypot(player.x-t.x,player.y-t.y)}))
  .filter(t=>t.distance<38&&(t.type!=='counter'||player.y>202)&&(t.type!=='receiving'||player.y<178)&&(t.type!=='outbound'||player.y>202)).sort((a,b)=>a.distance-b.distance)[0]||null;
}
function targetLabel(target){
 if(!target)return '行近目標';
 if(target.type==='counter')return shift.phase==='stocking'?'已停止接客':shift.queue[0]&&!shift.queue[0].revealed?'接待客人':shift.held?'交付包裹':'查看訂單';
 if(target.type==='outbound')return shift.isHoldingShipping()?'放入寄貨':'寄貨區';
 if(target.type==='receiving')return shift.held?'退回新貨':'揀新貨';
 if(!shift.held)return `${target.zone} 區揀貨`;
 const p=shift.packages.get(shift.held);
 return p.origin?.type==='shelf'&&p.origin.zone===target.zone?'退回原位':`${target.zone} 區上架`;
}
function faceToward(target){
 const dx=target.x-player.x,dy=(target.type==='shelf'?target.footY:target.type==='counter'?target.footY:target.y)-player.y;
 player.face=Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'up':'down');
}
function handleResult(result, animation=null){
 feedback={text:result.message,error:!result.ok,remaining:5};if(!result.ok)beep(false);
 if(result.ok&&animation)action={name:animation,remaining:.4,duration:.4,face:player.face};
 processEvents();canvas.focus({preventScroll:true});
}
function interact(){
 const target=closestTarget();if(!target)return;
 faceToward(target);
 if(target.type==='counter'){
  if(shift.phase==='stocking'){toast('今日已停止接客，先整理新貨或按「下一天」開門。');return;}
  const first=actors.get(shift.queue[0]?.id);
  if(first&&Math.hypot(first.x-queuePoints[0].x,first.y-queuePoints[0].y)>12){toast('客人行緊過嚟，等佢到櫃檯先。');return;}
  handleResult(shift.deliver(),'place');
 }else if(target.type==='outbound'){
  handleResult(shift.storeShipping(),'place');
 }else if(target.type==='shelf'){
  if(shift.held)handleResult(shift.stock(target.zone),'place');else openInventory(target);
 }else if(shift.held){
  const p=shift.packages.get(shift.held);
  if(p.origin?.type==='receiving')handleResult(shift.returnHeld(),'place');
  else toast(`呢件要退返 ${p.origin?.zone||p.zone} 區貨架。`,true);
 }else openInventory(target);
}
function inventoryPackages(){
 if(!inventoryContext)return [];
 const slots=inventoryContext.type==='shelf'?shift.shelves[inventoryContext.zone]:shift.receiving;
 return slots.map(s=>s.packageId?shift.packages.get(s.packageId):null);
}
function updateInventoryRequest(){
 const node=$('inventory-request'),text=requestText();if(node.dataset.text===text)return;
 node.dataset.text=text;node.replaceChildren();const order=shift.queue[0];
 if(order?.revealed&&order.type==='pickup'){
  const label=document.createElement('span'),code=document.createElement('strong');
  label.textContent=`客人要求 · ${shift.packages.get(order.packageId).zone} 區`;code.textContent=order.code;code.className='inventory-request-code';node.append(label,code);
 }else node.textContent=text;
}
function openInventory(target,restore=null){
 inventoryContext=target;selected=null;selectedIndex=-1;inventoryBusy=false;
 const list=inventoryPackages();
 $('inventory-title').textContent=target.type==='shelf'?`${target.zone} 區 · ${list.length} 格貨位`:`收貨區 · ${list.length} 格待上架`;
 $('inventory-feedback').textContent='';$('inventory-selection').textContent='請先選一件包裹';
 updateInventoryRequest();
 $('inventory-footnote').textContent=shift.phase==='stocking'?'上架時間不計時 · 返回場景後自由選 A／B／C 上架':'選貨時繼續計時 · 方向鍵選貨 / Enter 確認 / Esc 返回';
 const grid=$('parcel-grid');grid.replaceChildren();
 list.forEach((p,i)=>{
  const button=document.createElement('button');button.className='parcel-choice';button.type='button';
  button.setAttribute('aria-pressed','false');button.dataset.index=String(i);button.disabled=!p;
  if(p){
   const appearance=Number(p.code.slice(-1))%3;
   const name=['parcel_small','parcel_medium','parcel_padded'][appearance],rect=['40 60 16 16','36 56 24 20','36 64 24 12'][appearance];
   const ns='http://www.w3.org/2000/svg',icon=document.createElementNS(ns,'svg'),img=document.createElementNS(ns,'image');
   icon.setAttribute('viewBox',rect);icon.setAttribute('aria-hidden','true');icon.classList.add('parcel-art');
   img.setAttribute('href',sourceURL(sources[name]));img.setAttribute('width','96');img.setAttribute('height','80');icon.append(img);
   const label=document.createElement('span'),code=document.createElement('strong'),zone=document.createElement('small'),mark=document.createElement('span');
   mark.className='selection-mark';code.textContent=p.code;zone.textContent=p.zone?`${p.zone} 區 · 貨位 ${i+1}`:`待上架 · 貨位 ${i+1}`;
   label.append(code,zone);button.append(icon,label,mark);button.setAttribute('aria-label',`包裹 ${p.code}，${p.zone ? `${p.zone} 區` : '待上架'}`);
   button.addEventListener('click',()=>selectParcel(i));
  }else{button.classList.add('empty');button.textContent='＋ 空貨位';button.setAttribute('aria-label','空貨位');}
  grid.append(button);
 });
 $('inventory-confirm').disabled=true;$('inventory-confirm').textContent='確認取件';
 showDialog('inventory-dialog');
 const old=restore?.selected?list.findIndex(p=>p?.id===restore.selected):-1;
 if(old>=0)selectParcel(old);else $('inventory-close').focus();
 $('inventory-scroll').scrollTop=restore?.scroll||0;
}
function selectParcel(index,focus=true){
 const list=inventoryPackages();if(!list[index]||inventoryBusy)return;
 selected=list[index].id;selectedIndex=index;
 $('parcel-grid').querySelectorAll('button').forEach((b,i)=>{
  b.setAttribute('aria-pressed',String(i===index));const mark=b.querySelector('.selection-mark');if(mark)mark.textContent=i===index?'✓ 已選':'';
 });
 $('inventory-selection').textContent=`已選 ${list[index].code} · ${list[index].zone?`${list[index].zone} 區`:'待上架'}`;
 $('inventory-confirm').disabled=false;
 if(focus){const card=$('parcel-grid').children[index];card?.focus({preventScroll:true});card?.scrollIntoView({block:'nearest'});}
}
function confirmParcel(){
 if(!selected||!canWork()||inventoryBusy)return;
 const item=inventoryPackages().find(p=>p?.id===selected);
 if(!item){selected=null;$('inventory-confirm').disabled=true;$('inventory-feedback').textContent='這件貨物已移動，請重新選擇。';return;}
 inventoryBusy=true;$('inventory-confirm').disabled=true;$('inventory-confirm').textContent='處理中…';
 const result=shift.take(selected);
 if(result.ok){closeInventory();handleResult(result,'pickup');}
 else{inventoryBusy=false;$('inventory-confirm').disabled=false;$('inventory-confirm').textContent='確認取件';$('inventory-feedback').textContent=result.message;}
}
function closeInventory(focus=true){
 if($('inventory-dialog').open)$('inventory-dialog').close();
 inventoryContext=null;selected=null;inventoryBusy=false;clearInput();if(focus)canvas.focus({preventScroll:true});
}
function finish(){
 closeDialogs();clearInput();action=null;const s=shift.stats;
 $('result-title').textContent=`第 ${shift.day} 天 · 當值成績`;
 $('result-comment').textContent=s.completed+s.shipped>=8?'手腳俐落，街坊都收齊貨！':s.completed+s.shipped>0?'每一單都係進步，下次再順手啲。':'下一天先接待客人，再按提示找貨，慢慢掌握節奏。';
 $('result-grid').replaceChildren();
 for(const [label,value] of [['累計收入',`$${shift.totalRevenue}`],['完成提貨',`${s.completed} 單`],['完成寄貨',`${s.shipped} 單`],['服務收入',`$${s.revenue}`],['新貨上架',`${s.stocked} 件`],['錯件／流失',`${s.errors} / ${s.missed}`]]){
  const box=document.createElement('div'),name=document.createElement('small'),number=document.createElement('strong');
  name.textContent=label;number.textContent=value;box.append(name,number);$('result-grid').append(box);
 }
 $('pause-button').disabled=true;showDialog('result-dialog');
}
function processEvents(){
 for(const event of shift.drainEvents()){
  if(event.type==='customer')actors.set(event.order.id,{id:event.order.id,appearance:event.order.appearance,
   x:ENTRANCE.x,y:ENTRANCE.y,face:'down',moving:true,travel:0,carrying:event.order.type==='shipping',entered:false,route:[{x:40,y:64},{x:25,y:64},{x:25,y:142}],next:0});
  if(event.type==='delivered'||event.type==='missed'||event.type==='closed'||event.type==='shippingAccepted'){
   const actor=actors.get(event.order.id);
   if(actor){actors.delete(actor.id);actor.carrying=event.type==='delivered'||event.order.type==='shipping'&&event.type!=='shippingAccepted';actor.route=[{x:actor.x,y:100},{x:25,y:100},{x:25,y:52},{x:40,y:24},{...ENTRANCE}];actor.next=0;departures.push(actor);}
   if(event.type==='delivered')beep(true);else if(event.type==='missed')toast('有客人等唔切走咗，包裹會保留喺店內。',true);
  }
  if(event.type==='shipped')beep(true);
  if(event.type==='wrong')beep(false);
  if(event.type==='arrival')toast(`新貨到！收貨區多咗 ${event.count} 件。`);
  if(event.type==='end')finish();
  if(event.type==='stocking'){toast('收舖上架：不計時，自由選 A／B／C；也可隨時進入下一天。');}
  if(event.type==='daystart'){
   closeDialogs();action=null;queueSignature='';$('pause-button').disabled=false;
   toast(`第 ${event.day} 天開門！貨架位置已保留，先到櫃檯接客。`);
  }
 }
 if(shift.practice&&shift.stats.completed>=1&&shift.stats.stocked>=1&&!practiceDone){
  practiceDone=true;shift.pause();closeDialogs();showDialog('practice-done-dialog');
 }
}
const canStand=canStandAt;
function updatePlayer(dt){
 player.moving=false;
 if(!canWork()||dialogOpen()||action)return;
 let dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+joystickVector.x;
 let dy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+joystickVector.y;
 const length=Math.hypot(dx,dy);if(length<.1)return;
 if(length>1){dx/=length;dy/=length;}
 player.face=Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'up':'down');
 const oldX=player.x,oldY=player.y,speed=80;
 const steps=Math.ceil(speed*dt/3);
 for(let n=0;n<steps;n++){
  const x=player.x+dx*speed*dt/steps,y=player.y+dy*speed*dt/steps;
  if(canStand(x,player.y))player.x=x;
  if(canStand(player.x,y))player.y=y;
 }
 const distance=Math.hypot(player.x-oldX,player.y-oldY);player.moving=distance>.05;player.travel+=distance;
}
function walkActor(actor,target,dt){
 const dx=target.x-actor.x,dy=target.y-actor.y,d=Math.hypot(dx,dy);
 actor.moving=d>1;
 if(actor.moving){const step=Math.min(d,dt*54);actor.x+=dx/d*step;actor.y+=dy/d*step;actor.travel+=step;
  actor.face=Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'up':'down');
 }else actor.face='up';
}
function followRoute(actor,dt){
 const target=actor.route[actor.next];if(!target)return true;
 walkActor(actor,target,dt);if(Math.hypot(actor.x-target.x,actor.y-target.y)<1)actor.next++;
 return actor.next>=actor.route.length;
}
function updateActors(dt){
 shift.queue.forEach((order,i)=>{
  const actor=actors.get(order.id);if(!actor)return;
  if(!actor.entered){actor.entered=followRoute(actor,dt);return;}
  walkActor(actor,queuePoints[i],dt);if(!actor.moving)actor.face='down';
 });
 departures=departures.filter(actor=>!followRoute(actor,dt));
}
function drawTile(index,x,y){const img=images.get('tiles');if(img)ctx.drawImage(img,index%4*32,Math.floor(index/4)*32,32,32,x,y,32,32);}
function drawProp(name,x,y,scale=1){
 const img=images.get(name);if(!img)return;
 ctx.drawImage(img,x-48*scale,y-76*scale,96*scale,80*scale);
}
function drawLongCounter(){
 const img=images.get('counter');if(!img)return;
 for(const [left,right] of [[0,GATE.left],[GATE.right,world.width]]){
  for(let x=left;x<right;x+=16){const width=Math.min(16,right-x);ctx.drawImage(img,40,36,width,40,x,160,width,40);}
 }
 // Build the open counter leaf from the SAME pixels as the fixed counter.
 // Same cream top, teal front, charcoal edging and pixel density; no separate art.
 ctx.save();ctx.translate(GATE.left-6,184);ctx.rotate(Math.PI/2);
 ctx.drawImage(img,40,44,16,30,0,-10,54,20);ctx.restore();
 // Small flush hinges and pull, using the counter's existing cream/edge palette.
 ctx.fillStyle='#253b38';ctx.fillRect(GATE.left-8,185,5,3);ctx.fillRect(GATE.left-8,222,5,3);
 ctx.fillStyle='#e9d9b9';ctx.fillRect(GATE.left-6,186,3,1);ctx.fillRect(GATE.left-6,223,3,1);
 ctx.fillStyle='#253b38';ctx.fillRect(GATE.left-3,228,3,6);
 ctx.fillStyle='#e9d9b9';ctx.fillRect(GATE.left-2,229,1,4);
 drawProp('checkout_terminal',counter.x+10,164,.7);drawProp('scanner',counter.x-24,178,.65);
}
function pill(text,x,y,color='#315b49'){
 ctx.font='bold 11px system-ui';const width=ctx.measureText(text).width+14;
 ctx.fillStyle=color;ctx.fillRect(Math.round(x-width/2),Math.round(y-13),Math.round(width),20);
 ctx.fillStyle='#fff7df';ctx.textAlign='center';ctx.fillText(text,Math.round(x),Math.round(y+1));ctx.textAlign='left';
}
const directionIndex=face=>['down','left','right','up'].indexOf(face);
function drawActor(actor,isPlayer=false){
 const prefix=isPlayer?'clerk':actor.id==='courier'?'courier':people[actor.appearance];
 const carrying=isPlayer?!!shift.held:actor.carrying;
 let image,frame,row=directionIndex(actor.face),work=false;
 if(prefix==='courier'){
  image=images.get(carrying?'courier_carry_walk':'courier_walk');frame=actor.moving?Math.floor(actor.travel/4.5)%8:0;
  if(image)ctx.drawImage(image,frame*32,row*48,32,48,Math.round(actor.x)-16,Math.round(actor.y)-44,32,48);return;
 }
 if(isPlayer&&action){image=images.get('clerk_work');row=directionIndex(action.face);
  frame=(action.name==='place'?4:0)+Math.min(3,Math.floor((1-action.remaining/action.duration)*4));work=true;
 }else if(actor.moving){image=images.get(`${prefix}${carrying?'_carry':''}_walk`);frame=Math.floor(actor.travel/6.7)%8;}
 else if(carrying&&isPlayer){image=images.get('clerk_carry_idle');frame=row;row=0;}
 else if(carrying){image=images.get(`${prefix}_carry_walk`);frame=2;}
 else{image=images.get(`${prefix}_idle`);frame=row;row=0;}
 if(isPlayer){ctx.fillStyle='#31554842';ctx.beginPath();ctx.ellipse(Math.round(actor.x),Math.round(actor.y-1),10,3,0,0,Math.PI*2);ctx.fill();}
 if(image)ctx.drawImage(image,frame*32,row*48,32,48,Math.round(actor.x)-16,Math.round(actor.y)-44,32,48);
 if(isPlayer){ctx.fillStyle='#f4edc9';ctx.beginPath();ctx.moveTo(actor.x,actor.y-51);ctx.lineTo(actor.x-3,actor.y-56);ctx.lineTo(actor.x+3,actor.y-56);ctx.closePath();ctx.fill();}
}
function draw(){
 const bounds=canvas.getBoundingClientRect();if(!bounds.width||!bounds.height)return;
 const dpr=Math.min(window.devicePixelRatio||1,2),w=Math.round(bounds.width*dpr),h=Math.round(bounds.height*dpr);
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 const touch=getComputedStyle($('touch-controls')).display!=='none';
 const scale=touch?1.5:Math.min(2,bounds.width/world.width,bounds.height/world.height),viewW=bounds.width/scale,viewH=bounds.height/scale;
 camera={scale,x:Math.max(0,Math.min(world.width-viewW,player.x-viewW/2)),
  y:Math.max(0,Math.min(world.height-viewH,player.y-viewH/2))};
 const offsetX=Math.max(0,(viewW-world.width)/2),offsetY=Math.max(0,(viewH-world.height)/2);
 ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#bdc6af';ctx.fillRect(0,0,w,h);ctx.imageSmoothingEnabled=false;
 ctx.setTransform(dpr*scale,0,0,dpr*scale,Math.round((offsetX-camera.x)*dpr*scale),Math.round((offsetY-camera.y)*dpr*scale));
 ctx.save();ctx.beginPath();ctx.rect(0,0,world.width,world.height);ctx.clip();
 for(let y=0;y<world.height;y+=32)for(let x=0;x<world.width;x+=32)drawTile(y<32?4:15,x,y);
 // Double-width entrance, centered on the existing NPC route.
 const tiles=images.get('tiles');if(tiles)ctx.drawImage(tiles,64,32,32,32,8,0,64,32);
 for(const point of queuePoints){
  ctx.strokeStyle='#bda879';ctx.lineWidth=1;ctx.strokeRect(point.x-13,point.y-6,26,10);
 }

 const target=closestTarget();
 const drawables=[];
 for(const shelf of targets.filter(t=>t.type==='shelf'))drawables.push({y:shelf.footY,draw:()=>{
  drawProp('shelf_empty',shelf.x,shelf.footY,1.25);
  shift.shelves[shelf.zone].forEach((s,i)=>{
   if(!s.packageId)return;
   drawProp('parcel_small',shelf.x+(i%2===0?-15:15),shelf.footY-27+Math.floor(i/2)*21,.7);
  });
 }});
 drawables.push({y:counter.footY,draw:drawLongCounter});
 for(const t of targets.filter(t=>t.type==='receiving'||t.type==='outbound'))drawables.push({y:t.footY,draw:()=>{
  drawProp(t.type==='receiving'?'receiving_cage':'outbound_cage',t.x,t.footY,1.1);
  const slots=t.type==='receiving'?shift.receiving:shift.outbound;
  if(slots.some(s=>s.packageId))drawProp('parcel_medium',t.x,t.footY-18,.7);
 }});
 if(shift.courier)drawables.push({y:shift.courier.y,draw:()=>drawActor({...shift.courier,id:'courier'})});
 for(const actor of [...actors.values(),...departures])drawables.push({y:actor.y,draw:()=>drawActor(actor)});
 drawables.push({y:player.y,draw:()=>drawActor(player,true)});
 drawables.sort((a,b)=>a.y-b.y).forEach(d=>d.draw());
 for(const shelf of targets.filter(t=>t.type==='shelf'))pill(`${shelf.zone} 區`,shelf.x,280);
 pill(`收貨 ${shift.receivingCount()}/6`,receiving.x,77,'#8d693f');
 const outbound=targets.find(t=>t.type==='outbound');
 pill(`寄貨 ${shift.outbound.filter(s=>s.packageId).length}/6`,outbound.x,280,'#73518b');
 pill('互動',counter.x-38,218);
 if(target){
  ctx.strokeStyle='#f9fbdf';ctx.lineWidth=1;ctx.strokeRect(target.x-26,target.y-12,52,20);
  if(!touch&&target.type!=='counter')pill(`E · ${targetLabel(target)}`,player.x,player.y+17,'#214738');
 }
 ctx.restore();
}
function updateUI(){
 const order=shift.queue[0],known=order?.revealed,held=shift.held?shift.packages.get(shift.held):null;
 const stocking=shift.phase==='stocking'||shift.phase==='paused'&&shift.pausedPhase==='stocking';
 const holdingShipping=held?.kind==='shipping';
 const seconds=Math.ceil(shift.remaining);
 $('clock').textContent=stocking?'不限時':shift.practice?'練習':`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
 $('clock-label').textContent=stocking?'上架時間':'距離收工';
 $('store-day').textContent=`街坊集運 · 第 ${shift.day} 天`;
 $('clock').parentElement.classList.toggle('urgent',!stocking&&!shift.practice&&seconds<=30);
 $('mode-label').textContent=`第 ${shift.day} 天 · ${shift.phase==='paused'?'暫停':stocking?'上架時間':shift.phase==='playing'?(shift.practice?'練習':'營業中'):shift.phase==='closing'?'已收舖':'準備開檔'}`;
 $('order-title').textContent=holdingShipping?'寄貨處理中':'下一單，交畀你';
 $('order-code').textContent=holdingShipping?'寄貨':order?(known?(order.type==='shipping'?'寄貨':order.code):'待接待'):stocking?'整理中':shift.phase==='ready'?'準備中':'等新客';
 $('order-zone').textContent=holdingShipping?'寄':known?(order.type==='shipping'?'寄':shift.packages.get(order.packageId).zone):'—';
 $('order-kind').textContent=holdingShipping?'客人要求':known?(order.type==='shipping'?'客人要求':'客人提貨碼'):'服務狀態';
 $('order-type').textContent=holdingShipping?'寄貨':stocking?'整理':known?(order.type==='shipping'?'寄貨':'提貨'):order?'待接待':'—';
 $('order-location').textContent=holdingShipping?'右下角寄貨區':known?(order.type==='shipping'?'右下角寄貨區':`${shift.packages.get(order.packageId).zone} 區貨架`):order?'到櫃檯接待後顯示':stocking?'新貨可自由選架上架':'';
 document.querySelector('.order-card').classList.toggle('pending',!known&&!holdingShipping);
 $('queue-count').textContent=stocking?`收貨 ${shift.receivingCount()} 件`:`${shift.queue.length} 人等候`;
 const ratio=order?(shift.practice?1:Math.max(0,order.patience/order.maxPatience)):0;
 const activePatience=!!order&&!stocking&&!holdingShipping;
 $('order-patience').hidden=!activePatience;
 const patienceState=ratio<=.2?'danger':ratio<=.4?'warn':'normal';
 const patienceText=shift.practice?'不計時':shift.phase==='paused'?'已暫停':`${Math.ceil(order?.patience||0)} 秒 · ${ratio<=.2?'！快到時':ratio<=.4?'△ 留意':'充足'}`;
 for(const prefix of ['','inventory-']){
  const fill=$(prefix+'patience-fill'),text=$(prefix+'patience-text');
  fill.style.width=`${ratio*100}%`;fill.parentElement.className=`patience-track ${patienceState}`;
  fill.parentElement.hidden=!activePatience||shift.practice;fill.parentElement.setAttribute('aria-valuenow',String(Math.round(ratio*100)));
  text.textContent=activePatience?patienceText:stocking?'不計時':'—';
 }
 $('inventory-patience').hidden=!activePatience;
 $('held-code').textContent=held?`${held.code} · ${held.kind==='shipping'?'待放寄貨區':held.zone?`${held.zone} 區`: '待上架'}`:'空手';
 $('held-icon').style.backgroundImage=`url("${sourceURL(sources.ui_icons)}")`;
 $('order-feedback').hidden=!feedback;
 if(feedback){$('order-feedback').textContent=feedback.text;$('order-feedback').classList.toggle('error',feedback.error);}
 const mini=$('customer-mini');mini.style.backgroundImage=order?`url("${sourceURL(sources[`${people[order.appearance]}_idle`])}")`:'none';
 if(shift.practice)$('guide').textContent=shift.stats.completed?'提貨完成！去收貨區拿一件新貨，自由選 A／B／C 貨架上架。':known?'已登記提貨要求，按提示找貨，再返櫃檯交貨。':'先去櫃檯接待客人，互動後才會顯示提貨碼及貨架位置。';
 $('completed').textContent=String(shift.stats.completed+shift.stats.shipped);$('revenue').textContent=`$${shift.stats.revenue}`;
 const signature=shift.phase+'|'+shift.queue.slice(1).map(o=>`${o.id}:${Math.ceil(o.patience)}`).join('|');
 if(signature!==queueSignature){
  queueSignature=signature;const list=$('queue-list');list.replaceChildren();
  for(const o of shift.queue.slice(1)){
   const row=document.createElement('div');row.className='queue-item';
   for(const [tag,value] of [['span','等候接待'],['strong','—'],['span',shift.practice?'練習':`${Math.ceil(o.patience)}s`]]){
    const el=document.createElement(tag);el.textContent=value;row.append(el);
   }list.append(row);
  }
  if(!list.childNodes.length){const el=document.createElement('p');el.className='quiet';el.textContent=stocking?'今日已停止接客。':'暫時冇其他客，趁機補貨。';list.append(el);}
 }
 $('next-day').hidden=shift.phase!=='stocking';
 const target=closestTarget();$('touch-action').disabled=!target;$('touch-action-label').textContent=targetLabel(target);
 let destination=held?.kind==='shipping'?targets.find(t=>t.id==='outbound'):
  order&&!known?counter:held&&known&&order.packageId===held.id?counter:
  held?held.zone?targets.find(t=>t.id===held.zone):targets.filter(t=>t.type==='shelf').sort((a,b)=>Math.hypot(player.x-a.x,player.y-a.y)-Math.hypot(player.x-b.x,player.y-b.y))[0]:
  known&&order.type==='pickup'?targets.find(t=>t.id===shift.packages.get(order.packageId).zone):receiving;
 if((player.y>202&&destination.y<182)||(player.y<182&&destination.y>202)){
  const above=player.y<182;destination={type:'gate',x:310,y:Math.abs(player.x-310)<18?(above?218:156):(above?156:218)};
 }
 if(player.y>=182&&player.y<=202)destination={type:'gate',x:310,y:destination.y<182?156:218};
 const dx=destination.x-player.x,dy=destination.y-player.y;
 const arrow=Math.abs(dx)>Math.abs(dy)*2?(dx<0?'←':'→'):Math.abs(dy)>Math.abs(dx)*2?(dy<0?'↑':'↓'):
  dy<0?(dx<0?'↖':'↗'):(dx<0?'↙':'↘');
 const destinationName=held?.zone===null&&held.kind!=='shipping'?'自選 A／B／C':destination.type==='shelf'?`${destination.zone} 區貨架`:destination.type==='counter'?'交貨櫃檯':destination.type==='outbound'?'寄貨區':destination.type==='gate'?'員工通道':'收貨區';
 $('scene-status').textContent=canWork()?target?targetLabel(target):`${arrow} ${destinationName}`:
  shift.phase==='paused'?'已暫停':shift.phase==='closing'?'營業結束，準備上架':'等你開檔';
 if($('inventory-dialog').open)updateInventoryRequest();
}

function loop(now){
 const elapsed=Math.max(0,(now-(lastTime||now))/1000),dt=Math.min(.08,elapsed);lastTime=now;
 if(canWork()){
  shift.tick(elapsed);if(feedback){feedback.remaining-=elapsed;if(feedback.remaining<=0)feedback=null;}if(action){action.remaining-=elapsed;if(action.remaining<=0)action=null;}
  updatePlayer(dt);updateActors(dt);processEvents();
 }
 draw();updateUI();requestAnimationFrame(loop);
}

window.addEventListener('keydown',e=>{
 const key=e.key.toLowerCase();
 if($('inventory-dialog').open){
  if(['arrowleft','arrowright','arrowup','arrowdown'].includes(key)){
   e.preventDefault();const count=inventoryPackages().length,columns=getComputedStyle($('parcel-grid')).gridTemplateColumns.split(' ').length,delta=key==='arrowleft'?-1:key==='arrowright'?1:key==='arrowup'?-columns:columns;
   if(selectedIndex<0){const first=inventoryPackages().findIndex(Boolean);if(first>=0)selectParcel(first);return;}
   let index=selectedIndex;for(let n=0;n<count;n++){index=(index+delta+count)%count;if(inventoryPackages()[index]){selectParcel(index);break;}}
  }else if(key==='enter'&&e.target.id!=='inventory-close'&&e.target.id!=='inventory-pause'&&e.target.id!=='inventory-back'){
   e.preventDefault();if(!e.repeat)confirmParcel();
  }return;
 }
 if(dialogOpen())return;
 if(['w','a','s','d','arrowleft','arrowright','arrowup','arrowdown','e','escape','p'].includes(key)){
  e.preventDefault();if(!canWork())return;
  if(key==='escape'||key==='p'){if(!e.repeat)pause();return;}
  if(key==='e'){if(!e.repeat)interact();return;}keys.add(key);
 }
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{clearInput();pause('你離開咗遊戲畫面，班次已自動暫停。');});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();pause('畫面已切到背景，班次與客人耐性已暫停。');}});
let previousSize={width:innerWidth,height:innerHeight};
window.addEventListener('resize',()=>{
 if(Math.abs(innerWidth-previousSize.width)>25||Math.abs(innerHeight-previousSize.height)>100){
  clearInput();pause('畫面大小已改變；介面已重新排列，準備好再繼續。');
 }previousSize={width:innerWidth,height:innerHeight};
});
const joy=$('joystick');
function moveJoystick(e){
 if(e.pointerId!==joystickPointer)return;
 const r=joy.getBoundingClientRect(),radius=r.width*.32;
 let x=(e.clientX-r.left-r.width/2)/radius,y=(e.clientY-r.top-r.height/2)/radius;
 const length=Math.hypot(x,y);if(length>1){x/=length;y/=length;}
 joystickVector=length<.15?{x:0,y:0}:{x,y};
 $('joystick-knob').style.transform=`translate(${x*radius}px,${y*radius}px)`;
}
joy.addEventListener('pointerdown',e=>{
 if(joystickPointer!==null||!canWork()||dialogOpen())return;
 e.preventDefault();joystickPointer=e.pointerId;joy.setPointerCapture(e.pointerId);moveJoystick(e);
});
joy.addEventListener('pointermove',moveJoystick);
for(const event of ['pointerup','pointercancel','lostpointercapture'])joy.addEventListener(event,e=>{
 if(e.pointerId===joystickPointer){joystickPointer=null;joystickVector={x:0,y:0};$('joystick-knob').style.transform='';}
});
$('touch-action').addEventListener('pointerdown',e=>{e.preventDefault();interact();});
$('touch-action').addEventListener('click',e=>{if(e.detail===0)interact();});
$('pause-button').addEventListener('click',()=>pause());$('help-button').addEventListener('click',()=>pause('操作小抄：時間已暫停，慢慢睇。'));
$('practice-button').addEventListener('click',()=>start(true));$('start-button').addEventListener('click',()=>start(false));
$('resume-button').addEventListener('click',resume);$('restart-button').addEventListener('click',()=>start(shift.practice));
$('play-again').addEventListener('click',()=>{closeDialogs();shift.beginStocking();processEvents();$('pause-button').disabled=false;canvas.focus({preventScroll:true});});
$('next-day').addEventListener('click',()=>{closeInventory(false);shift.nextDay();processEvents();});
$('practice-to-shift').addEventListener('click',()=>start(false));
$('inventory-close').addEventListener('click',()=>closeInventory());$('inventory-confirm').addEventListener('click',confirmParcel);
$('inventory-pause').addEventListener('click',()=>pause());
$('inventory-back').addEventListener('click',()=>closeInventory());
$('inventory-dialog').addEventListener('cancel',e=>{e.preventDefault();closeInventory();});
$('pause-dialog').addEventListener('cancel',e=>{e.preventDefault();resume();});
for(const id of ['welcome-dialog','result-dialog','practice-done-dialog'])$(id).addEventListener('cancel',e=>e.preventDefault());
document.querySelector('.brand').addEventListener('click',e=>e.preventDefault());
showDialog('welcome-dialog');requestAnimationFrame(loop);
function packRuntimeImage(name,img){
 if(name==='courier_walk'||name==='courier_carry_walk'){
  const packed=document.createElement('canvas');packed.width=256;packed.height=192;
  const painter=packed.getContext('2d');painter.imageSmoothingEnabled=false;
  const state=name==='courier_walk'?'empty':'carry';
  COURIER_ART.frames[state].forEach((b,i)=>{
   const w=Math.round(b.w*COURIER_ART.scale),h=Math.round(b.h*COURIER_ART.scale);
   painter.drawImage(img,b.x,b.y,b.w,b.h,i%8*32+16-Math.round(w/2),Math.floor(i/8)*48+44-h,w,h);
  });return packed;
 }
 if(name==='outbound_cage'){
  const packed=document.createElement('canvas');packed.width=96;packed.height=80;
  const painter=packed.getContext('2d');painter.imageSmoothingEnabled=false;
  const [left,top,right,bottom]=COURIER_ART.outboundBounds;
  painter.drawImage(img,left,top,right-left,bottom-top,28,28,40,48);return packed;
 }
 return img;
}
Promise.all(Object.entries(sources).map(([name,path])=>new Promise((resolve,reject)=>{
 const img=new Image();img.onload=()=>{images.set(name,packRuntimeImage(name,img));resolve();};img.onerror=()=>reject(new Error(`Image unavailable: ${name}`));img.src=sourceURL(path);
}))).then(()=>{
 ready=true;$('loading-status').textContent='店面準備好，隨時可以開檔。';
 $('practice-button').disabled=false;$('start-button').disabled=false;
}).catch(error=>{
 loadError=true;$('loading-status').textContent='素材未能載入，請重試或用完整原型檔案開啟。';
 $('start-button').disabled=false;$('start-button').textContent='重新載入';console.error(error);
});

// Read-only QA snapshots; never exposes a way to alter inventory or grant income.
if(new URLSearchParams(location.search).has('qa'))window.__parcelQA={snapshot:()=>({assetSizes:Object.fromEntries([...images].map(([n,img])=>[n,[img.width,img.height]])),world:{...world},gate:{...GATE},targets:targets.map(t=>({...t})),actors:[...actors.values(),...departures].map(a=>({id:a.id,x:a.x,y:a.y,carrying:a.carrying})),courier:shift.courier?{...shift.courier}:null,outbound:shift.outbound.map(s=>({...s})),phase:shift.phase,
 day:shift.day,totalRevenue:shift.totalRevenue,pausedPhase:shift.pausedPhase,receivingCount:shift.receivingCount(),practice:shift.practice,remaining:shift.remaining,player:{...player},held:shift.held?{...shift.packages.get(shift.held)}:null,
 queue:shift.queue.map(o=>({...o})),stats:{...shift.stats},target:closestTarget()?.id||null,
 packages:[...shift.packages.values()].map(p=>({...p})),dialog:dialogIds.find(id=>$(id).open)||null,
 joystick:{...joystickVector},action:action?.name||null})};
