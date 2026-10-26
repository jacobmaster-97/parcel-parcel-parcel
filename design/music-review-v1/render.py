"""Original Parcel Point review compositions. No samples or external music.
Development renderer: Python 3 + numpy + ffmpeg. Not imported by the game.
"""
from pathlib import Path
import hashlib, json, math, subprocess, wave
import numpy as np

HERE = Path(__file__).resolve().parent
WAV_DIR = HERE.parents[1] / 'deliverables' / 'music-review-v1'
WAV_DIR.mkdir(parents=True, exist_ok=True)
SR = 44100
# Each melody entry is (eighth-note start, MIDI pitch, eighth-note length).
# These phrases were composed for this review, rather than taken from a song.
DAY_A = [
 [(0,76,1.1),(1.5,79,.6),(2.5,81,.7),(4,79,.8),(5.5,76,.6),(6.5,74,.7)],
 [(0,76,.8),(1.5,81,.8),(3,84,1.2),(5,83,.7),(6,81,.7),(7,79,.6)],
 [(0,81,1.2),(2,79,.8),(3.5,76,.7),(5,77,1),(6.5,81,.9)],
 [(0,83,.9),(1.5,81,.7),(3,79,1.1),(5,74,.8),(6.5,79,.8)],
 [(0,79,.8),(1.5,83,.7),(3,81,.8),(4.5,79,.7),(6,76,1.2)],
 [(0,84,1.1),(2,83,.7),(3.5,81,.8),(5,76,.7),(6.5,79,.8)],
 [(0,77,.9),(1.5,81,.8),(3,79,.7),(4.5,77,.8),(6,74,1.1)],
 [(0,74,.8),(1.5,79,.9),(3,81,.7),(4.5,83,.9),(6.5,71,.8)],
]
DAY_B = [
 [(0,84,1.2),(2,81,.8),(3.5,79,.8),(5,81,.8),(6.5,77,.8)],
 [(0,79,1),(2,76,.7),(3.5,72,.8),(5,74,.7),(6.5,76,1)],
 [(0,81,1.1),(2,79,.7),(3.5,77,.8),(5,81,.8),(6.5,74,.8)],
 [(0,83,1),(2,81,.8),(3.5,79,.8),(5,77,.7),(6.5,74,.8)],
 [(0,76,.9),(1.5,79,.7),(3,83,1.1),(5,81,.7),(6.5,79,.8)],
 [(0,81,1.2),(2,84,.8),(3.5,83,.8),(5,79,.8),(6.5,76,.8)],
 [(0,81,.9),(1.5,79,.7),(3,77,.8),(4.5,76,.7),(6,77,1.2)],
 [(0,79,1.1),(2,83,.8),(3.5,81,.7),(5,79,.7),(6.5,74,.8)],
]
NIGHT_A = [
 [(0,76,2.1),(3,79,1.5),(5.5,74,1.6)],
 [(0,72,2.2),(3.5,76,1.7),(6,77,1.3)],
 [(0,77,1.8),(3,81,1.6),(5.5,79,1.7)],
 [(0,74,2),(3,71,1.6),(6,74,1.2)],
 [(0,76,2.1),(3.5,81,1.7),(6,79,1.1)],
 [(0,79,2.2),(3.5,76,1.5),(6,74,1.2)],
 [(0,77,2),(3,76,1.5),(5.5,72,1.5)],
 [(0,74,2),(3.5,79,1.6),(6,71,1.2)],
]
NIGHT_B = [
 [(0,81,2.1),(3,79,1.6),(6,76,1.2)],
 [(0,79,2),(3.5,76,1.6),(6,72,1.2)],
 [(0,77,2),(3.5,74,1.5),(6,76,1.3)],
 [(0,79,2.2),(3.5,74,1.5),(6,71,1.2)],
 [(0,81,1.8),(3,76,1.8),(6,72,1.3)],
 [(0,76,2.1),(3.5,79,1.6),(6,83,1.2)],
 [(0,81,2),(3.5,77,1.6),(6,76,1.2)],
 [(0,74,2.1),(3.5,71,1.5),(6,74,1.3)],
]
C, AM, F, G, EM, DM = [48,55,59,64], [45,52,55,60], [41,48,52,57], [43,50,53,59], [40,47,50,55], [38,45,48,53]
SPECS = [
 dict(id='business', title='街坊開檔', bpm=104, bars=32, melodies=DAY_A+DAY_A+DAY_B+DAY_A,
      chords=[C,AM,F,G,EM,AM,DM,G]*2+[F,C,DM,G,EM,AM,F,G]+[C,AM,F,G,EM,AM,DM,G],seed=104),
 dict(id='stocking', title='收工慢慢執', bpm=84, bars=24, melodies=NIGHT_A+NIGHT_B+NIGHT_A,
      chords=[C,AM,F,G,AM,EM,F,G]*3,seed=84),
]

def frequency(note): return 440 * 2 ** ((note-69)/12)

def instrument(note, length, kind):
    t=np.arange(max(1,round(length*SR)))/SR; f=frequency(note); phase=2*np.pi*f*t
    attack=np.minimum(1,t/(.012 if kind=='bass' else .009))
    release=np.minimum(1,np.maximum(0,length-t)/.045)
    if kind=='lead':
        # A rounded chip tone; upper partials decay faster than its soft fundamental.
        y=(np.sin(phase)+.19*np.sin(3*phase)*np.exp(-10*t)+.065*np.sin(5*phase)*np.exp(-14*t))*.68
        env=(.72*np.exp(-3*t)+.28)*attack*release
    elif kind=='bass':
        y=sum(((-1)**k)*np.sin((2*k+1)*phase)/(2*k+1)**2 for k in range(4))*.85
        env=np.exp(-2.4*t)*attack*release
    elif kind=='arp':
        y=np.sin(phase)+.16*np.sin(2*phase)*np.exp(-13*t)
        env=np.exp(-10*t)*attack*release
    else:
        y=(np.sin(phase)+.12*np.sin(2*phase))*.8
        env=np.exp(-1.9*t)*np.minimum(1,t/.06)*np.minimum(1,np.maximum(0,length-t)/.15)
    return y*env

