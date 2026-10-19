"""Label actual V6 pixels and approved reference; no target generation or repainting."""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFont
import argparse
p=argparse.ArgumentParser();p.add_argument('--out',default='tmp/mantis-v6');p.add_argument('--nine-dir',default='tmp/mantis-v6-nine');a=p.parse_args()
r=Path(__file__).resolve().parents[3];out=r/a.out
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
f=ImageFont.truetype(font,24);sm=ImageFont.truetype(font,17)
def text(d,xy,t,small=False):d.text(xy,t,font=sm if small else f,fill='#d6ebef')
target=Image.open(r/'art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/splinter-mantis-lowpoly.webp').crop((5,270,505,970))
front=Image.open(out/'color-v6-front.png')
b=Image.new('RGB',(960,1340),'#0b1722');d=ImageDraw.Draw(b)
text(d,(20,18),'SPLINTER MANTIS / ACTUAL V6 STUDY')
text(d,(20,56),'Original approved concept is the authority. Model remains unaccepted.',True)
for x,im,label in [(15,target,'APPROVED CONCEPT'),(490,front,'ACTUAL V6 / COMPLETE BOUNDS')]:
 text(d,(x,108),label,True);im=ImageOps.contain(im,(450,1040));b.paste(im,(x+(450-im.width)//2,155+(1040-im.height)//2))
text(d,(20,1220),'Source-authored closed geometry. No painted cards or image edits.',True)
text(d,(20,1250),'Not gameplay. Rig, animation, combat and phone performance untested.',True)
b.save(out/'comparison-v6-board.webp',quality=88,method=6)
p=Image.new('RGB',(front.width,front.height+65),'#0b1722');p.paste(front,(0,65));text(ImageDraw.Draw(p),(15,18),'MANTIS / ACTUAL V6 / UNACCEPTED');p.save(out/'actual-v6-preview.webp',quality=87,method=6)
nine=r/a.nine_dir
views=['front','left','right','back','top','diag-front','diag-left','diag-right','diag-back']
if all((nine/f'color-v6-{v}.png').exists() for v in views):
 b=Image.new('RGB',(1170,1790),'#0b1722');d=ImageDraw.Draw(b);text(d,(20,15),'MANTIS V6 / NINE ACTUAL 3D VIEWS')
 for i,v in enumerate(views):
  x=(i%3)*390;y=65+(i//3)*555
  im=ImageOps.contain(Image.open(nine/f'color-v6-{v}.png'),(380,510));b.paste(im,(x+(390-im.width)//2,y+35+(510-im.height)//2));text(d,(x+10,y+8),v.upper(),True)
 text(d,(20,1740),'Original concept governs likeness; hidden anatomy is an interpretation.',True)
 b.save(out/'nine-view-v6-board.webp',quality=87,method=6)
