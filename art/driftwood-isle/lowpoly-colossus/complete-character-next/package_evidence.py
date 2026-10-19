"""Freeze exact source, actual matched captures, and preserved failure evidence."""
from pathlib import Path
import json,hashlib,struct,math,shutil
from PIL import Image,ImageDraw,ImageFont
B=Path(__file__).resolve().parent;R=B.parents[3];raw=R/'tmp/colossus-complete-character-next';initial=R/'tmp/colossus-complete-character-next-initial';prior=R/'tmp/colossus-complete-pass4/candidate'
views=['hero','front','left','right','back','top','diag-front','diag-left','diag-right','diag-back']
def record(p):return {'path':str(p.relative_to(R)) if p.is_relative_to(R) else str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
def write(p,x):p.write_text(json.dumps(x,indent=2)+'\n')
def chunks(p):
 r=p.read_bytes();n=struct.unpack_from('<I',r,12)[0];return json.loads(r[20:20+n]),r[20+n:]
a,ab=chunks(raw/'rendered-before-metadata-strip.glb');b,bb=chunks(B/'tide-root-colossus-complete-character-next.glb')
for mesh in a['meshes']:mesh.pop('name',None)
assert a==b and ab==bb
write(B/'render-equivalence.json',{'method':'Exact JSON equality after deleting only duplicate mesh names; exact BIN chunk equality. Node names retained.','rendered':record(raw/'rendered-before-metadata-strip.glb'),'final':record(B/'tide-root-colossus-complete-character-next.glb'),'geometryMaterialsTransformsIdentical':True,'renderProducer':record(B/'failed-initial/normalfixed-presize.py')})
assert (raw/'exit.txt').read_text().strip()=='0'
cam=json.loads((raw/'cameras.json').read_text())
verts=[v for p in json.loads((B/'editable-native.json').read_text())['parts'] for v in p['vertices']]
def norm(v):
 l=math.sqrt(sum(x*x for x in v));return [x/l for x in v]
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
framing=[]
for view in views:
 rows=[r for r in cam['views'] if r['view']==view];assert len(rows)==2
 assert all(rows[0][k]==rows[1][k] for k in ('position','target','orthoScale'))
 row=next(r for r in rows if r['version']=='candidate');direction=norm([a-b for a,b in zip(row['target'],row['position'])]);right=norm(cross(direction,[0,0,1]));up=cross(right,direction)
 xy=[]
 for v in verts:
  delta=[x-y for x,y in zip(v,row['target'])];xy.append([sum(x*y for x,y in zip(delta,right)),sum(x*y for x,y in zip(delta,up))])
 hx=7.7*.75/2;hy=7.7/2;mx=min(hx-abs(p[0]) for p in xy);my=min(hy-abs(p[1]) for p in xy)
 assert mx>0 and my>0,(view,mx,my)
 framing.append({'view':view,'horizontalMarginPixels':mx/(2*hx)*525,'verticalMarginPixels':my/(2*hy)*700})
 for r in rows:
  p=Path(r['file']);r['file']=str(p.relative_to(R)) if p.is_absolute() else str(p)
write(B/'cameras.json',cam);write(B/'framing-check.json',{'allGeometryInsideFrame':True,'records':framing})
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12)
def labelled(p,label):
 im=Image.open(p).convert('RGB');assert im.size==(525,700);o=Image.new('RGB',(525,730),'#101b22');o.paste(im,(0,30));ImageDraw.Draw(o).text((6,8),label,font=font,fill='#e6efef');return o
(B/'candidate').mkdir(exist_ok=True)
for v in views:labelled(raw/'candidate'/f'{v}.png',f'NEXT CANDIDATE | {v.upper()} | ACTUAL 3D').save(B/'candidate'/f'{v}.webp',quality=85,method=6)
board=Image.new('RGB',(525,1460),'#101b22');board.paste(labelled(prior/'hero.png','A | RETAINED PASS4 | ACTUAL MATCHED HERO'),(0,0));board.paste(labelled(raw/'candidate/hero.png','B | UNACCEPTED NEXT | ACTUAL MATCHED HERO'),(0,730));board.save(B/'matched-hero-board.webp',quality=85,method=6)
labelled(initial/'candidate/hero.png','INITIAL | NONPLANAR NORMALS | NOT FINAL').save(B/'failed-initial/hero.webp',quality=80,method=6)
shutil.copyfile(initial/'candidate/validation.json',B/'failed-initial/validation.json')
write(B/'failed-initial/closure.json',{'status':'Initial normals failure retained; not final','files':[record(p) for p in sorted(initial.rglob('*')) if p.is_file()]})
inputs=[B.parent/'complete-pass4/build_colossus_complete.py',B.parent/'complete-pass4/tide-root-colossus-complete-pass4.glb',B.parent/'complete-pass4/final-closure.json',R/'art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/tide-root-colossus-lowpoly.webp']+[R/'art/driftwood-isle/concepts/approved-nine-2026-10-19/previews'/f'{n}-sheet.webp' for n in ('colossusWorldGen','colossusExplorerGen')]+[prior/f'{v}.png' for v in views]
write(B/'input-preservation.json',{'files':[record(p) for p in inputs]})
write(B/'capture-receipt.json',{'status':'Actual candidate frames paired with unchanged retained pass4 captures','referenceStatus':'Original hero authoritative; both AI nine-angle sheets approximate hidden surfaces','resolution':[525,700],'samples':16,'denoising':False,'viewTransform':'Standard','worldColor':[.12,.12,.12],'target':[0,0,2.9],'orthoScale':7.7,'files':[record(p) for p in sorted(raw.rglob('*')) if p.is_file()]})
files=[p for p in B.rglob('*') if p.is_file() and '__pycache__' not in str(p) and p.name!='final-closure.json']
for p in files:
 if p.suffix=='.json':assert p.stat().st_size<=5_000_000
 elif p.suffix in ('.glb','.bin'):assert p.stat().st_size<=1_000_000
 elif p.suffix=='.webp':assert p.stat().st_size<=(500000 if 'board' in p.name else 250000)
binary=sum(p.stat().st_size for p in files if p.suffix in ('.glb','.bin','.webp'));rawbytes=sum(p.stat().st_size for root in (raw,initial) for p in root.rglob('*') if p.is_file())
assert binary<=4000000 and rawbytes<=30*1024**2,(binary,rawbytes)
write(B/'final-closure.json',{'status':'Frozen unaccepted candidate, no author score or runtime promotion','newBinaryBytes':binary,'rawEvidenceBytes':rawbytes,'files':[record(p) for p in sorted(files)]})
print(record(B/'final-closure.json'),binary,rawbytes)
