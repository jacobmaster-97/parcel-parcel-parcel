import {loadPreferences,savePreferences} from './preferences.js';
import {CUSTOMER_TYPES} from './customers.js';
import {BackgroundMusic} from './music.js';
import {ACHIEVEMENTS,achievementTier} from './achievements.js';
import {Shift, ZONES} from './game.js';
import {WORLD,TARGETS,GATE,QUEUE_POINTS,ENTRANCE,canStandInShop,shopLayout} from './layout.js';
import {COURIER_ART} from './courier-art.js';
import {makeSave,readSave,encodeShift,decodeShift} from './save.js';
import {DAY_EVENTS,dayEventSummary,eventSeedFromText} from './day-events.js';
import {upgradeOptions} from './upgrades.js';
import {SaveStore} from './storage.js';
import {NpcSpeech,eligibleLines,placeSpeech} from './npc-dialogue.js';

const $ = id => document.getElementById(id);
const canvas = $('shop'), ctx = canvas.getContext('2d');
const images = new Map(), keys = new Set();
const people = CUSTOMER_TYPES.map(c=>c.key);
const characterNames = ['courier_walk','courier_carry_walk',...['player','worker'].flatMap(p=>['walk','carry_walk','work','idle','carry_idle'].map(a=>`${p}_${a}`)),
 ...people.flatMap(p=>[`${p}_walk`,`${p}_carry_walk`,`${p}_idle`])];
const propNames = ['shelf_empty','counter','receiving_cage','parcel_small','parcel_medium','parcel_padded',
 'scanner','checkout_terminal','trolley','outbound_cage','counter_repeat','gate_open','countertop_decor','info_screen','warm_lamp','festive_decoration'];
const sources = Object.fromEntries([...characterNames.map(n=>[n,`assets/characters/${n}.png`]),
 ...propNames.map(n=>[n,`assets/environment/props/${n}.png`]),['tiles','assets/environment/shop_tiles.png'],['interior_tiles','assets/environment/shop_interior_tiles.png'],['ui_icons','assets/ui/ui_icons.png'],['achievement_icons','assets/ui/achievement_icons.png'],['achievement_two_hands','assets/ui/achievement_two_hands.png']]);
const sourceURL = path => window.__PACKAGED_ASSETS__?.[path] || path;
const backgroundMusic=new BackgroundMusic({business:sourceURL('assets/audio/business.mp3'),stocking:sourceURL('assets/audio/stocking.mp3')});
let audioFocused=true,sfxMaster=null;
const loadedPreferences=loadPreferences();let preferences=loadedPreferences.values,preferencesExplicit=loadedPreferences.explicit,preferenceStatus=loadedPreferences.error?'未能讀取偏好，暫用標準設定；遊戲存檔未變動。':'設定會記住在這個瀏覽器。';
function syncMusic(){
 const phase=shift.phase==='paused'?shift.pausedPhase:shift.phase;
 const track=phase==='playing'?'business':['closing','upgrading','stocking'].includes(phase)?'stocking':null;
 const enabled=!!track&&preferences.musicEnabled&&preferences.musicVolume>0&&campaignActive&&!ownershipLost&&!saveBusy&&audioFocused&&!document.hidden&&shift.phase!=='paused'&&!$('welcome-dialog').open;
 backgroundMusic.scene(track,track?`${track}:${shift.day}`:null,enabled);
}
function primeAudio(){if(document.hidden)return;audioFocused=true;backgroundMusic.unlock();syncMusic();}
document.addEventListener('pointerdown',primeAudio,{capture:true,passive:true});document.addEventListener('keydown',primeAudio,{capture:true});
let world=WORLD,targets=TARGETS;const queuePoints=QUEUE_POINTS;
function syncLayout(){const layout=shopLayout(shift.shelves);world=layout.world;targets=layout.targets;}
const counter=targets.find(t=>t.type==='counter'),receiving=targets.find(t=>t.type==='receiving');
let shift = new Shift(), player, actors = new Map(), departures = [], lastTime = 0;
const npcSpeech=new NpcSpeech(),successfulDepartures=new Set(),speechLayouts=new Map();let speechBubble=null;
const speechLive=document.createElement('span');speechLive.id='npc-speech-live';speechLive.setAttribute('role','status');speechLive.setAttribute('aria-live','polite');speechLive.style.cssText='position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap';document.body.append(speechLive);
function resetSpeech(){npcSpeech.reset(shift.dayEvents.seed^shift.day);successfulDepartures.clear();speechBubble=null;speechLive.textContent='';}
syncLayout();
let selectedIds=[];
let action = null, selected = null, inventoryContext = null, selectedIndex = 0;
let joystickPointer = null, joystickVector = {x:0,y:0}, ready = false, loadError = false;
let camera = {x:0,y:0,scale:2}, mapViewport=null, mobileMarkers=[],mobileMarkerKey='',mobileDetailKey='', queueSignature = '';
const legacySound=()=>preferences.musicEnabled||preferences.sfxEnabled;
let suspendedInventory=null,inventoryBusy=false,feedback=null;
const saveStore=new SaveStore();let campaignId=null,campaignActive=false,campaignMemory=null,campaignCatalog=null,saveBusy=false,ownershipLost=false,menuBusy=false,choiceResolve=null,pendingBoundary=null;
let purchasesBlocked=false,upgradeCategory='工具',upgradeBusy=false,eventInfoKey='';
let saveStatus='只在整理完、開下一天前自動保存。';
const mobileLayoutQuery=matchMedia('(pointer:coarse), (max-width:800px), (orientation:landscape) and (max-height:600px)');
const syncMobileLayout=()=>document.body.classList.toggle('full-map-mobile',mobileLayoutQuery.matches);syncMobileLayout();mobileLayoutQuery.addEventListener('change',syncMobileLayout);
const mobileView=()=>document.body.classList.contains('full-map-mobile');
let achievementOrigin=null,achievementViewGame=null,achievementSavedSnapshot=null;
const dialogIds = ['settings-dialog','achievements-dialog','mobile-detail-dialog','welcome-dialog','inventory-dialog','pause-dialog','result-dialog','finance-dialog','checkpoint-dialog','confirm-dialog','upgrade-prompt','upgrade-dialog'];
const canWork = () => shift.canWork()&&!saveBusy&&!ownershipLost;
const rackHints = () => shift.upgrades.cargoManagement;
const rackMessage = text => rackHints()?text:text.replace(/[A-D] 區貨架/g,'貨架').replace(/[A-D] 區/g,'貨架');
const requestText = () => {
 const o = shift.queue[0];
 return o ? o.type==='shipping'&&o.revealed?'客人寄貨：請將手上貨物放到寄貨區':o.revealed ? `客人要：${o.code} · ${rackHints()?`${o.zone} 區貨架`:"請逐架尋找"}` : '未接待：先到櫃檯與客人互動。' : shift.phase === 'stocking' ? '收舖整理：新貨可自由放到 已開放貨架；不計時。' : '暫時冇客，趁空檔上架新貨。';
};
const dialogOpen = () => dialogIds.some(id=>$(id).open);
function resetPlayer(){ player={x:174,y:232,face:'down',moving:false,travel:0}; }
resetPlayer();

function clearInput(){
 keys.clear();joystickPointer=null;joystickVector={x:0,y:0};$('joystick-knob').style.transform='';
}
function closeDialogs(){ for(const id of dialogIds)if($(id).open)$(id).close();inventoryContext=null;selected=null;selectedIds=[];suspendedInventory=null;clearInput(); }
function showDialog(id){clearInput();if(!$(id).open)$(id).showModal();}
// The floating message area is intentionally silent in every game phase.
function toast() {}

