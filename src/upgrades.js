// Approved shop upgrades; prices are incremental purchases, not cumulative totals.
export const BASE_ZONES=['A','B'];
export const ALL_ZONES=['A','B','C','D'];
export function initialUpgrades(){return{shoeThroughDay:0,shelfLevels:{A:0,B:0},receivingLevel:0,outboundLevel:0,workerBookedDay:0,workerZones:['A','B']};}
export function upgradeOptions(game){
 const u=game.upgrades,items=[{id:'shoes',category:'工具',name:'輕便工作鞋',price:80,before:`移速 ${game.moveSpeed()}`,after:'移速 88 · 下一個營業日起連續3日',note:`當晚整理即可使用，不疊加。${u.shoeThroughDay?`現有有效至第 ${u.shoeThroughDay} 天整理結束。`:''}`,blocked:u.shoeThroughDay>game.day?'仍在有效期內':''}];
 for(const z of ALL_ZONES){const level=u.shelfLevels[z],exists=level!==undefined;items.push({id:`shelf:${z}`,category:'貨架',name:exists?`${z} 區貨架加層`:`新增 ${z} 區貨架`,price:exists?(level===0?480:650):320,before:exists?`${game.shelves[z].length} 格`:'尚未設置',after:exists?`${Math.min(8,6+level*2)} 格`:`新增4格 · ${z==='C'?'原下排右側位置':'店面下方新一排'}`,note:exists?'原貨物及格號保留，新增空格，不附送貨物。':'沿用原貨架美術，保持原店寬度及主要動線。',blocked:level===2?'已滿級':''});}
 for(const type of ['receiving','outbound'])items.push({id:type,category:'設備',name:type==='receiving'?'收貨籠擴容':'寄貨籠擴容',price:200,before:`${game[type].length} 格`,after:`${Math.min(12,game[type].length+2)} 格`,note:'每次增加2格，上限12格；不改客流、到貨頻率或服務費。',blocked:game[type].length>=12?'已滿級':''});
 items.push({id:'worker',category:'人手',name:'聘請明日理貨店員',price:60,before:u.workerBookedDay?'已預約明日':'明日未排班',after:`第 ${game.day+1} 天 · $60／日`,note:'先預留薪金，翌日開門扣款。只上架，每晚自行決定續聘；可取消未開始排班。',blocked:u.workerBookedDay?'明日已排班':''});return items;
}
