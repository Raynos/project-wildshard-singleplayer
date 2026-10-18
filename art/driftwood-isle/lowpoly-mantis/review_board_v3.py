"""Assemble a labelled portrait evidence board from actual render and concept.
No generated replacement of render pixels. Run from repository root.
"""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFont
R=Path(__file__).resolve().parents[3]
fontpath='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
f=ImageFont.truetype(fontpath,23);small=ImageFont.truetype(fontpath,18)
b=Image.new('RGB',(900,1450),'#0b1722');d=ImageDraw.Draw(b)
d.text((24,15),'SPLINTER MANTIS / LOW-POLY STUDY V3',font=f,fill='#ccecf3')
d.text((24,52),'Actual 3D reconstruction vs revised AI concept',font=small,fill='#93b5c2')
target=Image.open(R/'art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/splinter-mantis-lowpoly.webp')
w,h=target.size;target=target.crop((int(w*5/1024),int(h*270/1536),int(w*505/1024),int(h*970/1536)))
actual=Image.open(R/'tmp/lowpoly-mantis/color-v3-front.png')
for x,im,label in [(20,target,'APPROVED TARGET / AI CONCEPT'),(460,actual,'ACTUAL V3 BLENDER RENDER')]:
 fitted=ImageOps.contain(im,(420,960));b.paste(fitted,(x+(420-fitted.width)//2,130+(960-fitted.height)//2))
 d.text((x,100),label,font=small,fill='#92e5ef')
d.text((24,1130),'Broad wood planes / thick leaf wings / four walking legs',font=small,fill='white')
d.text((24,1160),'Two hooked forearms / true segmented 3D anatomy',font=small,fill='white')
d.text((24,1240),'STUDY ONLY. Not game capture or human-approved quality.',font=small,fill='#ffc57c')
d.text((24,1270),'No runtime integration, animation or device performance claim.',font=small,fill='#a8bdc5')
b.save(R/'art/driftwood-isle/lowpoly-mantis/comparison-v3-board.webp',quality=88,method=6)
