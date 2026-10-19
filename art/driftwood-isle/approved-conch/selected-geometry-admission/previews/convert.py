"""Delivery-only derivatives. Run with Python + Pillow; never changes sources.
Matches existing delivery convention: 720px LANCZOS, WebP quality84/method6.
No crop, retouch, reconstructed geometry, render, or source modification.
"""
from pathlib import Path
from io import BytesIO
import hashlib,json
from PIL import Image,ImageDraw,ImageFont,features,__version__
OUT=Path(__file__).resolve().parent
ROOT=OUT.parent
sha=lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
receipts=json.loads((ROOT/'capture-receipts.json').read_text())
freeze=json.loads((ROOT/'freeze.json').read_text())
originals=[x for x in receipts['files'] if x['path'].endswith('.png')]
assert len(originals)==20
for x in originals:
 p=ROOT/x['path']
 assert p.stat().st_size==x['bytes'] and sha(p)==x['sha256']
 assert freeze['files'][x['path']]['sha256']==x['sha256']

def encode(im,path,cap):
 for quality in [84,80,76,72,68,64,60]:
  b=BytesIO();im.save(b,format='WEBP',quality=quality,method=6)
  if len(b.getvalue())<=cap:
   path.parent.mkdir(exist_ok=True);path.write_bytes(b.getvalue())
   return {'path':str(path.relative_to(ROOT)),'bytes':path.stat().st_size,'sha256':sha(path),'dimensions':list(im.size),'quality':quality,'method':6}
 raise RuntimeError('Size cap exceeded; no oversized derivative written')

rows=[]
for x in originals:
 p=ROOT/x['path']
 with Image.open(p) as source:
  assert source.mode in ('RGB','RGBA')
  if source.mode=='RGBA': assert source.getextrema()[3]==(255,255),'Unexpected transparency'
  dims=list(source.size);im=source.convert('RGB')
 im.thumbnail((720,720),Image.Resampling.LANCZOS)
 target=OUT/Path(x['path']).parts[1]/(p.stem+'.webp')
 row=encode(im,target,250000)
 row.update({'source':x,'source_dimensions':dims,'operations':['RGB conversion (opaque source)','aspect-preserving LANCZOS resize to at most 720x720','lossy WebP encoding']})
 rows.append(row)

board=Image.new('RGB',(1440,820),(21,29,40));draw=ImageDraw.Draw(board)
font=ImageFont.load_default(size=24);small=ImageFont.load_default(size=18)
heroes=[]
for i,label in enumerate(['baseline','corrected']):
 p=ROOT/'captures'/label/'color-front.png'
 with Image.open(p) as source: im=source.convert('RGB')
 im.thumbnail((720,720),Image.Resampling.LANCZOS)
 x=i*720+(720-im.width)//2;y=60+(720-im.height)//2
 board.paste(im,(x,y));draw.text((i*720+22,18),label.upper()+' | matched hero',font=font,fill='white')
 heroes.append({'path':str(p.relative_to(ROOT)),'sha256':sha(p),'bytes':p.stat().st_size})
draw.text((22,790),'Delivery preview only | full frames, resized | original PNGs preserved',font=small,fill=(207,217,227))
boardrow=encode(board,OUT/'baseline-corrected-hero.webp',500000)
boardrow.update({'sources':heroes,'operations':['aspect-preserving LANCZOS resize to at most 720x720','side-by-side placement without cropping','labels outside image frames','lossy WebP encoding']})
manifest={'purpose':'Delivery derivatives only; not raw evidence or likeness approval','pillow_version':__version__,'libwebp_version':features.version('webp'),'converter_sha256':sha(Path(__file__)),'source_receipts_sha256':sha(ROOT/'capture-receipts.json'),'source_freeze_sha256':sha(ROOT/'freeze.json'),'previews':rows,'hero_comparison':boardrow}
(OUT/'provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
for x in originals: assert sha(ROOT/x['path'])==x['sha256']
size=sum(p.stat().st_size for p in OUT.rglob('*') if p.is_file())
assert size<1800000,size
print(json.dumps({'previews':len(rows),'preview_max_bytes':max(x['bytes'] for x in rows),'board_bytes':boardrow['bytes'],'total_directory_bytes':size,'all_raw_hashes_unchanged':True}))
