// Presentation only. Music never changes gameplay, RNG, wallets or saves.
export class BackgroundMusic {
 constructor(sources,{volume=.25}={}){
  this.sources=sources;this.volume=volume;this.context=null;this.master=null;this.track=null;this.key=null;this.enabled=false;this.position=0;this.active=null;this.buffers=new Map();this.failed=new Set();this.revision=0;this.pending=null;this.unavailable=false;this.fading=new Set();
 }
 setVolume(volume){
  this.volume=Math.max(0,Math.min(1,volume));
  if(this.master){const now=this.context.currentTime;this.master.gain.cancelScheduledValues(now);this.master.gain.setValueAtTime(this.volume,now);}
 }
 unlock(){
  try{
   if(!this.context){const Factory=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Factory){this.unavailable=true;return;}
    this.context=new Factory();this.master=this.context.createGain();this.master.gain.value=this.volume;this.master.connect(this.context.destination);
    this.context.addEventListener('statechange',()=>{if(this.context.state==='running')this.ensurePlaying();});
   }
   if(this.context.state==='suspended'||this.context.state==='interrupted')this.context.resume().then(()=>this.ensurePlaying()).catch(()=>{});
   else this.ensurePlaying();
  }catch{this.unavailable=true;}
 }
 scene(track,key,enabled){
  const changed=track!==this.track||key!==this.key;
  if(changed){this.stop(false,!!track&&enabled);this.track=track;this.key=key;this.position=0;}
  if(this.enabled!==enabled){this.enabled=enabled;if(!enabled)this.stop(true);}
  if(track&&enabled)this.ensurePlaying();
 }
 stop(remember=true,fade=false){
  this.revision++;this.pending=null;
  for(const old of this.fading){try{old.source.stop();old.source.disconnect();old.gain.disconnect();}catch{}}this.fading.clear();
  const a=this.active;if(!a)return;
  if(remember)this.position=(a.offset+this.context.currentTime-a.startedAt)%a.duration;
  this.active=null;
  // Only a scene transition crossfades; explicit pause/background is immediately silent.
  try{if(fade){const now=this.context.currentTime;this.fading.add(a);a.gain.gain.cancelScheduledValues(now);a.gain.gain.setValueAtTime(a.gain.gain.value,now);a.gain.gain.linearRampToValueAtTime(0,now+.12);a.source.onended=()=>{a.source.disconnect();a.gain.disconnect();this.fading.delete(a);};a.source.stop(now+.12);}else{a.source.stop();a.source.disconnect();a.gain.disconnect();}}catch{/* Already ended. */}
 }
 reset(){this.stop(false);this.track=null;this.key=null;this.position=0;this.enabled=false;}
 async buffer(track){
  if(!this.buffers.has(track))this.buffers.set(track,(async()=>{
   const response=await fetch(this.sources[track]);if(!response.ok)throw Error('Music unavailable');
   return this.context.decodeAudioData(await response.arrayBuffer());
  })());
  return this.buffers.get(track);
 }
 async ensurePlaying(){
  if(!this.enabled||!this.track||!this.context||this.context.state!=='running'||this.active||this.pending!==null||this.failed.has(this.track))return;
  const revision=this.revision,track=this.track;this.pending=revision;
  try{
   const buffer=await this.buffer(track);
   if(revision!==this.revision||!this.enabled||this.track!==track||this.context.state!=='running')return;
   const source=this.context.createBufferSource(),gain=this.context.createGain(),now=this.context.currentTime;
   source.buffer=buffer;source.loop=true;gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(1,now+.25);
   source.connect(gain);gain.connect(this.master);const offset=this.position%buffer.duration;
   this.active={source,gain,offset,startedAt:now,duration:buffer.duration};source.start(0,offset);
  }catch{if(revision===this.revision){this.failed.add(track);this.unavailable=true;}}
  finally{if(this.pending===revision)this.pending=null;}
 }
 duck(){
  if(!this.master||!this.active)return;const g=this.master.gain,t=this.context.currentTime;
  g.cancelScheduledValues(t);g.setValueAtTime(g.value,t);g.linearRampToValueAtTime(this.volume*.3,t+.025);g.linearRampToValueAtTime(this.volume,t+.25);
 }
 snapshot(){const a=this.active;return{volume:this.volume,masterGain:this.master?.gain.value??null,track:this.track,key:this.key,enabled:this.enabled,playing:!!a&&this.enabled&&this.context?.state==='running',activeSources:(a?1:0)+this.fading.size,fadingSources:this.fading.size,loop:!!a?.source.loop,position:a?(a.offset+this.context.currentTime-a.startedAt)%a.duration:this.position,contextState:this.context?.state||'uninitialized',decodedTracks:[...this.buffers.keys()].filter(k=>!this.failed.has(k)),unavailable:this.unavailable};}
}
