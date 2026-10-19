"""Validate exact camera/light parity and preserve twenty actual native raw renders."""
import hashlib,json,shutil
from pathlib import Path
from PIL import Image,ImageDraw
H=Path(__file__).resolve().parent;R=H.parents[3];T=R/'tmp/bellback-complete-character-pass'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def entry(p):return dict(path=str(p.relative_to(R)),bytes=p.stat().st_size,sha256=sha(p))
base=H.parent/'woody-character-integration';reference=R/'art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/bellback-lowpoly.webp'
pins=dict(reference=entry(reference),baseline_source=entry(base/'build_bellback_complete.py'),baseline_glb=entry(base/'bellback-woody-character-integration.glb'),candidate_source=entry(H/'build_bellback_complete.py'),candidate_glb=entry(H/'bellback-complete-character-pass.glb'),capture_script=entry(H/'capture_review.py'))
assert sha(base/'capture_review.py')==sha(H/'capture_review.py')
pairs=[]
for kind in ['hero','nine']:
 od=T/'final/baseline'/kind;nd=T/'final/candidate'/kind
 old=json.loads((od/f'capture-{kind}.json').read_text());new=json.loads((nd/f'capture-{kind}.json').read_text())
 assert old['capture_script_sha256']==new['capture_script_sha256']==sha(H/'capture_review.py')
 assert old['lights']==new['lights'];assert len(old['shots'])==len(new['shots'])
 for role,receipt,src,folder,glb in [('baseline',old,base/'build_bellback_complete.py',od,'bellback-woody-character-integration.glb'),('candidate',new,H/'build_bellback_complete.py',nd,'bellback-complete-character-pass.glb')]:
  assert receipt['source_sha256']==sha(src)
  assert sha(folder/glb)==sha((base if role=='baseline' else H)/glb)
  shutil.copyfile(folder/f'capture-{kind}.json',H/f'{role}-capture-{kind}.json')
 for a,b in zip(old['shots'],new['shots']):
  for k in ['name','camera','target','ortho_scale']:assert a[k]==b[k]
  op=od/(a['name']+'.png');np=nd/(b['name']+'.png');assert sha(op)==a['image_sha256'];assert sha(np)==b['image_sha256']
  oi=Image.open(op).convert('RGB');ni=Image.open(np).convert('RGB');assert oi.size==ni.size
  board=Image.new('RGB',(oi.width,oi.height*2+48),'#15212b');board.paste(oi,(0,24));board.paste(ni,(0,oi.height+48));draw=ImageDraw.Draw(board)
  draw.text((8,7),'A: retained woody baseline / '+a['name'],fill='white');draw.text((8,oi.height+31),'B: complete character pass / '+b['name'],fill='white')
  dest=T/'pairs'/(a['name']+'.png');dest.parent.mkdir(exist_ok=True);board.save(dest)
  # Compact derivative only; native raw evidence above remains unmodified.
  preview=board.copy();preview.thumbnail((768,1536));preview.save(H/('matched-'+a['name']+'-board.webp'),quality=82,method=6)
  pairs.append(dict(view=a['name'],baseline=entry(op),candidate=entry(np),pair=entry(dest),camera=a['camera'],target=a['target'],ortho_scale=a['ortho_scale']))
(H/'input-pins.json').write_text(json.dumps(pins,indent=2)+'\n')
(H/'paired-captures.json').write_text(json.dumps(dict(status='Twenty actual renders, ten exact matched pairs. Raw PNG bytes unchanged; pair boards concatenate full RGB pixels.',capture_script_sha256=sha(H/'capture_review.py'),pairs=pairs),indent=2)+'\n')
shutil.copyfile(T/'final/candidate/hero/metrics.json',H/'metrics.json')
# Source-level exact geometry delta; no visual score inferred.
old={r['name']:r for r in json.loads((T/'baseline-exact-mesh.json').read_text())};new={r['name']:r for r in json.loads((T/'candidate-exact-mesh.json').read_text())}
added=[n for n in new if n not in old];removed=[n for n in old if n not in new];changed=[n for n in new.keys()&old.keys() if new[n]!=old[n]];unchanged=[n for n in new.keys()&old.keys() if new[n]==old[n]]
(H/'source-diff-summary.json').write_text(json.dumps(dict(added=added,removed=removed,changed=sorted(changed),unchanged=sorted(unchanged),baseline_exact=entry(T/'baseline-exact-mesh.json'),candidate_exact=entry(T/'candidate-exact-mesh.json')),indent=2)+'\n')
files=[entry(p) for p in sorted(H.rglob('*')) if p.is_file() and p.name!='closure.json'];raw=[entry(p) for p in sorted(T.rglob('*.png'))]
total=sum(p.stat().st_size for folder in [H,T] for p in folder.rglob('*') if p.is_file());assert total<=60*1024**2,total
(H/'closure.json').write_text(json.dumps(dict(status='Static evidence frozen; no quality score, promotion, runtime or physics acceptance',files=files,raw_pngs=raw,new_footprint_bytes=total),indent=2)+'\n');print('FROZEN',len(pairs),'pairs',total,'bytes')
