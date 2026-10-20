"""Package actual fresh paired captures without modifying their raw originals."""
from pathlib import Path
import json,hashlib,math,os
from PIL import Image,ImageDraw,ImageFont
B=Path(__file__).resolve().parent;R=B.parents[3];raw=R/'tmp/colossus-complete-character-refined'
views=['hero','front','left','right','back','top','diag-front','diag-left','diag-right','diag-back']
def record(p):return {'path':os.path.relpath(p,R),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
def write(p,x):p.write_text(json.dumps(x,indent=2)+'\n')
cam=json.loads((raw/'cameras.json').read_text());verts=[v for p in json.loads((B/'editable-native.json').read_text())['parts'] for v in p['vertices']]
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
for version,title in [('predecessor','RETAINED NEXT'),('candidate','REFINED CANDIDATE')]:
 (B/version).mkdir(exist_ok=True)
 for v in views:labelled(raw/version/f'{v}.png',f'{title} | {v.upper()} | ACTUAL 3D').save(B/version/f'{v}.webp',quality=83,method=6)
board=Image.new('RGB',(525,1460),'#101b22');board.paste(labelled(raw/'predecessor/hero.png','A | RETAINED NEXT | FRESH MATCHED HERO'),(0,0));board.paste(labelled(raw/'candidate/hero.png','B | UNACCEPTED REFINED | MATCHED HERO'),(0,730));board.save(B/'matched-hero-board.webp',quality=83,method=6)
for version in ('predecessor','candidate'):
 # A non-overlapping 3x3 nine-view sheet, hero separately above.
 sheet=Image.new('RGB',(1050,1461),'#101b22')
 for i,v in enumerate(views[1:]):sheet.paste(labelled(raw/version/f'{v}.png',f'{version.upper()} | {v.upper()}').resize((350,487)),((i%3)*350,(i//3)*487))
 sheet.save(B/f'{version}-nineview-sheet.webp',quality=83,method=6)
originals=[R.parent/'generated_images/tide-root-colossus-lowpoly-style-revision.png']+[R.parent/'wildshard-review-site-current/source-evidence/approved-nine-qa/originals/corrections'/f'colossus{x}CorrectedGen-v3.png' for x in ('World','Explorer')]
write(B/'capture-receipt.json',{'status':'Both retained next and candidate freshly rendered, identical source protocol','referenceStatus':'Original hero authoritative; AI hidden surfaces approximate','originalReferences':[record(p) for p in originals],'resolution':[525,700],'samples':16,'denoising':False,'viewTransform':'Standard','worldColor':[.12,.12,.12],'target':[0,0,2.9],'orthoScale':7.7,'files':[record(p) for p in sorted(raw.rglob('*')) if p.is_file() and '__pycache__' not in str(p)]})
for r in json.loads((B/'input-preservation.json').read_text())['files']:assert record(R/r['path'])==r
assert (B/'tide-root-colossus-complete-character-refined.glb').read_bytes()==(raw/'candidate/tide-root-colossus-complete-character-refined.glb').read_bytes()
write(B/'render-equivalence.json',{'method':'Exact exported GLB byte equality before and after captures','rendered':record(raw/'candidate/tide-root-colossus-complete-character-refined.glb'),'final':record(B/'tide-root-colossus-complete-character-refined.glb'),'geometryMaterialsTransformsIdentical':True})
files=[p for p in B.rglob('*') if p.is_file() and '__pycache__' not in str(p) and p.name!='final-closure.json']
for p in files:
 limit=5_000_000 if p.suffix=='.json' else 500000 if ('board' in p.name or 'sheet' in p.name) else 250000 if p.suffix=='.webp' else 1_000_000
 assert p.stat().st_size<=limit,(p,p.stat().st_size)
binary=sum(p.stat().st_size for p in files if p.suffix in ('.glb','.bin','.webp'))
write(B/'final-closure.json',{'status':'Frozen unaccepted candidate; no author score or runtime promotion','newBinaryBytes':binary,'files':[record(p) for p in sorted(files)]})
print(record(B/'final-closure.json'),binary)
