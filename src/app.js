import {Shift, ZONES} from './game.js';

const $ = id => document.getElementById(id);
const canvas = $('shop'), ctx = canvas.getContext('2d');
const images = new Map(), keys = new Set();
const people = ['customer_young', 'customer_office', 'customer_senior'];
const characterNames = ['clerk_walk','clerk_carry_walk','clerk_work','clerk_idle','clerk_carry_idle',
 ...people.flatMap(p=>[`${p}_walk`,`${p}_carry_walk`,`${p}_idle`])];
const propNames = ['shelf_empty','counter','receiving_cage','parcel_small','parcel_medium','parcel_padded',
 'scanner','checkout_terminal','trolley'];
const sources = Object.fromEntries([...characterNames.map(n=>[n,`assets/characters/${n}.png`]),
 ...propNames.map(n=>[n,`assets/environment/props/${n}.png`]),['tiles','assets/environment/shop_tiles.png']]);
const sourceURL = path => window.__PACKAGED_ASSETS__?.[path] || path;
const targets = [
 ...ZONES.map((zone,i)=>({id:zone,type:'shelf',zone,x:96+i*132,y:130,footY:110})),
 {id:'counter',type:'counter',x:300,y:195,footY:237},
 {id:'receiving',type:'receiving',x:116,y:263,footY:270}
];
const obstacles = [...targets.filter(t=>t.type==='shelf').map(t=>({x:t.x-34,y:91,w:68,h:22})),
 {x:252,y:214,w:96,h:24},{x:39,y:244,w:57,h:28}];
const world = {width:480,height:340};
let shift = new Shift(), player, actors = new Map(), departures = [], lastTime = 0;
let action = null, selected = null, inventoryContext = null, selectedIndex = 0;
let joystickPointer = null, joystickVector = {x:0,y:0}, ready = false, loadError = false;
let camera = {x:0,y:0,scale:2}, practiceDone = false, queueSignature = '';
let sound = true, audio = null;
const dialogIds = ['welcome-dialog','inventory-dialog','pause-dialog','result-dialog','practice-done-dialog'];
const canWork = () => shift.canWork();
const requestText = () => {
 const o = shift.queue[0];
 return o ? o.revealed ? `客人要：${o.code} · ${shift.packages.get(o.packageId).zone} 區` : '未接待：先到櫃檯與客人互動。' : shift.phase === 'stocking' ? '收舖整理：新貨可自由放到 A／B／C；不計時。' : '暫時冇客，趁空檔上架新貨。';
};
const dialogOpen = () => dialogIds.some(id=>$(id).open);
function resetPlayer(){ player={x:240,y:178,face:'down',moving:false,travel:0}; }
resetPlayer();

