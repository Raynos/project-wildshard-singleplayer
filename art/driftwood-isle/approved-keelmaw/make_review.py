"""Actual source render/contact sheets, labelled separately from AI targets."""
import json,hashlib
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];RAW=ROOT/'tmp/keelmaw-v5';OUT=HERE/'v1';FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
def text(d,xy,s,size=17):d.text(xy,s,font=ImageFont.truetype(FONT,size),fill='white')
def fit(im,size):im=im.copy();im.thumbnail(size);return im
views=['front','left','right','back','top','elevated-front','elevated-left','elevated-right','elevated-back']
for name in ['hero']+views:
 im=Image.open(RAW/(name+'.png')).convert('RGB').resize((480,576));d=ImageDraw.Draw(im);d.rectangle((0,0,600,38),fill='#142331');text(d,(12,9),'ACTUAL SOURCE MODEL / '+name.upper(),17);im.save(OUT/(name+'.webp'),quality=65)
refdir=ROOT/'art/driftwood-isle/concepts/approved-nine-2026-10-19'
hero=Image.open(refdir/'keelmaw-hero.png').convert('RGB');board=Image.new('RGB',(1000,660),'#142331');d=ImageDraw.Draw(board);text(d,(15,10),'AI APPROVED HERO',20);text(d,(515,10),'ACTUAL MODEL / V1 / UNACCEPTED',18)
for x,im in [(0,hero),(500,Image.open(RAW/'hero.png'))]:im=fit(im,(500,600));board.paste(im,(x+(500-im.width)//2,45+(600-im.height)//2))
board.save(OUT/'paired-hero-board.webp',quality=70)
for kind,path in [('explorer',refdir/'keelmawExplorerCorrectedGen.png'),('world',refdir/'keelmawWorldGen.png')]:
 sheet=Image.open(path).convert('RGB');w,h=sheet.size;board=Image.new('RGB',(1200,1200),'#142331');d=ImageDraw.Draw(board);text(d,(15,10),'KEELMAW: AI '+kind.upper()+' TARGET | ACTUAL SOURCE MODEL',24)
 for i,name in enumerate(views):
  col=i%3;row=i//3;x=col*400;y=50+row*370
  # Current manifest panel geometry, reference camera category approximate.
  crop=sheet.crop((int(col*w/3),int((.04+row*.3033333333)*h),int((col+1)*w/3),int((.04+(row+1)*.3033333333)*h)))
  text(d,(x+8,y+4),f'{i+1:02d} {name.upper()}',16)
  for off,im in [(0,crop),(200,Image.open(RAW/(name+'.png')))]:
   im=fit(im,(196,310));board.paste(im,(x+off+(200-im.width)//2,y+45+(310-im.height)//2))
  text(d,(x+8,y+27),'AI TARGET',13);text(d,(x+208,y+27),'ACTUAL MODEL',13)
 text(d,(12,1175),'Source renders, not gameplay. Hidden reference surfaces and side cameras are inferred.',17);board.save(OUT/(kind+'-paired-nine-board.webp'),quality=65)
receipt={'renderSource':'build_keelmaw.py','rawDirectory':'tmp/keelmaw-v5','rawBytes':sum(p.stat().st_size for p in RAW.glob('*.png')),'referenceCameraCaveat':'Generated target panels approximate; actual model cameras are explicit orthographic angles. No native gameplay renders yet.','files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.glob('*.webp')}}
(OUT/'review-captures.json').write_text(json.dumps(receipt,indent=2)+'\n');(OUT/'cameras.json').write_bytes((RAW/'cameras.json').read_bytes())
