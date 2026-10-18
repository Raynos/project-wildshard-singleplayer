"""Label actual mesh render beside the owner-approved AI target; no visual model edits."""
from pathlib import Path
import argparse
p=argparse.ArgumentParser();p.add_argument('--version',choices=['v1','v2'],default='v2');a=p.parse_args();tag='' if a.version=='v1' else '-v2'
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[3];folder=Path(__file__).resolve().parent
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18)
board=Image.new('RGB',(1000,1140),'#13232e');d=ImageDraw.Draw(board)
def panel(path,box,crop=None):
 im=Image.open(path).convert('RGB')
 if crop:im=im.crop(crop)
 im.thumbnail((box[2]-box[0],box[3]-box[1]));board.paste(im,(box[0]+(box[2]-box[0]-im.width)//2,box[1]+(box[3]-box[1]-im.height)//2))
reference=root/'art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/bellback-lowpoly.webp'
im=Image.open(reference);w,h=im.size
panel(reference,(0,85,500,1030),(0,int(h*.19),int(w*.5),int(h*.67)))
panel(root/'tmp/lowpoly-bellback'/('bellback'+tag+'-front.png'),(500,85,1000,1030))
d.text((20,20),'BELLBACK | TARGET AND REAL 3D STUDY',font=font,fill='white');d.text((20,55),'Approved AI target',font=font,fill='#c8dddf');d.text((520,55),'Actual Blender '+a.version+' | WIP, unaccepted',font=font,fill='#c8dddf');d.text((20,1050),'Real hollow bell, clapper, timber frame and four legs.',font=font,fill='white');d.text((20,1080),'Unrigged source study. No runtime or combat acceptance claimed.',font=font,fill='white')
board.save(folder/('comparison-board-'+a.version+'.webp'),quality=85,method=6)
Image.open(root/'tmp/lowpoly-bellback'/('bellback'+tag+'-front.png')).convert('RGB').save(folder/('bellback-study-'+a.version+'-front.webp'),quality=83,method=6)
