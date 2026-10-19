"""Package actual matched frames and close source/provenance hashes."""
from pathlib import Path
import hashlib,json,shutil
from PIL import Image,ImageDraw,ImageFont
base=Path(__file__).resolve().parent;repo=base.parents[3];raw=repo/'tmp/colossus-complete-pass3'
def rec(p):return {'path':str(p.relative_to(repo)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
assert (raw/'exit.txt').read_text().strip()=='0'
assert (raw/'candidate/tide-root-colossus-complete-pass3.glb').stat().st_size<=1000000
cam=json.loads((raw/'cameras.json').read_text())
for view in ['hero','front','left','right','back','top','diag-front','diag-left','diag-right','diag-back']:
 rows=[r for r in cam['views'] if r['view']==view]
 assert len(rows)==2
 assert all(rows[0][k]==rows[1][k] for k in ['position','target','orthoScale'])
for r in json.loads((base/'predecessor-preservation.json').read_text())['files']:
 assert rec(repo/r['path'])==r,r['path']
views=['hero','front','left','right','back','top','diag-front','diag-left','diag-right','diag-back']
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12)
def labeled(p,label,width=525):
 im=Image.open(p).convert('RGB');im=im.resize((width,round(im.height*width/im.width)),Image.Resampling.LANCZOS)
 dst=Image.new('RGB',(width,im.height+30),'#101b22');dst.paste(im,(0,30));ImageDraw.Draw(dst).text((6,8),label,font=font,fill='#e6efef');return dst
def save(im,p,limit=250000):
 for q in [88,82,76,70,64]:
  im.save(p,'WEBP',quality=q,method=6)
  if p.stat().st_size<=limit:return
 raise ValueError(p)
for version,label in [('predecessor','RETAINED COMPLETE PASS 1'),('candidate','CANDIDATE COMPLETE PASS 3')]:
 dest=base/version;dest.mkdir(exist_ok=True)
 board=Image.new('RGB',(1050,1491),'#101b22')
 for i,v in enumerate(views):
  save(labeled(raw/version/(v+'.png'),f'{label} | {v.upper()} | ACTUAL 3D'),dest/(v+'.webp'))
  if i:board.paste(labeled(raw/version/(v+'.png'),f'{label} | {v.upper()}',350),(((i-1)%3)*350,((i-1)//3)*497))
 save(board,dest/'nine-board.webp',500000)
board=Image.new('RGB',(525,1460),'#101b22')
for i,(v,label) in enumerate([('predecessor','A | RETAINED COMPLETE PASS 1'),('candidate','B | CANDIDATE COMPLETE PASS 3')]):
 board.paste(labeled(raw/v/'hero.png',label),(0,i*730))
save(board,base/'matched-hero-board.webp',500000)
for name in ['tide-root-colossus-complete-pass3.glb','metrics-complete-pass3.json','validation.json']:
 shutil.copyfile(raw/'candidate'/name,base/name)
camera=json.loads((raw/'cameras.json').read_text())
for row in camera['views']:row['file']=str(Path(row['file']).relative_to(repo))
(base/'cameras.json').write_text(json.dumps(camera,indent=2)+'\n')
assert (raw/'predecessor/tide-root-colossus-complete-pass1.glb').read_bytes()==(base.parent/'complete-pass1/tide-root-colossus-complete-pass1.glb').read_bytes()
files=[raw/v/(n+'.png') for v in ['predecessor','candidate'] for n in views]+[raw/'render.log',raw/'exit.txt',raw/'predecessor/tide-root-colossus-complete-pass1.glb',raw/'predecessor/validation.json',raw/'candidate/tide-root-colossus-complete-pass3.glb',raw/'candidate/validation.json']
(base/'capture-receipt.json').write_text(json.dumps({'status':'Actual matched hero plus nine for both retained predecessor and candidate','predecessorRebuildByteIdentical':True,'files':[rec(p) for p in files]},indent=2)+'\n')
source=[base/n for n in ['build_colossus_complete.py','render_matched.py','construct_source.py','validate_glb.py','package_evidence.py']]+[repo/'docs/reviews/colossus-complete-pass3-construction.md',repo/'art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/tide-root-colossus-lowpoly.webp']
(base/'source-closure.json').write_text(json.dumps({'files':[rec(p) for p in source]},indent=2)+'\n')
files=[p for p in base.rglob('*') if p.is_file() and '__pycache__' not in str(p) and p.name!='final-closure.json']
(base/'final-closure.json').write_text(json.dumps({'status':'Unaccepted static candidate; no author score','predecessorMismatches':[],'files':[rec(p) for p in sorted(files)]},indent=2)+'\n')
print(json.dumps({'closure':rec(base/'final-closure.json'),'glb':rec(base/'tide-root-colossus-complete-pass3.glb')},indent=2))
