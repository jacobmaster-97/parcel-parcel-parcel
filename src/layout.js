// Approved shop layout: public queue above, staff work area below the divider.
export const WORLD = {width:350,height:340};
export const GATE = {left:278,right:342,y:192};
export const TARGETS = [
 ...['A','B','C'].map((zone,i)=>({id:zone,type:'shelf',zone,x:70+i*70,y:260,footY:330})),
 {id:'counter',type:'counter',x:174,y:218,footY:200},
 {id:'receiving',type:'receiving',x:310,y:112,footY:92},
 {id:'outbound',type:'outbound',x:310,y:260,footY:330}
];
export const QUEUE_POINTS = [174,140,106,72,38].map(x=>({x,y:142}));
export const ENTRANCE = {x:40,y:-18};
export const COURIER_ROUTE = [ENTRANCE,{x:40,y:64},{x:272,y:64},{x:272,y:112},{x:310,y:112}];
export const OBSTACLES = [
 {x:0,y:182,w:GATE.left,h:20},{x:GATE.right,y:182,w:WORLD.width-GATE.right,h:20},
 {x:286,y:68,w:48,h:26},{x:286,y:300,w:48,h:30},
 ...TARGETS.filter(t=>t.type==='shelf').map(t=>({x:t.x-34,y:285,w:68,h:49}))
];
export function canStandAt(x,y){return canStandInShop(x,y);}
// Buying D adds one lower row; existing coordinates and public route stay fixed.
export function shopLayout(shelves={A:[],B:[]}){
 const extra=!!shelves.D;
 return{world:{width:350,height:extra?484:340},targets:extra?[...TARGETS.filter(t=>t.type!=='shelf'||!!shelves[t.zone]),{id:'D',type:'shelf',zone:'D',x:70,y:404,footY:474}]:TARGETS.filter(t=>t.type!=='shelf'||!!shelves[t.zone])};
}
export function canStandInShop(x,y,shelves={A:[],B:[]}){
 const layout=shopLayout(shelves);
 return x>=15&&x<=335&&y>=42&&y<=layout.world.height-14&&
 !OBSTACLES.filter(o=>o.y!==285||Object.keys(shelves).some(z=>TARGETS.find(t=>t.zone===z)?.x===o.x+34)).some(o=>x+8>o.x&&x-8<o.x+o.w&&y>o.y&&y-8<o.y+o.h)&&
 !(shelves.D&&x+8>36&&x-8<104&&y>429&&y-8<478);
}