function beep(success=true){
 if(!preferences.sfxEnabled||preferences.sfxVolume===0)return;
 try{
  const audio=backgroundMusic.context;if(!audio||audio.state!=='running')return;
  if(!sfxMaster){sfxMaster=audio.createGain();sfxMaster.connect(audio.destination);}
  sfxMaster.gain.setValueAtTime(preferences.sfxVolume/100,audio.currentTime);backgroundMusic.duck();
  const osc=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;
  osc.type='triangle';osc.frequency.setValueAtTime(success?660:185,now);
  if(success)osc.frequency.setValueAtTime(880,now+.08);
  gain.gain.setValueAtTime(.025,now);gain.gain.exponentialRampToValueAtTime(.001,now+.19);
  osc.connect(gain);gain.connect(sfxMaster);osc.start();osc.stop(now+.2);
 }catch{/* Audio is optional; gameplay continues if the browser denies it. */}
}
function beginSession(){
 if(!ready){if(loadError)location.reload();return;}
 backgroundMusic.reset();closeDialogs();shift=new Shift({deferDayStart:true,eventSeed:eventSeedFromText(campaignId)});syncLayout();resetPlayer();actors=new Map();departures=[];
 action=null;feedback=null;queueSignature='';resetSpeech();shift.start();processEvents();
 $('guide').textContent='先到櫃檯接待客人，再按提貨碼找貨。新貨可自由選 已開放貨架 上架。';
 const first=actors.get(shift.queue[0]?.id);if(first){first.x=queuePoints[0].x;first.y=queuePoints[0].y;first.moving=false;first.entered=true;}
 $('pause-button').disabled=false;canvas.focus({preventScroll:true});
 toast('開檔！先接待客人，空檔自由上架新貨。');
}
function pause(reason='所有客人耐性及班次時間已停止。'){
 if(!shift.pause())return;
 if($('inventory-dialog').open){
  const saved={target:{...inventoryContext},selected,selectedIds:[...selectedIds],scroll:$('inventory-scroll').scrollTop};
  closeInventory(false);suspendedInventory=saved;
 }
 $('pause-reason').textContent=reason;showDialog('pause-dialog');syncMusic();
}
function resume(){
 if(ownershipLost){$('pause-reason').textContent='這個分頁已停止寫入。請匯出本頁或回主選單載入最新進度。';return;}
 if(shift.phase==='closing'){closeDialogs();finish();return;}
 if(shift.phase==='upgrading'){closeDialogs();showUpgradePrompt();return;}
 if(shift.phase==='dayend'){closeDialogs();completeBoundary();return;}
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
 if(!shift.held)return rackHints()?`查看 ${target.zone} 區貨架`:'查看貨架';
 const p=shift.packages.get(shift.held);
 return p.origin?.type==='shelf'&&p.origin.zone===target.zone?'退回原位':'貨物上架';
}
function faceToward(target){
 const dx=target.x-player.x,dy=(target.type==='shelf'?target.footY:target.type==='counter'?target.footY:target.y)-player.y;
 player.face=Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'up':'down');
}
function handleResult(result, animation=null){
 feedback={text:rackMessage(result.message),error:!result.ok,remaining:5};if(!result.ok)beep(false);
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
  const wasHolding=!!shift.held,result=shift.deliver();
  handleResult(result,!wasHolding&&shift.held?'pickup':wasHolding&&!shift.held?'place':null);
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
  label.textContent='客人要求';code.textContent=order.code;code.className='inventory-request-code';node.append(label,code);if(rackHints()){const location=document.createElement("span");location.textContent=`${order.zone} 區貨架`;node.append(location);}
 }else node.textContent=text;
}
const inventoryLimit=()=>inventoryContext?.type==='receiving'&&shift.upgrades.twoHands?2:1;
function openInventory(target,restore=null){
 inventoryContext=target;selected=null;selectedIds=[];selectedIndex=-1;inventoryBusy=false;
 const list=inventoryPackages();
 $('inventory-title').textContent=target.type==='shelf'?`${rackHints()?`${target.zone} 區貨架`:"貨架"} · ${list.length} 格貨位`:`收貨區 · ${list.length} 格待上架`;
 $('inventory-feedback').textContent='';$('inventory-selection').textContent=inventoryLimit()===2?'可選1至2件新貨，按選取順序逐件上架':'請先選一件包裹';
 updateInventoryRequest();
 $('inventory-footnote').textContent=shift.phase==='stocking'?'上架時間不計時 · 返回場景後自由選 已開放貨架 上架':inventoryLimit()===2?'方向鍵移動／Space選取或取消／Enter確認；營業仍計時':'選貨時繼續計時 · 方向鍵選貨 / Enter 確認 / Esc 返回';
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
   mark.className='selection-mark';code.textContent=p.code;zone.textContent=p.zone?`${rackHints()?`${p.zone} 區 · `:""}貨位 ${i+1}`:`待上架 · 貨位 ${i+1}`;
   label.append(code,zone);button.append(icon,label,mark);button.setAttribute('aria-label',`包裹 ${p.code}，${p.zone ? (rackHints()?`${p.zone} 區貨架`:'貨架') : '待上架'}`);
   button.addEventListener('click',()=>selectParcel(i));
  }else{button.classList.add('empty');button.textContent='＋ 空貨位';button.setAttribute('aria-label','空貨位');}
  grid.append(button);
 });
 $('inventory-confirm').disabled=true;$('inventory-confirm').textContent='確認取件';
 showDialog('inventory-dialog');
 const restored=restore?.selectedIds||[restore?.selected].filter(Boolean);
 for(const id of restored){const i=list.findIndex(p=>p?.id===id);if(i>=0&&selectedIds.length<inventoryLimit())selectParcel(i,false);}
 $('inventory-close').focus();$('inventory-scroll').scrollTop=restore?.scroll||0;
}
function selectParcel(index,focus=true){
 const list=inventoryPackages(),item=list[index];if(!item||inventoryBusy)return;
 if(inventoryLimit()===2){
  if(selectedIds.includes(item.id))selectedIds=selectedIds.filter(id=>id!==item.id);
  else if(selectedIds.length<2)selectedIds.push(item.id);
  else{$('inventory-feedback').textContent='最多同時拿兩件；先取消一件再選其他貨物。';return;}
 }else selectedIds=[item.id];
 selected=selectedIds[0]||null;selectedIndex=index;
 $('parcel-grid').querySelectorAll('button').forEach((b,i)=>{
  const chosen=!!list[i]&&selectedIds.includes(list[i].id);b.setAttribute('aria-pressed',String(chosen));const mark=b.querySelector('.selection-mark');if(mark)mark.textContent=chosen?'✓ 已選':'';
 });
 $('inventory-selection').textContent=selectedIds.length?`已選 ${selectedIds.map(id=>list.find(p=>p?.id===id)?.code).join('、')}${inventoryLimit()===2?` · ${selectedIds.length}／2件`:''}`:inventoryLimit()===2?'可選1至2件新貨，按選取順序逐件上架':'請先選一件包裹';
 $('inventory-confirm').disabled=!selectedIds.length;$('inventory-confirm').textContent=inventoryLimit()===2?`確認取件${selectedIds.length?`（${selectedIds.length}件）`:''}`:'確認取件';
 if(focus){const card=$('parcel-grid').children[index];card?.focus({preventScroll:true});card?.scrollIntoView({block:'nearest'});}
}
function confirmParcel(){
 if(!selected||!canWork()||inventoryBusy)return;
 const list=inventoryPackages();
 if(selectedIds.some(id=>!list.some(p=>p?.id===id))){selected=null;$('inventory-confirm').disabled=true;$('inventory-feedback').textContent='這件貨物已移動，請重新選擇。';return;}
 inventoryBusy=true;$('inventory-confirm').disabled=true;$('inventory-confirm').textContent='處理中…';
 const result=shift.takeMany([...selectedIds]);
 if(result.ok){closeInventory();handleResult(result,'pickup');}
 else{inventoryBusy=false;$('inventory-confirm').disabled=false;$('inventory-confirm').textContent='確認取件';$('inventory-feedback').textContent=rackMessage(result.message);}
}
function closeInventory(focus=true){
 if($('inventory-dialog').open)$('inventory-dialog').close();
 inventoryContext=null;selected=null;selectedIds=[];inventoryBusy=false;clearInput();if(focus)canvas.focus({preventScroll:true});
}
function finish(){
 closeDialogs();clearInput();action=null;const s=shift.stats;
 $('result-title').textContent=`第 ${shift.day} 天 · 當值成績`;
 $('result-comment').textContent=s.completed+s.shipped>=8?'手腳俐落，街坊都收齊貨！':s.completed+s.shipped>0?'每一單都係進步，下次再順手啲。':'下一天先接待客人，再按提示找貨，慢慢掌握節奏。';
 $('result-grid').replaceChildren();
 for(const [label,value] of [['可用資金',moneyText(shift.availableFunds())],['完成提貨',`${s.completed} 單`],['完成寄貨',`${s.shipped} 單`],['今日收入',`$${s.revenue}`],['新貨上架',`${s.stocked} 件`],['錯件／流失',`${s.errors} / ${s.missed}`]]){
  const box=document.createElement('div'),name=document.createElement('small'),number=document.createElement('strong');
  name.textContent=label;number.textContent=value;box.append(name,number);$('result-grid').append(box);
 }
 renderAchievementNews();$('pause-button').disabled=true;showDialog('result-dialog');
}
function renderAchievementNews(){
 const entries=ACHIEVEMENTS.filter(c=>shift.achievements?.unlocked[c.id]?.includes(shift.day));const node=$('result-achievements-new');node.hidden=!entries.length;node.textContent=entries.length?`本日新成就：${entries.map(c=>c.name).join('、')}（開下一天前保存）`:'';
}
function renderAchievements(){
 const game=achievementViewGame,a=game?.achievements;
 const unlocked=a?ACHIEVEMENTS.filter(c=>achievementTier(a,c)>0).length:0,complete=a?ACHIEVEMENTS.filter(c=>achievementTier(a,c)===c.goals.length).length:0;
 const summary=$('achievements-summary');summary.replaceChildren();for(const text of game?[`已解鎖 ${unlocked}／${ACHIEVEMENTS.length}`,`滿級 ${complete}／${ACHIEVEMENTS.length}`]:['尚無正式店舖進度']){const part=document.createElement('span');part.textContent=text;summary.append(part);}
 const savedView=achievementOrigin?.id==='welcome-dialog'&&(!campaignMemory||ownershipLost),dirty=!savedView&&JSON.stringify(a)!==achievementSavedSnapshot;
 $('achievements-save-note').textContent=!game?'先開始經營才會累積成就。':`${savedView?'顯示最近保存的店舖進度。':dirty?'成就有未保存進度；開下一天前才會保存。':'成就進度與最近保存點一致；其他遊戲進度仍只在換日前保存。'}${a?.legacy?' 舊檔服務統計由更新後實際工作起累計，不補造歷史。':''}`;
 const grid=$('achievements-cards');grid.replaceChildren();
 if(!game){const empty=document.createElement('p');empty.className='achievement-empty';empty.textContent='查看成就不會建立新店或開始倒數。';grid.append(empty);return;}
 for(const c of ACHIEVEMENTS){const tier=achievementTier(a,c),max=tier===c.goals.length;
  const card=document.createElement('article');card.className=`achievement-card ${tier?'unlocked':'locked'} tier-${tier}`;card.dataset.achievement=c.id;
  const icon=document.createElement('span');icon.className='achievement-icon';icon.setAttribute('role','img');icon.setAttribute('aria-label',tier?`${c.name}已解鎖圖示`:'圖示未解鎖');
  if(tier){icon.style.backgroundImage=`url("${sourceURL(sources[c.iconImage||'achievement_icons'])}")`;if(c.iconImage){icon.style.backgroundSize='100% 100%';icon.style.backgroundPosition='center';}else icon.style.backgroundPosition=`${c.icon%5*25}% ${Math.floor(c.icon/5)*20}%`;}else icon.textContent='?';
  const body=document.createElement('div'),name=document.createElement('h3'),desc=document.createElement('p'),progress=document.createElement('strong'),track=document.createElement('div'),fill=document.createElement('span');
  name.textContent=c.name;desc.textContent=c.description;const target=c.goals[Math.min(tier,c.goals.length-1)],value=a.values[c.id];progress.textContent=`${max?'✓ 已完成':tier?'已解鎖 · 下一階段':'未完成'} · ${Math.min(value,target).toLocaleString()}／${target.toLocaleString()}`;track.className='achievement-track';track.setAttribute('role','progressbar');track.setAttribute('aria-label',c.name);track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax',String(target));track.setAttribute('aria-valuenow',String(Math.min(value,target)));fill.style.width=`${Math.min(1,value/target)*100}%`;track.append(fill);body.append(name,desc,progress);
  if(c.goals.length>1){const levels=document.createElement('small');levels.className='achievement-levels';levels.textContent=c.goals.map((goal,i)=>`${['銅','銀','金'][i]} ${goal.toLocaleString()}${i<tier?' ✓':''}`).join(' · ');body.append(levels);}
  body.append(track);card.append(icon,body);grid.append(card);
 }
}
async function openAchievements(id,button){
 if(menuBusy||saveBusy||$('achievements-dialog').open)return;
 if(id==='welcome-dialog'){
  const memory=!ownershipLost&&campaignMemory,record=memory||campaignCatalog?.current;
  try{achievementViewGame=record?readSave(record).game:null;}catch{achievementViewGame=null;}
 }else{achievementViewGame=shift;}
 achievementOrigin={id,button};clearInput();$(id).close();renderAchievements();showDialog('achievements-dialog');$('achievements-scroll').scrollTop=0;$('achievements-close').focus();
}
function closeAchievements(){if(!$('achievements-dialog').open)return;$('achievements-dialog').close();const from=achievementOrigin;achievementOrigin=null;achievementViewGame=null;clearInput();if(from){showDialog(from.id);$(from.button)?.focus({preventScroll:true});}}
for(const[id,button]of[['welcome-dialog','menu-achievements'],['pause-dialog','pause-achievements'],['result-dialog','result-achievements']])$(button).addEventListener('click',()=>openAchievements(id,button));
$('achievements-close').addEventListener('click',closeAchievements);$('achievements-back').addEventListener('click',closeAchievements);$('achievements-dialog').addEventListener('cancel',e=>{e.preventDefault();closeAchievements();});
function processEvents(){
 for(const event of shift.drainEvents()){
  if(event.type==='customer')actors.set(event.order.id,newCustomerActor(event.order));
  if(event.type==='checkpoint')queueMicrotask(()=>completeBoundary());
  if(event.type==='delivered'||event.type==='missed'||event.type==='closed'||event.type==='shippingAccepted'){
   if(event.type==='delivered'||event.type==='shippingAccepted')successfulDepartures.add(event.order.id);
   const actor=actors.get(event.order.id);
   if(actor){actors.delete(actor.id);actor.carrying=event.type==='delivered'||event.order.type==='shipping'&&event.type!=='shippingAccepted';actor.route=[{x:actor.x,y:100},{x:25,y:100},{x:25,y:52},{x:40,y:24},{...ENTRANCE}];actor.next=0;departures.push(actor);}
   if(event.type==='delivered')beep(true);else if(event.type==='missed')toast('有客人等唔切走咗，包裹會保留喺店內。',true);
  }
  if(event.type==='shipped')beep(true);
  if(event.type==='wrong')beep(false);
  if(event.type==='arrival')toast(`新貨到！收貨區多咗 ${event.count} 件。`);
  if(event.type==='end')finish();
  if(event.type==='stocking'){toast('收舖上架：不計時，自由選 已開放貨架；也可隨時進入下一天。');}
  if(event.type==='daystart'){
   resetSpeech();
   closeDialogs();action=null;queueSignature='';$('pause-button').disabled=false;
   toast(`第 ${event.day} 天開門！貨架位置已保留，先到櫃檯接客。`);
  }
 }
}
const canStand=(x,y)=>canStandInShop(x,y,shift.shelves);
function updatePlayer(dt){
 player.moving=false;
 if(!canWork()||dialogOpen()||action)return;
 let dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+joystickVector.x;
 let dy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+joystickVector.y;
 const length=Math.hypot(dx,dy);if(length<.1)return;
 if(length>1){dx/=length;dy/=length;}
 player.face=Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'up':'down');
 const oldX=player.x,oldY=player.y,speed=shift.moveSpeed();
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
function drawTile(index,x,y){const img=images.get('interior_tiles');if(img)ctx.drawImage(img,index%4*32,Math.floor(index/4)*32,32,32,x,y,32,32);}
function drawProp(name,x,y,scale=1){
 const img=images.get(name);if(!img)return;
 ctx.drawImage(img,x-48*scale,y-76*scale,96*scale,80*scale);
}
function drawLongCounter(){
 const img=images.get('counter_repeat');if(!img)return;
 for(const [left,right] of [[0,GATE.left],[GATE.right,world.width]]){
  for(let x=left;x<right;x+=16){const width=Math.min(16,right-x);ctx.drawImage(img,0,0,width,40,x,160,width,40);}
 }
 // Approved matching gate; geometry and 64px staff passage stay unchanged.
 const gate=images.get('gate_open');if(gate)ctx.drawImage(gate,40,28,16,48,GATE.left-4,184,16,48);
 // Eight decorative props, including the front-facing screen. Feet contact y170.
 const decor=images.get('countertop_decor');if(decor)ctx.drawImage(decor,0,138);
}
function pill(text,x,y,color='#315b49'){
 ctx.font='bold 11px system-ui';const width=ctx.measureText(text).width+14;
 ctx.fillStyle=color;ctx.fillRect(Math.round(x-width/2),Math.round(y-13),Math.round(width),20);
 ctx.fillStyle='#fff7df';ctx.textAlign='center';ctx.fillText(text,Math.round(x),Math.round(y+1));ctx.textAlign='left';
}
const directionIndex=face=>['down','left','right','up'].indexOf(face);
function drawActor(actor,isPlayer=false){
 const isWorker=actor.id==='worker';
 const prefix=isPlayer?'player':isWorker?'worker':actor.id==='courier'?'courier':people[actor.appearance];
 const carrying=isPlayer?!!shift.held:actor.carrying;
 let image,frame,row=directionIndex(actor.face),work=false;
 if(prefix==='courier'){
  image=images.get(carrying?'courier_carry_walk':'courier_walk');frame=actor.moving?Math.floor(actor.travel/4.5)%8:0;
  if(image)ctx.drawImage(image,frame*32,row*48,32,48,Math.round(actor.x)-16,Math.round(actor.y)-44,32,48);return;
 }
 if(isPlayer&&action){image=images.get('player_work');row=directionIndex(action.face);
  frame=(action.name==='place'?4:0)+Math.min(3,Math.floor((1-action.remaining/action.duration)*4));work=true;
 }else if(actor.moving){image=images.get(`${prefix}${carrying?'_carry':''}_walk`);frame=Math.floor(actor.travel/6.7)%8;}
 else if(carrying&&(isPlayer||isWorker)){image=images.get(`${prefix}_carry_idle`);frame=row;row=0;}
 else if(carrying){image=images.get(`${prefix}_carry_walk`);frame=2;}
 else{image=images.get(`${prefix}_idle`);frame=row;row=0;}
 if(isPlayer){ctx.fillStyle='#31554842';ctx.beginPath();ctx.ellipse(Math.round(actor.x),Math.round(actor.y-1),10,3,0,0,Math.PI*2);ctx.fill();}
 if(image)ctx.drawImage(image,frame*32,row*48,32,48,Math.round(actor.x)-16,Math.round(actor.y)-44,32,48);
 if(isPlayer&&shift.heldExtra&&!work&&actor.face!=='up'){const box=images.get('parcel_small');if(box)ctx.drawImage(box,40,60,16,16,Math.round(actor.x)+(actor.face==='left'?-14:actor.face==='right'?2:-6),Math.round(actor.y)-31,12,12);}
 if(isPlayer){ctx.fillStyle='#f4edc9';ctx.beginPath();ctx.moveTo(actor.x,actor.y-51);ctx.lineTo(actor.x-3,actor.y-56);ctx.lineTo(actor.x+3,actor.y-56);ctx.closePath();ctx.fill();}
}
function updateMobileMapLabels(bounds){
 const layer=$('mobile-map-labels');
 if(!mobileView()){if(mobileMarkerKey){layer.replaceChildren();mobileMarkers=[];mobileMarkerKey='';}return;}
 const shelves=targets.filter(t=>t.type==='shelf'),key=String(rackHints())+'|'+shelves.map(t=>t.zone).join();
 if(key!==mobileMarkerKey){
  mobileMarkerKey=key;mobileMarkers=[...(rackHints()?shelves.map(t=>({x:t.x,y:t.footY-49,text:t.zone,type:'shelf'})):[]),{x:receiving.x,y:receiving.footY-41,text:'收',type:'receiving'},...targets.filter(t=>t.type==='outbound').map(t=>({x:t.x,y:t.footY-50,text:'寄',type:'outbound'}))];
  layer.replaceChildren();for(const marker of mobileMarkers){const el=document.createElement('span');el.className=`mobile-map-marker ${marker.type}`;el.textContent=marker.text;marker.el=el;layer.append(el);}
 }
 for(const marker of mobileMarkers){const x=Math.max(12,Math.min(bounds.width-12,mapViewport.x+marker.x*camera.scale)),y=Math.max(11,Math.min(bounds.height-11,mapViewport.y+marker.y*camera.scale));marker.el.style.left=`${x}px`;marker.el.style.top=`${y}px`;marker.rect={x:(x-12-mapViewport.x)/camera.scale,y:(y-11-mapViewport.y)/camera.scale,w:24/camera.scale,h:22/camera.scale};}
}
function updateMobileHud(order,known,held,stocking,holdingShipping,activePatience,ratio,patienceState){
 const title=holdingShipping?'待入籠':order?(known?(order.type==='shipping'?'寄貨':order.code):'待接待'):stocking?'貨物上架':shift.phase==='ready'?'準備中':'等新客';
 $('mobile-code').textContent=title;$('mobile-code').classList.toggle('words',!/^[0-9]+$/.test(title));
 $('mobile-service').textContent=stocking?`第${shift.day}天`:holdingShipping?'寄貨':known&&order.type==='pickup'?'提貨':'服務';
 const showZone=known&&order.type==='pickup'&&rackHints()&&!holdingShipping;$('mobile-zone').hidden=!showZone;$('mobile-zone').textContent=showZone?`${order.zone} 區`:'';
 const location=stocking?`收貨${shift.receivingCount()}件 · 自由選架上架`:holdingShipping?'送到右下寄貨籠':held&&known&&order?.packageId===held.id?'返回櫃檯交貨':order?known?order.type==='shipping'?'寄貨服務':rackHints()?`前往 ${order.zone} 區貨架`:'按提貨碼逐架尋找':'先到櫃檯接待':'趁空檔整理貨物';
 $('mobile-location').textContent=feedback?.error?`！${feedback.text}`:location;
 $('mobile-order-open').classList.toggle('error',!!feedback?.error);$('mobile-order-open').classList.toggle('warn',activePatience&&patienceState==='warn');$('mobile-order-open').classList.toggle('danger',activePatience&&patienceState==='danger');
 $('mobile-patience').textContent=activePatience?shift.phase==='paused'?'已暫停':`${ratio<=.2?'！':ratio<=.4?'△ ':''}耐性 ${Math.ceil(order.patience)}秒`:holdingShipping?'已接收':stocking?'不限時':'';
 $('mobile-patience-track').style.visibility=activePatience?'visible':'hidden';$('mobile-patience-track').setAttribute('aria-valuenow',String(Math.round(ratio*100)));$('mobile-patience-fill').style.width=`${ratio*100}%`;
 $('mobile-held').textContent=shift.heldExtra?shift.heldIds().map(id=>shift.packages.get(id).code).join('／'):held?held.kind==='shipping'?'待寄貨':held.code:'空手';
 $('mobile-order-open').disabled=!shift.canWork()||saveBusy||ownershipLost;
 if(!$('mobile-detail-dialog').open)return;
 const detail={request:holdingShipping?'已接收寄貨，請放到右下寄貨籠。':requestText(),held:$('held-code').textContent,patience:$('mobile-patience').textContent,day:shift.day,phase:shift.phase,receiving:shift.receivingCount(),receivingCapacity:shift.receiving.length,outbound:shift.outbound.filter(s=>s.packageId).length,outboundCapacity:shift.outbound.length,completed:shift.stats.completed+shift.stats.shipped,revenue:shift.stats.revenue,queue:shift.queue.map(o=>({patience:`${Math.ceil(o.patience)}秒`,status:o.revealed?'已接待':'待接待'})),feedback:feedback?.text||''};
 const key=JSON.stringify(detail);if(key===mobileDetailKey)return;mobileDetailKey=key;
 $('mobile-detail-request').textContent=detail.request;$('mobile-detail-feedback').textContent=detail.feedback;$('mobile-detail-feedback').hidden=!detail.feedback;
 const facts=[['營業日',`第${detail.day}天`],['店員手上',detail.held],['客人耐性',detail.patience||'—'],['收貨待上架',`${detail.receiving}／${detail.receivingCapacity}`],['寄貨籠',`${detail.outbound}／${detail.outboundCapacity}`],['等候客人',`${detail.queue.length}人`],['今日完成',`${detail.completed}單`],['今日收入',`$${detail.revenue}`]];
 $('mobile-detail-facts').replaceChildren();for(const[label,value]of facts){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;$('mobile-detail-facts').append(dt,dd);}
 $('mobile-detail-queue').replaceChildren();for(const[o,i]of detail.queue.map((o,i)=>[o,i])){const row=document.createElement('div');row.textContent=`${i+1}. ${o.status} · ${o.patience}`;$('mobile-detail-queue').append(row);}if(!detail.queue.length)$('mobile-detail-queue').textContent=stocking?'今日已停止接客。':'暫時沒有客人。';
}
function openMobileDetails(){if(!canWork()||dialogOpen())return;clearInput();mobileDetailKey='';showDialog('mobile-detail-dialog');updateUI();}
function closeMobileDetails(){$('mobile-detail-dialog').close();clearInput();if(mobileView())$('mobile-order-open').focus({preventScroll:true});else canvas.focus({preventScroll:true});}
function drawNpcSpeech(elapsed,view){
 speechBubble=null;
 const enabled=shift.phase==='playing'&&!dialogOpen()&&!saveBusy&&!ownershipLost;
 if(!enabled){if(shift.phase!=='paused'&&shift.phase!=='playing')npcSpeech.active=null;speechLive.textContent='';return;}
 const event=shift.dayEvents.current.id,allActors=[player,...actors.values(),...departures,...(shift.worker?[shift.worker]:[]),...(shift.courier?[shift.courier]:[])];
 const obstacles=allActors.map(a=>({x:a.x-16,y:a.y-44,w:32,h:48}));
 obstacles.push({x:0,y:0,w:world.width,h:32},{x:0,y:158,w:GATE.left,h:44},{x:GATE.right,y:158,w:world.width-GATE.right,h:44},{x:GATE.left-4,y:184,w:16,h:48},
 {x:receiving.x-39,y:receiving.footY-74,w:78,h:80},{x:274,y:267,w:76,h:67});
 if(!mobileView())obstacles.push({x:108,y:202,w:52,h:26});else obstacles.push(...mobileMarkers.map(m=>m.rect));
 const tooltip=closestTarget();if(tooltip&&tooltip.type!=='counter'&&getComputedStyle($('touch-controls')).display==='none')obstacles.push({x:player.x-55,y:player.y+4,w:110,h:28});
 for(const t of targets.filter(t=>t.type==='shelf'))obstacles.push({x:t.x-34,y:t.footY-66,w:68,h:70});
 const fontSize=Math.max(10,Math.ceil(14/camera.scale)),lineHeight=Math.ceil(fontSize*1.4);ctx.font=`bold ${fontSize}px system-ui`;
 const layout=text=>{const key=`${fontSize}:${text}`;if(speechLayouts.has(key))return speechLayouts.get(key);const lines=[];let line='';for(const c of text){if(line&&ctx.measureText(line+c).width>88){lines.push(line);line='';}line+=c;}if(line)lines.push(line);const b={lines,w:Math.ceil(Math.max(...lines.map(l=>ctx.measureText(l).width)))+12,h:lines.length*lineHeight+10};speechLayouts.set(key,b);return b;};
 const visible=a=>a.y>=64&&a.x-16>=view.x&&a.x+16<=view.x+view.w&&a.y-44>=view.y&&a.y+4<=view.y+view.h;
 const speakers=[];
 for(const o of shift.queue){const a=actors.get(o.id);if(a&&visible(a))speakers.push({...a,id:`guest:${shift.day}:${o.id}`,role:'customer',shipping:o.type==='shipping',ratio:o.patience/o.maxPatience,departing:false});}
 const activeDepartures=new Set(departures.map(a=>a.id));for(const id of successfulDepartures)if(!activeDepartures.has(id))successfulDepartures.delete(id);
 for(const a of departures)if(visible(a))speakers.push({...a,id:`guest:${shift.day}:${a.id}`,role:'customer',departing:true,success:successfulDepartures.has(a.id)});
 if(shift.worker&&visible(shift.worker)){const freeShelf=shift.upgrades.workerZones.reduce((n,z)=>n+shift.shelves[z].filter(s=>!s.packageId&&!s.reservedFor).length,0);speakers.push({...shift.worker,id:`worker:${shift.day}`,role:'worker',event,idle:!shift.worker.task,carrying:!!shift.worker.task?.carrying,hasStock:shift.receivingCount()>0||!!shift.worker.task?.carrying,freeShelf});}
 if(shift.courier&&visible(shift.courier)){const c=shift.courier;speakers.push({...c,id:`courier:${c.id}`,role:'courier',event,freeReceiving:shift.receiving.filter(s=>!s.packageId&&!s.reservedFor).length,nearReceiving:Math.hypot(c.x-receiving.x,c.y-receiving.y)<32});}
 for(const s of speakers)s.allowedLineIds=eligibleLines(s).filter(l=>{const b=layout(l.text);return placeSpeech(s,[b.w,b.h],view,obstacles);}).map(l=>l.id);
 const active=npcSpeech.tick(elapsed,speakers.filter(s=>s.allowedLineIds.length),true);
 if(!active){speechLive.textContent='';return;}
 const actor=speakers.find(s=>s.id===active.speakerId);if(!actor)return;
 const b=layout(active.text),rect=placeSpeech(actor,[b.w,b.h],view,obstacles);if(!rect){speechLive.textContent='';return;}
 ctx.fillStyle='#23473d';ctx.fillRect(rect.x-1,rect.y-1,rect.w+2,rect.h+2);ctx.fillStyle='#fff6df';ctx.fillRect(rect.x,rect.y,rect.w,rect.h);
 const tx=Math.max(rect.x+4,Math.min(rect.x+rect.w-4,actor.x)),ty=Math.max(rect.y+4,Math.min(rect.y+rect.h-4,actor.y-24));
 ctx.fillStyle='#23473d';ctx.beginPath();
 if(actor.x<rect.x||actor.x>rect.x+rect.w){const left=actor.x<rect.x,x=left?rect.x-1:rect.x+rect.w+1;ctx.moveTo(x,ty-3);ctx.lineTo(x,ty+3);ctx.lineTo(x+(left?-3:3),ty);}
 else{const below=rect.y>actor.y-24,y=below?rect.y-1:rect.y+rect.h+1;ctx.moveTo(tx-3,y);ctx.lineTo(tx+3,y);ctx.lineTo(tx,y+(below?-3:3));}ctx.fill();
 ctx.fillStyle='#23473d';ctx.textAlign='left';b.lines.forEach((line,i)=>ctx.fillText(line,rect.x+6,rect.y+fontSize+5+i*lineHeight));
 speechBubble={id:active.id,role:active.role,text:active.text,speakerId:active.speakerId,rect:{...rect},view:{...view},fontCssPixels:fontSize*camera.scale,until:active.until,obstacles:obstacles.map(o=>({...o}))};
 const spoken=`${{customer:'客人',worker:'理貨員',courier:'送貨員'}[active.role]}：${active.text}`;if(speechLive.textContent!==spoken)speechLive.textContent=spoken;
}
function draw(elapsed=0){
 const bounds=canvas.getBoundingClientRect();if(!bounds.width||!bounds.height)return;
 const dpr=Math.min(window.devicePixelRatio||1,2),w=Math.round(bounds.width*dpr),h=Math.round(bounds.height*dpr);
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 const touch=getComputedStyle($('touch-controls')).display!=='none';
 const scale=touch?Math.max(.01,Math.min((bounds.width-2)/world.width,(bounds.height-2)/world.height)):Math.min(2,bounds.width/world.width,bounds.height/world.height),viewW=bounds.width/scale,viewH=bounds.height/scale;
 camera={scale,x:Math.max(0,Math.min(world.width-viewW,player.x-viewW/2)),
  y:Math.max(0,Math.min(world.height-viewH,player.y-viewH/2))};
 const offsetX=Math.max(0,(viewW-world.width)/2),offsetY=Math.max(0,(viewH-world.height)/2);
 mapViewport={x:(offsetX-camera.x)*scale,y:(offsetY-camera.y)*scale,width:world.width*scale,height:world.height*scale,scale,fullMap:touch};updateMobileMapLabels(bounds);
 ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#bdc6af';ctx.fillRect(0,0,w,h);ctx.imageSmoothingEnabled=false;
 ctx.setTransform(dpr*scale,0,0,dpr*scale,Math.round((offsetX-camera.x)*dpr*scale),Math.round((offsetY-camera.y)*dpr*scale));
 ctx.save();ctx.beginPath();ctx.rect(0,0,world.width,world.height);ctx.clip();
 for(let y=0;y<world.height;y+=32)for(let x=0;x<world.width;x+=32)drawTile(y<32?4:(x/32+y/32)%4,x,y);
 // Double-width entrance, centered on the existing NPC route.
 const tiles=images.get('tiles');if(tiles)ctx.drawImage(tiles,64,32,32,32,8,0,64,32);
 drawProp('info_screen',230,30,.5);
 for(const x of[110,175,285])drawProp('warm_lamp',x,13,.45);
 for(const x of[96,310])drawProp('festive_decoration',x,29,.45);
 for(const point of queuePoints){
  ctx.strokeStyle='#bda879';ctx.lineWidth=1;ctx.strokeRect(point.x-13,point.y-6,26,10);
 }

 const target=closestTarget();
 const drawables=[];
 for(const shelf of targets.filter(t=>t.type==='shelf'))drawables.push({y:shelf.footY,draw:()=>{
  const count=shift.shelves[shelf.zone].length,rows=count/2;
  drawProp('shelf_empty',shelf.x,shelf.footY,1.25);
  const shelfImage=images.get('shelf_empty'),parcelImage=images.get('parcel_small');
  if(count>4&&shelfImage){
   ctx.drawImage(shelfImage,26,41,44,10,shelf.x-27,shelf.footY-50,54,45);
   for(let n=1;n<rows;n++)ctx.drawImage(shelfImage,25,53,46,3,shelf.x-28,shelf.footY-50+n*45/rows,56,3);
  }
  shift.shelves[shelf.zone].forEach((s,i)=>{
   const row=Math.floor(i/2),x=shelf.x+(i%2===0?-15:15);
   if(count===4){if(s.packageId)drawProp('parcel_small',x,shelf.footY-27+row*21,.7);}
   else if(s.packageId&&parcelImage){const size=rows===4?10:12;ctx.drawImage(parcelImage,40,60,16,16,x-size/2,shelf.footY-49+row*45/rows,size,size);}
   ctx.fillStyle='#e9d9b9';ctx.font='5px monospace';ctx.fillText(String(i+1),x-10,shelf.footY-38+row*(count===4?21:45/rows));
  });
 }});
 drawables.push({y:counter.footY,draw:drawLongCounter});
 for(const t of targets.filter(t=>t.type==='receiving'||t.type==='outbound'))drawables.push({y:t.footY,draw:()=>{
  drawProp(t.type==='receiving'?'receiving_cage':'outbound_cage',t.x,t.footY,1.1);
  const slots=t.type==='receiving'?shift.receiving:shift.outbound;
  if(slots.some(s=>s.packageId))drawProp('parcel_medium',t.x,t.footY-18,.7);
 }});
 if(shift.worker)drawables.push({y:shift.worker.y,draw:()=>drawActor({...shift.worker,id:'worker',carrying:!!shift.worker.task?.carrying})});
 if(shift.courier)drawables.push({y:shift.courier.y,draw:()=>drawActor({...shift.courier,id:'courier'})});
 for(const actor of [...actors.values(),...departures])drawables.push({y:actor.y,draw:()=>drawActor(actor)});
 drawables.push({y:player.y,draw:()=>drawActor(player,true)});
 drawables.sort((a,b)=>a.y-b.y).forEach(d=>d.draw());

 if(!touch&&rackHints())for(const shelf of targets.filter(t=>t.type==='shelf'))pill(`${shelf.zone} 區`,shelf.x,shelf.footY-49);
 if(!touch)pill(`收貨 ${shift.receivingCount()}/${shift.receiving.length}`,receiving.x,receiving.footY-59,'#8d693f');
 const outbound=targets.find(t=>t.type==='outbound');
 if(!touch){pill(`寄貨 ${shift.outbound.filter(s=>s.packageId).length}/${shift.outbound.length}`,outbound.x,280,'#73518b');pill('互動',counter.x-38,218);}
 if(target){
  ctx.strokeStyle='#f9fbdf';ctx.lineWidth=1;ctx.strokeRect(target.x-26,target.y-12,52,20);
  if(!touch&&target.type!=='counter')pill(`E · ${targetLabel(target)}`,player.x,player.y+17,'#214738');
 }
 const vx=Math.max(0,camera.x-offsetX),vy=Math.max(0,camera.y-offsetY);
 drawNpcSpeech(elapsed,{x:vx,y:vy,w:Math.min(world.width,camera.x-offsetX+viewW)-vx,h:Math.min(world.height,camera.y-offsetY+viewH)-vy});
 ctx.restore();
}
function updateUI(){
 const order=shift.queue[0],known=order?.revealed,held=shift.held?shift.packages.get(shift.held):null;
 const stocking=shift.phase==='stocking'||shift.phase==='paused'&&shift.pausedPhase==='stocking';
 const holdingShipping=held?.kind==='shipping';
 const seconds=Math.ceil(shift.remaining);
 $('clock').textContent=stocking?'不限時':`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
 $('clock-label').textContent=stocking?'上架時間':'距離收工';
 $('store-day').textContent=`街坊集運 · 第 ${shift.day} 天`;
 $('clock').parentElement.classList.toggle('urgent',!stocking&&seconds<=30);
 $('mode-label').textContent=`第 ${shift.day} 天 · ${shift.phase==='paused'?'暫停':stocking?'上架時間':shift.phase==='playing'?shift.currentEvent().mode:shift.phase==='closing'?'已收舖':shift.phase==='upgrading'?'商店升級':'準備開檔'}`;
 $('order-title').textContent=holdingShipping?'寄貨處理中':'下一單，交畀你';
 $('order-code').textContent=holdingShipping?'寄貨':order?(known?(order.type==='shipping'?'寄貨':order.code):'待接待'):stocking?'整理中':shift.phase==='ready'?'準備中':'等新客';
 $('order-zone').textContent=holdingShipping?'寄':known?(order.type==='shipping'?'寄':rackHints()?order.zone:'取'):'—';
 $('order-kind').textContent=holdingShipping?'客人要求':known?(order.type==='shipping'?'客人要求':'客人提貨碼'):'服務狀態';
 $('order-type').textContent=holdingShipping?'寄貨':stocking?'整理':known?(order.type==='shipping'?'寄貨':'提貨'):order?'待接待':'—';
 $('order-location').textContent=holdingShipping?'右下角寄貨區':known?(order.type==='shipping'?'右下角寄貨區':rackHints()?`${order.zone} 區貨架`:'按提貨碼逐架尋找'):order?'到櫃檯接待後顯示':stocking?'新貨可自由選架上架':'';
 document.querySelector('.order-card').classList.toggle('pending',!known&&!holdingShipping);
 $('queue-count').textContent=stocking?`收貨 ${shift.receivingCount()} 件`:`${shift.queue.length} 人等候`;
 const ratio=order?Math.max(0,order.patience/order.maxPatience):0;
 const activePatience=!!order&&!stocking&&!holdingShipping;
 $('order-patience').hidden=!activePatience;
 const patienceState=ratio<=.2?'danger':ratio<=.4?'warn':'normal';
 const patienceText=shift.phase==='paused'?'已暫停':`${Math.ceil(order?.patience||0)} 秒 · ${ratio<=.2?'！快到時':ratio<=.4?'△ 留意':'充足'}`;
 for(const prefix of ['','inventory-']){
  const fill=$(prefix+'patience-fill'),text=$(prefix+'patience-text');
  fill.style.width=`${ratio*100}%`;fill.parentElement.className=`patience-track ${patienceState}`;
  fill.parentElement.hidden=!activePatience;fill.parentElement.setAttribute('aria-valuenow',String(Math.round(ratio*100)));
  text.textContent=activePatience?patienceText:stocking?'不計時':'—';
 }
 $('inventory-patience').hidden=!activePatience;
 $('held-code').textContent=shift.heldExtra?`${shift.heldIds().map(id=>shift.packages.get(id).code).join('、')} · 2件待上架`:held?`${held.code} · ${held.kind==='shipping'?'待放寄貨區':held.zone?(rackHints()?`${held.zone} 區貨架`:'架上貨物'): '待上架'}`:'空手';
 $('held-icon').style.backgroundImage=`url("${sourceURL(sources.ui_icons)}")`;
 $('order-feedback').hidden=!feedback;
 if(feedback){$('order-feedback').textContent=feedback.text;$('order-feedback').classList.toggle('error',feedback.error);}
 const mini=$('customer-mini');mini.style.backgroundImage=order?`url("${sourceURL(sources[`${people[order.appearance]}_idle`])}")`:'none';
 renderEventInfo();
 $('wallet-summary').textContent=`可用資金 ${moneyText(shift.availableFunds())} · 預留薪金 ${moneyText(shift.reservedWages())} · 今日收入 ${moneyText(Object.values(shift.ledger.current.income).reduce((a,b)=>a+b,0))} · 今日支出 ${moneyText(Object.values(shift.ledger.current.expense).reduce((a,b)=>a+b,0)-shift.ledger.current.refund)}`;
 document.querySelectorAll('.save-status').forEach(e=>e.textContent=saveStatus);
 $('completed').textContent=String(shift.stats.completed+shift.stats.shipped);$('revenue').textContent=`$${shift.stats.revenue}`;
 const signature=shift.phase+'|'+shift.queue.slice(1).map(o=>`${o.id}:${Math.ceil(o.patience)}`).join('|');
 if(signature!==queueSignature){
  queueSignature=signature;const list=$('queue-list');list.replaceChildren();
  for(const o of shift.queue.slice(1)){
   const row=document.createElement('div');row.className='queue-item';
   for(const [tag,value] of [['span','等候接待'],['strong','—'],['span',`${Math.ceil(o.patience)}s`]]){
    const el=document.createElement(tag);el.textContent=value;row.append(el);
   }list.append(row);
  }
  if(!list.childNodes.length){const el=document.createElement('p');el.className='quiet';el.textContent=stocking?'今日已停止接客。':'暫時冇其他客，趁機補貨。';list.append(el);}
 }
 $('next-day').hidden=shift.phase!=='stocking';$('shop-button').hidden=shift.phase!=='stocking';
 const target=closestTarget();$('touch-action').disabled=!target;$('touch-action-label').textContent=targetLabel(target);
 let destination=held?.kind==='shipping'?targets.find(t=>t.id==='outbound'):
  order&&!known?counter:held&&known&&order.packageId===held.id?counter:
  held?held.zone?targets.find(t=>t.id===held.zone):targets.filter(t=>t.type==='shelf').sort((a,b)=>Math.hypot(player.x-a.x,player.y-a.y)-Math.hypot(player.x-b.x,player.y-b.y))[0]:
  known&&order.type==='pickup'?{type:'search',x:player.x,y:player.y}:receiving;
 if((player.y>202&&destination.y<182)||(player.y<182&&destination.y>202)){
  const above=player.y<182;destination={type:'gate',x:310,y:Math.abs(player.x-310)<18?(above?218:156):(above?156:218)};
 }
 if(player.y>=182&&player.y<=202)destination={type:'gate',x:310,y:destination.y<182?156:218};
 const dx=destination.x-player.x,dy=destination.y-player.y;
 const arrow=Math.abs(dx)>Math.abs(dy)*2?(dx<0?'←':'→'):Math.abs(dy)>Math.abs(dx)*2?(dy<0?'↑':'↓'):
  dy<0?(dx<0?'↖':'↗'):(dx<0?'↙':'↘');
 const destinationName=held?.zone===null&&held.kind!=='shipping'?'自選 已開放貨架':destination.type==='shelf'?(rackHints()?`${destination.zone} 區貨架`:'貨架'):destination.type==='counter'?'交貨櫃檯':destination.type==='outbound'?'寄貨區':destination.type==='gate'?'員工通道':'收貨區';
 $('scene-status').textContent=canWork()?target?targetLabel(target):destination.type==='search'?(rackHints()?`前往 ${order.zone} 區貨架`:'按提貨碼逐架尋找'):`${arrow} ${destinationName}`:
  shift.phase==='paused'?'已暫停':shift.phase==='closing'?'營業結束，準備上架':shift.phase==='upgrading'?'商店升級':'等你開檔';
 updateMobileHud(order,known,held,stocking,holdingShipping,activePatience,ratio,patienceState);
 if($('inventory-dialog').open)updateInventoryRequest();
}

function loop(now){
 const elapsed=Math.max(0,(now-(lastTime||now))/1000),dt=Math.min(.08,elapsed);lastTime=now;
 if(canWork()){
  shift.selectionId=$('inventory-dialog').open?selected:null;shift.selectionIds=$('inventory-dialog').open?[...selectedIds]:[];shift.workerAvoid=player;shift.tick(elapsed);if(feedback){feedback.remaining-=elapsed;if(feedback.remaining<=0)feedback=null;}if(action){action.remaining-=elapsed;if(action.remaining<=0)action=null;}
  updatePlayer(dt);updateActors(dt);processEvents();
 }
 draw(elapsed);updateUI();syncMusic();requestAnimationFrame(loop);
}

window.addEventListener('keydown',e=>{
 const key=e.key.toLowerCase();
 if($('inventory-dialog').open){
  if(['arrowleft','arrowright','arrowup','arrowdown'].includes(key)){
   e.preventDefault();const count=inventoryPackages().length,columns=getComputedStyle($('parcel-grid')).gridTemplateColumns.split(' ').length,delta=key==='arrowleft'?-1:key==='arrowright'?1:key==='arrowup'?-columns:columns;
   if(selectedIndex<0){const first=inventoryPackages().findIndex(Boolean);if(first>=0){if(inventoryLimit()===2){selectedIndex=first;$('parcel-grid').children[first].focus();}else selectParcel(first);}return;}
   let index=selectedIndex;for(let n=0;n<count;n++){index=(index+delta+count)%count;if(inventoryPackages()[index]){if(inventoryLimit()===2){selectedIndex=index;$('parcel-grid').children[index].focus();}else selectParcel(index);break;}}
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
window.addEventListener('blur',()=>{audioFocused=false;syncMusic();clearInput();pause('你離開咗遊戲畫面，班次已自動暫停。');});
window.addEventListener('focus',()=>{audioFocused=true;syncMusic();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){audioFocused=false;syncMusic();clearInput();pause('畫面已切到背景，班次與客人耐性已暫停。');}});
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
$('mobile-order-open').addEventListener('click',openMobileDetails);
$('mobile-detail-close').addEventListener('click',closeMobileDetails);$('mobile-detail-back').addEventListener('click',closeMobileDetails);$('mobile-detail-dialog').addEventListener('cancel',e=>{e.preventDefault();closeMobileDetails();});$('mobile-detail-pause').addEventListener('click',()=>pause());
$('pause-button').addEventListener('click',()=>pause());$('help-button').addEventListener('click',()=>pause('操作小抄：時間已暫停，慢慢睇。'));
$('start-button').addEventListener('click',()=>start());
$('resume-button').addEventListener('click',resume);$('restart-button').addEventListener('click',()=>campaignMenu());
$('play-again').addEventListener('click',()=>{if(ownershipLost){campaignMenu();return;}shift.managementFrom='closing';shift.phase='upgrading';showUpgradePrompt();});
$('next-day').addEventListener('click',()=>{if(ownershipLost)return;closeInventory(false);shift.nextDay();processEvents();});
$('inventory-close').addEventListener('click',()=>closeInventory());$('inventory-confirm').addEventListener('click',confirmParcel);
$('inventory-pause').addEventListener('click',()=>pause());
$('inventory-back').addEventListener('click',()=>closeInventory());
$('inventory-dialog').addEventListener('cancel',e=>{e.preventDefault();closeInventory();});
$('pause-dialog').addEventListener('cancel',e=>{e.preventDefault();resume();});
for(const id of ['welcome-dialog','result-dialog'])$(id).addEventListener('cancel',e=>e.preventDefault());
document.querySelector('.brand').addEventListener('click',e=>e.preventDefault());
// Only preferences write here; shop progress remains at its original save boundary.
function applyPreferences(){
 document.body.classList.toggle('large-text',preferences.textSize==='large');
 backgroundMusic.setVolume(preferences.musicVolume/100);
 if(sfxMaster)sfxMaster.gain.setValueAtTime(preferences.sfxEnabled?preferences.sfxVolume/100:0,backgroundMusic.context.currentTime);
 syncMusic();
}
function applyLegacySound(enabled){
 if(!preferencesExplicit){preferences={...preferences,musicEnabled:enabled,sfxEnabled:enabled};}
}
function renderSettings(){
 $('music-enabled').checked=preferences.musicEnabled;$('sfx-enabled').checked=preferences.sfxEnabled;
 for(const kind of ['music','sfx']){$(kind+'-volume').value=preferences[kind+'Volume'];$(kind+'-volume-value').textContent=preferences[kind+'Volume']+'%';}
 $('text-size').value=preferences.textSize;$('preferences-status').textContent=preferenceStatus;
}
async function openSettings(){
 if(!$('pause-dialog').open)return;
 showDialog('settings-dialog');renderSettings();$('settings-scroll').scrollTop=0;$('settings-close').focus();
 $('settings-last-saved').textContent='正在讀取保存時間…';
 try{const catalog=await saveStore.inspect(),record=catalog.current;if(record){readSave(record);$('settings-last-saved').textContent=`最後成功保存：第 ${record.payload.shift.day} 天 · ${new Date(record.savedAt).toLocaleString('zh-HK',{timeZone:'Asia/Hong_Kong'})}`;}else $('settings-last-saved').textContent='尚未有成功保存的遊戲進度。';}
 catch{$('settings-last-saved').textContent='無法讀取有效保存時間；現有檔案未被取代。';}
}
function closeSettings(){$('settings-dialog').close();clearInput();$('settings-button').focus({preventScroll:true});}
function changePreferences(){
 preferences={musicEnabled:$('music-enabled').checked,musicVolume:Number($('music-volume').value),sfxEnabled:$('sfx-enabled').checked,sfxVolume:Number($('sfx-volume').value),textSize:$('text-size').value};
 preferencesExplicit=true;applyPreferences();const saved=savePreferences(preferences);
 preferenceStatus=saved?'偏好已記住；遊戲進度仍只在換日前保存。':'偏好在本頁生效，但未能記住；關頁後可能需要重設。';renderSettings();
}
$('settings-button').addEventListener('click',openSettings);
for(const id of ['settings-close','settings-back'])$(id).addEventListener('click',closeSettings);
$('settings-dialog').addEventListener('cancel',e=>{e.preventDefault();closeSettings();});
for(const id of ['music-enabled','sfx-enabled','text-size'])$(id).addEventListener('change',changePreferences);
for(const id of ['music-volume','sfx-volume'])$(id).addEventListener('input',changePreferences);
$('settings-import').addEventListener('click',()=>$('import-file').click());
applyPreferences();

// Campaign persistence: gameplay remains in memory until the day boundary.
function campaignView(game=shift){
 const active=new Map(actors);const queueActors=game.queue.map(o=>active.get(o.id)||newCustomerActor(o));
 return{player:{...player,moving:false},actors:queueActors.map(a=>structuredClone(a)),departures:structuredClone(departures)};
}
function newCustomerActor(order){return{id:order.id,appearance:order.appearance,x:ENTRANCE.x,y:ENTRANCE.y,face:'down',moving:true,travel:0,carrying:order.type==='shipping',entered:false,route:[{x:40,y:64},{x:25,y:64},{x:25,y:142}],next:0};}
function captureCampaign(){return pendingBoundary?.record||makeSave(campaignId,shift,campaignView(),{sound:legacySound()});}
function moneyText(n){return `$${n.toLocaleString('en-US')}`;}
function savedDescription(record){try{const {game}=readSave(record);return`第 ${game.day} 天 · 可用資金 ${moneyText(game.availableFunds())} · ${new Date(record.savedAt).toLocaleString('zh-HK',{timeZone:'Asia/Hong_Kong'})}`;}catch(e){return e.message;}}
function setSaveStatus(text){saveStatus=text;document.querySelectorAll('.save-status').forEach(e=>e.textContent=text);}
function askCampaign(title,message,label='確認'){
 if(choiceResolve)return Promise.resolve(false);
 $('confirm-title').textContent=title;$('confirm-message').textContent=message;$('confirm-yes').textContent=label;showDialog('confirm-dialog');
 return new Promise(resolve=>{choiceResolve=resolve;});
}
function answerCampaign(yes){$('confirm-dialog').close();const resolve=choiceResolve;choiceResolve=null;resolve?.(yes);}
async function refreshCampaignMenu(){
 let catalog;
 try{catalog=await saveStore.inspect();campaignCatalog=catalog;}
 catch(e){$('campaign-summary').textContent=e.message;setSaveStatus('無法讀取本地存檔；可手動匯出／匯入。');return;}
 const record=(!ownershipLost&&campaignMemory)||catalog.current;
 let valid=false;try{if(record){readSave(record);valid=true;}}catch{}
 $('continue-button').hidden=!valid;$('continue-button').disabled=!valid;
 $('continue-button').textContent=campaignMemory&&!ownershipLost?'繼續本頁進度':'繼續經營';
 $('campaign-summary').textContent=record?(campaignMemory&&!ownershipLost?'本頁未到自動保存時點 · ':'')+savedDescription(record):'尚無自動存檔；整理完、開下一天前會保存。';
 const recovery=$('recovery-list');recovery.replaceChildren();
 for(const [key,label] of [['previous','上一份有效備份'],['checkpoint','較早換日備份']]){
  const record=catalog[key];if(!record)continue;
  try{readSave(record);}catch{continue;}
  const button=document.createElement('button');button.className='button button-secondary';button.textContent=`恢復${label}：${savedDescription(record)}`;
  button.addEventListener('click',()=>replaceCampaign(record,`恢復${label}`));recovery.append(button);
 }
 if(catalog.current&&!valid)$('campaign-summary').textContent='主存檔無法載入：'+savedDescription(catalog.current)+' 可選擇有效備份或匯入，原檔仍然保留。';
}
async function claimCampaign(id,{reset=false}={}){
 try{await saveStore.acquire(id,{reset});return true;}
 catch(e){
  if(e.message!=='TAKEOVER')throw e;
  if(!await askCampaign('接管店舖工作階段','這間店在另一分頁或之前的工作階段使用中。接管後，舊分頁將停止寫入；未保存進度不會自動合併。','接管'))return false;
  await saveStore.acquire(id,{reset,force:true});return true;
 }
}
async function start(){
 if(!ready||menuBusy)return;
 menuBusy=true;
 try{
  let catalog;try{catalog=await saveStore.inspect();}catch{/* Allow explicit memory-only play. */}
  if(campaignMemory||catalog?.current){if(!await askCampaign('開始新店','這會取代現有正式店舖。若要保留當前進度，請先取消並匯出備份。','開始新店'))return;}
  const id=globalThis.crypto?.randomUUID?.()||`shop-${Date.now()}-${Math.random()}`;
  try{if(!await claimCampaign(id,{reset:true}))return;}
  catch(e){if(!await askCampaign('未能啟用本地存檔',e.message+' 可先在本頁經營，換日前重試，或手動匯出；關頁會失去未保存進度。','暫不存檔開始'))return;}
  achievementSavedSnapshot=null;campaignId=id;campaignMemory=null;campaignActive=true;ownershipLost=false;purchasesBlocked=false;pendingBoundary=null;
  setSaveStatus('尚未自動保存；整理完、準備開下一天前才會保存。');beginSession();
 }finally{menuBusy=false;}
}
function restoreCampaign(record,{saved=true}={}){
 backgroundMusic.reset();const restored=readSave(record);if(saved)achievementSavedSnapshot=JSON.stringify(restored.game.achievements);closeDialogs();shift=restored.game;syncLayout();campaignId=record.profileId;campaignActive=true;ownershipLost=false;pendingBoundary=null;
 player={...restored.view.player,moving:false};actors=new Map(restored.view.actors.map(a=>[a.id,a]));departures=restored.view.departures;applyLegacySound(restored.settings.sound);resetSpeech();
 action=null;feedback=null;queueSignature='';suspendedInventory=null;clearInput();
 if(shift.canWork())shift.pause();
 $('pause-button').disabled=false;$('pause-reason').textContent='進度已還原。離線期間沒有推進時間，準備好再繼續。';showDialog('pause-dialog');lastTime=performance.now();
}
async function continueCampaign(){
 if(menuBusy)return;menuBusy=true;
 try{
  const catalog=await saveStore.inspect(),memory=campaignMemory&&!ownershipLost,record=memory?campaignMemory:catalog.current;if(!record)return;
  readSave(record);if(!await claimCampaign(record.profileId))return;
  restoreCampaign(record,{saved:!memory});campaignMemory=null;
  setSaveStatus(memory?'已還原本頁進度；尚未到自動保存時點。':`已儲存：${new Date(record.savedAt).toLocaleString('zh-HK',{timeZone:'Asia/Hong_Kong'})}。只在換日前自動保存。`);
 }catch(e){await askCampaign('未能繼續經營',e.message,'知道了');}finally{menuBusy=false;}
}
async function campaignMenu(){
 if(campaignActive){if(shift.canWork())shift.pause();campaignMemory=captureCampaign();}
 closeDialogs();clearInput();showDialog('welcome-dialog');syncMusic();await refreshCampaignMenu();
}
function stageNextDay(){
 const next=decodeShift(encodeShift(shift));next.openNextDay();next.drainEvents();
 const view=campaignView(next);return{record:makeSave(campaignId,next,view,{sound:legacySound()})};
}
async function completeBoundary(){
 if(saveBusy||shift.phase!=='dayend')return;
 saveBusy=true;closeDialogs();showDialog('checkpoint-dialog');$('checkpoint-title').textContent='換日儲存中';$('checkpoint-message').textContent='正在封存本日帳目，保存下一天開門前的完整進度…';
 for(const id of ['checkpoint-retry','checkpoint-export','checkpoint-continue'])$(id).hidden=true;
 try{
  if(ownershipLost)throw new Error('另一分頁已接管，這份進度沒有覆蓋新存檔。請匯出本頁進度。');
  pendingBoundary??=stageNextDay();
  if(saveStore.profileId!==campaignId){await saveStore.inspect();if(!await claimCampaign(campaignId))throw new Error('尚未取得寫入權限，進度保留在本頁。');}
  const saved=await saveStore.write(pendingBoundary.record);
  adoptBoundary(saved);purchasesBlocked=false;setSaveStatus(`已儲存：第 ${shift.day} 天開門前 · ${new Date(saved.savedAt).toLocaleString('zh-HK',{timeZone:'Asia/Hong_Kong'})}`);
 }catch(e){
  $('checkpoint-title').textContent='未能儲存';$('checkpoint-message').textContent=e.message+' 本日結果仍保留在記憶體，重試不會重複發錢。';
  for(const id of ['checkpoint-retry','checkpoint-export','checkpoint-continue'])$(id).hidden=false;
  purchasesBlocked=true;setSaveStatus('未能儲存；請重試或匯出完整備份。');
 }finally{saveBusy=false;}
}
function adoptBoundary(record,{saved=true}={}){
 const {game,view}=readSave(record);if(saved)achievementSavedSnapshot=JSON.stringify(game.achievements);shift=game;syncLayout();player={...view.player,moving:false};actors=new Map(view.actors.map(a=>[a.id,a]));departures=view.departures;resetSpeech();
 pendingBoundary=null;campaignMemory=null;action=null;feedback=null;queueSignature='';closeDialogs();clearInput();$('pause-button').disabled=false;lastTime=performance.now();canvas.focus({preventScroll:true});
}
async function skipBoundarySave(){
 if(saveBusy||!pendingBoundary||ownershipLost)return;
 if(await askCampaign('暫不存檔繼續','下一天會在本頁開始，但沒有寫入本地。關頁將回到較舊的保存點；你可先匯出這份進度。','繼續本頁')){adoptBoundary(pendingBoundary.record,{saved:false});setSaveStatus('目前進度未儲存；關頁會回到上次成功保存點。');}
}
function exportCampaign(){
 try{
  const record=captureCampaign();readSave(record);
  const blob=new Blob([JSON.stringify(record,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=`parcel-parcel-parcel-day-${record.payload.shift.day}-${new Date().toISOString().slice(0,10)}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(e){askCampaign('無法匯出',e.message,'知道了');}
}
async function replaceCampaign(record,title='匯入備份'){
 if(menuBusy)return;menuBusy=true;
 try{
  readSave(record);await saveStore.inspect();
  if(!await askCampaign(title,savedDescription(record)+'。確認後整份取代目前進度；目前有效主檔會保留為上一份備份。其他分頁會停止寫入。','確認取代'))return;
  const saved=await saveStore.write(record,{replace:true,force:true});purchasesBlocked=false;campaignMemory=null;restoreCampaign(saved);setSaveStatus(`已${title} · ${new Date(saved.savedAt).toLocaleString('zh-HK',{timeZone:'Asia/Hong_Kong'})}`);
 }catch(e){await askCampaign('進度沒有被取代',e.message,'知道了');}finally{menuBusy=false;}
}
function openFinance(){
 if(!campaignActive)return;
 const ledger=shift.ledger;
 $('finance-wallet').textContent=`可用資金 ${moneyText(shift.availableFunds())} · 預留薪金 ${moneyText(shift.reservedWages())} · 累計收入 ${moneyText(ledger.lifetimeRevenue)} · 今日支出 ${moneyText(Object.values(ledger.current.expense).reduce((a,b)=>a+b,0)-ledger.current.refund)}`;
 renderFinance();showDialog('finance-dialog');
}
function renderFinance(){
 const d=shift.ledger.current;
 $('report-period').textContent=`第 ${d.day} 天 · ${d.sealed?'已封存':['closing','upgrading','stocking'].includes(shift.phase)||shift.pausedPhase==='stocking'?'整理中':'營業中'}`;
 const body=$('report-body');body.replaceChildren();const income=Object.values(d.income).reduce((a,b)=>a+b,0),expense=Object.values(d.expense).reduce((a,b)=>a+b,0)-d.refund;
 const values=[['期初資金',d.opening],['提貨服務費',d.income.pickup],['小費',d.income.tips],['寄貨服務費',d.income.shipping],['今日收入',income],['營運支出',d.expense.operating],['投資支出',d.expense.investment],['今日現金增減',income-expense],[d.sealed?'期末資金':'目前資金',d.opening+income-expense]];
 for(const [name,value] of values){const row=document.createElement('div');row.className='report-row';const label=document.createElement('span'),amount=document.createElement('strong');label.textContent=name;amount.textContent=moneyText(value);row.append(label,amount);body.append(row);}
 const stats=d.stats||shift.stats;const p=document.createElement('p');p.className='report-note';p.textContent=`完成提貨 ${stats.completed} · 寄貨 ${stats.shipped} · 上架 ${stats.stocked} · 錯件 ${stats.errors} · 流失 ${stats.missed}`;body.append(p);
}

