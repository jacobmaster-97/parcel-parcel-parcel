// Approved v0.15 catalogue. Original proposal numbers are stable; removed rows are not shipped.
export const ACHIEVEMENTS=[
 [4,'累計','街坊熟面口',[50,100,500],'累計完成提貨'],[5,'累計','寄貨能手',[20,50,100],'累計完成寄貨入籠'],[6,'累計','上架達人',[50,200,400],'親手首次上架不同新貨'],[7,'累計','細水長流',[500,3000,5000],'累計服務收入（$）'],[8,'技巧','件件準繩',[10,30,100],'最佳連續正確提貨；錯件重算，寄貨不打斷'],[9,'技巧','眼明手快',[10],'接待後10秒內正確交貨的累計次數'],[10,'技巧','有條不紊',[1],'單日營業完成8單，0錯件、0流失'],[11,'技巧','獨當一面',[1],'無理貨員的營業日完成10單'],[12,'成長','添置新架',[1],'購入C區貨架'],[13,'成長','容量大升級',[6,8],'任一貨架的最高格數'],[14,'成長','籠位充足',[1],'收貨籠及寄貨籠均達12格'],[15,'成長','數碼小店',[1],'購入貨物管理系統'],[16,'成長','生意上軌道',[3,10,30],'至少完成1單的營業日數'],[17,'團隊','最佳拍檔',[1],'首次實際聘用及付薪；預約不算'],[18,'團隊','理貨好幫手',[30,100,500],'理貨員首次上架不同新貨'],[19,'事件','迎戰大促',[1],'購買網優惠當日營業完成10單'],[20,'事件','風雨無阻',[1],'惡劣天氣當日營業完成6單'],[21,'事件','退貨專家',[1],'退貨潮當日營業完成5單寄貨'],[22,'事件','見慣大場面',[4],'四種店況各完成有實際服務的營業日'],[23,'整理','收工有交帶',[1],'當晚親手上架新貨並清空收貨，沒有手持待上架貨'],[24,'整理','井井有條',[1],'同一晚3件不同新貨上架至3個不同貨架區'],[25,'成長','開店投資',[1],'首次完成付費升級購買；薪金預約不算'],[27,'技巧','服務有餘裕',[1],'同一營業日8單提貨，交貨時各仍有30秒耐性'],[28,'技巧','口碑連連',[1],'連續3個營業日各完成5單，0錯件、0流失'],[29,'技巧','鞋仔飛人',[1],'工作鞋生效的營業日完成15單'],[30,'團隊','進階精英',[1],'完成實際聘用及付薪的進階理貨員營業日'],[31,'團隊','合作無間',[1],'同一營業日玩家與理貨員各上架3件新貨，並完成5單服務'],[34,'收支','精打細算',[1],'日結收入扣除營運及投資支出後達$100'],[35,'收支','精打細算2',[3,5,20],'淨收支達$100的累計日結日數'],[36,'整理','收工有交帶2',[3,10,15],'符合收工有交帶的最佳連續晚數']
].map(([id,category,name,goals,description],icon)=>Object.freeze({id:String(id),category,name,goals:Object.freeze(goals),description,icon}));
const achievementDay=(day,tracked=true)=>({day,tracked,pickup:0,shipping:0,playerStock:0,workerStock:0,errors:0,missed:0,comfortable:0,nightStock:0,nightZones:[],greeted:{},staffTier:'none',closed:false,sealed:false});
export function initialAchievements(day=1,legacy=false){return{version:1,startDay:day,legacy,values:Object.fromEntries(ACHIEVEMENTS.map(a=>[a.id,0])),unlocked:Object.fromEntries(ACHIEVEMENTS.map(a=>[a.id,[]])),chain:0,goodDays:0,tidyNights:0,events:[],today:achievementDay(day,!legacy)};}
export function refreshAchievements(g){
 if(g.practice)return;const a=g.achievements;if(!a)return;const v=a.values;
 v[7]=g.ledger.lifetimeRevenue;v[12]=g.shelves.C?1:0;v[13]=Math.max(0,...Object.values(g.shelves).map(s=>s.length));v[14]=Number(g.receiving.length===12&&g.outbound.length===12);v[15]=Number(g.upgrades.cargoManagement);v[25]=Number(g.ledger.paid.some(id=>id.startsWith('upgrade:')));v[17]=Number(g.ledger.paid.some(id=>id.startsWith('salary:')));
 for(const c of ACHIEVEMENTS){const level=c.goals.filter(goal=>v[c.id]>=goal).length;while(a.unlocked[c.id].length<level)a.unlocked[c.id].push(g.day);}
}
export function achievementEvent(g,type,d){
 if(g.practice||!g.achievements)return;const a=g.achievements;
 if(type==='daystart'){a.today=achievementDay(g.day);a.today.staffTier=g.worker?.tier||'none';}
 const t=a.today,v=a.values;
 if(type==='greet')t.greeted[d.order.id]=g.elapsed;
 if(type==='delivered'){v[4]++;a.chain++;v[8]=Math.max(v[8],a.chain);if(t.greeted[d.order.id]!==undefined&&g.elapsed-t.greeted[d.order.id]<=10+.000001)v[9]++;delete t.greeted[d.order.id];t.pickup++;if(d.order.patience>=30)t.comfortable++;}
 if(type==='shipped'){v[5]++;if(g.phase==='playing')t.shipping++;}
 if(type==='wrong'){a.chain=0;t.errors++;}
 if(type==='missed'){t.missed++;delete t.greeted[d.order.id];}
 if(type==='closed')delete t.greeted[d.order.id];
 if((type==='stock'||type==='workerStock')&&d.fresh){const worker=type==='workerStock';v[worker?18:6]++;if(g.phase==='playing')t[worker?'workerStock':'playerStock']++;if(!worker&&g.phase==='stocking'){t.nightStock++;if(!t.nightZones.includes(d.zone))t.nightZones.push(d.zone);if(t.nightZones.length>=3)v[24]=1;if(t.nightStock&&g.receivingCount()===0&&!g.held)v[23]=1;}}
 if(type==='end'&&!t.closed){t.closed=true;if(t.tracked){const services=t.pickup+t.shipping;if(services>0){v[16]++;if(!a.events.includes(g.currentEvent().id))a.events.push(g.currentEvent().id);v[22]=a.events.length;}
  if(services>=8&&!t.errors&&!t.missed)v[10]=1;if(services>=10&&t.staffTier==='none')v[11]=1;if(g.currentEvent().id==='sale'&&services>=10)v[19]=1;if(g.currentEvent().id==='weather'&&services>=6)v[20]=1;if(g.currentEvent().id==='returns'&&t.shipping>=5)v[21]=1;
  if(t.comfortable>=8)v[27]=1;a.goodDays=services>=5&&!t.errors&&!t.missed?a.goodDays+1:0;if(a.goodDays>=3)v[28]=1;if(g.upgrades.shoeThroughDay>=g.day&&services>=15)v[29]=1;if(t.staffTier==='advanced')v[30]=1;if(t.playerStock>=3&&t.workerStock>=3&&services>=5)v[31]=1;
 }else a.goodDays=0;}
 refreshAchievements(g);
}
export function sealAchievementDay(g){
 if(g.practice||!g.achievements)return;const a=g.achievements,t=a.today;if(t.sealed)return;t.sealed=true;
 if(t.tracked){const net=Object.values(g.ledger.current.income).reduce((s,n)=>s+n,0)-Object.values(g.ledger.current.expense).reduce((s,n)=>s+n,0)+g.ledger.current.refund;if(net>=100){a.values[34]=1;a.values[35]++;}
 const clean=t.nightStock>0&&g.receivingCount()===0&&!g.held;a.tidyNights=clean?a.tidyNights+1:0;if(clean)a.values[23]=1;a.values[36]=Math.max(a.values[36],a.tidyNights);
 }else a.tidyNights=0;refreshAchievements(g);
}
export function migrateAchievements(g){g.achievements=initialAchievements(g.day,true);for(const p of g.packages.values())if(p.kind!=='shipping')p.achievementStocked=p.location==='shelf'||p.location==='held'&&p.origin?.type==='shelf';refreshAchievements(g);return g.achievements;}
export function validAchievements(a,day){
 const n=x=>Number.isSafeInteger(x)&&x>=0&&x<=Number.MAX_SAFE_INTEGER;const keys=o=>o&&Object.keys(o).sort().join()===ACHIEVEMENTS.map(c=>c.id).sort().join();
 if(!a||a.version!==1||!n(a.startDay)||a.startDay<1||a.startDay>day||typeof a.legacy!=='boolean'||!keys(a.values)||!keys(a.unlocked)||![a.chain,a.goodDays,a.tidyNights].every(n)||!Array.isArray(a.events)||new Set(a.events).size!==a.events.length||a.events.some(e=>!['normal','sale','weather','returns'].includes(e)))return false;
 for(const c of ACHIEVEMENTS){const dates=a.unlocked[c.id];if(!n(a.values[c.id])||!Array.isArray(dates)||dates.length!==c.goals.filter(goal=>a.values[c.id]>=goal).length||dates.some(d=>!n(d)||d<1||d>day)||dates.some((d,i)=>i&&d<dates[i-1]))return false;}
 const t=a.today;if(!t||t.day!==day||typeof t.tracked!=='boolean'||typeof t.closed!=='boolean'||typeof t.sealed!=='boolean'||!['none','basic','advanced'].includes(t.staffTier)||!['pickup','shipping','playerStock','workerStock','errors','missed','comfortable','nightStock'].every(k=>n(t[k]))||t.comfortable>t.pickup||!Array.isArray(t.nightZones)||new Set(t.nightZones).size!==t.nightZones.length||t.nightZones.some(z=>!['A','B','C','D'].includes(z))||!t.greeted||typeof t.greeted!=='object'||Array.isArray(t.greeted)||Object.keys(t.greeted).length>6||Object.entries(t.greeted).some(([id,time])=>!/^O[1-9]\d*$/.test(id)||!Number.isFinite(time)||time<0||time>120))return false;return true;
}
export const achievementTier=(a,c)=>a?.unlocked[c.id]?.length||0;
