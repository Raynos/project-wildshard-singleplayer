"""Package frozen actual pass4 frames; reference exact retained pass1 inputs."""
from pathlib import Path
import hashlib,json,shutil
from PIL import Image,ImageDraw,ImageFont
base=Path(__file__).resolve().parent
repo=base.parents[3]
raw=repo/'tmp/colossus-complete-pass4'
prior=repo/'tmp/colossus-complete-pass3/predecessor'
views=['hero','front','left','right','back','top','diag-front','diag-left','diag-right','diag-back']
def rec(p):
 return {'path':str(p.relative_to(repo)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
def write(p,value):p.write_text(json.dumps(value,indent=2)+'\n')
assert (raw/'exit.txt').read_text().strip()=='0'
assert (raw/'failed-initial/exit.txt').read_text().strip()=='0'
for r in json.loads((base/'input-preservation.json').read_text())['files']:
 assert rec(repo/r['path'])==r,r['path']
cam=json.loads((raw/'cameras.json').read_text())
for v in views:
 rows=[r for r in cam['views'] if r['view']==v]
 assert len(rows)==2
 assert all(rows[0][k]==rows[1][k] for k in ['position','target','orthoScale'])
 for r in rows:
  p=Path(r['file']);r['file']=str(p.relative_to(repo)) if p.is_absolute() else str(p)
write(base/'cameras.json',cam)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12)
def labeled(path,label):
 im=Image.open(path).convert('RGB');assert im.size==(525,700)
 dst=Image.new('RGB',(525,730),'#101b22');dst.paste(im,(0,30))
 ImageDraw.Draw(dst).text((6,8),label,font=font,fill='#e6efef')
 return dst
def save(im,path,limit):
 for q in [88,82,76,70,64]:
  im.save(path,'WEBP',quality=q,method=6)
  if path.stat().st_size<=limit:return
 raise ValueError(path)
dest=base/'candidate';dest.mkdir(exist_ok=True)
for v in views:save(labeled(raw/'candidate'/(v+'.png'),f'PASS4 CANDIDATE | {v.upper()} | ACTUAL 3D'),dest/(v+'.webp'),250000)
board=Image.new('RGB',(525,1460),'#101b22')
board.paste(labeled(prior/'hero.png','A | RETAINED PASS1 | ACTUAL MATCHED HERO'),(0,0))
board.paste(labeled(raw/'candidate/hero.png','B | UNACCEPTED PASS4 | ACTUAL MATCHED HERO'),(0,730))
save(board,base/'matched-hero-board.webp',500000)
for n in ['tide-root-colossus-complete-pass4.glb','metrics-complete-pass4.json','validation.json']:
 shutil.copyfile(raw/'candidate'/n,base/n)
assert (base/'tide-root-colossus-complete-pass4.glb').stat().st_size<=1000000
met=json.loads((base/'metrics-complete-pass4.json').read_text())
assert met['sourceSHA256']==rec(base/'build_colossus_complete.py')['sha256']
val=json.loads((base/'validation.json').read_text())
assert val['sha256']==rec(base/'tide-root-colossus-complete-pass4.glb')['sha256']
assert not any(val[k] for k in ['boundaryEdges','nonmanifoldEdges','windingConflicts','zeroAreaTriangles','nonpositiveMeshVolumes'])
failure=base/'failed-initial'
for n in ['metrics-complete-pass4.json','validation.json']:shutil.copyfile(raw/'failed-initial/candidate'/n,failure/n)
save(labeled(raw/'failed-initial/candidate/hero.png','FAILED INITIAL | BURIED GROWTH / OPEN TOPOLOGY'),failure/'hero.webp',250000)
failedfiles=[p for p in (raw/'failed-initial').rglob('*') if p.is_file()]+[p for p in failure.iterdir() if p.is_file() and p.name!='closure.json']
write(failure/'closure.json',{'status':'Preserved failed construction; not final candidate or independent judgment','files':[rec(p) for p in sorted(failedfiles)]})
files=[prior/(v+'.png') for v in views]+[raw/'candidate'/(v+'.png') for v in views]
files += [raw/n for n in ['render.log','exit.txt','build.log','cameras.json']]
files += [raw/'candidate'/n for n in ['tide-root-colossus-complete-pass4.glb','metrics-complete-pass4.json','validation.json']]
write(base/'capture-receipt.json',{'status':'Actual pass4 matched against exact pinned pass1 frames, reused by reference','retainedBaseline':'complete-pass1','resolution':[525,700],'samples':16,'denoising':False,'viewTransform':'Standard','worldColor':[.12,.12,.12],'target':[0,0,2.9],'orthoScale':7.7,'lights':[{'name':'Key','position':[-4,-6,9],'energy':1500,'size':5},{'name':'Fill','position':[5,-3,5],'energy':850,'size':4},{'name':'Rim','position':[0,4,7],'energy':1800,'size':3}],'files':[rec(p) for p in files]})
source=[base/n for n in ['build_colossus_complete.py','construct_source.py','render_matched.py','validate_glb.py','package_evidence.py']]+[repo/'docs/reviews/colossus-complete-pass4-construction.md']
write(base/'source-closure.json',{'files':[rec(p) for p in source]})
files=[p for p in base.rglob('*') if p.is_file() and '__pycache__' not in str(p) and p.name!='final-closure.json']
binary=sum(p.stat().st_size for p in files if p.suffix in ('.webp','.glb','.jpg','.png'))
evidence=sum(p.stat().st_size for p in raw.rglob('*') if p.is_file())+sum(p.stat().st_size for p in files)
assert binary<=4000000,binary
assert evidence<=50*1024**2,evidence
write(base/'final-closure.json',{'status':'Frozen unaccepted static pass4; no author score','newBinaryBytes':binary,'totalNewEvidenceBytesExcludingThisReceipt':evidence,'preservedBaselinePins':16,'files':[rec(p) for p in sorted(files)]})
print(json.dumps({'binaryBytes':binary,'totalEvidenceBytes':evidence,'glb':rec(base/'tide-root-colossus-complete-pass4.glb'),'closure':rec(base/'final-closure.json')},indent=2))