// Cards share one saved forecast; rendering never draws a new event.
function fillEventCard(id,entry,label){
 const node=$(id);node.hidden=!entry;if(node.hidden)return;
 const event=DAY_EVENTS[entry.id],key=`${label}:${entry.day}:${entry.id}`;if(node.dataset.event===key)return;
 node.dataset.event=key;node.replaceChildren();const tag=document.createElement('small'),name=document.createElement('h3'),story=document.createElement('p'),effects=document.createElement('p');
 tag.textContent=`${label} · 第 ${entry.day} 天`;name.textContent=event.name;story.textContent=event.story;effects.className='event-effects';effects.textContent=dayEventSummary(event);node.append(tag,name,story,effects);
}
function renderEventInfo(){
 const key=`${shift.dayEvents.current.day}:${shift.dayEvents.current.id}:${shift.dayEvents.next?.day}:${shift.dayEvents.next?.id}`;if(key===eventInfoKey)return;eventInfoKey=key;
 fillEventCard('forecast-prompt',shift.dayEvents.next,'明日店況');fillEventCard('forecast-shop',shift.dayEvents.next,'明日店況');
 fillEventCard('pause-event',shift.dayEvents.current,'今日店況');
 const node=$('pause-event');if(!node.hidden&&shift.dayEvents.next){const key=`${shift.dayEvents.next.day}:${shift.dayEvents.next.id}`;if(node.dataset.next!==key){node.querySelector('.next-event')?.remove();const p=document.createElement('p');p.className='next-event';p.textContent=`明日 · ${DAY_EVENTS[shift.dayEvents.next.id].name}：${dayEventSummary(DAY_EVENTS[shift.dayEvents.next.id])}`;node.append(p);node.dataset.next=key;}}else{node.querySelector('.next-event')?.remove();delete node.dataset.next;}
}

