"""V3 landmark review. Labels only: never modifies the model render."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json
root=Path(__file__).resolve().parents[3];here=Path(__file__).resolve().parent
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',15)
ref=Image.open(root/'art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/bellback-lowpoly.webp').convert('RGB');render=Image.open(root/'tmp/lowpoly-bellback/bellback-v3-front.png').convert('RGB')
data=json.loads((root/'tmp/lowpoly-bellback/landmarks-v3-front.json').read_text())
# Hand-picked concept landmarks are approximate visible pixels, not recovered 3D.
target={'bell_crown':(274,447),'mouth_left':(197,631),'mouth_right':(420,589),'clapper':(323,637),'nose':(405,765),'fore_left':(206,892),'fore_right':(477,862),'stern_tip':(183,351)}
keys=['bell_crown','clapper','nose','stern_tip']
for im,is_ref in [(ref,True),(render,False)]:
 d=ImageDraw.Draw(im)
 for i,key in enumerate(keys,1):
  if is_ref:x,y=target[key];x*=im.width/1024;y*=im.height/1536
  else:x,y=data['projected'][key];x*=im.width;y=(1-y)*im.height
  d.ellipse((x-7,y-7,x+7,y+7),outline='#fff499',width=2);d.text((x+8,y-10),str(i),font=font,fill='#fff499')
ref=ref.crop((0,int(ref.height*.215),int(ref.width*.5),int(ref.height*.61)))
board=Image.new('RGB',(1000,1140),'#13232e');d=ImageDraw.Draw(board)
for im,x in [(ref,0),(render,500)]:
 im.thumbnail((490,900));board.paste(im,(x+(500-im.width)//2,110+(900-im.height)//2))
d.text((20,20),'BELLBACK V3 | LANDMARK COMPARISON',font=font,fill='white')
d.text((20,60),'Approved AI target',font=font,fill='#c8dddf');d.text((520,60),'Actual mesh render | not accepted',font=font,fill='#c8dddf')
for i,line in enumerate(['1 Bell crown   2 Physical clapper   3 Nose   4 Tall stern tip','Camera is manually estimated; full 3D, no silhouette warping.','Unrigged. Four-view and real runtime checks still required.']):d.text((20,1030+i*30),line,font=small,fill='white')
board.save(here/'comparison-board-v3.webp',quality=86,method=6)
Image.open(root/'tmp/lowpoly-bellback/bellback-v3-front.png').convert('RGB').save(here/'bellback-study-v3-front.webp',quality=84,method=6)
