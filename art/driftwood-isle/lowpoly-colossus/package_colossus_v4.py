"""Package completed actual renders without geometry, lighting, or framing edits."""
from pathlib import Path
import hashlib
import json
import shutil
from datetime import datetime, timezone
from PIL import Image, ImageDraw, ImageFont

base=Path(__file__).resolve().parent
repo=base.parents[2]
hero=repo/'tmp/colossus-v4'
nine=repo/'tmp/colossus-v4-nine'
views=['front','left','right','back','top','diag-front','diag-left','diag-right','diag-back']
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',14)
def record(p):
    return {'path':str(p.relative_to(repo)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
def labeled(path,label,width=None):
    im=Image.open(path).convert('RGB')
    if width:
        im=im.resize((width,round(im.height*width/im.width)),Image.Resampling.LANCZOS)
    out=Image.new('RGB',(im.width,im.height+32),'#101b22')
    out.paste(im,(0,32));ImageDraw.Draw(out).text((10,8),label,font=font,fill='#dfebee')
    return out

def save_webp(im,path,cap):
    for q in [85,80,75,70,65]:
        im.save(path,'WEBP',quality=q,method=6)
        if path.stat().st_size<=cap:return
    raise ValueError(f'{path.name} exceeds cap')

frozen=json.loads((base/'v4-source-closure.json').read_text())
assert all(record(repo/f['path'])['sha256']==f['sha256'] for f in frozen['files'])
assert (hero/'tide-root-colossus-v4.glb').read_bytes()==(nine/'tide-root-colossus-v4.glb').read_bytes()
assert 'Saved:' in (hero/'render.log').read_text()
assert (nine/'render.log').read_text().count('Saved:')==9
validation=json.loads((hero/'validation.json').read_text())
assert not any(validation[k] for k in ('boundaryEdges','nonmanifoldEdges','windingConflicts','zeroAreaTriangles','nonpositiveMeshVolumes'))
assert validation['sha256']==record(hero/'tide-root-colossus-v4.glb')['sha256']
save_webp(labeled(hero/'three-quarter.png','COLOSSUS V4 | ACTUAL 3D STUDY | THREE-QUARTER'),base/'v4-hero.webp',250000)
board=Image.new('RGB',(1350,1896),'#101b22')
for i,v in enumerate(views):
    p=nine/f'color-v4-{v}.png'
    label=f'COLOSSUS V4 | ACTUAL 3D | {v.upper()}'
    save_webp(labeled(p,label),base/f'v4-{i+1:02}-{v}.webp',250000)
    board.paste(labeled(p,label,450),((i%3)*450,(i//3)*632))
save_webp(board,base/'v4-nine-board.webp',500000)
for src,name in [(hero/'tide-root-colossus-v4.glb','tide-root-colossus-v4.glb'),(hero/'metrics-v4.json','metrics-v4.json'),(hero/'validation.json','validation-v4.json'),(nine/'cameras-v4.json','cameras-v4.json')]:
    shutil.copyfile(src,base/name)
raw=[hero/'three-quarter.png']+[nine/f'color-v4-{v}.png' for v in views]+[hero/'render.log',nine/'render.log',hero/'tide-root-colossus-v4.glb',nine/'tide-root-colossus-v4.glb']
receipt={'status':'Actual V4 hero and full canonical nine captured; independent likeness review pending','capturedUTC':datetime.now(timezone.utc).isoformat(),'heroExit':0,'nineExit':0,'geometryAuditExit':0,'heroAndNineGLBIdentical':True,'sourceSHA256':record(base/'build_colossus_v4.py')['sha256'],'rendererSHA256':record(base/'render_colossus_v4_nine.py')['sha256'],'files':[record(p) for p in raw]}
(base/'v4-capture-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
old=json.loads((base/'v3-final-closure.json').read_text())
assert all(record(repo/f['path'])['sha256']==f['sha256'] for f in old['files'])
paths=sorted(set(base.glob('*v4*'))|{repo/'docs/reviews/colossus-v4-construction.md'})
closure={'status':'V4 sources and actual static evidence frozen; independent review pending','capturedUTC':datetime.now(timezone.utc).isoformat(),'V3PreservationMismatches':[],'scope':'No changes to playable, runtime assets, animation, Site or Mac','files':[record(p) for p in paths if p.is_file() and p.name!='v4-final-closure.json']}
(base/'v4-final-closure.json').write_text(json.dumps(closure,indent=2)+'\n')
print(json.dumps({'files':len(closure['files']),'bytes':sum(f['bytes'] for f in closure['files']),'closureSHA256':record(base/'v4-final-closure.json')['sha256']},indent=2))
