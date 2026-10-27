"""Measure generated chroma sheets, then use ImageMagick to assemble runtime atlases.
Pillow/numpy only inspect pixels and measure masks. Visible artwork is generated.
"""
from pathlib import Path
import json,subprocess,hashlib
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
RAW=ROOT/'assets/raw/customers-v017';OUT=ROOT/'assets/characters';TMP=ROOT/'assets/.packing/customers-v017';TMP.mkdir(parents=True,exist_ok=True)
NAMES=['customer_student','customer_hat','customer_uncle'];DIRECTIONS=['down','left','right','up']
def run(args):subprocess.run(['convert',*map(str,args)],check=True)
def groups(bits):
 ids=np.flatnonzero(bits);return [] if not len(ids) else [(int(g[0]),int(g[-1])+1) for g in np.split(ids,np.where(np.diff(ids)>1)[0]+1)]
def measure(path):
 rgb=np.array(Image.open(path).convert('RGB')).astype(float)/255
 mask=~((rgb[:,:,1]>.55)&(rgb[:,:,1]>rgb[:,:,0]*1.5)&(rgb[:,:,1]>rgb[:,:,2]*1.5))
 rows=groups(mask.any(axis=1));assert len(rows)==4,(path,rows)
 boxes=[]
 for y0,y1 in rows:
  cols=groups(mask[y0:y1].any(axis=0));assert len(cols)==8,(path,cols)
  for x0,x1 in cols:
   yy,xx=np.where(mask[y0:y1,x0:x1]);boxes.append([x0+int(xx.min()),y0+int(yy.min()),int(xx.max()-xx.min()+1),int(yy.max()-yy.min()+1)])
 return boxes
def pixel_hash(im):return hashlib.sha256(im.tobytes()).hexdigest()
report=[];plans=[]
for name in NAMES:
 sources={kind:RAW/(name+suffix+'.png') for kind,suffix in [('walk','_walk'),('carry_walk','_carry_walk')]}
 if not all(p.exists() for p in sources.values()):continue
 boxes={kind:measure(p) for kind,p in sources.items()};frames={}
 # One scale per direction shared by empty/carry variants preserves character size.
 scales=[40/max(boxes[k][row*8+i][3] for k in boxes for i in range(8)) for row in range(4)]
 for kind,path in sources.items():
  keyed=TMP/(name+'_'+kind+'-keyed.png')
  run([path,'-alpha','on','-channel','A','-fx','(g>0.08 && g>r*1.2 && g>b*1.2)?0:1','+channel',keyed])
  cells=[]
  for i,(x,y,w,h) in enumerate(boxes[kind]):
   scale=min(scales[i//8],28/w);cw,ch=round(w*scale),round(h*scale)
   crop=TMP/(name+'_'+kind+f'-crop{i}.png');cell=TMP/(name+'_'+kind+f'-cell{i}.png')
   run([keyed,'-crop',f'{w}x{h}+{x}+{y}','+repage','-filter','point','-resize',f'{cw}x{ch}!',crop])
   run(['-size','32x48','xc:none',crop,'-geometry',f'+{16-cw//2}+{44-ch}','-compose','over','-composite',cell]);cells.append(cell)
  rows=[]
  for row in range(4):
   strip=TMP/(name+'_'+kind+f'-row{row}.png');run([*cells[row*8:row*8+8],'+append',strip]);rows.append(strip)
  output=OUT/(name+'_'+kind+'.png');run([*rows,'-append','-depth','8',output]);frames[kind]=cells
  atlas=Image.open(output).convert('RGBA');assert atlas.size==(256,192)
  rgba=np.array(atlas).astype(float)/255;assert not np.any((rgba[:,:,3]>0)&(rgba[:,:,1]>.08)&(rgba[:,:,1]>rgba[:,:,0]*1.2)&(rgba[:,:,1]>rgba[:,:,2]*1.2)),(name,kind,'green spill')
  unique=[];bounds=[]
  for row in range(4):
   hs=[]
   for col in range(8):
    cell=atlas.crop((col*32,row*48,(col+1)*32,(row+1)*48));bb=cell.getbbox();assert bb and bb[0]>=1 and bb[1]>=2 and bb[2]<=31 and bb[3]==44,(name,kind,row,col,bb)
    hs.append(pixel_hash(cell));bounds.append(bb)
   unique.append(len(set(hs)))
  assert min(unique)>=6,(name,kind,unique)
  meta={'name':name+'_'+kind,'image':'assets/characters/'+output.name,'frameWidth':32,'frameHeight':48,'columns':8,'rows':4,'frameCount':32,'filter':'nearest','anchor':[16,44],'directions':DIRECTIONS,'animations':{d:{'frames':list(range(r*8,r*8+8)),'frameRate':12,'repeat':-1} for r,d in enumerate(DIRECTIONS)},'source':'assets/raw/customers-v017/'+path.name,'sourceBoxes':boxes[kind],'sharedDirectionalScales':scales}
  (ROOT/'assets/metadata'/(name+'_'+kind+'.json')).write_text(json.dumps(meta,indent=2)+'\n')
  report.append({'name':meta['name'],'size':atlas.size,'uniqueFramesPerDirection':unique,'contentBounds':bounds,'anchor':[16,44],'sha256':hashlib.sha256(output.read_bytes()).hexdigest()})
  plans.append(meta)
  # Nearest-neighbour animation contact preview; this changes no artwork content.
  gif=ROOT/'assets/previews/customers-v017'/(name+'_'+kind+'.gif')
  run(['-delay','9',*[p for row in range(4) for p in cells[row*8:row*8+8]],'-loop','0','-filter','point','-resize','300%',gif])
 idle=OUT/(name+'_idle.png');run([*[frames['walk'][r*8+2] for r in range(4)],'+append','-depth','8',idle]);assert Image.open(idle).size==(128,48)
 idle_meta={'name':name+'_idle','image':'assets/characters/'+idle.name,'frameWidth':32,'frameHeight':48,'columns':4,'rows':1,'frameCount':4,'anchor':[16,44],'filter':'nearest','directions':DIRECTIONS,'sourceFrames':[2,10,18,26]}
 (ROOT/'assets/metadata'/(name+'_idle.json')).write_text(json.dumps(idle_meta,indent=2)+'\n');plans.append(idle_meta)
(ROOT/'assets/metadata/customers-v017-packing.json').write_text(json.dumps({'method':'Measured foreground rows/columns, shared empty/carry directional scale, nearest resize, ImageMagick chroma and composite; no generated-cell equal-grid assumption.','atlases':plans},indent=2)+'\n')
(ROOT/'deliverables/customers-v017/asset-report.json').write_text(json.dumps({'status':'PASS' if len(report)==6 else 'partial','walkAtlases':report,'runtimeCell':[32,48],'runtimeWalkSheet':[256,192],'idleSheet':[128,48],'expectedNewCharacterCount':3,'completedCharacters':len(report)//2},indent=2)+'\n')
print(json.dumps({'completedCharacters':len(report)//2,'atlases':len(plans),'motionUniqueRows':[r['uniqueFramesPerDirection'] for r in report]}))
