"""Compose explicitly labelled portrait evidence; keeps full PNG renders under tmp."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import argparse
p=argparse.ArgumentParser();p.add_argument('--out',required=True);p.add_argument('--concept',required=True);a=p.parse_args();root=Path(a.out)
W,H=1200,1800;board=Image.new('RGB',(W,H),(9,19,28));draw=ImageDraw.Draw(board)
font_path='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
def font(size):return ImageFont.truetype(font_path,size)
def label(text,xy,size=24,color=(220,237,241)):draw.text(xy,text,font=font(size),fill=color)
def place(im,box):
    x,y,w,h=box;im=im.convert('RGB');im.thumbnail((w,h));board.paste(im,(x+(w-im.width)//2,y+(h-im.height)//2))
label('BRINE PUFFER / APPROVED TARGET COMPARISON',(35,28),35)
label('Real Blender geometry study. Not a game capture. Not accepted.',(35,83),24,(255,187,90))
concept=Image.open(a.concept);cw,ch=concept.size
concept=concept.crop((int(cw*.009),int(ch*.252),int(cw*.475),int(ch*.555)))
place(concept,(20,175,560,600));place(Image.open(root/'three-quarter.png'),(620,150,560,700))
label('OWNER-APPROVED CONCEPT',(25,132),25,(255,205,102));label('NEW MESH / THREE-QUARTER',(620,132),25)
for i,name in enumerate(['front','side','back']):
    x=15+i*395;label('REAL MESH / '+name.upper(),(x+10,900),23)
    place(Image.open(root/(name+'.png')),(x,945,380,600))
label('Review silhouette, face, plate overlaps, throat folds, fin anatomy.',(35,1625),25)
label('Renders prove geometry only; runtime and motion acceptance remain open.',(35,1680),23)
path=root/'puffer-comparison-board.webp'
for q in [90,85,80,75,70,65]:
    board.save(path,quality=q,method=6)
    if path.stat().st_size<=500000:break
assert path.stat().st_size<=500000
print(path, path.stat().st_size)
