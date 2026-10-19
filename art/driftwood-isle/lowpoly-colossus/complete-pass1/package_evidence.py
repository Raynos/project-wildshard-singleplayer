"""Package actual completed renders; no mesh/camera/lighting changes."""
from pathlib import Path
import hashlib,json,shutil
from PIL import Image,ImageDraw,ImageFont
base=Path(__file__).resolve().parent
repo=base.parents[3]
hero=repo/'tmp/colossus-complete-pass1';nine=repo/'tmp/colossus-complete-pass1-nine'
def record(p):return {'path':str(p.relative_to(repo)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
views=['front','left','right','back','top','diag-front','diag-left','diag-right','diag-back']
for manifest in ['source-closure.json','predecessor-preservation.json']:
 for r in json.loads((base/manifest).read_text())['files']:
  assert record(repo/r['path'])['sha256']==r['sha256'],r['path']
assert (hero/'exit.txt').read_text().strip()=='0'
assert (nine/'exit.txt').read_text().strip()=='0'
assert (hero/'tide-root-colossus-complete-pass1.glb').read_bytes()==(nine/'tide-root-colossus-complete-pass1.glb').read_bytes()
audit=json.loads((hero/'validation.json').read_text())
assert not any(audit[k] for k in ['boundaryEdges','nonmanifoldEdges','windingConflicts','zeroAreaTriangles','nonpositiveMeshVolumes'])
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13)
def labeled(p,label,width=None):
 im=Image.open(p).convert('RGB')
 if width: im=im.resize((width,round(im.height*width/im.width)),Image.Resampling.LANCZOS)
 out=Image.new('RGB',(im.width,im.height+32),'#101b22');out.paste(im,(0,32));ImageDraw.Draw(out).text((8,8),label,font=font,fill='#dfebee');return out
def save(im,p,cap):
 for q in [86,80,75,70,65]:
  im.save(p,'WEBP',quality=q,method=6)
  if p.stat().st_size<=cap:return
 raise ValueError(p)
save(labeled(hero/'three-quarter.png','COLOSSUS COMPLETE PASS 1 | ACTUAL 3D | UNACCEPTED'),base/'hero.webp',250000)
board=Image.new('RGB',(1350,1896),'#101b22')
for i,v in enumerate(views):
 p=nine/f'color-complete-pass1-{v}.png';label=f'COLOSSUS COMPLETE PASS 1 | {v.upper()}'
 save(labeled(p,label),base/f'{i+1:02}-{v}.webp',250000)
 board.paste(labeled(p,label,450),((i%3)*450,(i//3)*632))
save(board,base/'nine-board.webp',500000)
for p in [hero/'tide-root-colossus-complete-pass1.glb',hero/'metrics-complete-pass1.json',hero/'validation.json',nine/'cameras-complete-pass1.json']:
 shutil.copyfile(p,base/p.name)
raw=[hero/'three-quarter.png']+[nine/f'color-complete-pass1-{v}.png' for v in views]+[hero/'render.log',nine/'render.log',hero/'exit.txt',nine/'exit.txt']
(base/'capture-receipt.json').write_text(json.dumps({'status':'Actual hero and nine; independent review pending','heroExit':0,'nineExit':0,'geometryAuditExit':0,'heroAndNineGLBIdentical':True,'files':[record(p) for p in raw]},indent=2)+'\n')
paths=[p for p in base.iterdir() if p.is_file() and p.name!='final-closure.json']+[repo/'docs/reviews/colossus-complete-pass1-construction.md']
(base/'final-closure.json').write_text(json.dumps({'status':'Unaccepted static study; no score or runtime admission','predecessorMismatches':[],'files':[record(p) for p in sorted(paths)]},indent=2)+'\n')
print(json.dumps({'closure':record(base/'final-closure.json'),'glb':record(base/'tide-root-colossus-complete-pass1.glb')},indent=2))
