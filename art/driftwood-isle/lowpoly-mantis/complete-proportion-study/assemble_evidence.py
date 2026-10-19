"""Label real captures; never overwrite, recompress, or replace raw PNG files."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageOps
import hashlib,json,math
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3];RAW=ROOT/'tmp/mantis-complete-proportion-study';BASE=HERE.parent
views=['hero','front','left','right','back','top','diag-front','diag-left','diag-right','diag-back']
roles={'baseline':'CERVICAL REPAIR','candidate':'COMPLETE PROPORTION'}
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(im,p,cap):
 im.save(p,quality=90,method=6);assert p.stat().st_size<=cap
cameras=json.loads((HERE/'cameras.json').read_text())['cameras'];provenance=json.loads((HERE/'capture-provenance.json').read_text())
models={r:json.loads((BASE/s/('mantis-mesh-'+s+'.json')).read_text()) for r,s in [('baseline','cervical-frame-repair'),('candidate','complete-proportion-study')]}
def project(p,c):
 rx,ry,rz=c['rotation'];cx,sx=math.cos(rx),math.sin(rx);cy,sy=math.cos(ry),math.sin(ry);cz,sz=math.cos(rz),math.sin(rz)
 r=[[cz*cy,cz*sy*sx-sz*cx,cz*sy*cx+sz*sx],[sz*cy,sz*sy*sx+cz*cx,sz*sy*cx-cz*sx],[-sy,cy*sx,cy*cx]];q=[p[i]-c['location'][i] for i in range(3)];v=[sum(r[j][i]*q[j] for j in range(3)) for i in range(3)]
 return [319+v[0]*900/c['orthoScale'],450-v[1]*900/c['orthoScale']]
frames=[];fits=[]
for view in views:
 assert provenance['baseline']['capturedViews'][view]['camera']==provenance['candidate']['capturedViews'][view]['camera']
 assert provenance['baseline']['capturedViews'][view]['settings']==provenance['candidate']['capturedViews'][view]['settings']
 for role,title in roles.items():
  path=RAW/role/(view+'.png');digest=sha(path);im=Image.open(path);im.load();assert im.size==(638,900)
  assert digest==provenance[role]['capturedViews'][view]['sha256']
  frames.append(dict(path=str(path.relative_to(ROOT)),sha256=digest,bytes=path.stat().st_size,size=list(im.size)))
  pts=[project(v,cameras[view]) for part in models[role]['parts'] for v in part['vertices']]
  bounds=[min(p[0] for p in pts),min(p[1] for p in pts),max(p[0] for p in pts),max(p[1] for p in pts)]
  assert bounds[0]>0 and bounds[1]>0 and bounds[2]<638 and bounds[3]<900
  fits.append(dict(role=role,view=view,pixelBounds=bounds))
  im=im.convert('RGB');d=ImageDraw.Draw(im);d.rectangle((0,0,638,34),fill='#0b1722');d.text((10,5),title+' / REAL / '+view,font=font,fill='white');save(im,HERE/(role+'-'+view+'.webp'),250000)
  assert sha(path)==digest
for role,title in roles.items():
 b=Image.new('RGB',(1080,1580),'#0b1722');d=ImageDraw.Draw(b);d.text((15,10),title+' / REAL MATCHED NINE',font=font,fill='white')
 for i,view in enumerate(views[1:]):
  x=i%3*360;y=45+i//3*505;im=ImageOps.contain(Image.open(RAW/role/(view+'.png')),(350,470));b.paste(im,(x+(360-im.width)//2,y+28));d.text((x+12,y),view,font=font,fill='white')
 save(b,HERE/(role+'-nine-board.webp'),500000)
ref=ROOT/'art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/splinter-mantis-lowpoly.webp'
b=Image.new('RGB',(1080,1580),'#0b1722');d=ImageDraw.Draw(b);d.text((15,12),'MANTIS / ORIGINAL + MATCHED REAL COMPLETE MODELS',font=font,fill='white')
ims=[Image.open(ref).crop((5,270,505,970)),Image.open(RAW/'baseline/hero.png'),Image.open(RAW/'candidate/hero.png')]
for i,(title,im) in enumerate(zip(['APPROVED LARGE FIGURE (CROP)','REPAIRED BASELINE','COMPLETE STUDY / UNREVIEWED'],ims)):
 x=0 if i==0 else (i-1)*540;y=50 if i==0 else 790;d.text((x+12,y),title,font=font,fill='white');im=ImageOps.contain(im,(500,690));b.paste(im,(x+((1080 if i==0 else 540)-im.width)//2,y+32))
save(b,HERE/'matched-hero-board.webp',500000)
for p,digest in json.loads((HERE/'input-pins.json').read_text()).items():assert sha(ROOT/p)==digest
for row in frames:assert sha(ROOT/row['path'])==row['sha256']
footprint=sum(p.stat().st_size for folder in [HERE,RAW] for p in folder.rglob('*') if p.is_file())
assert footprint<=20*1024*1024,footprint
report=dict(status='MATCHED_STATIC_CAPTURE_VERIFIED',score=None,visualAcceptance=False,rawPngsImmutable=True,frameCount=len(frames),rawFrames=frames,projectionFits=fits,pairedCamerasAndSettings=True,totalNewBytes=footprint,files={str(p.relative_to(ROOT)):sha(p) for p in HERE.rglob('*') if p.is_file() and p.name!='evidence.json'},limits='No articulation/contact/animation/runtime acceptance. Hidden original angles approximate. Raw PNGs never re-encoded; previews are labelled derivatives.')
(HERE/'evidence.json').write_text(json.dumps(report,indent=2)+'\n');print('PASS',len(frames),'raw frames;',footprint,'bytes')
