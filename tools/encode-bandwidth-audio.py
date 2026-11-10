"""Encode approved original PCM masters; never transcode an MP3 source."""
from pathlib import Path
import subprocess,json,hashlib,wave,importlib.util
r=Path(__file__).resolve().parents[1];masters=r/'deliverables/music-review-v1'
if not all((masters/(n+'.wav')).exists() for n in ['business','stocking']):
 spec=importlib.util.spec_from_file_location('parcel_music_renderer',r/'design/music-review-v1/render.py');renderer=importlib.util.module_from_spec(spec);spec.loader.exec_module(renderer)
 renderer.HERE=r/'deliverables/bandwidth-master-regeneration';renderer.HERE.mkdir(parents=True,exist_ok=True);renderer.WAV_DIR=masters;masters.mkdir(parents=True,exist_ok=True)
 for score in renderer.SPECS:renderer.render(score)
p=r/'assets/metadata/background_music.json';meta=json.loads(p.read_text());results=[]
for name,bitrate in [('business',96),('stocking',64)]:
 src=masters/(name+'.wav');dst=r/'assets/audio'/(name+'.mp3');original=r/'design/music-review-v1'/(name+'.mp3')
 with wave.open(str(src),'rb') as w:
  assert w.getnchannels()==2 and w.getframerate()==44100
  frames=w.getnframes()
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(src),'-map_metadata','-1','-c:a','libmp3lame','-b:a',str(bitrate)+'k','-ar','44100','-ac','2','-write_xing','1','-id3v2_version','3','-metadata','title='+next(t['title'] for t in meta['tracks'] if t['id']==name),'-metadata','artist=Parcel Point — original program composition',str(dst)],check=True)
 decoded=subprocess.check_output(['ffmpeg','-v','error','-i',str(dst),'-f','f32le','-acodec','pcm_f32le','-'])
 import numpy as np
 samples=np.frombuffer(decoded,dtype='<f4').reshape(-1,2)
 assert len(samples)==frames,(name,len(samples),frames)
 assert np.max(np.abs(samples))<1
 t=next(t for t in meta['tracks'] if t['id']==name);t.update(mp3Bytes=dst.stat().st_size,mp3Sha256=hashlib.sha256(dst.read_bytes()).hexdigest(),targetBitrateKbps=bitrate,encoding='CBR MP3 from original PCM master',masterFrames=frames,masterSha256=hashlib.sha256(src.read_bytes()).hexdigest(),originalMp3File=str(original.relative_to(r)),originalMp3Bytes=original.stat().st_size,decodedPeakDbfs=float(20*np.log10(np.max(np.abs(samples)))),decodedLoopBoundaryStep=float(np.max(np.abs(samples[0]-samples[-1]))))
 results.append({'track':name,'bytes':dst.stat().st_size,'originalBytes':original.stat().st_size,'frames':frames,'decodedFrames':len(samples),'channels':2,'sampleRate':44100,'clippedSamples':int(np.sum(np.abs(samples)>=1))})
meta['version']='0.19.11';meta['optimization']='96/64kbps stereo encoded from original WAV, originals retained in design/music-review-v1.';p.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n');out=r/'deliverables/bandwidth-v01911';out.mkdir(parents=True,exist_ok=True);(out/'audio-report.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results,indent=2))
