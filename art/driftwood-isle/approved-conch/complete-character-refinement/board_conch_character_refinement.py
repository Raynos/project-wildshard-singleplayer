"""Label actual Conch CHARACTER REFINEMENT render evidence; no concept pixels enter model panels."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import argparse
p=argparse.ArgumentParser();p.add_argument('--out',default='tmp/conch-complete-character-refinement');a=p.parse_args()
r=Path(__file__).resolve().parents[4];out=r/a.out
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',19)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',15)
ref=Image.open(r/'art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/conch-duelist-lowpoly.webp').crop((20,300,495,965))
board=Image.new('RGB',(1000,1540),'#111b24');d=ImageDraw.Draw(board)
d.text((18,12),'CONCH / ORIGINAL + RETAINED PASS 2 + CHARACTER REFINEMENT',font=font,fill='white')
for im,x,label in [(ref,10,'ORIGINAL TARGET'),(Image.open(r/'tmp/conch-complete-pass2/color-front.png'),510,'RETAINED PASS 2')]:
 im.thumbnail((480,620));board.paste(im,(x+(480-im.width)//2,66));d.text((x+8,42),label,font=small,fill='white')
im=Image.open(out/'color-front.png');im.thumbnail((650,760));board.paste(im,((1000-im.width)//2,728))
d.text((18,704),'CHARACTER REFINEMENT / ACTUAL MODEL / UNACCEPTED',font=font,fill='#ffb17d')
d.text((18,1508),'Matched hero camera and lighting / no game or motion acceptance',font=small,fill='#90d9ea')
board.save(out/'comparison-character-refinement-board.webp',quality=83,method=6)
views=['front','left','right','back','top','diag-front','diag-left','diag-right','diag-back']
if all((out/f'color-character-refinement-{v}.png').exists() for v in views):
 board=Image.new('RGB',(1050,1595),'#111b24');d=ImageDraw.Draw(board)
 d.text((18,15),'CONCH CHARACTER REFINEMENT • ACTUAL NINE-VIEW GEOMETRY • +Y FRONT',font=font,fill='white')
 for i,v in enumerate(views):
  x=(i%3)*350;y=50+(i//3)*500;im=Image.open(out/f'color-character-refinement-{v}.png');im.thumbnail((344,463));board.paste(im,(x+(350-im.width)//2,y+28));d.text((x+10,y+4),v.upper(),font=font,fill='#90d9ea')
 d.text((18,1560),'Fixed half-dome / shared scale / studio render / independent review pending',font=small,fill='#ffb17d')
 board.save(out/'nine-view-character-refinement-board.webp',quality=83,method=6)
# Compact labelled copies for persistent review; original full PNGs stay untouched.
for name in ['color-front']+[f'color-character-refinement-{v}' for v in views]:
 im=Image.open(out/f'{name}.png').convert('RGB')
 panel=Image.new('RGB',(im.width,im.height+45),'#111b24');panel.paste(im,(0,45))
 dd=ImageDraw.Draw(panel);dd.text((10,12),'CONCH REFINEMENT / '+('HERO' if name=='color-front' else name.replace('color-character-refinement-','').upper()),font=small,fill='white')
 panel.save(out/f'{name}.webp',quality=84,method=6)
