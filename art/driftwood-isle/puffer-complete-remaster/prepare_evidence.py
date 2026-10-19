"""Save size-capped actual captures; lossless geometry/camera provenance retained."""
import hashlib,json
from pathlib import Path
from PIL import Image,ImageDraw
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];RAW=ROOT/'tmp/puffer-complete-remaster/matched'
r=json.loads((RAW/'capture-receipt.json').read_text())
if len(r['captures'])!=20 or r['status']!='All twenty actual matched captures completed':raise RuntimeError('Incomplete actual capture run')
manifest=[]
for c in r['captures']:
 src=RAW/c['filename']
 if hashlib.sha256(src.read_bytes()).hexdigest()!=c['sha256']:raise RuntimeError('Raw capture changed')
 dest=HERE/(src.stem+'.webp')
 if dest.exists():raise RuntimeError('Existing evidence must not be overwritten')
 with Image.open(src) as im:im.convert('RGB').save(dest,'WEBP',quality=88,method=6)
 if dest.stat().st_size>250000:raise RuntimeError('Preview exceeds storage cap')
 manifest.append({**c,'preview':str(dest.relative_to(ROOT)),'previewSha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'bytes':dest.stat().st_size})
board=Image.new('RGB',(600,420),(35,35,35));draw=ImageDraw.Draw(board)
for j,variant in enumerate(['v71','complete']):
 with Image.open(RAW/f'{variant}-hero.png') as im:board.paste(im.convert('RGB').resize((300,370)),(j*300,25))
 draw.text((j*300+12,8),'V71 retained baseline' if j==0 else 'Complete static study',(255,255,255))
draw.text((12,402),'Actual matched Blender captures; no runtime admission',(255,255,255))
board.save(HERE/'hero-comparison-board.webp','WEBP',quality=88,method=6)
assert (HERE/'hero-comparison-board.webp').stat().st_size<500000
with (HERE/'capture-receipt.json').open('x') as f:json.dump(r,f,indent=2);f.write('\n')
with (HERE/'evidence-manifest.json').open('x') as f:json.dump({'captures':manifest,'rawRetained':'tmp/puffer-complete-remaster/matched','conversion':'RGB WebP quality 88; full captures unchanged 600x740; board is labelled paired hero overview','runtimeAdmitted':False},f,indent=2);f.write('\n')
print('Saved twenty actual frames plus paired hero board')
