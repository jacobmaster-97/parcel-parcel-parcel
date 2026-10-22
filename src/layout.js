// Approved shop layout: public queue above, staff work area below the divider.
export const WORLD = {width:350,height:340};
export const GATE = {left:278,right:342,y:192};
export const TARGETS = [
 ...['A','B','C'].map((zone,i)=>({id:zone,type:'shelf',zone,x:70+i*70,y:260,footY:330})),
 {id:'counter',type:'counter',x:174,y:218,footY:200},
 {id:'receiving',type:'receiving',x:240,y:156,footY:136},
 {id:'outbound',type:'outbound',x:310,y:156,footY:136}
];
export const QUEUE_POINTS = [174,132,90,48].map(x=>({x,y:142}));
export const ENTRANCE = {x:40,y:-18};
export const COURIER_ROUTE = [ENTRANCE,{x:40,y:64},{x:202,y:64},{x:202,y:156},{x:240,y:156}];
export const OBSTACLES = [
 {x:0,y:182,w:GATE.left,h:20},{x:GATE.right,y:182,w:WORLD.width-GATE.right,h:20},
 ...[240,310].map(x=>({x:x-24,y:112,w:48,h:26})),
 ...TARGETS.filter(t=>t.type==='shelf').map(t=>({x:t.x-34,y:285,w:68,h:49}))
];
export function canStandAt(x,y){
 return x>=15&&x<=WORLD.width-15&&y>=42&&y<=WORLD.height-14&&
  !OBSTACLES.some(o=>x+8>o.x&&x-8<o.x+o.w&&y>o.y&&y-8<o.y+o.h);
}