// Night management deliberately does not call SaveStore.write.
function showUpgradePrompt(){
 renderEventInfo();closeDialogs();$('upgrade-prompt-wallet').textContent=`可用資金 ${moneyText(shift.availableFunds())} · 薪金支出 ${moneyText(shift.reservedWages())}`;showDialog('upgrade-prompt');
}
function enterStocking(){
 if(ownershipLost){campaignMenu();return;}
 closeDialogs();
 if(shift.managementFrom==='stocking')shift.phase='stocking';else shift.beginStocking();
 processEvents();$('pause-button').disabled=false;canvas.focus({preventScroll:true});
}
function openUpgradeShop(){
 if(ownershipLost)return;
 if(shift.phase==='stocking'){shift.managementFrom='stocking';shift.phase='upgrading';}
 if(shift.phase!=='upgrading')return;
 closeDialogs();$('upgrade-feedback').textContent='';renderUpgrades();showDialog('upgrade-dialog');
}
function renderUpgrades(){
 renderEventInfo();
 $('upgrade-wallet').textContent=`錢包 ${moneyText(shift.ledger.balance)} · 薪金支出 ${moneyText(shift.reservedWages())} · 可用 ${moneyText(shift.availableFunds())}`;
 const tabs=$('upgrade-tabs');tabs.replaceChildren();for(const category of ['工具','設備','貨架','人手']){const b=document.createElement('button');b.className='button button-secondary';b.textContent=category;b.setAttribute('aria-pressed',String(category===upgradeCategory));b.onclick=()=>{upgradeCategory=category;renderUpgrades();$('upgrade-scroll').scrollTop=0;tabs.querySelector(`[aria-pressed="true"]`).focus();};tabs.append(b);}
 const grid=$('upgrade-cards');grid.replaceChildren();
 for(const item of upgradeOptions(shift).filter(i=>i.category===upgradeCategory)){
  const card=document.createElement('article');card.className='upgrade-card';
  const heading=document.createElement('h3');heading.textContent=item.name;
  const effect=document.createElement('strong');effect.className='upgrade-effect';effect.textContent=item.showEffect===false?item.before:`${item.before} → ${item.after}`;
  const note=document.createElement('p');note.textContent=item.note;
  const price=document.createElement('p');price.className='upgrade-price';price.textContent=['worker','workerAdvanced'].includes(item.id)?`日薪 ${moneyText(item.price)}`:`價格 ${moneyText(item.price)} · 餘額 ${moneyText(Math.max(0,shift.availableFunds()-item.price))}`;
  const b=document.createElement('button');b.className='button button-primary';b.dataset.upgrade=item.id;
  const blocked=ownershipLost?'另一分頁已接管':purchasesBlocked?'須先恢復保存':item.blocked|| (shift.availableFunds()<item.price?'資金不足':'');
  b.disabled=!!blocked||upgradeBusy;b.textContent=blocked||(['worker','workerAdvanced'].includes(item.id)?'續聘員工':'購買');b.onclick=()=>buyUpgrade(item.id);card.append(heading);if(item.showState!==false)card.append(effect);if(item.note)card.append(note);card.append(price,b);grid.append(card);
 }
 const personnel=upgradeCategory==='人手';$('worker-settings').hidden=!personnel;
 if(personnel){
  const selected=new Set(shift.upgrades.workerZones),zones=$('worker-zones'),priority=$('worker-priority');zones.replaceChildren();priority.replaceChildren();
  for(const z of Object.keys(shift.shelves)){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=z;input.checked=selected.has(z);label.append(input,`${z} 區`);zones.append(label);const option=document.createElement('option');option.value=z;option.textContent=`${z} 區優先`;priority.append(option);}
  priority.value=shift.upgrades.workerZones[0];$('worker-cancel').textContent=`取消明日排班（釋放 ${moneyText(shift.reservedWages())}）`;$('worker-cancel').disabled=!shift.upgrades.workerBookedDay||ownershipLost;
 }
}
async function buyUpgrade(id){
 if(upgradeBusy||ownershipLost||purchasesBlocked)return;
 const item=upgradeOptions(shift).find(i=>i.id===id);if(!item||item.blocked||shift.availableFunds()<item.price)return;
 upgradeBusy=true;let button=$('upgrade-cards').querySelector(`[data-upgrade="${id}"]`);
 try{
  if(!await saveStore.isOwner())throw new Error('此工作階段沒有寫入權限，請回主選單繼續或接管店舖。');
  const summary=item.showState===false?'':item.showEffect===false?item.before:`${item.before} → ${item.after}`;
  const message=`${summary?summary+'\n':''}${['worker','workerAdvanced'].includes(id)?'預留明日薪金':'價格'} ${moneyText(item.price)} · ${['worker','workerAdvanced'].includes(id)?'預約':'購買'}後餘額 ${moneyText(shift.availableFunds()-item.price)}\n${['worker','workerAdvanced'].includes(id)?'翌日開門時發薪，不自動續聘。':'本頁即時生效，開下一天前才保存。'}`;
  if(!await askCampaign(item.name,message,['worker','workerAdvanced'].includes(id)?'確認排班':'確認購買'))return;
  if(ownershipLost||!await saveStore.isOwner())throw new Error('另一分頁已接管，沒有扣款。');
  const result=shift.purchaseUpgrade(id);syncLayout();if(result.ok&&!canStand(player.x,player.y)){const safe=targets.find(t=>t.id===id.split(':')[1])||counter;player.x=safe.x;player.y=safe.y;player.moving=false;clearInput();}$('upgrade-feedback').textContent=result.message;processEvents();
 }catch(e){$('upgrade-feedback').textContent=e.message;}
 finally{upgradeBusy=false;renderUpgrades();button=$('upgrade-cards').querySelector(`[data-upgrade="${id}"]`);if(button&&!button.disabled)button.focus();else $('upgrade-done').focus();}
}
$('upgrade-enter').addEventListener('click',openUpgradeShop);$('shop-button').addEventListener('click',openUpgradeShop);
for(const id of ['upgrade-skip','upgrade-close','upgrade-done'])$(id).addEventListener('click',()=>{if(!upgradeBusy)enterStocking();});
$('upgrade-prompt').addEventListener('cancel',e=>{e.preventDefault();enterStocking();});
$('upgrade-dialog').addEventListener('cancel',e=>{e.preventDefault();if(!upgradeBusy)enterStocking();});
$('worker-cancel').addEventListener('click',()=>{if(ownershipLost||upgradeBusy)return;shift.cancelWorkerBooking();$('upgrade-feedback').textContent='已取消明日排班，預留薪金已釋放。';renderUpgrades();});
$('worker-configure').addEventListener('click',()=>{if(ownershipLost||upgradeBusy)return;const selected=[...$('worker-zones').querySelectorAll('input:checked')].map(e=>e.value),first=$('worker-priority').value;const ordered=selected.includes(first)?[first,...selected.filter(z=>z!==first)]:selected;$('upgrade-feedback').textContent=shift.setWorkerZones(ordered)?`已設定順序：${ordered.join(' → ')}`:'請至少選擇一個上架分區。';});