function clearInput(){
 keys.clear();joystickPointer=null;joystickVector={x:0,y:0};$('joystick-knob').style.transform='';
}
function closeDialogs(){ for(const id of dialogIds)if($(id).open)$(id).close();inventoryContext=null;selected=null;clearInput(); }
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
 action=null;practiceDone=false;queueSignature='';shift.start();processEvents();
 $('guide').textContent='先到櫃檯接待客人，再按提貨碼找貨。新貨可自由選 A／B／C 上架。';
 const first=actors.get(shift.queue[0]?.id);if(first){first.x=300;first.y=282;first.moving=false;}
 $('pause-button').disabled=false;canvas.focus({preventScroll:true});
 toast(practice?'練習不計時：先到櫃檯接待客人，登記提貨要求。':'開檔！先接待客人，空檔自由上架新貨。');
}
function pause(reason='所有客人耐性及班次時間已停止。'){
 if(!shift.pause())return;
 if($('inventory-dialog').open)closeInventory(false);
 $('pause-reason').textContent=reason;showDialog('pause-dialog');
}
function resume(){
 if($('pause-dialog').open)$('pause-dialog').close();
 clearInput();shift.resume();lastTime=performance.now();canvas.focus({preventScroll:true});
}
function closestTarget(){
 if(!canWork()||dialogOpen()||action)return null;
 return targets.map(t=>({...t,distance:Math.hypot(player.x-t.x,player.y-t.y)}))
  .filter(t=>t.distance<47).sort((a,b)=>a.distance-b.distance)[0]||null;
}
function targetLabel(target){
 if(!target)return '行近目標';
 if(target.type==='counter')return shift.phase==='stocking'?'已停止接客':shift.queue[0]&&!shift.queue[0].revealed?'接待客人':shift.held?'交付包裹':'查看訂單';
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
 toast(result.message,!result.ok);
 if(result.ok&&animation)action={name:animation,remaining:.4,duration:.4,face:player.face};
 processEvents();canvas.focus({preventScroll:true});
}
function interact(){
 const target=closestTarget();if(!target)return;
 faceToward(target);
 if(target.type==='counter'){
  if(shift.phase==='stocking'){toast('今日已停止接客，先整理新貨或按「下一天」開門。');return;}
  const first=actors.get(shift.queue[0]?.id);
  if(first&&Math.hypot(first.x-300,first.y-282)>12){toast('客人行緊過嚟，等佢到櫃檯先。');return;}
  handleResult(shift.deliver(),'place');
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
function openInventory(target){
 inventoryContext=target;selected=null;selectedIndex=0;
 $('inventory-title').textContent=target.type==='shelf'?`${target.zone} 區貨架`:'收貨區 · 待上架新貨';
 $('inventory-feedback').textContent='';
 const order=shift.queue[0];
 $('inventory-request').textContent=requestText();
 $('inventory-footnote').textContent=shift.phase==='stocking'?'上架時間不計時 · 可隨時按上方「下一天」':'選貨時仍會計時 · 方向鍵選擇，Enter 確認，Esc 返回';
 const list=inventoryPackages(),grid=$('parcel-grid');grid.replaceChildren();
 list.forEach((p,i)=>{
  const button=document.createElement('button');button.className='parcel-choice';button.type='button';
  button.setAttribute('aria-pressed','false');button.dataset.index=String(i);button.disabled=!p;
  if(p){
   const img=document.createElement('img');img.src=sourceURL(sources.parcel_medium);img.alt='';
   const label=document.createElement('span'),code=document.createElement('strong'),zone=document.createElement('small');
   code.textContent=p.code;zone.textContent=p.zone?`${p.zone} 區 · 架上包裹`:'自選 A／B／C 上架';
   label.append(code,zone);button.append(img,label);button.setAttribute('aria-label',`包裹 ${p.code}，${p.zone ? `${p.zone} 區` : '待上架'}`);
   button.addEventListener('click',()=>selectParcel(i));
  }else{button.textContent='空貨位';button.setAttribute('aria-label','空貨位');}
  grid.append(button);
 });
 $('inventory-confirm').disabled=true;
 showDialog('inventory-dialog');
 const first=list.findIndex(Boolean);if(first>=0)selectParcel(first,true);else $('inventory-close').focus();
}
function selectParcel(index,focus=true){
 const list=inventoryPackages();if(!list[index])return;
 selected=list[index].id;selectedIndex=index;
 $('parcel-grid').querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
 $('inventory-confirm').disabled=false;
 if(focus)$('parcel-grid').children[index]?.focus({preventScroll:true});
}
function confirmParcel(){
 if(!selected||!canWork())return;
 const result=shift.take(selected);
 if(result.ok){closeInventory();handleResult(result,'pickup');}
 else $('inventory-feedback').textContent=result.message;
}
function closeInventory(focus=true){
 if($('inventory-dialog').open)$('inventory-dialog').close();
 inventoryContext=null;selected=null;clearInput();if(focus)canvas.focus({preventScroll:true});
}
function finish(){
 closeDialogs();clearInput();action=null;const s=shift.stats;
 $('result-title').textContent=`第 ${shift.day} 天 · 當值成績`;
 $('result-comment').textContent=s.completed>=8?'手腳俐落，街坊都收齊貨！':s.completed>0?'每一單都係進步，下次再順手啲。':'下一天先接待客人，再按提示找貨，慢慢掌握節奏。';
 $('result-grid').replaceChildren();
 for(const [label,value] of [['累計收入',`$${shift.totalRevenue}`],['完成交貨',`${s.completed} 單`],['服務收入',`$${s.revenue}`],['新貨上架',`${s.stocked} 件`],['錯件／流失',`${s.errors} / ${s.missed}`]]){
  const box=document.createElement('div'),name=document.createElement('small'),number=document.createElement('strong');
  name.textContent=label;number.textContent=value;box.append(name,number);$('result-grid').append(box);
 }
 $('pause-button').disabled=true;showDialog('result-dialog');
}
function processEvents(){
 for(const event of shift.drainEvents()){
  if(event.type==='customer')actors.set(event.order.id,{id:event.order.id,appearance:event.order.appearance,
   x:462,y:311,face:'left',moving:true,travel:0,carrying:false});
  if(event.type==='delivered'||event.type==='missed'||event.type==='closed'){
   const actor=actors.get(event.order.id);
   if(actor){actors.delete(actor.id);actor.carrying=event.type==='delivered';departures.push(actor);}
   if(event.type==='delivered')beep(true);else if(event.type==='missed')toast('有客人等唔切走咗，包裹會保留喺店內。',true);
  }
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
function canStand(x,y){
 if(x<15||x>465||y<57||y>326)return false;
 return !obstacles.some(o=>x+8>o.x&&x-8<o.x+o.w&&y>o.y&&y-8<o.y+o.h);
}
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
function updateActors(dt){
 shift.queue.forEach((order,i)=>{
  const actor=actors.get(order.id);if(!actor)return;
  const points=[{x:300,y:282},{x:363,y:286},{x:408,y:299},{x:449,y:309}];
  walkActor(actor,points[i],dt);
 });
 departures.forEach(actor=>walkActor(actor,{x:515,y:310},dt));
 departures=departures.filter(actor=>actor.x<500);
}
function drawTile(index,x,y){const img=images.get('tiles');if(img)ctx.drawImage(img,index%4*32,Math.floor(index/4)*32,32,32,x,y,32,32);}
function drawProp(name,x,y,scale=1){const img=images.get(name);if(img)ctx.drawImage(img,x-48*scale,y-76*scale,96*scale,80*scale);}
function pill(text,x,y,color='#315b49'){
 ctx.font='bold 11px system-ui';const width=ctx.measureText(text).width+14;
 ctx.fillStyle=color;ctx.fillRect(Math.round(x-width/2),Math.round(y-13),Math.round(width),20);
 ctx.fillStyle='#fff7df';ctx.textAlign='center';ctx.fillText(text,Math.round(x),Math.round(y+1));ctx.textAlign='left';
}
const directionIndex=face=>['down','left','right','up'].indexOf(face);
function drawActor(actor,isPlayer=false){
 const prefix=isPlayer?'clerk':people[actor.appearance];
 const carrying=isPlayer?!!shift.held:actor.carrying;
 let image,frame,row=directionIndex(actor.face),work=false;
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
 const scale=touch?1.5:2,viewW=bounds.width/scale,viewH=bounds.height/scale;
 camera={scale,x:Math.max(0,Math.min(world.width-viewW,player.x-viewW/2)),
  y:Math.max(0,Math.min(world.height-viewH,player.y-viewH/2))};
 const offsetX=Math.max(0,(viewW-world.width)/2),offsetY=Math.max(0,(viewH-world.height)/2);
 ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#bdc6af';ctx.fillRect(0,0,w,h);ctx.imageSmoothingEnabled=false;
 ctx.setTransform(dpr*scale,0,0,dpr*scale,Math.round((offsetX-camera.x)*dpr*scale),Math.round((offsetY-camera.y)*dpr*scale));
 ctx.save();ctx.beginPath();ctx.rect(0,0,world.width,world.height);ctx.clip();
 for(let y=0;y<world.height;y+=32)for(let x=0;x<world.width;x+=32)drawTile(y<32?4:15,x,y);
 for(const point of [{x:358,y:285},{x:402,y:301},{x:442,y:309}]){
  ctx.strokeStyle='#bda879';ctx.lineWidth=1;ctx.strokeRect(point.x-13,point.y-6,26,10);
 }
 ctx.strokeStyle='#518378';ctx.setLineDash([4,3]);ctx.strokeRect(34,211,99,69);ctx.setLineDash([]);
 const target=closestTarget();
 const drawables=[];
 for(const shelf of targets.filter(t=>t.type==='shelf'))drawables.push({y:shelf.footY,draw:()=>{
  drawProp('shelf_empty',shelf.x,shelf.footY,1.25);
  shift.shelves[shelf.zone].forEach((s,i)=>{
   if(!s.packageId)return;
   drawProp('parcel_small',shelf.x+(i%2===0?-15:15),shelf.footY-27+Math.floor(i/2)*21,.7);
  });
 }});
 drawables.push({y:237,draw:()=>{drawProp('counter',300,237,1.25);drawProp('checkout_terminal',310,198,.7);drawProp('scanner',275,211,.65);}});
 drawables.push({y:270,draw:()=>{
  drawProp('receiving_cage',68,270,1.1);const count=shift.receiving.filter(s=>s.packageId).length;
  if(count)drawProp('parcel_medium',68,248,.9);drawProp('trolley',136,277,.8);
 }});
 for(const actor of [...actors.values(),...departures])drawables.push({y:actor.y,draw:()=>drawActor(actor)});
 drawables.push({y:player.y,draw:()=>drawActor(player,true)});
 drawables.sort((a,b)=>a.y-b.y).forEach(d=>d.draw());
 for(const shelf of targets.filter(t=>t.type==='shelf'))pill(`${shelf.zone} 區`,shelf.x,46);
 pill(`收貨 ${shift.receiving.filter(s=>s.packageId).length}/6`,79,204,'#8d693f');
 if(target){
  ctx.strokeStyle='#f9fbdf';ctx.lineWidth=1;ctx.strokeRect(target.x-35,target.type==='counter'?215:target.type==='receiving'?238:89,70,26);
  if(!touch)pill(`E · ${targetLabel(target)}`,player.x,player.y+17,'#214738');
 }
 ctx.restore();
}
function updateUI(){
 const order=shift.queue[0],known=order?.revealed,held=shift.held?shift.packages.get(shift.held):null;
 const stocking=shift.phase==='stocking'||shift.phase==='paused'&&shift.pausedPhase==='stocking';
 const seconds=Math.ceil(shift.remaining);
 $('clock').textContent=stocking?'不限時':shift.practice?'練習':`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
 $('clock-label').textContent=stocking?'上架時間':'距離收工';
 $('store-day').textContent=`街坊集運 · 第 ${shift.day} 天`;
 $('clock').parentElement.classList.toggle('urgent',!stocking&&!shift.practice&&seconds<=30);
 $('mode-label').textContent=`第 ${shift.day} 天 · ${shift.phase==='paused'?'暫停':stocking?'上架時間':shift.phase==='playing'?(shift.practice?'練習':'營業中'):shift.phase==='closing'?'已收舖':'準備開檔'}`;
 $('order-code').textContent=order?(known?order.code:'待接待'):stocking?'整理中':shift.phase==='ready'?'準備中':'等新客';
 $('order-zone').textContent=known?shift.packages.get(order.packageId).zone:'—';
 $('queue-count').textContent=stocking?`收貨 ${shift.receivingCount()} 件`:`${shift.queue.length} 人等候`;
 const ratio=order?(shift.practice?1:Math.max(0,order.patience/order.maxPatience)):0;
 $('patience-fill').style.width=`${ratio*100}%`;$('patience-fill').classList.toggle('low',ratio<.3);
 $('patience-fill').parentElement.setAttribute('aria-valuenow',String(Math.round(ratio*100)));
 $('patience-text').textContent=stocking?'不計時':order?(shift.practice?'不計時':`${Math.ceil(order.patience)}s`):'—';
 $('held-code').textContent=held?`${held.code} · ${held.zone?`${held.zone} 區`:'自選貨架'}`:'空手 · 可以取件';
 const mini=$('customer-mini');mini.style.backgroundImage=order?`url("${sourceURL(sources[`${people[order.appearance]}_idle`])}")`:'none';
 if(shift.practice)$('guide').textContent=shift.stats.completed?'提貨完成！去收貨區拿一件新貨，自由選 A／B／C 貨架上架。':known?'已登記提貨要求，按提示找貨，再返櫃檯交貨。':'先去櫃檯接待客人，互動後才會顯示提貨碼及貨架位置。';
 $('completed').textContent=String(shift.stats.completed);$('revenue').textContent=`$${shift.stats.revenue}`;
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
 const destination=order&&!known?targets.find(t=>t.id==='counter'):
  held&&known&&order.packageId===held.id?targets.find(t=>t.id==='counter'):
  held?held.zone?targets.find(t=>t.id===held.zone):targets.filter(t=>t.type==='shelf').sort((a,b)=>Math.hypot(player.x-a.x,player.y-a.y)-Math.hypot(player.x-b.x,player.y-b.y))[0]:
  known?targets.find(t=>t.id===shift.packages.get(order.packageId).zone):targets.find(t=>t.id==='receiving');
 const dx=destination.x-player.x,dy=destination.y-player.y;
 const arrow=Math.abs(dx)>Math.abs(dy)*2?(dx<0?'←':'→'):Math.abs(dy)>Math.abs(dx)*2?(dy<0?'↑':'↓'):
  dy<0?(dx<0?'↖':'↗'):(dx<0?'↙':'↘');
 const destinationName=held?.zone===null?'自選 A／B／C':destination.type==='shelf'?`${destination.zone} 區貨架`:destination.type==='counter'?'交貨櫃檯':'收貨區';
 $('scene-status').textContent=canWork()?target?targetLabel(target):`${arrow} ${destinationName}`:
  shift.phase==='paused'?'已暫停':shift.phase==='closing'?'營業結束，準備上架':'等你開檔';
 if($('inventory-dialog').open)$('inventory-request').textContent=requestText();
}

function loop(now){
 const elapsed=Math.max(0,(now-(lastTime||now))/1000),dt=Math.min(.08,elapsed);lastTime=now;
 if(canWork()){
  shift.tick(elapsed);if(action){action.remaining-=elapsed;if(action.remaining<=0)action=null;}
  updatePlayer(dt);updateActors(dt);processEvents();
 }
 draw();updateUI();requestAnimationFrame(loop);
}

window.addEventListener('keydown',e=>{
 const key=e.key.toLowerCase();
 if($('inventory-dialog').open){
  if(['arrowleft','arrowright','arrowup','arrowdown'].includes(key)){
   e.preventDefault();const count=inventoryPackages().length,delta=key==='arrowleft'?-1:key==='arrowright'?1:key==='arrowup'?-2:2;
   let index=selectedIndex;for(let n=0;n<count;n++){index=(index+delta+count)%count;if(inventoryPackages()[index]){selectParcel(index);break;}}
  }else if(key==='enter'&&e.target.id!=='inventory-close'&&e.target.id!=='inventory-pause'){
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
$('inventory-pause').addEventListener('click',()=>{closeInventory(false);pause();});
$('inventory-dialog').addEventListener('cancel',e=>{e.preventDefault();closeInventory();});
$('pause-dialog').addEventListener('cancel',e=>{e.preventDefault();resume();});
for(const id of ['welcome-dialog','result-dialog','practice-done-dialog'])$(id).addEventListener('cancel',e=>e.preventDefault());
document.querySelector('.brand').addEventListener('click',e=>e.preventDefault());
showDialog('welcome-dialog');requestAnimationFrame(loop);
Promise.all(Object.entries(sources).map(([name,path])=>new Promise((resolve,reject)=>{
 const img=new Image();img.onload=()=>{images.set(name,img);resolve();};img.onerror=()=>reject(new Error(`Image unavailable: ${name}`));img.src=sourceURL(path);
}))).then(()=>{
 ready=true;$('loading-status').textContent='店面準備好，隨時可以開檔。';
 $('practice-button').disabled=false;$('start-button').disabled=false;
}).catch(error=>{
 loadError=true;$('loading-status').textContent='素材未能載入，請重試或用完整原型檔案開啟。';
 $('start-button').disabled=false;$('start-button').textContent='重新載入';console.error(error);
});

// Read-only QA snapshots; never exposes a way to alter inventory or grant income.
if(new URLSearchParams(location.search).has('qa'))window.__parcelQA={snapshot:()=>({phase:shift.phase,
 day:shift.day,totalRevenue:shift.totalRevenue,pausedPhase:shift.pausedPhase,receivingCount:shift.receivingCount(),practice:shift.practice,remaining:shift.remaining,player:{...player},held:shift.held?{...shift.packages.get(shift.held)}:null,
 queue:shift.queue.map(o=>({...o})),stats:{...shift.stats},target:closestTarget()?.id||null,
 packages:[...shift.packages.values()].map(p=>({...p})),dialog:dialogIds.find(id=>$(id).open)||null,
 joystick:{...joystickVector},action:action?.name||null})};
