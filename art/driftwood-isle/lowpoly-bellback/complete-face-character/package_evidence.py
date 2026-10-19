"""Package actual rendered geometry stills with labels; no image synthesis."""
import hashlib,json,shutil
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[4]
here=Path(__file__).resolve().parent
scratch=root/'tmp/bellback-complete-face-character/final'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def label(im,text):
 im=im.convert('RGB');d=ImageDraw.Draw(im);d.rectangle((0,im.height-30,im.width,im.height),fill='#18242d');d.text((8,im.height-23),text,fill='white');return im
for kind in ['hero','nine']:
 folder=scratch/kind
 if not (folder/('capture-'+kind+'.json')).exists():continue
 r=json.loads((folder/('capture-'+kind+'.json')).read_text())
 for row in r['shots']:
  p=folder/(row['name']+'.png');assert sha(p)==row['image_sha256']
  label(Image.open(p),'Bellback face character | '+row['name']+' | STATIC WIP').save(here/(row['name']+'.webp'),quality=90)
 shutil.copyfile(folder/('capture-'+kind+'.json'),here/('capture-'+kind+'.json'))
shutil.copyfile(scratch/'hero/bellback-complete-face-character.glb',here/'bellback-complete-face-character.glb')
shutil.copyfile(scratch/'hero/metrics.json',here/'metrics.json')
shots=sorted(here.glob('0*.webp'))
if len(shots)==9:
 board=Image.new('RGB',(780,990),'#101b24')
 for i,p in enumerate(shots):
  im=Image.open(p);im.thumbnail((260,330));board.paste(im,((i%3)*260,(i//3)*330))
 board.save(here/'nine-view-board.webp',quality=90)
original=Image.open(root/'art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/bellback-lowpoly.webp').crop((20,325,508,940)).convert('RGB')
hero=Image.open(here/'hero.webp').crop((0,110,768,920))
board=Image.new('RGB',(800,1050),'#101b24')
for i,(im,title) in enumerate([(original,'Original approved concept'),(hero,'Actual face character | static WIP')]):
 im.thumbnail((800,490));board.paste(im,((800-im.width)//2,i*525+25));ImageDraw.Draw(board).text((20,i*525+8),title,fill='white')
board.save(here/'comparison-board.webp',quality=90)
paths=[p for p in here.iterdir() if p.is_file() and p.name!='closure.json']
(here/'closure.json').write_text(json.dumps({'status':'Frozen complete static evidence, independent review pending','files':[{'path':str(p.relative_to(root)),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(paths)]},indent=2)+'\n')