$('continue-button').addEventListener('click',()=>continueCampaign());
$('confirm-yes').addEventListener('click',()=>answerCampaign(true));$('confirm-no').addEventListener('click',()=>answerCampaign(false));
$('confirm-dialog').addEventListener('cancel',e=>{e.preventDefault();answerCampaign(false);});
$('checkpoint-dialog').addEventListener('cancel',e=>e.preventDefault());
$('checkpoint-retry').addEventListener('click',()=>completeBoundary());$('checkpoint-export').addEventListener('click',()=>exportCampaign());$('checkpoint-continue').addEventListener('click',()=>skipBoundarySave());
for(const id of ['finance-button','result-finance'])$(id).addEventListener('click',()=>openFinance());
for(const id of ['export-button','result-export'])$(id).addEventListener('click',()=>exportCampaign());
$('finance-close').addEventListener('click',()=>$('finance-dialog').close());
$('result-menu').addEventListener('click',()=>campaignMenu());
$('import-button').addEventListener('click',()=>$('import-file').click());
$('import-file').addEventListener('change',async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>8*1024*1024)throw new Error('備份檔案過大。');const record=JSON.parse(await file.text());await replaceCampaign(record);}catch(error){await askCampaign('無法匯入',error.message,'知道了');}});
saveStore.onConflict=()=>{if(campaignId&&!ownershipLost){ownershipLost=true;pause('另一分頁已接管此店，本頁已暫停。請匯出本頁或回主選單載入最新進度。');setSaveStatus('另一分頁已接管；本頁不能覆寫最新存檔。');}};
showDialog('welcome-dialog');refreshCampaignMenu();requestAnimationFrame(loop);
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
 $('start-button').disabled=false;
}).catch(error=>{
 loadError=true;$('loading-status').textContent='素材未能載入，請重試或用完整原型檔案開啟。';
 $('start-button').disabled=false;$('start-button').textContent='重新載入';console.error(error);
});

