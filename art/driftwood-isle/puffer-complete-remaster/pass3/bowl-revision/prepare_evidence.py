"""Save size-capped actual captures; lossless geometry/camera provenance retained."""
import hashlib,json
from pathlib import Path
from PIL import Image,ImageDraw
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[4];RAW=ROOT/'tmp/puffer-complete-pass3/bowl-revision'
r=json.loads((RAW/'capture-receipt.json').read_text())
if len(r['captures'])!=20 or r['status']!='All twenty actual matched captures completed':raise RuntimeError('Incomplete actual capture run')
manifest=[]
for c in r['captures']:
 src=RAW/c['filename']
 if hashlib.sha256(src.read_bytes()).hexdigest()!=c['sha256']:raise RuntimeError('Raw capture changed')
 dest=HERE/(src.stem+'.webp')
 if dest.exists():raise RuntimeError('Existing evidence must not be overwritten')
 with Image.open(src) as im:
  im=im.convert('RGB');d=ImageDraw.Draw(im);d.rectangle((0,0,600,23),fill=(25,30,35));d.text((8,6),src.stem+' | Actual static bind capture',fill=(255,255,255));im.save(dest,'WEBP',quality=88,method=6)
 if dest.stat().st_size>250000:raise RuntimeError('Preview exceeds storage cap')
 manifest.append({**c,'preview':str(dest.relative_to(ROOT)),'previewSha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'bytes':dest.stat().st_size})
board=Image.new('RGB',(600,800),(35,35,35));draw=ImageDraw.Draw(board)
for row,view in enumerate(['hero','02-left']):
 for j,variant in enumerate(['pass2','pass3']):
  with Image.open(RAW/f'{variant}-{view}.png') as im:board.paste(im.convert('RGB').resize((300,370)),(j*300,row*390+24))
  draw.text((j*300+10,row*390+7),('Pass2 retained' if j==0 else 'Pass3 static')+' | '+view,(255,255,255))
draw.text((12,785),'Actual matched captures | Static study only',(255,255,255))
board.save(HERE/'hero-comparison-board.webp','WEBP',quality=88,method=6)
assert (HERE/'hero-comparison-board.webp').stat().st_size<500000
for variant in ['pass2','pass3']:
 sheet=Image.new('RGB',(600,800),(35,35,35));d=ImageDraw.Draw(sheet)
 views=[c['view'] for c in r['captures'] if c['variant']==variant and c['view']!='hero']
 for i,view in enumerate(views):
  x=(i%3)*200;y=(i//3)*263
  with Image.open(RAW/f'{variant}-{view}.png') as im:sheet.paste(im.convert('RGB').resize((200,247)),(x,y+16))
  d.text((x+4,y+2),variant+' '+view,(255,255,255))
 sheet.save(HERE/f'{variant}-nine-view-sheet.webp','WEBP',quality=90,method=6)
with (HERE/'capture-receipt.json').open('x') as f:json.dump(r,f,indent=2);f.write('\n')
with (HERE/'evidence-manifest.json').open('x') as f:json.dump({'captures':manifest,'rawRetained':'tmp/puffer-complete-pass3/bowl-revision','conversion':'RGB WebP quality 88; full captures unchanged 600x740; board is labelled paired hero/side overview; nine-view contact sheets are overviews only','runtimeAdmitted':False},f,indent=2);f.write('\n')
print('Saved twenty actual frames plus paired hero board')
