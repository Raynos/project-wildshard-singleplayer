"""Freeze native source and untouched raw PNG evidence; exact pixel matched pairs."""
import hashlib,json,shutil
from pathlib import Path
from PIL import Image,ImageDraw
h=Path(__file__).resolve().parent;root=h.parents[3];tmp=root/'tmp/bellback-woody-character-integration';pairs=[]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def entry(p):return {'path':str(p.relative_to(root)),'bytes':p.stat().st_size,'sha256':sha(p)}
for kind in ['hero','nine']:
 newdir=tmp/'final'/kind;olddir=root/'tmp/bellback-complete-pass3'/kind
 new=json.loads((newdir/f'capture-{kind}.json').read_text());old=json.loads((olddir/f'capture-{kind}.json').read_text())
 assert new['capture_script_sha256']==old['capture_script_sha256']==sha(h/'capture_review.py')
 assert new['lights']==old['lights']
 assert sha(root/new['source'])==new['source_sha256']
 assert sha(root/old['source'])==old['source_sha256']
 shutil.copyfile(newdir/f'capture-{kind}.json',h/f'capture-{kind}.json')
 for a,b in zip(old['shots'],new['shots']):
  for k in ['name','camera','target','ortho_scale']:assert a[k]==b[k]
  op=olddir/(a['name']+'.png');np=newdir/(b['name']+'.png')
  assert sha(op)==a['image_sha256'];assert sha(np)==b['image_sha256']
  oi,ni=Image.open(op).convert('RGB'),Image.open(np).convert('RGB');assert oi.size==ni.size
  # No resizing, cropping, recoloring or lossy recompression. Raw files not rewritten.
  board=Image.new('RGB',(oi.width,oi.height*2+48),'#15212b');board.paste(oi,(0,24));board.paste(ni,(0,oi.height+48))
  draw=ImageDraw.Draw(board);draw.text((8,7),'A: retained pass3 / '+a['name'],fill='white');draw.text((8,oi.height+31),'B: woody integration / '+b['name'],fill='white')
  dest=tmp/'pairs'/(a['name']+'.png');dest.parent.mkdir(exist_ok=True);board.save(dest)
  pairs.append({'view':a['name'],'baseline':entry(op),'candidate':entry(np),'pair':entry(dest),'camera':a['camera'],'target':a['target'],'ortho_scale':a['ortho_scale']})
(h/'paired-captures.json').write_text(json.dumps({'status':'Ten exact-camera pairs; original raw PNG bytes preserved. Pair images concatenate unchanged RGB pixels.','capture_script_sha256':sha(h/'capture_review.py'),'pairs':pairs},indent=2)+'\n')
assert sha(tmp/'final/hero/bellback-woody-character-integration.glb')==sha(tmp/'final/nine/bellback-woody-character-integration.glb')==sha(h/'bellback-woody-character-integration.glb')
shutil.copyfile(tmp/'final/hero/metrics.json',h/'metrics.json')
files=[entry(p) for p in sorted(h.iterdir()) if p.is_file() and p.name!='closure.json']
raw=[entry(p) for p in sorted(tmp.rglob('*.png'))]
total=sum(p.stat().st_size for p in list(h.rglob('*'))+list(tmp.rglob('*')) if p.is_file())
assert total<=22*1024**2,total
(h/'closure.json').write_text(json.dumps({'status':'Static evidence frozen, no quality score or runtime acceptance','files':files,'raw_pngs':raw,'new_footprint_bytes':total},indent=2)+'\n')
print('FROZEN',len(pairs),'pairs',total,'bytes')