// Read-only QA snapshots; never exposes a way to alter inventory or grant income.
if(new URLSearchParams(location.search).has('qa'))window.__parcelQA={snapshot:()=>({mapViewport:mapViewport?{...mapViewport}:null,mobileView:mobileView(),speech:speechBubble?structuredClone(speechBubble):null,speechTime:npcSpeech.time,speechNext:npcSpeech.next,assetSizes:Object.fromEntries([...images].map(([n,img])=>[n,[img.width,img.height]])),world:{...world},gate:{...GATE},targets:targets.map(t=>({...t})),actors:[...actors.values(),...departures].map(a=>({id:a.id,x:a.x,y:a.y,carrying:a.carrying})),courier:shift.courier?{...shift.courier}:null,outbound:shift.outbound.map(s=>({...s})),phase:shift.phase,
 departures:structuredClone(departures),preferences:{...preferences},sfxGain:sfxMaster?.gain.value??null,music:backgroundMusic.snapshot(),achievements:structuredClone(shift.achievements),dayEvents:structuredClone(shift.dayEvents),customerTimer:shift.customerTimer,deliveryTimer:shift.deliveryTimer,day:shift.day,totalRevenue:shift.totalRevenue,wallet:shift.ledger.balance,upgrades:structuredClone(shift.upgrades),availableFunds:shift.availableFunds(),worker:shift.worker?structuredClone(shift.worker):null,ledger:shift.ledger.toJSON(),saveBusy,saveStatus,pausedPhase:shift.pausedPhase,receivingCount:shift.receivingCount(),practice:shift.practice,remaining:shift.remaining,player:{...player},held:shift.held?{...shift.packages.get(shift.held)}:null,heldExtra:shift.heldExtra?{...shift.packages.get(shift.heldExtra)}:null,selectedIds:[...selectedIds],
 queue:shift.queue.map(o=>({...o})),stats:{...shift.stats},target:closestTarget()?.id||null,
 packages:[...shift.packages.values()].map(p=>({...p})),dialog:dialogIds.find(id=>$(id).open)||null,
 joystick:{...joystickVector},action:action?.name||null})};