def render(spec):
    beat=60/spec['bpm']; duration=spec['bars']*4*beat; size=round(duration*SR)
    rng=np.random.default_rng(spec['seed']); mix=np.zeros((size,2),dtype=np.float64); score=[]
    def add(y,start,volume,pan=0):
        index=round(start*SR); indices=(np.arange(len(y))+index)%size
        mix[indices,0]+=y*volume*math.sqrt((1-pan)/2)
        mix[indices,1]+=y*volume*math.sqrt((1+pan)/2)
    def note(pitch,start,length,kind,volume,pan=0):
        add(instrument(pitch,length,kind),start,volume,pan)
        score.append(dict(midi=pitch,start=round(start,5),duration=round(length,5),voice=kind))
    for bar,(melody,chord) in enumerate(zip(spec['melodies'],spec['chords'])):
        base=bar*4*beat; daytime=spec['id']=='business'
        for pos,pitch,span in melody:
            # The second A section answers in a softer articulation; the final returns gently.
            amp=(.14 if daytime else .13)*(1 if bar<8 else .93 if bar<16 else .98)
            note(pitch,base+pos*.5*beat,span*.5*beat+.07,'lead',amp,-.08)
        for j,pitch in enumerate(chord):
            note(pitch+12,base+j*.012,3.7*beat,'pad',.032 if daytime else .045,[-.48,-.18,.18,.48][j])
        root=chord[0]
        if daytime:
            for j,pitch in enumerate([root,root+12,root+7,root+12]):
                note(pitch,base+j*beat,.68*beat,'bass',.13 if j%2==0 else .095,0)
            for j in [1,3,5,7]:
                note(chord[(j//2+bar)%4]+24,base+j*.5*beat,.4*beat,'arp',.04,.38)
        else:
            for j,pitch in [(0,root),(2,root+7)]: note(pitch,base+j*beat,1.5*beat,'bass',.10,0)
            for j in [2,6]: note(chord[(bar+j//2)%4]+24,base+j*.5*beat,.7*beat,'arp',.035,.38)
        if daytime:
            for b in [0,2]:
                t=np.arange(round(.16*SR))/SR
                kick=np.sin(2*np.pi*(45*t+37*(1-np.exp(-28*t))/28))*np.exp(-27*t)*np.minimum(1,t/.003)
                add(kick,base+b*beat,.105)
            for b in [1,3]:
                t=np.arange(round(.12*SR))/SR; noise=rng.uniform(-1,1,len(t)); noise=np.convolve(noise,np.ones(7)/7,'same')
                add((noise*.65+.16*np.sin(2*np.pi*180*t))*np.exp(-36*t)*np.minimum(1,t/.004),base+b*beat,.055,-.22)
        for j in (range(8) if daytime else [2,6]):
            t=np.arange(round(.04*SR))/SR; noise=rng.uniform(-1,1,len(t)); noise=np.diff(noise,prepend=0)
            add(noise*np.exp(-110*t)*np.minimum(1,t/.002),base+j*.5*beat,.012 if daytime else .008,.32)
    # Circular short room and musical echo carry across the exact loop boundary.
    dry=mix.copy();mix+=np.roll(dry,round(beat*.75*SR),axis=0)*.10
    mix[:,0]+=np.roll(dry[:,1],round(.037*SR))*.07
    mix[:,1]+=np.roll(dry[:,0],round(.049*SR))*.07
    mix-=mix.mean(axis=0)
    peak=float(np.max(np.abs(mix)));rms=float(np.sqrt(np.mean(mix*mix)))
    gain=min(.71/peak,.085/rms);mix*=gain
    wav=WAV_DIR/(spec['id']+'.wav'); pcm=np.rint(mix*32767).astype('<i2')
    with wave.open(str(wav),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm.tobytes())
    mp3=HERE/(spec['id']+'.mp3')
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-c:a','libmp3lame','-q:a','3','-id3v2_version','3','-metadata','title='+spec['title'],'-metadata','artist=Parcel Point — original program composition',str(mp3)],check=True)
    result=dict(id=spec['id'],title=spec['title'],bpm=spec['bpm'],bars=spec['bars'],seconds=round(size/SR,5),sampleRate=SR,channels=2,mp3Bytes=mp3.stat().st_size,mp3Sha256=hashlib.sha256(mp3.read_bytes()).hexdigest(),peakDbfs=round(20*np.log10(np.max(np.abs(mix))),2),rmsDbfs=round(20*np.log10(np.sqrt(np.mean(mix*mix))),2),clippedSamples=int(np.sum(np.abs(pcm.astype(np.int32))>=32767)),loopBoundaryStep=float(np.max(np.abs(mix[0]-mix[-1]))),noteCount=len(score))
    (HERE/(spec['id']+'-score.json')).write_text(json.dumps(dict(**result,notes=score),ensure_ascii=False,indent=2)+'\n')
    return result

if __name__=='__main__':
    report=dict(status='preview-only',integrated=False,gameVersionUnchanged='0.15.2',source='Original note sequences and deterministic synthesis in render.py; no external music, recordings, samples or generative music service.',tracks=[render(s) for s in SPECS])
    (HERE/'metadata.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False,indent=2))
